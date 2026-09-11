// Yaş Grupları ekranı — tüm durumlar, GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/yas-gruplari-e2e.cjs <userDataDizini> [ekranGoruntusuDizini]
// Durumlar: varsayılan liste (aktif sezon + yalnız aktif gruplar), aktif oyuncu sayısı (pasif oyuncu sayılmaz), program özeti,
// "Pasif grupları da göster", durum rozetiyle Aktif↔Pasif, Grup Ekle (düğme, Enter, boş ad kapalı), sonraki sezona grup
// ekleyince süzgecin o sezona geçmesi ve "(gelecek)" etiketi, sezon süzgeci (eski sezon "(eski)"), Düzenle (ad/sıra/program/
// sezon) + Vazgeç, Sil (oyuncusu olan grup silinemez, boş grup silinir). Çıktıda "TUM KONTROLLER GECTI" aranır.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const [dizin, shotDir] = process.argv.slice(2);
app.setPath("userData", dizin);
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
const db = require("../../electron/db.cjs");
require("../../electron/main.cjs");
let basladi = false;

app.on("browser-window-created", async (_e, win) => {
  if (basladi) return;
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const shot = async (ad) => {
      if (!shotDir) return;
      fs.writeFileSync(path.join(shotDir, ad + ".png"), (await win.webContents.capturePage()).toPNG());
    };
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim() === ${JSON.stringify(metin)}) || [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok/kapalı: " + metin);
      await bekle(450);
    };
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
      );
    const sec = (sel, deger) =>
      js(
        `(() => { const s = document.querySelector(${JSON.stringify(sel)}); if (!s) return false; s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`,
      );
    const gruplar = () => js(`[...document.querySelectorAll("table tbody tr")].map((tr) => tr.cells[1]?.textContent.trim())`);
    const satir = (ad) =>
      js(
        `([...document.querySelectorAll("table tbody tr")].find((tr) => tr.cells[1]?.textContent.trim() === ${JSON.stringify(ad)})?.textContent) || ""`,
      );
    const satirDugme = async (ad, dugme) => {
      const ok = await js(
        `(() => { const tr = [...document.querySelectorAll("table tbody tr")].find((t) => t.cells[1]?.textContent.trim() === ${JSON.stringify(ad)}); const b = tr && [...tr.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(dugme)}); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error(`Satır düğmesi yok: ${ad} / ${dugme}`);
      await bekle(450);
    };
    const bekleListe = async (beklenen) => {
      const hedef = [...beklenen].join(",");
      let son = "";
      for (let i = 0; i < 25; i++) {
        son = (await gruplar()).join(",");
        if (son === hedef) return { ok: true, son };
        await bekle(200);
      }
      return { ok: false, son };
    };
    const liste = async (ad, beklenen) => {
      const r = await bekleListe(beklenen);
      check(ad, r.ok, `liste: [${r.son}] beklenen [${beklenen.join(",")}]`);
    };
    const ozet = () =>
      js(`[...document.querySelectorAll("span")].map((x) => x.textContent.trim()).find((t) => /^\\d+ grup/.test(t)) || ""`);

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(500);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "grup-test-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Tohum ──
    const bugun = new Date();
    const y = bugun.getFullYear(),
      m = bugun.getMonth() + 1;
    const sezon = m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    const sonraki = `${Number(sezon.slice(0, 4)) + 1}-${Number(sezon.slice(5)) + 1}`;
    const eskiSezon = `${Number(sezon.slice(0, 4)) - 1}-${Number(sezon.slice(5)) - 1}`;
    db.setSetting("aktif_sezon", sezon);
    const u11 = db.createAgeGroup({ ad: "U11", sezon, sira: 1 });
    const u12 = db.createAgeGroup({ ad: "U12", sezon, sira: 2 });
    db.updateAgeGroup(u12.id, { program: [{ gun: 2, saat: "18:00", saha: "Saha 1" }] });
    const u9 = db.createAgeGroup({ ad: "U9", sezon, sira: 3 });
    db.updateAgeGroup(u9.id, { aktif: 0 });
    db.createAgeGroup({ ad: "Eski Grup", sezon: eskiSezon, sira: 1 });
    const P = (ad, grup, durum) =>
      db.createPlayer({
        ad_soyad: ad,
        dogum_tarihi: "2015-01-01",
        yas_grubu_id: grup,
        durum,
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        odeme_donemi: "1-10",
      });
    P("A Aktif", u11.id, "aktif");
    P("B Deneme", u11.id, "deneme");
    P("C Pasif", u11.id, "pasif");
    P("D Sakat", u12.id, "sakat");

    await js(`document.querySelector("button[aria-label='Yaş Grupları']").click()`);
    await bekle(800);

    // 1) Varsayılan liste
    await liste("varsayılan: aktif sezonun aktif grupları (pasif U9 ve eski sezonun grubu yok)", ["U11", "U12"]);
    check("sezon süzgeci aktif sezonda", (await js(`document.querySelector("select[aria-label='Sezon süzgeci']").value`)) === sezon);
    check(
      "süzgeç seçeneği '(aktif sezon)' etiketli",
      /\(aktif sezon\)/.test(await js(`document.querySelector("select[aria-label='Sezon süzgeci']").selectedOptions[0].textContent`)),
    );
    check("özet: 2 grup · 1 gizli", /2 grup · 1 gizli/.test(await ozet()), await ozet());
    check(
      "U11 aktif oyuncu sayısı 2 (pasif oyuncu sayılmaz)",
      /U11.*2/.test((await satir("U11")).replace(/\s+/g, "")) && !/3/.test((await satir("U11")).replace(sezon, "")),
      await satir("U11"),
    );
    check(
      "U12 program özeti 'Sal 18:00', 1 aktif oyuncu",
      /Sal 18:00/.test(await satir("U12")) && /U12.*1/.test((await satir("U12")).replace(sezon, "")),
      await satir("U12"),
    );
    check("U11'de program yok → '—'", /—/.test(await satir("U11")));
    await shot("01-varsayilan");

    // 2) Pasif grupları göster / durum rozeti
    const kutu = (ac) =>
      js(
        `(() => { const i = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Pasif grupları da göster"))?.querySelector("input"); if (!i) return "yok"; if (i.checked !== ${ac}) i.click(); return i.checked; })()`,
      );
    const kutuVar = () => js(`!![...document.querySelectorAll("label")].find((l) => l.textContent.includes("Pasif grupları da göster"))`);
    await kutu(true);
    await liste("'Pasif grupları da göster (1)' → U9 Pasif rozetiyle gelir", ["U11", "U12", "U9"]);
    check(
      "U9 satırında Pasif rozeti",
      /Pasif/.test(await satir("U9")) && !!(await js(`!!document.querySelector("button[aria-label='U9 durum: Pasif']")`)),
    );
    await shot("02-pasifler-gosteriliyor");
    await js(`document.querySelector("button[aria-label='U9 durum: Pasif']").click()`);
    await bekle(600);
    check(
      "rozete tıklayınca U9 aktif olur (toast, rozet Aktif)",
      !!(await js(`!!document.querySelector("button[aria-label='U9 durum: Aktif']")`)) &&
        /U9 aktif/.test(await js(`document.body.textContent`)),
    );
    check("pasif kalmayınca 'Pasif grupları da göster' kutusu kaybolur", !(await kutuVar()));
    await js(`document.querySelector("button[aria-label='U12 durum: Aktif']").click()`);
    await bekle(600);
    // Kutu daha önce işaretlenmişti: pasife alınan U12 listede kalır (Pasif rozeti), kutu işaretli olarak geri gelir
    check(
      "U12 pasife alındı: toast, Pasif rozeti, kutu işaretli görünür",
      /U12 pasife alındı/.test(await js(`document.body.textContent`)) &&
        !!(await js(`!!document.querySelector("button[aria-label='U12 durum: Pasif']")`)) &&
        (await kutuVar()),
    );
    await kutu(false);
    await liste("kutu kapatılınca pasif U12 listeden düşer", ["U11", "U9"]);
    check("özet: 2 grup · 1 gizli (U12)", /2 grup · 1 gizli/.test(await ozet()), await ozet());
    await kutu(true);
    await bekleListe(["U11", "U12", "U9"]);
    await js(`document.querySelector("button[aria-label='U12 durum: Pasif']").click()`);
    await bekle(600);
    await liste("U12 yeniden aktif; kutu kaybolur; üçü listede", ["U11", "U12", "U9"]);
    check("özet: 3 grup, gizli yok", /^3 grup$/.test(await ozet()) && !(await kutuVar()), await ozet());

    // 3) Grup Ekle
    check(
      "boş adla 'Grup Ekle' kapalı",
      await js(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Grup Ekle").disabled`),
    );
    await setInput('input[placeholder="U11"]', "U13");
    await tikla("Grup Ekle");
    await liste("Grup Ekle: U13 aktif sezonda listede", ["U11", "U12", "U9", "U13"]);
    check(
      "ekle sonrası ad kutusu boşalır, toast 'Grup eklendi'",
      (await js(`document.querySelector('input[placeholder="U11"]').value`)) === "" &&
        /Grup eklendi/.test(await js(`document.body.textContent`)),
    );
    check(
      "U13 sezonu aktif sezon, etiket yok",
      new RegExp(`U13${sezon}`).test((await satir("U13")).replace(/\s+/g, "")) && !/gelecek|eski/.test(await satir("U13")),
    );
    await setInput('input[placeholder="U11"]', "U15");
    await js(
      `document.querySelector('input[placeholder="U11"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`,
    );
    await liste("Enter ile ekleme: U15", ["U11", "U12", "U9", "U13", "U15"]);
    await shot("03-grup-eklendi");
    // Sonraki sezona grup: form sezon kutusu sonraki sezon → süzgeç o sezona geçer, "(gelecek)"
    const formSezon = `[...document.querySelectorAll("select[aria-label='Sezon']")].at(0)`;
    check(
      "form sezon kutusu: aktif + sonraki sezon seçenekleri",
      (await js(`${formSezon}.options.length`)) === 2 && (await js(`${formSezon}.options[1].value`)) === sonraki,
    );
    await js(
      `(() => { const s = ${formSezon}; s.value = ${JSON.stringify(sonraki)}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await setInput('input[placeholder="U11"]', "U14");
    await tikla("Grup Ekle");
    await liste("sonraki sezona U14: süzgeç sonraki sezona geçer, yalnız U14 listede", ["U14"]);
    check(
      "süzgeç sonraki sezonda, U14 '(gelecek)' etiketli",
      (await js(`document.querySelector("select[aria-label='Sezon süzgeci']").value`)) === sonraki &&
        /\(gelecek\)/.test(await satir("U14")),
    );
    check("form sezon kutusu yine aktif sezona döner", (await js(`${formSezon}.value`)) === sezon);
    await shot("04-sonraki-sezon");

    // 4) Sezon süzgeci
    await sec("select[aria-label='Sezon süzgeci']", sezon);
    await liste("aktif sezona dönünce U14 yok", ["U11", "U12", "U9", "U13", "U15"]);
    check(
      "süzgeçte eski sezon seçeneği var",
      await js(
        `[...document.querySelector("select[aria-label='Sezon süzgeci']").options].some((o) => o.value === ${JSON.stringify(eskiSezon)})`,
      ),
    );
    await sec("select[aria-label='Sezon süzgeci']", eskiSezon);
    await liste("eski sezon: yalnız 'Eski Grup'", ["Eski Grup"]);
    check(
      "'(eski)' etiketi; salt okunur değil, Düzenle/Sil var",
      /\(eski\)/.test(await satir("Eski Grup")) && /Düzenle/.test(await satir("Eski Grup")),
    );
    await shot("05-eski-sezon");
    await sec("select[aria-label='Sezon süzgeci']", sezon);
    await bekleListe(["U11", "U12", "U9", "U13", "U15"]);

    // 5) Düzenle + Vazgeç
    await satirDugme("U12", "Düzenle");
    check(
      "düzenleme satırı: ad kutusu, Aktif onay kutusu, program alanları",
      (await js(`[...document.querySelectorAll("table tbody input")].some((i) => i.value === "U12")`)) &&
        (await js(`!!document.querySelector("input[aria-label='Pazartesi saati']")`)),
    );
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = [...document.querySelectorAll("table tbody input")].find((x) => x.value === "U12"); set.call(i, "U12 DEĞİŞMEMELİ"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await satirDugme("U12 DEĞİŞMEMELİ", "Vazgeç").catch(async () => {
      await tikla("Vazgeç");
    });
    await liste("Vazgeç: değişiklik kaydedilmedi", ["U11", "U12", "U9", "U13", "U15"]);
    await satirDugme("U11", "Düzenle");
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const g = (v) => { const i = [...document.querySelectorAll("table tbody input")].find((x) => x.value === v); return i; }; const ad = g("U11"); set.call(ad, "U11 A"); ad.dispatchEvent(new Event("input", { bubbles: true })); const sira = g("1"); set.call(sira, "9"); sira.dispatchEvent(new Event("input", { bubbles: true })); const saat = document.querySelector("input[aria-label='Pazartesi saati']"); set.call(saat, "17:30"); saat.dispatchEvent(new Event("input", { bubbles: true })); const saha = document.querySelector("input[aria-label='Pazartesi sahası']"); set.call(saha, "Saha 2"); saha.dispatchEvent(new Event("input", { bubbles: true })); const bitis = document.querySelector("input[aria-label='Pazartesi bitişi']"); set.call(bitis, "17:00"); bitis.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    // plan §37: bitiş başlangıçtan önce → satırda uyarı, Kaydet kapalı
    check(
      "program bitişi başlangıçtan önce → 'Bitiş başlangıçtan sonra olmalı' ve Kaydet kapalı",
      /Bitiş başlangıçtan sonra olmalı/.test(await js(`document.querySelector("table tbody [role=alert]")?.textContent || ""`)) &&
        (await js(
          `[...document.querySelectorAll("table tbody tr")].find((tr) => tr.querySelector("input"))?.querySelector("button[disabled]")?.textContent.trim()`,
        )) === "Kaydet",
    );
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const bitis = document.querySelector("input[aria-label='Pazartesi bitişi']"); set.call(bitis, "19:00"); bitis.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    check(
      "bitiş düzelince '90 dk' süresi görünür",
      /90 dk/.test(await js(`document.querySelector("table tbody tr input[aria-label='Pazartesi bitişi']").closest("tr").textContent`)),
    );
    await shot("06-duzenle");
    await tikla("Kaydet", '[...document.querySelectorAll("table tbody tr")].find((tr) => tr.querySelector("input"))');
    await liste("Düzenle+Kaydet: ad 'U11 A', sıra 9 → listenin sonuna", ["U12", "U9", "U13", "U15", "U11 A"]);
    check(
      "program özeti 'Pzt 17:30–19:00'; sıra 9",
      /Pzt 17:30–19:00/.test(await satir("U11 A")) &&
        /^9/.test(
          await js(
            `[...document.querySelectorAll("table tbody tr")].find((tr) => tr.cells[1]?.textContent.trim() === "U11 A").cells[0].textContent.trim()`,
          ),
        ),
    );
    check(
      "veritabanı: program ve ad kaydedildi",
      (() => {
        const g = db.listAgeGroups().find((x) => x.id === u11.id);
        return g.ad === "U11 A" && g.sira === 9 && /17:30/.test(g.program || "") && /"bitis":"19:00"/.test(g.program || "");
      })(),
    );
    // plan §37: kayıtlı bitiş Düzenle'de dolu gelir; ikinci gün eklenince özet iki günü aralıklarıyla sıralar;
    // bitiş temizlenince özet yalnız başlangıcı gösterir ve program JSON'da bitiş boş kalır
    await satirDugme("U11 A", "Düzenle");
    check(
      "Düzenle: kayıtlı başlangıç/bitiş/saha dolu gelir",
      (await js(`document.querySelector("input[aria-label='Pazartesi saati']").value`)) === "17:30" &&
        (await js(`document.querySelector("input[aria-label='Pazartesi bitişi']").value`)) === "19:00" &&
        (await js(`document.querySelector("input[aria-label='Pazartesi sahası']").value`)) === "Saha 2",
    );
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const g = (sel, v) => { const i = document.querySelector(sel); set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); }; g("input[aria-label='Çarşamba saati']", "17:00"); g("input[aria-label='Çarşamba bitişi']", "18:30"); g("input[aria-label='Çarşamba sahası']", "Saha 1"); g("input[aria-label='Pazartesi bitişi']", ""); })()`,
    );
    check(
      "bitiş silinince Pazartesi satırında süre yok, Çarşamba '90 dk'; Kaydet açık",
      !/Bitiş başlangıçtan sonra olmalı/.test(await js(`document.querySelector("table tbody")?.textContent || ""`)) &&
        /90 dk/.test(await js(`document.querySelector("input[aria-label='Çarşamba bitişi']").closest("tr").textContent`)) &&
        !(await js(
          `[...document.querySelectorAll("table tbody tr")].find((tr) => tr.querySelector("input"))?.querySelector("button[disabled]")`,
        )),
    );
    await tikla("Kaydet", '[...document.querySelectorAll("table tbody tr")].find((tr) => tr.querySelector("input"))');
    check(
      "özet 'Pzt 17:30 · Çar 17:00–18:30' (bitişsiz gün yalnız başlangıç)",
      /Pzt 17:30 · Çar 17:00–18:30/.test(await satir("U11 A")),
      await satir("U11 A"),
    );
    check(
      "veritabanı: Pazartesi bitişi boş, Çarşamba bitişi 18:30",
      (() => {
        const pr = JSON.parse(db.listAgeGroups().find((x) => x.id === u11.id).program || "[]");
        return (
          pr.length === 2 && pr[0].gun === 1 && pr[0].bitis === "" && pr[1].gun === 3 && pr[1].bitis === "18:30" && pr[1].saha === "Saha 1"
        );
      })(),
    );
    // Düzenle ile sezonu sonraki sezona taşı (U13)
    await satirDugme("U13", "Düzenle");
    await js(
      `(() => { const s = [...document.querySelectorAll("table tbody select[aria-label='Sezon']")].at(0); s.value = ${JSON.stringify(sonraki)}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await tikla("Kaydet", '[...document.querySelectorAll("table tbody tr")].find((tr) => tr.querySelector("input"))');
    // Plan §21: grubun sezon üyeliği geçmiş olarak kalır → U13 bu sezonda da listelenir, artık "(gelecek)" etiketli
    await liste("U13 sezonu sonrakine taşındı: bu sezonda üyelik geçmişiyle kalır", ["U12", "U9", "U13", "U15", "U11 A"]);
    check("U13 '(gelecek)' etiketli", /\(gelecek\)/.test(await satir("U13")), await satir("U13"));
    await sec("select[aria-label='Sezon süzgeci']", sonraki);
    await liste("sonraki sezon: U14 ve U13", ["U13", "U14"]);
    await sec("select[aria-label='Sezon süzgeci']", sezon);
    await bekleListe(["U12", "U9", "U13", "U15", "U11 A"]);

    // 6) Sil
    await satirDugme("U11 A", "Sil");
    check(
      "silme onayı: grup adı ve uyarı",
      /"U11 A" grubunu silmek/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)),
    );
    await tikla("Evet", 'document.querySelector("[role=dialog]")');
    await bekle(400);
    check(
      "oyuncusu olan grup silinemez: hata toast'ı, satır duruyor",
      /Bu grupta 3 oyuncu var/.test(await js(`document.body.textContent`)) && (await gruplar()).includes("U11 A"),
    );
    await shot("07-sil-engellendi");
    await satirDugme("U15", "Sil");
    await tikla("Vazgeç", 'document.querySelector("[role=dialog]")');
    await bekle(300);
    check("silme Vazgeç: satır duruyor", (await gruplar()).includes("U15"));
    await satirDugme("U15", "Sil");
    await tikla("Evet", 'document.querySelector("[role=dialog]")');
    await liste("boş grup silinir (toast 'Grup silindi')", ["U12", "U9", "U13", "U11 A"]);
    check("veritabanından da silindi", !db.listAgeGroups().some((g) => g.ad === "U15"));
    await shot("08-son-liste");

    console.log(fail ? `${fail} KONTROL BASARISIZ` : "TUM KONTROLLER GECTI");
  } catch (e) {
    console.error("HATA:", e && e.stack ? e.stack : e);
    fail++;
  } finally {
    setTimeout(() => app.exit(fail ? 1 : 0), 300);
  }
});
