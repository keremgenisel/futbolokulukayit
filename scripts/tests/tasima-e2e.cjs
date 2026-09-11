// Taşıma paketi uçtan uca (plan §14): GERÇEK electron/main.cjs ile üç oturum.
//   1. "olustur"  (eski PC, userData A): arayüzden giriş + parola + veri; Ayarlar > Yedekleme > parola → "Taşıma Paketi Oluştur".
//   2. "geriyukle" (yeni PC, userData B, boş): ilk kurulum; "Paket Dosyası Seç" → yanlış parola reddi → doğru parola → onay →
//      "Paketi Aç ve Geri Yükle"; uygulama kendini yeniden başlatmak isterken (app.exit) veriler doğrulanır.
//   3. "dogrula"  (yeni PC, userData B): yeniden açılış; eski PC'nin yönetici parolasıyla giriş, oyuncu arayüzde, sayılar aynı.
// Dosya diyalogları test dosyasına yönlendirilir (gerçek pencere açılmaz). Kullanım:
//   electron scripts/tests/tasima-e2e.cjs <eskiDizin> <yeniDizin> <paketYolu> olustur|geriyukle|dogrula
const { app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const [eskiDizin, yeniDizin, paketYol, adim] = process.argv.slice(2);
app.setPath("userData", adim === "olustur" ? eskiDizin : yeniDizin);
const beklenenYol = paketYol + ".beklenen.json";
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
// Koşul sağlanana kadar bekle (scrypt + zip yük altında saniyeler sürebilir); en çok `enCok` ms
const bekleKosul = async (fn, enCok = 30000) => {
  const bas = Date.now();
  while (Date.now() - bas < enCok) {
    if (await fn()) return true;
    await bekle(250);
  }
  return false;
};
let fail = 0;
const check = (ad, k) => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}`);
  if (!k) fail++;
};
// Diyaloglar: kaydet → paket yolu; aç → paket yolu (yedek.cjs `dialog.showX(...)` çağrı anında bu nesneye bakar)
dialog.showSaveDialog = async () => ({ canceled: false, filePath: paketYol });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paketYol] });

const db = require("../../electron/db.cjs");
if (adim === "geriyukle") {
  // Geri yükleme sonrası uygulama relaunch + exit ister; relaunch'ı susturup çıkışta veriyi doğrularız
  app.relaunch = () => {};
  const asilCikis = app.exit.bind(app);
  app.exit = (kod) => {
    try {
      const b = JSON.parse(fs.readFileSync(beklenenYol, "utf8"));
      const kenar = fs.readdirSync(yeniDizin).filter((f) => f.startsWith("data.db.pre-restore-"));
      check("yeni PC'nin eski verisi .pre-restore ile kenara alındı", kenar.length === 1);
      db.init(); // paketten gelen DB bu makinenin anahtarıyla yeniden şifrelendi; açılmalı
      check(
        "paketten gelen oyuncu ve makbuz sayısı aynı",
        db.listPlayers({ durum: null }).length === b.oyuncu &&
          db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts").get().n === b.makbuz,
      );
      check(
        "yönetici parolası eski PC'ninki (paketle geldi)",
        !!db.verifyPassword("admin", "eski-pc-parola-1") && !db.verifyPassword("admin", "yeni-pc-parola-1"),
      );
      check(
        "makine kimliği ve lease pakete gelmedi (güvenlik #1)",
        db.getMetaValue("makineId") !== b.makineId && !db.getMetaValue("lisansLease"),
      );
      check(
        "belge dosyası paketle geldi",
        fs.readFileSync(path.join(db.getUploadsDir(), "oyuncu-" + b.oyuncuId, "1-diger-not.txt"), "utf8") === "taşınan belge",
      );
      db.close();
    } catch (e) {
      console.error("HATA (çıkış doğrulaması):", e && e.stack);
      fail++;
    }
    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    asilCikis(fail === 0 ? 0 : kod || 1);
  };
}

require("../../electron/main.cjs");

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); if (!i) throw new Error("Alan yok: " + ${JSON.stringify(sel)}); set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
    const tikla = async (metin) => {
      const ok = await js(
        `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(500);
    };
    const metinVar = (m) => js(`document.body.textContent.includes(${JSON.stringify(m)})`);
    const giris = async (parola) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(parola)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(600);
    };
    const ilkParola = async (yeni) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, ${JSON.stringify(yeni)}); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
      );
      await tikla("Kaydet");
      await bekle(700);
      if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
        await tikla("Şimdi değil");
        await bekle(300);
      }
    };

    if (adim === "olustur") {
      await giris("admin");
      await ilkParola("eski-pc-parola-1");
      // Eski PC'nin verisi (arayüz dışı, hızlı): grup, iki oyuncu, makbuz, belge dosyası
      const g = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
      // plan §37: sezon tarihleri ve bitişli antrenman da pakete girer
      db.sezonTarihKaydet("2026-2027", "2026-09-01", "2027-06-30");
      db.createTraining({ age_group_id: g.id, tarih: "2026-09-10", saat: "17:00", bitis_saat: "18:30", saha: "Saha 1" });
      const o1 = db.createPlayer({
        ad_soyad: "Taşınan Oyuncu",
        dogum_tarihi: "2015-03-03",
        yas_grubu_id: g.id,
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 3500,
        odeme_donemi: "1-10",
      });
      db.createPlayer({
        ad_soyad: "İkinci Oyuncu",
        dogum_tarihi: "2014-05-05",
        yas_grubu_id: g.id,
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 3500,
        odeme_donemi: "1-10",
      });
      const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
      db.createReceipt({
        player_id: o1.id,
        tarih: "2026-09-09",
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 3500, yil: 2026, ay: 9 }],
      });
      fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + o1.id), { recursive: true });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + o1.id, "1-diger-not.txt"), "taşınan belge");
      db.belgeEkle(o1.id, { tip: "diger", dosya_yolu: `oyuncu-${o1.id}/1-diger-not.txt`, orijinal_ad: "not.txt" });
      await tikla("Ayarlar");
      await bekle(400);
      await tikla("Yedekleme");
      await bekle(500);
      // Kısa parola reddedilir (arayüz kuralı, 10 karakter)
      await setInput("input[aria-label='Paket parolası']", "kisa");
      await setInput("input[aria-label='Paket parolası tekrar']", "kisa");
      await tikla("Taşıma Paketi Oluştur");
      check("kısa parola reddedildi, dosya yazılmadı", (await metinVar("Parola en az 10 karakter")) && !fs.existsSync(paketYol));
      // Parolalar farklıysa reddedilir
      await setInput("input[aria-label='Paket parolası']", "tasima-parolasi-1");
      await setInput("input[aria-label='Paket parolası tekrar']", "tasima-parolasi-2");
      await tikla("Taşıma Paketi Oluştur");
      check("farklı parolalar reddedildi", (await metinVar("Parolalar aynı değil")) && !fs.existsSync(paketYol));
      await setInput("input[aria-label='Paket parolası tekrar']", "tasima-parolasi-1");
      await tikla("Taşıma Paketi Oluştur");
      await bekleKosul(() => metinVar("Taşıma paketi kaydedildi"));
      check(
        "taşıma paketi arayüzden oluşturuldu (diyalog → dosya)",
        fs.existsSync(paketYol) && (await metinVar("Taşıma paketi kaydedildi")),
      );
      check(
        "paket düz metin değil",
        !fs.readFileSync(paketYol).includes(Buffer.from("SQLite format 3")) &&
          !fs.readFileSync(paketYol).includes(Buffer.from("taşınan belge")),
      );
      check("parola kutuları temizlendi", (await js(`document.querySelector("input[aria-label='Paket parolası']").value`)) === "");
      fs.writeFileSync(
        beklenenYol,
        JSON.stringify({
          oyuncu: db.listPlayers({ durum: null }).length,
          makbuz: db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts").get().n,
          oyuncuId: o1.id,
          oyuncuAd: o1.ad_soyad,
          makineId: db.getMetaValue("makineId"),
        }),
      );
      if (fail === 0) console.log("TUM KONTROLLER GECTI");
      win.close();
      return;
    }

    if (adim === "geriyukle") {
      const b = JSON.parse(fs.readFileSync(beklenenYol, "utf8"));
      await giris("admin");
      await ilkParola("yeni-pc-parola-1");
      check("yeni PC boş: oyuncu yok", db.listPlayers({ durum: null }).length === 0);
      await tikla("Ayarlar");
      await bekle(400);
      await tikla("Yedekleme");
      await bekle(500);
      await tikla("Paket Dosyası Seç");
      check("seçilen paket adı görünüyor", await metinVar(path.basename(paketYol)));
      await setInput("input[aria-label='Geri yükleme parolası']", "yanlis-parola-99");
      await tikla("Paketi Aç ve Geri Yükle");
      await bekleKosul(() => metinVar("Parola yanlış"));
      check(
        "yanlış parola reddedildi, onay çıkmadı",
        (await metinVar("Parola yanlış")) && !(await js(`!!document.querySelector("[role=dialog]")`)),
      );
      await setInput("input[aria-label='Geri yükleme parolası']", "tasima-parolasi-1");
      await tikla("Paketi Aç ve Geri Yükle");
      await bekleKosul(() => metinVar("Taşıma paketi açıldı"));
      check(
        "doğru parola: özet onayı çıktı (oyuncu/makbuz sayısı)",
        await metinVar(`Taşıma paketi açıldı: ${b.oyuncu} oyuncu, ${b.makbuz} makbuz`),
      );
      await js(`[...document.querySelectorAll("[role=dialog] button")].find((x) => x.textContent.trim() === "Evet")?.click()`);
      await bekleKosul(() => metinVar("Taşıma paketi yüklendi"));
      check("geri yükleme başladı (yeniden başlatma bildirimi)", await metinVar("Taşıma paketi yüklendi"));
      // app.exit (yukarıda sarıldı) veriyi doğrular ve çıkar
      return;
    }

    if (adim === "dogrula") {
      const b = JSON.parse(fs.readFileSync(beklenenYol, "utf8"));
      await giris("eski-pc-parola-1");
      check(
        "yeniden açılışta eski PC'nin parolasıyla giriş, parola değişimi istenmiyor",
        !(await js(`!!document.querySelector("[role=dialog]")`)) && (await metinVar("Pano")),
      );
      await js(`document.querySelector("button[aria-label='Oyuncular']")?.click()`);
      await bekle(700);
      check("taşınan oyuncu arayüzde görünüyor", await metinVar(b.oyuncuAd));
      check(
        "sayılar yeniden açılışta da aynı",
        db.listPlayers({ durum: null }).length === b.oyuncu &&
          db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts").get().n === b.makbuz,
      );
      check(
        "sezon tarihleri ve antrenman bitişi taşındı (plan §37)",
        db.sezonTarihleri("2026-2027").kayitli === true &&
          db.sezonTarihleri("2026-2027").bitis === "2027-06-30" &&
          db.listTrainings("2026-09-10", "2026-09-10").some((t) => t.saat === "17:00" && t.bitis_saat === "18:30"),
      );
      check(
        "yeni PC kendi makine kimliğini üretti (deneme lisansı)",
        !!db.lisansDurumu().makineId && db.lisansDurumu().makineId !== b.makineId,
      );
      if (fail === 0) console.log("TUM KONTROLLER GECTI");
      app.exit(fail === 0 ? 0 : 1);
    }
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
