// Plan §42 uçtan uca (gerçek main.cjs + DB + pencere): durum değişiminde muafiyet sorusu tüm durumlar için — Dondurma/Pasif/Ayrıldı
// (Evet/Vazgeç), Sakat/Deneme (soru yok), ay ödenmiş/kısmi/açılmamış (soru yok), Düzenle formundan değişim, Ödemeler'de Muaf yap /
// Muafiyeti kaldır / Muaf ay ekle, Tahsilat'ta muaf ay seçilmez, Pano/Raporlar'da muaf borç değil, Dondurma→Aktif dönüşünde muaf
// korunur, kullanıcı rolü (muaf_eden), salt okunurda ana süreç reddeder. Kullanım: electron scripts/tests/muafiyet-e2e.cjs <dizin>
const { app, ipcMain } = require("electron");
const [dizin] = process.argv.slice(2);
app.setPath("userData", dizin);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
const db = require("../../electron/db.cjs");
require("../../electron/main.cjs");
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

let ilk = true;
app.on("browser-window-created", async (_e, win) => {
  if (!ilk) return;
  ilk = false;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const D = `[...document.querySelectorAll("[role=dialog]")].pop()`;
    const dMetin = () => js(`(${D})?.textContent || ""`);
    const dEtiket = () => js(`(${D})?.getAttribute("aria-label") || ""`);
    const govde = () => js(`document.body.textContent`);
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(450);
    };
    const yaz = async (etiket, deger, kok = "document") => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = ${kok}.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!i) throw new Error("Girdi yok: " + ${JSON.stringify(etiket)}); set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(300);
    };
    const sec = async (etiket, deger, kok = "document") => {
      await js(
        `(() => { const s = ${kok}.querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!s) throw new Error("Kutu yok: " + ${JSON.stringify(etiket)}); s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(500);
    };
    const sekme = async (ad) => {
      await js(`document.querySelector("button[aria-label='${ad}']").click()`);
      await bekle(800);
    };
    const giris = async (k, p) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, ${JSON.stringify(k)}); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(p)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(800);
    };
    const cikis = async () => {
      await js(`document.querySelector("button[aria-label='Çıkış']").click()`);
      await bekle(1500);
    };
    // Oyuncu kartı yardımcıları
    const kartAc = async (ad) => {
      await sekme("Oyuncular");
      await sec("Durum", ""); // tüm durumlar (dondurma/pasif gizli olmasın)
      await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(ad)})).click()`);
      await bekle(900);
    };
    const kartKapat = async () => {
      await js(`(${D})?.querySelector("button[aria-label='Kapat']")?.click()`);
      await bekle(400);
    };
    const durumSec = async (durum) => {
      // başlıktaki Durum kutusu (aria-label yok: select içinde 'Durum:' etiketi) → kart içindeki ilk select
      await js(
        `(() => { const s = (${D}).querySelector("select"); s.value = ${JSON.stringify(durum)}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(900);
    };
    const soruVar = () => js(`(${D})?.getAttribute("aria-label") === "Onay" && /muaf yapılsın mı/.test((${D}).textContent)`);
    const odemelerAc = async () => {
      await js(`[...(${D}).querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ödemeler")).click()`);
      await bekle(500);
    };
    const aySatiri = (ad, yil) =>
      js(
        `([...(${D}).querySelectorAll("table tbody tr")].find((tr) => tr.textContent.startsWith(${JSON.stringify(ad + " " + yil)}))?.textContent) || ""`,
      );
    const aySatirDugme = async (ad, yil, dugme) => {
      const ok = await js(
        `(() => { const tr = [...(${D}).querySelectorAll("table tbody tr")].find((tr) => tr.textContent.startsWith(${JSON.stringify(ad + " " + yil)})); const b = tr && [...tr.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(dugme)}); if (!b) return false; b.click(); return true; })()`,
      );
      await bekle(500);
      return ok;
    };
    for (const kanal of ["cikti:yazdir", "cikti:pdfAc"]) {
      ipcMain.removeHandler(kanal);
      ipcMain.handle(kanal, async () => ({ ok: true }));
    }

    // ── Veri ──
    db.hamBaglanti().prepare("UPDATE users SET ad_soyad='Şerif Çelik' WHERE username='admin'").run();
    db.setSetting("aktif_sezon", "2026-2027");
    const g = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    const aidatK = db.listFeeItems().find((k) => k.kod === "aidat");
    const t = new Date();
    const yil = t.getFullYear(),
      ay = t.getMonth() + 1;
    const bugun = `${yil}-${String(ay).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    const P = (ad) =>
      db.createPlayer({
        ad_soyad: ad,
        dogum_tarihi: "2015-01-01",
        odeme_donemi: "1-10",
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        yas_grubu_id: g.id,
      });
    const dondur = P("Dondur Deneme"),
      pasif = P("Pasif Vazgec"),
      ayrildi = P("Ayrildi Evet"),
      sakat = P("Sakat Soru Yok"),
      odendi = P("Odendi Soru Yok"),
      kismi = P("Kismi Soru Yok"),
      acilmamis = P("Acilmamis Soru Yok"),
      form = P("Form Dondurma"),
      gecmis = P("Gecmis Muaf");
    for (const p of [dondur, pasif, ayrildi, sakat, odendi, kismi, form, gecmis]) db.ensureMonthlyDues(yil, ay, p.id);
    db.createReceipt({
      player_id: odendi.id,
      tarih: bugun,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidatK.id, tutar: 1000, yil, ay }],
    });
    db.createReceipt({
      player_id: kismi.id,
      tarih: bugun,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidatK.id, tutar: 400, yil, ay }],
    });
    db.hamBaglanti().prepare("DELETE FROM monthly_dues WHERE player_id=?").run(acilmamis.id); // bu ay hiç açılmamış
    // Geçmiş aylar (Gecmis Muaf): iki ay önce ödenmemiş, üç ay önce ödendi
    const ayGeri = (n) => {
      const d = new Date(yil, ay - 1 - n, 1);
      return { yil: d.getFullYear(), ay: d.getMonth() + 1 };
    };
    const g2 = ayGeri(2),
      g3 = ayGeri(3);
    db.ensureMonthlyDues(g2.yil, g2.ay, gecmis.id);
    db.ensureMonthlyDues(g3.yil, g3.ay, gecmis.id);
    db.createReceipt({
      player_id: gecmis.id,
      tarih: bugun,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidatK.id, tutar: 1000, yil: g3.yil, ay: g3.ay }],
    });
    const due = (p, y = yil, a = ay) => db.getDue(p.id, y, a);

    // ── Giriş ──
    await giris("admin", "admin");
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "muaf-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(800);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── 1. Aktif → Dondurma → Evet ──
    await kartAc("Dondur Deneme");
    await durumSec("dondurma");
    check("Dondurma: soru geldi", await soruVar(), await dEtiket());
    await tikla("Evet", D);
    await bekle(800);
    let d = due(dondur);
    check(
      "Evet: bu ay muaf (neden dondurma, not 'Durum: Dondurma', eden oturum), toast",
      d.durum === "muaf" &&
        d.muaf_neden === "dondurma" &&
        d.muaf_notu === "Durum: Dondurma" &&
        d.muaf_eden === "Şerif Çelik" &&
        /muaf yapıldı/.test(await govde()),
      JSON.stringify(d),
    );
    await odemelerAc();
    check(
      "Ödemeler satırı: Muaf · Dondurma: Durum: Dondurma, 'Muafiyeti Kaldır' var",
      /Muaf.*Dondurma: Durum: Dondurma/.test(await aySatiri(AYLAR[ay - 1], yil)) &&
        /Muafiyeti Kaldır/.test(await aySatiri(AYLAR[ay - 1], yil)),
      await aySatiri(AYLAR[ay - 1], yil),
    );
    // Dondurma → Aktif: muaf korunur (bu ay yeniden açılmaz)
    await durumSec("aktif");
    check("Dondurma → Aktif: soru yok, muaf korunur", !(await soruVar()) && due(dondur).durum === "muaf");
    await kartKapat();

    // ── 2. Aktif → Pasif → Vazgeç ──
    await kartAc("Pasif Vazgec");
    await durumSec("pasif");
    check("Pasif: soru geldi", await soruVar());
    await tikla("Vazgeç", D);
    await bekle(500);
    d = due(pasif);
    check(
      "Vazgeç: borç kalır (ödenmedi), durum pasif",
      d.durum === "odenmedi" && db.getPlayer(pasif.id).durum === "pasif" && !(await soruVar()),
    );
    await kartKapat();

    // ── 3. Aktif → Ayrıldı → Evet ──
    await kartAc("Ayrildi Evet");
    await durumSec("ayrildi");
    check("Ayrıldı: soru geldi", await soruVar());
    await tikla("Evet", D);
    await bekle(800);
    d = due(ayrildi);
    check(
      "Ayrıldı Evet: muaf neden 'diger', not 'Durum: Ayrıldı'",
      d.durum === "muaf" && d.muaf_neden === "diger" && d.muaf_notu === "Durum: Ayrıldı",
      JSON.stringify(d),
    );
    await kartKapat();

    // ── 4. Sakat / Deneme: soru yok ──
    await kartAc("Sakat Soru Yok");
    await durumSec("sakat");
    const s1 = await soruVar();
    await durumSec("deneme");
    check("Sakat ve Deneme: soru yok, borç kalır", !s1 && !(await soruVar()) && due(sakat).durum === "odenmedi");
    await kartKapat();

    // ── 5. Bu ay ödenmiş / kısmi / açılmamış: soru yok ──
    await kartAc("Odendi Soru Yok");
    await durumSec("dondurma");
    check("bu ay ödenmişse soru yok", !(await soruVar()) && due(odendi).durum === "odendi");
    await kartKapat();
    await kartAc("Kismi Soru Yok");
    await durumSec("dondurma");
    check("bu ay kısmi ödenmişse soru yok (ödenen > 0)", !(await soruVar()) && due(kismi).durum === "kismi");
    await odemelerAc();
    check("kısmi ayda 'Muaf Yap' düğmesi yok", !/Muaf Yap/.test(await aySatiri(AYLAR[ay - 1], yil)));
    await kartKapat();
    await kartAc("Acilmamis Soru Yok");
    await durumSec("dondurma");
    check("bu ay hiç açılmamışsa soru yok, kayıt oluşmaz", !(await soruVar()) && due(acilmamis) === null);
    await kartKapat();

    // ── 6. Düzenle formundan Aktif → Dondurma → soru ──
    await kartAc("Form Dondurma");
    await tikla("Düzenle", D);
    await bekle(500);
    await js(
      `(() => { const l = [...(${D}).querySelectorAll("label, div")].find((x) => x.textContent.trim().startsWith("Durum") && x.querySelector("select") && x.children.length <= 3); const s = l.querySelector("select"); s.value = "dondurma"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await bekle(300);
    await tikla("Kaydet", D);
    await bekle(1200);
    check("Düzenle formundan Dondurma: soru geldi", await soruVar(), await dEtiket());
    await tikla("Evet", D);
    await bekle(800);
    check("form yolu Evet: muaf (dondurma)", due(form).durum === "muaf" && due(form).muaf_neden === "dondurma");
    await kartKapat();

    // ── 7. Ödemeler: geçmiş ay Muaf yap / kaldır / Muaf ay ekle; ödenmiş ayda düğme yok ──
    await kartAc("Gecmis Muaf");
    await odemelerAc();
    const g2ad = AYLAR[g2.ay - 1],
      g3ad = AYLAR[g3.ay - 1];
    check(
      "ödenmiş geçmiş ayda 'Muaf Yap' yok, ödenmemişte var",
      !/Muaf Yap/.test(await aySatiri(g3ad, g3.yil)) && /Muaf Yap/.test(await aySatiri(g2ad, g2.yil)),
      (await aySatiri(g2ad, g2.yil)) + " | " + (await aySatiri(g3ad, g3.yil)),
    );
    await aySatirDugme(g2ad, g2.yil, "Muaf Yap");
    check("Muaf yap penceresi", (await dEtiket()) === "Aidat Muafiyeti" && (await dMetin()).includes(`${g2ad} ${g2.yil}`));
    await sec("Muafiyet nedeni", "sakatlik", D);
    await yaz("Muafiyet notu", "rapor 2 hafta", D);
    await tikla("Muaf Yap", D);
    await bekle(800);
    d = due(gecmis, g2.yil, g2.ay);
    check(
      "geçmiş ay muaf: sakatlık + not, satırda görünür",
      d.durum === "muaf" &&
        d.muaf_neden === "sakatlik" &&
        d.muaf_notu === "rapor 2 hafta" &&
        /Muaf.*Sakatlık: rapor 2 hafta/.test(await aySatiri(g2ad, g2.yil)),
      await aySatiri(g2ad, g2.yil),
    );
    await aySatirDugme(g2ad, g2.yil, "Muafiyeti Kaldır");
    await bekle(400);
    check(
      "Muafiyeti kaldır: ödenmedi'ye döner, alanlar temiz",
      due(gecmis, g2.yil, g2.ay).durum === "odenmedi" &&
        due(gecmis, g2.yil, g2.ay).muaf_neden === "" &&
        /Muaf Yap/.test(await aySatiri(g2ad, g2.yil)),
    );
    // Muaf ay ekle: 5 ay önce (açılmamış)
    const g5 = ayGeri(5);
    await tikla("Muaf Ay Ekle", D);
    await bekle(400);
    await sec("Muaf yılı", String(g5.yil), D);
    await sec("Muaf ayı", String(g5.ay), D);
    await tikla("Muaf Yap", D);
    await bekle(800);
    d = due(gecmis, g5.yil, g5.ay);
    check(
      "Muaf ay ekle: açılmamış geçmiş ay muaf olarak açıldı (dondurma, tutar 1000), listede",
      d?.durum === "muaf" &&
        d.muaf_neden === "dondurma" &&
        d.tutar === 1000 &&
        /Muaf.*Dondurma/.test(await aySatiri(AYLAR[g5.ay - 1], g5.yil)),
      JSON.stringify(d),
    );
    // ödenmiş ay için ana süreç reddeder (IPC)
    const red = await js(
      `window.okul.db("aidatMuafYap", ${gecmis.id}, ${g3.yil}, ${g3.ay}, { neden: "burs" }).then(() => "ok").catch((e) => e.message)`,
    );
    check("ödenmiş ay için aidatMuafYap ana süreçte reddedilir", /Ödeme yapılmış ay muaf yapılamaz/.test(red), red);
    await kartKapat();

    // ── 8. Tahsilat: muaf ay pilleri seçilmez; Pano/Raporlar: muaf borç değil ──
    await sekme("Tahsilat");
    await yaz("Oyuncu ara", "Gecmis Muaf").catch(() => {});
    await bekle(600);
    await js(
      `[...document.querySelectorAll("button, tr, li, div[role=button]")].find((x) => x.textContent.trim().startsWith("Gecmis Muaf"))?.click()`,
    );
    await bekle(900);
    const g5Pil = await js(
      `[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.trim() === ${JSON.stringify(`${AYLAR[g5.ay - 1]} ${g5.yil}`)})`,
    );
    check("Tahsilat: muaf ay pil olarak sunulmaz (ödenmiş/muaf aylar aralığa girmez)", !g5Pil);
    await sekme("Pano");
    await bekle(500);
    const oz = db.panoOzet({ yil, ay, bugun });
    const borclular = db.listUnpaid(yil, ay, null, null, { bugun, yalnizVadesiGecen: true }).map((u) => u.ad_soyad);
    check(
      "Pano/borçlu listesi (sahada): muaf yapılanlar yok; Pasif Vazgec ve Kismi (dondurma) sahada değil; Sakat (deneme) ve Gecmis Muaf borçlu",
      !borclular.some((a) => /Dondur Deneme|Ayrildi Evet|Form Dondurma|Pasif Vazgec|Kismi Soru Yok/.test(a)) &&
        borclular.includes("Sakat Soru Yok") &&
        borclular.includes("Gecmis Muaf") &&
        oz.borclu === borclular.length,
      JSON.stringify(borclular),
    );
    const ayrilanBorc = db.listUnpaid(yil, ay, null, null, { bugun, yalnizVadesiGecen: true, kume: "ayrilan" }).map((u) => u.ad_soyad);
    check(
      "Raporlar kümesi 'ayrilan': Pasif Vazgec borçlu (borç kaldı), Ayrildi Evet değil (muaf)",
      ayrilanBorc.includes("Pasif Vazgec") && !ayrilanBorc.includes("Ayrildi Evet"),
      JSON.stringify(ayrilanBorc),
    );

    // ── 9. Kullanıcı rolü muaf yapabilir (eden 'Hoca Bey'); salt okunurda ana süreç reddeder ──
    db.createUser({ username: "hoca", password: "hoca-parola-1", ad_soyad: "Hoca Bey", role: "kullanici", must_change_password: 0 });
    await cikis();
    await giris("hoca", "hoca-parola-1");
    await kartAc("Sakat Soru Yok");
    await odemelerAc();
    await aySatirDugme(AYLAR[ay - 1], yil, "Muaf Yap");
    await tikla("Muaf Yap", D);
    await bekle(800);
    check(
      "kullanıcı rolü: muaf yaptı, eden 'Hoca Bey'",
      due(sakat).durum === "muaf" && due(sakat).muaf_eden === "Hoca Bey",
      JSON.stringify(due(sakat)),
    );
    await kartKapat();
    await cikis();
    const gD = db.lisansDurumu,
      gS = db.lisansSaltOkunurMu,
      gY = db.lisansYenile;
    const saltDurum = () => ({ ...gD(), mod: "saltOkunur", neden: "lisansBitti", kalanGun: 0 });
    db.lisansDurumu = saltDurum;
    db.lisansSaltOkunurMu = () => true;
    db.lisansYenile = async () => ({ ok: true, durum: saltDurum() });
    await giris("admin", "muaf-parola-1");
    await kartAc("Kismi Soru Yok");
    await odemelerAc();
    const saltRed = await js(`window.okul.db("aidatMuafKaldir", ${sakat.id}, ${yil}, ${ay}).then(() => "ok").catch((e) => e.message)`);
    check(
      "salt okunur: Ödemeler'de muaf düğmeleri yok, ana süreç aidatMuafKaldir'ı reddeder",
      !/Muaf Yap|Muaf Ay Ekle|Muafiyeti Kaldır/.test(await dMetin()) && /salt okunur/.test(saltRed),
      saltRed,
    );
    await kartKapat();
    db.lisansDurumu = gD;
    db.lisansSaltOkunurMu = gS;
    db.lisansYenile = gY;

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
