// Tahsilat ekranı — tüm durumlar, GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/tahsilat-durumlar.cjs <userDataDizini> [ekranGoruntusuDizini]
// Durumlar (plan §24 + eski akış): borçsuz oyuncu (bu ay seçili), elle 3 ay + makbuz (ayrı satırlar),
// eski borçlu (en eski borç seçili, "3 Ay" borçlardan başlar), ödenmiş aylar aralıktan atlanır ("6 Ay" → 6 satır,
// makbuzda tek özet satır), tümü ödenmişse Uygula kapalı, "Sezon Sonuna Kadar", kısmi ödeme (kalan), ücretsiz
// (muaf), makbuz iptali (aylar geri açılır), bugünkü tahsilat rozeti. Çıktıda "TUM KONTROLLER GECTI" aranır.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const [dizin, shotDir] = process.argv.slice(2);
app.setPath("userData", dizin);
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k) => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}`);
  if (!k) fail++;
};
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const ayEkle = (yil, ay, n) => {
  const t = yil * 12 + (ay - 1) + n;
  return { yil: Math.floor(t / 12), ay: (t % 12) + 1 };
};
const adi = (d) => `${AY[d.ay - 1]} ${d.yil}`;

require("../../electron/main.cjs");
let basladi = false;

app.on("browser-window-created", async (_e, win) => {
  if (basladi) return; // yazdırma/PDF penceresi de bu olayı tetikler
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
      );
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok/kapalı: " + metin);
      await bekle(450);
    };
    const shot = async (ad) => {
      if (!shotDir) return;
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(shotDir, ad + ".png"), img.toPNG());
    };
    const metin = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
    const toplam = () =>
      js(
        `(() => { const s = [...document.querySelectorAll("span")].find(x => x.textContent.trim() === "TOPLAM"); return s ? s.parentElement.textContent : ""; })()`,
      );
    const secilenAylar = () => js(`[...document.querySelectorAll("button[aria-pressed='true']")].map(b => b.getAttribute("aria-label"))`);
    const tutarKutusu = (ad) => js(`document.querySelector('input[aria-label=${JSON.stringify(ad + " aidat tutarı")}]')?.value ?? null`);
    const oyuncuSec = async (ad) => {
      if (!(await js(`!!document.querySelector('input[aria-label="Oyuncu ara"]')`))) await tikla("Değiştir");
      await setInput('input[aria-label="Oyuncu ara"]', ad);
      await bekle(500);
      const ok = await js(
        `(() => { const d = [...document.querySelectorAll("div")].find(x => (x.getAttribute("style") || "").includes("cursor: pointer") && x.textContent.includes(${JSON.stringify(ad)}) && x.querySelector("span")); if (!d) return false; d.click(); return true; })()`,
      );
      if (!ok) throw new Error("Arama sonucu yok: " + ad);
      await bekle(600);
    };
    const modalSec = async (hangi, deger) => {
      await js(
        `(() => { const s = document.querySelectorAll("[role=dialog] select")[${hangi}]; s.value = ${JSON.stringify(deger)}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(200);
    };
    const modalMetin = () => metin("[role=dialog]");
    const modalKapat = async () => {
      await tikla("Vazgeç", 'document.querySelector("[role=dialog]")');
    };
    const db = require("../../electron/db.cjs");
    const { makbuzHtml } = await import(pathToFileURL(path.join(__dirname, "../../src/lib/makbuzHtml.js")).href);
    const bugun = new Date();
    const bu = { yil: bugun.getFullYear(), ay: bugun.getMonth() + 1 };
    const iso = `${bu.yil}-${String(bu.ay).padStart(2, "0")}-${String(bugun.getDate()).padStart(2, "0")}`;

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(500);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "tahsilat-test-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Tohum (doğrudan db): sezon, grup, beş oyuncu ──
    const sezon = bu.ay >= 9 ? `${bu.yil}-${bu.yil + 1}` : `${bu.yil - 1}-${bu.yil}`;
    db.setSetting("aktif_sezon", sezon);
    const grp = db.createAgeGroup({ ad: "U11", sezon });
    const oy = (ad, ek) =>
      db.createPlayer({
        ad_soyad: ad,
        dogum_tarihi: "2015-11-02",
        yas_grubu_id: grp.id,
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 5000,
        odeme_donemi: "1-10",
        ...ek,
      });
    const A = oy("Ali Borcsuz");
    const B = oy("Berk Borclu", { aylik_aidat: 4000 });
    const C = oy("Can Odenmis");
    oy("Deniz Ucretsiz", { ucret_tipi: "ucretsiz", aylik_aidat: 0 });
    const E = oy("Ece Kismi");
    db.ensureMonthlyDues(bu.yil, bu.ay); // bu ayın aidatları (uygulama da açılışta yapar)
    const aidatKalemi = db.listFeeItems().find((k) => k.kod === "aidat");
    // B: 3 ay geriye borç
    for (let i = 3; i >= 1; i--) {
      const d = ayEkle(bu.yil, bu.ay, -i);
      db.ensureMonthlyDues(d.yil, d.ay, B.id);
    }
    // C: bu ay ve sonraki 2 ay ödenmiş (tek makbuz)
    const cAylar = [0, 1, 2].map((i) => ayEkle(bu.yil, bu.ay, i));
    db.ensureMonthlyDuesAraligi(C.id, cAylar);
    db.createReceipt({
      player_id: C.id,
      tarih: iso,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: cAylar.map((d) => ({ fee_item_id: aidatKalemi.id, tutar: 5000, aciklama: adi(d), yil: d.yil, ay: d.ay })),
    });
    // E: bu ay 2.000 kısmi
    db.createReceipt({
      player_id: E.id,
      tarih: iso,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 2000, aciklama: adi(bu), yil: bu.yil, ay: bu.ay }],
    });

    await tikla("Tahsilat");
    await bekle(600);
    const rozet = () => js(`(document.body.innerText.match(/Bugünkü tahsilat: [\\d.]+/) || [""])[0]`);
    const rozetIlk = await rozet();
    check("bugünkü tahsilat rozeti tohum makbuzlarını sayar (17.000)", /17\.000/.test(rozetIlk));

    // ── 1) Borçsuz oyuncu: bu ay seçili gelir, tutar aylık aidat ──
    await oyuncuSec("Ali Borcsuz");
    check("borçsuz: bu ay seçili gelir", JSON.stringify(await secilenAylar()) === JSON.stringify([adi(bu)]));
    check("borçsuz: tutar aylık aidat (5.000)", (await tutarKutusu(adi(bu))) === "5.000");
    check("borçsuz: toplam 5.000", /5\.000 ₺/.test(await toplam()));
    await shot("01-borcsuz-bu-ay");

    // ── 2) Elle 3 ay (pil) → toplam 15.000 → Kaydet → makbuz 3 ayrı satır ──
    await tikla(adi(ayEkle(bu.yil, bu.ay, 1)));
    await tikla(adi(ayEkle(bu.yil, bu.ay, 2)));
    check("elle 3 ay: toplam 15.000", /15\.000 ₺/.test(await toplam()));
    await shot("02-elle-3-ay");
    await tikla("Kaydet");
    await bekle(2500);
    let makbuzlar = db.listReceiptsByDate(iso, iso, sezon).filter((m) => m.player_id === A.id);
    check("elle 3 ay: makbuz kaydedildi", makbuzlar.length === 1 && makbuzlar[0].toplam === 15000);
    let m = db.getReceipt(makbuzlar[0].id);
    let html = makbuzHtml({ makbuz: m, kalemler: db.listFeeItems(), logo: "" });
    check("elle 3 ay: makbuzda 3 ayrı AİDAT satırı, özet yok", (html.match(/AİDAT · /g) || []).length === 6 && !/\(3 AY\)/.test(html));
    check("elle 3 ay: PDF üretildi", !!m.pdf_yolu && fs.existsSync(path.join(db.getUploadsDir(), m.pdf_yolu)));
    check("kaydet sonrası ekran temizlenir", (await secilenAylar()).length === 0);

    // ── 3) Eski borçlu: en eski borç seçili; Uzun Dönem "3 Ay" borçlardan başlar ──
    await oyuncuSec("Berk Borclu");
    const enEski = ayEkle(bu.yil, bu.ay, -3);
    check("borçlu: en eski borç seçili gelir", JSON.stringify(await secilenAylar()) === JSON.stringify([adi(enEski)]));
    check(
      "borçlu: 4 'ödenmedi' pili (3 geçmiş + bu ay)",
      (await js(`[...document.querySelectorAll("button[aria-pressed]")].filter(b => b.textContent.includes("ödenmedi")).length`)) === 4,
    );
    await shot("03-borclu");
    await tikla("Uzun Dönem Seç");
    await bekle(400);
    check(
      "modal açıldı, varsayılan 6 ay borçtan başlar",
      /6 ay seçilecek: /.test(await modalMetin()) && (await modalMetin()).includes(adi(enEski)),
    );
    await tikla("3 Ay", 'document.querySelector("[role=dialog]")');
    const m3 = await modalMetin();
    check(
      "3 Ay: en eski borçtan 3 ay, toplam 12.000",
      m3.includes(`3 ay seçilecek: ${adi(enEski)} – ${adi(ayEkle(enEski.yil, enEski.ay, 2))}`) && /12\.000 ₺/.test(m3),
    );
    await shot("04-modal-3-ay");
    await tikla("Uygula", 'document.querySelector("[role=dialog]")');
    await bekle(800);
    check("3 Ay uygulandı: 3 ay listede, toplam 12.000", (await secilenAylar()).length === 3 && /12\.000 ₺/.test(await toplam()));
    check("3 Ay: her ayın tutarı 4.000", (await tutarKutusu(adi(enEski))) === "4.000");
    await shot("05-3-ay-uygulandi");

    // ── 4) Ödenmiş aylar aralıktan atlanır ──
    await oyuncuSec("Can Odenmis");
    const cIlkBorc = ayEkle(bu.yil, bu.ay, 3);
    check(
      "ödenmiş oyuncu: seçili gelen ay ilk ödenmemiş ay (peşin ödenen bu ay atlanır)",
      JSON.stringify(await secilenAylar()) === JSON.stringify([adi(cIlkBorc)]),
    );
    check(
      "ödenmiş oyuncu: piller ödenmiş ayları atlayıp 3 gelecek ay gösterir",
      (await js(`document.querySelectorAll("button[aria-pressed]").length`)) === 3,
    );
    await shot("06a-odenmis-varsayilan");
    await tikla("Uzun Dönem Seç");
    await bekle(400);
    await modalSec(0, `${bu.yil}-${bu.ay}`); // başlangıç: bu ay (ödenmiş)
    const bit = ayEkle(bu.yil, bu.ay, 5);
    await modalSec(1, `${bit.yil}-${bit.ay}`);
    const mC = await modalMetin();
    check(
      "ödenmişler önizlemede atlanır: 3 ay, 15.000, '3 ay zaten ödenmiş'",
      mC.includes(`3 ay seçilecek: ${adi(cIlkBorc)} – ${adi(bit)}`) && /15\.000 ₺/.test(mC) && /3 ay zaten ödenmiş, atlandı/.test(mC),
    );
    await shot("06-modal-odenmis-atlanir");
    await tikla("Uygula", 'document.querySelector("[role=dialog]")');
    await bekle(800);
    check(
      "ödenmiş aylar listede yok, 3 ay 5.000",
      (await tutarKutusu(adi(bu))) === null && (await tutarKutusu(adi(cIlkBorc))) === "5.000" && (await secilenAylar()).length === 3,
    );
    check("toplam 15.000", /15\.000 ₺/.test(await toplam()));
    await shot("07-odenmis-atlandi");
    // tümü ödenmiş aralık → Uygula kapalı
    await tikla("Uzun Dönem Seç");
    await bekle(400);
    await modalSec(0, `${bu.yil}-${bu.ay}`);
    const b2 = ayEkle(bu.yil, bu.ay, 2);
    await modalSec(1, `${b2.yil}-${b2.ay}`);
    check(
      "tümü ödenmiş: uyarı ve Uygula kapalı",
      /tüm aylar zaten ödenmiş/.test(await modalMetin()) &&
        (await js(`[...document.querySelectorAll("[role=dialog] button")].find(b => b.textContent.trim() === "Uygula").disabled`)),
    );
    await shot("08-modal-tumu-odenmis");
    // "6 Ay" → ilk borçtan 6 ay → Kaydet → makbuzda tek özet satır
    await tikla("6 Ay", 'document.querySelector("[role=dialog]")');
    check("6 Ay: 6 ay, 30.000", /6 ay seçilecek/.test(await modalMetin()) && /30\.000 ₺/.test(await modalMetin()));
    await tikla("Uygula", 'document.querySelector("[role=dialog]")');
    await bekle(800);
    check("6 ay listede, toplam 30.000", (await secilenAylar()).length === 6 && /30\.000 ₺/.test(await toplam()));
    await shot("09-6-ay-secili");
    await tikla("Kaydet");
    await bekle(2500);
    makbuzlar = db.listReceiptsByDate(iso, iso, sezon).filter((x) => x.player_id === C.id && x.toplam === 30000);
    check("6 ay makbuzu kaydedildi (6 satır)", makbuzlar.length === 1 && db.getReceipt(makbuzlar[0].id).satirlar.length === 6);
    m = db.getReceipt(makbuzlar[0].id);
    html = makbuzHtml({ makbuz: m, kalemler: db.listFeeItems(), logo: "" });
    const son6 = ayEkle(cIlkBorc.yil, cIlkBorc.ay, 5);
    check(
      "6 ay makbuzu: tek özet satır '(6 AY)' + 30.000, Dönem aralık",
      (html.match(/AİDAT · /g) || []).length === 2 &&
        /\(6 AY\)/.test(html) &&
        /30\.000 ₺/.test(html) &&
        html.includes(`${adi(cIlkBorc)} – ${adi(son6)}`),
    );
    check("6 ay: PDF üretildi", !!m.pdf_yolu && fs.existsSync(path.join(db.getUploadsDir(), m.pdf_yolu)));
    check(
      "6 ay: aylar ödendi",
      cAylar.concat([cIlkBorc, son6]).every((d) => db.getDue(C.id, d.yil, d.ay)?.durum === "odendi"),
    );

    // ── 5) Sezon Sonuna Kadar ──
    await oyuncuSec("Berk Borclu");
    await tikla("Uzun Dönem Seç");
    await bekle(400);
    await tikla("Sezon Sonuna Kadar", 'document.querySelector("[role=dialog]")');
    const sezonSonAy = { yil: Number(sezon.slice(5)), ay: 8 };
    const mS = await modalMetin();
    const beklenen = sezonSonAy.yil * 12 + sezonSonAy.ay - 1 - (enEski.yil * 12 + enEski.ay - 1) + 1;
    check(
      `sezon sonuna kadar: ${beklenen} ay, ${adi(enEski)} – ${adi(sezonSonAy)}`,
      mS.includes(`${beklenen} ay seçilecek: ${adi(enEski)} – ${adi(sezonSonAy)}`),
    );
    await shot("10-modal-sezon-sonu");
    await modalKapat();
    check("Vazgeç: seçim değişmedi (en eski borç)", JSON.stringify(await secilenAylar()) === JSON.stringify([adi(enEski)]));

    // ── 6) Kısmi ödeme: kalan gösterilir ──
    await oyuncuSec("Ece Kismi");
    check(
      "kısmi: kalan 3.000 seçili gelir",
      (await tutarKutusu(adi(bu))) === "3.000" &&
        /kalan 3\.000/.test(await js(`document.querySelector("button[aria-pressed='true']")?.textContent`)),
    );
    await shot("11-kismi");

    // ── 7) Ücretsiz (muaf): aidat seçilmez, toplam 0 ──
    await oyuncuSec("Deniz Ucretsiz");
    check("ücretsiz: aidat ayı seçili değil, toplam 0", (await secilenAylar()).length === 0 && /0 ₺/.test(await toplam()));
    await shot("12-ucretsiz");

    // ── 8) Makbuz iptali: aylar geri açılır, rozet düşer ──
    const rozetOnce = await rozet();
    check("rozet güncel (17.000 + 15.000 + 30.000 = 62.000)", /62\.000/.test(rozetOnce));
    const iptalOk = await js(
      `(() => { const tr = [...document.querySelectorAll("tr")].find(t => t.textContent.includes("Ali Borcsuz")); const b = tr && [...tr.querySelectorAll("button")].find(x => x.textContent.trim() === "İptal"); if (!b) return false; b.click(); return true; })()`,
    );
    check("bugün kesilenlerde İptal düğmesi", iptalOk);
    await bekle(400);
    await setInput('input[aria-label="İptal nedeni"]', "test iptali");
    await tikla("İptal Et", 'document.querySelector("[role=dialog]")');
    await bekle(800);
    check(
      "iptal: 3 ay yeniden ödenmedi, rozet 47.000",
      [0, 1, 2].every((i) => {
        const d = ayEkle(bu.yil, bu.ay, i);
        return db.getDue(A.id, d.yil, d.ay)?.durum === "odenmedi";
      }) && /47\.000/.test(await rozet()),
    );
    await shot("13-iptal-sonrasi");
    // İptalle geri açılan GELECEK aylar borç gibi listelenmez: yalnız bu ay kırmızı, ileri aylar sade ve en fazla 3 (10.09.2026)
    await oyuncuSec("Ali Borcsuz");
    const piller = await js(`[...document.querySelectorAll("button[aria-pressed]")].map(b => b.textContent.trim())`);
    check(
      "iptal sonrası: yalnız bu ay 'ödenmedi', ileri aylar sade, toplam 4 pil",
      piller.length === 4 && piller.filter((p) => p.includes("ödenmedi")).length === 1 && piller[0].startsWith(adi(bu)),
    );
    check("iptal sonrası: bu ay seçili gelir", JSON.stringify(await secilenAylar()) === JSON.stringify([adi(bu)]));
    await shot("14-iptal-sonrasi-piller");

    console.log(fail ? `${fail} KONTROL BASARISIZ` : "TUM KONTROLLER GECTI");
  } catch (e) {
    console.error("HATA:", e && e.stack ? e.stack : e);
    fail++;
  } finally {
    setTimeout(() => app.exit(fail ? 1 : 0), 300);
  }
});
