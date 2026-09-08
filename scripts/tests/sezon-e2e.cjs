// Yeni Sezon sihirbazı uçtan uca (gerçek main.cjs, arayüzden): kurulum + sihirbaz ("yaz"), yeniden açılışta kalıcılık ("oku").
// Çalıştırma: npx electron scripts/tests/sezon-e2e.cjs <boş dizin> yaz && … oku  (vitest sarmalayıcı: tests/sezon-e2e.test.js) Adım "yaz": kurulum + sihirbaz; adım "oku": yeniden açılışta kalıcılık.
const { app } = require("electron");
const path = require("path");
const [dizin, adim] = process.argv.slice(2);
app.setPath("userData", dizin);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k) => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}`);
  if (!k) fail++;
};
require(path.join(process.cwd(), "electron/main.cjs"));
app.once("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const tikla = async (m) => {
      const ok = await js(
        `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === ${JSON.stringify(m)} || x.getAttribute("aria-label") === ${JSON.stringify(m)}); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + m);
      await bekle(450);
    };
    const kutu = (etiket, deger) =>
      js(
        `(() => { const i = document.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!i) return "yok"; if (i.checked !== ${deger}) i.click(); return i.checked; })()`,
      );
    const secimDeger = (etiket) =>
      js(
        `(() => { const s = document.querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); return s ? s.options[s.selectedIndex]?.textContent : "yok"; })()`,
      );
    const db = require(path.join(process.cwd(), "electron/db.cjs"));
    const giris = async (parola) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(parola)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(500);
    };
    if (adim === "yaz") {
      await giris("admin");
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "sezon-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
      );
      await tikla("Kaydet");
      await bekle(600);
      if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`))
        await tikla("Şimdi değil");
      // Kurulum: 2026-2027 sezonu, gruplar U11 / U11 A / U11 B / U12 / U12 A (U12 B YOK → gövde U12'ye düşmeli)
      db.setSetting("aktif_sezon", "2026-2027");
      db.setSetting("sezon_baslangic_ayi", "9");
      const g = {};
      let sira = 0;
      for (const ad of ["U11", "U11 A", "U11 B", "U12", "U12 A"]) g[ad] = db.createAgeGroup({ ad, sezon: "2026-2027", sira: ++sira }).id;
      const oy = (ad, grup, durum = "aktif") =>
        db.createPlayer({
          ad_soyad: ad,
          dogum_tarihi: "2015-05-05",
          yas_grubu_id: g[grup],
          durum,
          ucret_tipi: "normal",
          aylik_aidat: 3000,
          odeme_donemi: "1-10",
          sezon: "2026-2027",
        });
      const ada = oy("Ada Kaya", "U11"),
        baris = oy("Barış Güneş", "U11 A"),
        cem = oy("Cem Polat", "U11 B"),
        deniz = oy("Deniz Aksoy", "U12"),
        fatma = oy("Fatma Işık", "U12 A", "deneme"),
        ece = oy("Ece Pasif", "U11", "pasif");
      db.ensureMonthlyDues(2026, 8, deniz.id);
      db.ensureMonthlyDues(2026, 9, deniz.id); // Deniz'in 2 ay borcu var, yenilemeyecek
      await tikla("Ayarlar");
      await bekle(400);
      await tikla("Yeni Sezon");
      await bekle(700);
      check(
        "geçilecek sezon önerisi 2027-2028",
        (await js(`document.querySelector("input[aria-label='Geçilecek sezon']").value`)) === "2027-2028",
      );
      const adlar = await js(`[...document.querySelectorAll("input[aria-label$=' yeniledi']")].map((i) => i.getAttribute("aria-label"))`);
      check("aday listesi: 5 aktif/deneme oyuncu; pasif Ece listede yok", adlar.length === 5 && !adlar.some((a) => a.startsWith("Ece")));
      check(
        "borç rozeti: Deniz 2 ay · 6.000 ₺",
        await js(
          `[...document.querySelectorAll("tr")].some((tr) => tr.textContent.includes("Deniz Aksoy") && tr.textContent.includes("2 ay") && tr.textContent.includes("6.000 ₺"))`,
        ),
      );
      for (const ad of ["Ada Kaya", "Barış Güneş", "Cem Polat", "Fatma Işık"]) await kutu(`${ad} yeniledi`, true);
      await bekle(300);
      check(
        "üst grup önerileri: Ada→U12, Barış→U12 A, Cem→U12 (U12 B yok, gövdeye düştü), Fatma→U12 A (U13 A yok, kaldı)",
        (await secimDeger("Ada Kaya yeni grup")) === "U12" &&
          (await secimDeger("Barış Güneş yeni grup")) === "U12 A" &&
          (await secimDeger("Cem Polat yeni grup")) === "U12" &&
          (await secimDeger("Fatma Işık yeni grup")) === "U12 A",
      );
      check(
        "özet: 4 geçecek · 1 pasife alınacak",
        (await js(`document.querySelector("[data-testid=sezon-ozet]")?.textContent.replace(/\\s+/g, " ")`)) ===
          "4 oyuncu 2027-2028 sezonuna geçecek · 1 oyuncu pasife alınacak",
      );
      // Filtre + arama: grup filtresi U11 A → yalnız Barış; arama "cem" → yalnız Cem
      await js(
        `(() => { const s = document.querySelector("select[aria-label='Yaş grubu filtresi']"); s.value = String(${g["U11 A"]}); s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(200);
      check(
        "grup filtresi U11 A → tek satır Barış",
        (await js(`[...document.querySelectorAll("input[aria-label$=' yeniledi']")].map((i) => i.getAttribute("aria-label"))`)).join() ===
          "Barış Güneş yeniledi",
      );
      await js(
        `(() => { const s = document.querySelector("select[aria-label='Yaş grubu filtresi']"); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label='Oyuncu ara']"); set.call(i, "cem"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(200);
      check(
        "arama 'cem' → tek satır Cem; özet değişmedi",
        (await js(`[...document.querySelectorAll("input[aria-label$=' yeniledi']")].length`)) === 1 &&
          (await js(`document.querySelector("[data-testid=sezon-ozet]").textContent`)).includes("4"),
      );
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label='Oyuncu ara']"); set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(200);
      // Eski borç silme kutusu (Deniz'in 6.000 ₺'si) işaretlenir
      await js(
        `(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.includes("eski aidatını")); const i = l?.querySelector("input"); if (i && !i.checked) i.click(); })()`,
      );
      await bekle(200);
      await tikla("Yeni Sezona Geç");
      await bekle(400);
      const onayMetin = await js(`document.querySelector("[role=dialog]")?.textContent || ""`);
      check(
        "onay metni: 4 geçecek, 1 pasif, eski borçlar silinecek",
        /4 oyuncu yeni sezona geçecek, 1 oyuncu pasife alınacak, eski borçlar silinecek/.test(onayMetin),
      );
      await tikla("Evet");
      await bekle(1200);
      check(
        "sonuç kutusu: 2027-2028'e geçildi, 4 yeniledi (3 üst gruba; Fatma U12 A'da kaldı), 1 pasif, 2 aidat silindi",
        await js(
          `[...document.querySelectorAll("[role=status]")].some((s) => /2027-2028 sezonuna geçildi\\. 4 oyuncu yeniledi \\(3 üst gruba taşındı\\), 1 oyuncu pasife alındı, 2 eski aidat kaydı silindi/.test(s.textContent))`,
        ),
      );
      // DB
      const P = (id) => db.getPlayer(id);
      check(
        "yenileyenler: sezon 2027-2028 ve yeni gruplar",
        P(ada.id).sezon === "2027-2028" &&
          P(ada.id).yas_grubu_id === g["U12"] &&
          P(baris.id).yas_grubu_id === g["U12 A"] &&
          P(cem.id).yas_grubu_id === g["U12"] &&
          P(fatma.id).yas_grubu_id === g["U12 A"] &&
          P(fatma.id).durum === "deneme",
      );
      check(
        "Deniz pasif, notunda 2026-2027 yenilemedi; borçları muaf oldu",
        P(deniz.id).durum === "pasif" &&
          /2026-2027 sezonu sonunda yenilemedi/.test(P(deniz.id).notlar) &&
          db.listDues(deniz.id).every((d) => d.durum === "muaf"),
      );
      check("Ece pasif kaldı, dokunulmadı", P(ece.id).durum === "pasif" && !/yenilemedi/.test(P(ece.id).notlar || ""));
      check(
        "aktif gruplar ve aktif_sezon 2027-2028, son geçiş damgası var",
        db.listAgeGroups().every((x) => x.sezon === "2027-2028") &&
          db.getSetting("aktif_sezon") === "2027-2028" &&
          !!db.getSetting("son_sezon_gecisi"),
      );
      // Oyuncular listesi varsayılan yalnız aktif: Deniz ve Ece görünmez
      await tikla("Oyuncular");
      await bekle(800);
      const gorunen = await js(`[...document.querySelectorAll("table tbody tr")].map((r) => r.textContent)`);
      check(
        "Oyuncular listesi varsayılan 'aktif, deneme ve sakat': pasifler (Deniz, Ece) gizli; deneme Fatma dahil 4 yenileyen var",
        gorunen.length === 4 && !gorunen.some((r) => /Deniz Aksoy|Ece Pasif/.test(r)) && gorunen.some((r) => /Fatma/.test(r)),
      );
      // Sihirbaz yeniden açılınca aday listesi 4 kişi, aktif sezon 2027-2028, öneri 2028-2029
      await tikla("Ayarlar");
      await bekle(300);
      await tikla("Yeni Sezon");
      await bekle(700);
      check(
        "sihirbaz tekrar: aktif sezon 2027-2028, öneri 2028-2029, 4 aday",
        (await js(`document.querySelector("input[aria-label='Aktif sezon']").value`)) === "2027-2028" &&
          (await js(`document.querySelector("input[aria-label='Geçilecek sezon']").value`)) === "2028-2029" &&
          (await js(`document.querySelectorAll("input[aria-label$=' yeniledi']").length`)) === 4,
      );
      console.log(fail === 0 ? "YAZ TAMAM" : "YAZ HATALI");
      win.close();
    } else {
      await giris("sezon-parola-1");
      const P = db.listPlayers({ durum: null });
      const ada = P.find((p) => p.ad_soyad === "Ada Kaya"),
        deniz = P.find((p) => p.ad_soyad === "Deniz Aksoy");
      check(
        "yeniden açılış: Ada 2027-2028 / U12, Deniz pasif + not, aktif_sezon 2027-2028",
        ada.sezon === "2027-2028" &&
          ada.yas_grubu_ad === "U12" &&
          deniz.durum === "pasif" &&
          /yenilemedi/.test(deniz.notlar) &&
          db.getSetting("aktif_sezon") === "2027-2028",
      );
      check(
        "yeniden açılış: gruplar 2027-2028, Deniz'in eski aidatları muaf",
        db.listAgeGroups().every((x) => x.sezon === "2027-2028") && db.listDues(deniz.id).every((d) => d.durum === "muaf"),
      );
      console.log(fail === 0 ? "TUM KONTROLLER GECTI" : "KONTROL HATASI");
      app.exit(fail === 0 ? 0 : 1);
    }
  } catch (e) {
    console.log("HATA", e.message);
    app.exit(1);
  }
});
app.on("window-all-closed", () => app.exit(fail === 0 ? 0 : 1));
