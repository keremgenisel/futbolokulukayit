// Electron altında gerçek uygulamayı açar (geçici userData), giriş yapar, örnek veri girer ve
// ekranların görüntüsünü alır. Dağıtım öncesi görsel duman testi: `npx electron scripts/tests/smoke-ui.cjs <ciktiDizini>`
// Çıktı: <dizin>/01-giris.png ... ; herhangi bir adım patlarsa çıkış kodu 1.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const cikti = process.argv[2] || path.join(os.tmpdir(), "eyupspor-smoke");
fs.mkdirSync(cikti, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-smoke-data-"));
app.setPath("userData", tmp);
process.env.VITE_DEV_SERVER_URL = "";

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  let kod = 0;
  try {
    const db = require("../../electron/db.cjs");
    const { registerDataHandlers, getSession } = require("../../electron/ipc/data.cjs");
    const { registerFileHandlers } = require("../../electron/ipc/files.cjs");
    const { registerCiktiHandlers } = require("../../electron/ipc/cikti.cjs");
    const { registerYedekHandlers } = require("../../electron/ipc/yedek.cjs");
    const { registerOptimizeHandlers } = require("../../electron/ipc/optimize.cjs");
    const { registerAktarHandlers } = require("../../electron/ipc/aktar.cjs");
    const { ipcMain } = require("electron");
    db.init();
    const t = new Date(); db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
    registerDataHandlers(); registerFileHandlers(getSession); registerCiktiHandlers(getSession); registerYedekHandlers(getSession); registerOptimizeHandlers(getSession); registerAktarHandlers(getSession);
    ipcMain.handle("app:version", () => "smoke");
    ipcMain.handle("app:logo", () => "");

    // Örnek veri
    const u11 = db.createAgeGroup({ ad: "U11", sezon: "2026-2027", sira: 1 });
    const u12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027", sira: 2 });
    const bugun = t.toISOString().slice(0, 10);
    const o1 = db.createPlayer({ tc_no: "10000000001", ad_soyad: "Kerem Yılmaz", dogum_tarihi: "2014-03-14", yas_grubu_id: u12.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10" });
    const o2 = db.createPlayer({ tc_no: "10000000002", ad_soyad: "Kaan Yıldız", dogum_tarihi: "2015-11-02", yas_grubu_id: u11.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10" });
    db.createPlayer({ tc_no: "10000000003", ad_soyad: "Ela Demir", dogum_tarihi: "2017-06-21", yas_grubu_id: u11.id, durum: "deneme", ucret_tipi: "kardes", aylik_aidat: 3000, odeme_donemi: "11-20" });
    db.createUser({ username: "hoca", password: "hoca-sifre-1", ad_soyad: "Ahmet Hoca", role: "kullanici" });
    db.createPlayer({ uyruk: "yabanci", pasaport_no: "U1234567", ad_soyad: "Ivan Petrov", dogum_tarihi: "2014-02-02", yas_grubu_id: u12.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10" });
    db.createPlayer({ tc_no: "10000000004", ad_soyad: "Yusuf Kara", dogum_tarihi: "2013-05-17", yas_grubu_id: u12.id, durum: "sakat", ucret_tipi: "burslu", aylik_aidat: 0, odeme_donemi: "1-10" });
    db.addGuardian(o2.id, { tip: "baba", ad_soyad: "Murat Yıldız", gsm: "0533 000 00 12", whatsapp_no: "0533 000 00 12", veli_mi: 1 });
    db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    db.createReceipt({ player_id: o1.id, tarih: bugun, odeme_yontemi: "nakit", tahsil_eden: "Şerif Çelik", satirlar: [{ fee_item_id: aidat.id, tutar: 3500, aciklama: "Aidat", yil: t.getFullYear(), ay: t.getMonth() + 1 }] });
    const tr = db.createTraining({ age_group_id: u12.id, tarih: bugun, saat: "11:30", saha: "Saha 1" });
    db.setAttendance(tr.id, o1.id, "geldi");

    const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: path.join(__dirname, "../../electron/preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    await win.loadFile(path.join(__dirname, "../../dist/index.html"));
    await bekle(800);
    const shot = async (ad) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(cikti, ad + ".png"), img.toPNG()); console.log("shot", ad); };
    const js = (kod) => win.webContents.executeJavaScript(kod, true);
    const tikla = async (metin, sec = "button") => {
      const ok = await js(`(() => { const b = [...document.querySelectorAll("${sec}")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`);
      if (!ok) throw new Error("Düğme bulunamadı: " + metin);
      await bekle(500);
    };
    await shot("01-giris");
    // Giriş: React kontrollü input → native setter + input event
    await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await tikla("Giriş Yap");
    await bekle(600);
    await shot("02-parola-zorunlu");
    await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const ins = [...document.querySelectorAll("input[type=password]")]; for (const i of ins) { set.call(i, "yeniparola1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`);
    await tikla("Kaydet");
    await bekle(600);
    await shot("03-pano");
    // Kenar menü: daralt (yalnız ikonlar) → ekran görüntüsü → genişlet
    await js(`document.querySelector("button[aria-label='Menüyü daralt']").click()`); await bekle(400);
    await shot("03b-menu-dar");
    await js(`document.querySelector("button[aria-label='Menüyü genişlet']").click()`); await bekle(400);
    await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label='Tesise giriş araması']"); set.call(i, "Ka"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await bekle(600);
    await shot("04-pano-arama");
    await tikla("Oyuncular"); await bekle(500); await shot("05-oyuncular");
    // Boş formda Kaydet: zorunlu alan uyarısı formun üstünde görünmeli
    await tikla("Yeni Oyuncu"); await bekle(400); await tikla("Oyuncuyu Kaydet"); await bekle(300); await shot("05b-yeni-oyuncu-uyari");
    if (!(await js(`!!document.querySelector("[role=dialog] [role=alert]")`))) throw new Error("Zorunlu alan uyarısı görünmedi");
    await js(`document.querySelector("[role=dialog] button[aria-label=Kapat]")?.click()`); await bekle(300);
    await js(`[...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes("Kaan Yıldız")).click()`); await bekle(600); await shot("06-oyuncu-karti");
    await tikla("Belgeler"); await bekle(300); await shot("07-belgeler");
    await tikla("Ödemeler"); await bekle(300); await shot("08-odemeler");
    await tikla("Makbuz Kes"); await bekle(800); await shot("09-tahsilat");
    await tikla("Kaydet"); await bekle(1500); await shot("10-tahsilat-sonrasi");
    await tikla("Yoklama"); await bekle(600);
    await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.startsWith("U12")); b && b.click(); })()`); await bekle(600); await shot("11-yoklama");
    await tikla("Raporlar"); await bekle(400); await tikla("Önizle"); await bekle(600); await shot("12-raporlar");
    await tikla("Yaş Grupları"); await bekle(400); await shot("13-gruplar");
    await tikla("Ayarlar"); await bekle(400); await tikla("Kurulum Sihirbazını Aç"); await bekle(500); await shot("13a-kurulum-sihirbazi");
    await js(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")?.click()`); await bekle(400);
    await tikla("Ayarlar"); await bekle(400); await tikla("Aidat Kalemleri"); await bekle(500);
    await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const [sel, v] of [["input[aria-label='Forma fiyatı']", "9000"], ["input[aria-label='Mont fiyatı']", "8000"]]) { const i = document.querySelector(sel); set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`); await bekle(300); await shot("13b-aidat-kalemleri");
    await tikla("Vazgeç"); await bekle(200); // kaydedilmemiş değişiklik uyarısı sonraki bölüm geçişini engellemesin
    await tikla("Kullanıcılar"); await bekle(500); await shot("13c-kullanicilar");
    await tikla("Lisans"); await bekle(400); await shot("14-lisans");
    await tikla("Yeni Sezon"); await bekle(600); await js(`document.querySelector("input[aria-label='Kerem Yılmaz yeniledi']")?.click()`); await bekle(300); await shot("14b-yeni-sezon");
    await tikla("Yedekleme"); await bekle(400); await shot("15-yedekleme");
    await tikla("Resim ve Belge Optimizasyonu"); await bekle(300); await tikla("Analiz Et"); await bekle(600); await shot("15b-optimizasyon");
    // Makbuz PDF üretildi mi?
    const makbuzlar = db.listReceipts(o2.id);
    if (!makbuzlar.length || !makbuzlar[0].pdf_yolu) throw new Error("Makbuz PDF üretilmedi");
    const pdfYol = path.join(db.getUploadsDir(), makbuzlar[0].pdf_yolu);
    if (!fs.existsSync(pdfYol)) throw new Error("PDF dosyası yok: " + pdfYol);
    fs.copyFileSync(pdfYol, path.join(cikti, "makbuz.pdf"));
    console.log("SMOKE OK");
  } catch (e) { console.error("SMOKE HATA:", e && e.stack); kod = 1; }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  app.exit(kod);
});
