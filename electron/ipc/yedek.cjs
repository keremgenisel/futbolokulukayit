// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ (belgeler, vesikalıklar, makbuz PDF'leri)
// TEK bir zip dosyasına yazılır: eyupspor-yedek-<damga>.zip. Taşırken bir şey unutulmaz.
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında günde bir kez.
// Geri yükleme zip'ten (yeni) veya klasörden (eski biçim) yapılabilir.
const { ipcMain, dialog, BrowserWindow, app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { zipSync, unzipSync } = require("fflate"); // saf JS zip; native bağımlılık yok
const db = require("../db.cjs");
const config = require("../config.cjs");

function kopyalaKlasor(kaynak, hedef) {
  if (!fs.existsSync(kaynak)) return;
  fs.mkdirSync(hedef, { recursive: true });
  for (const ad of fs.readdirSync(kaynak)) {
    const k = path.join(kaynak, ad), h = path.join(hedef, ad);
    if (fs.statSync(k).isDirectory()) kopyalaKlasor(k, h); else fs.copyFileSync(k, h);
  }
}

// Klasördeki tüm dosyaları zip girdisi olarak toplar (yol ayırıcı her zaman "/").
function zipGirdileriTopla(kok, onek, girdiler) {
  if (!fs.existsSync(kok)) return;
  for (const ad of fs.readdirSync(kok)) {
    const k = path.join(kok, ad);
    if (fs.statSync(k).isDirectory()) zipGirdileriTopla(k, onek + ad + "/", girdiler);
    else girdiler[onek + ad] = [new Uint8Array(fs.readFileSync(k)), { level: 0 }]; // resim/pdf/şifreli db zaten sıkışık
  }
}

function yedekAl(hedefKok) {
  const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const hedef = path.join(hedefKok, `eyupspor-yedek-${damga}.zip`);
  fs.mkdirSync(hedefKok, { recursive: true });
  db.checkpoint();
  const girdiler = { "data.db": [new Uint8Array(fs.readFileSync(db.getDbPath())), { level: 0 }] };
  zipGirdileriTopla(db.getUploadsDir(), "uploads/", girdiler);
  const gecici = hedef + ".tmp";
  fs.writeFileSync(gecici, Buffer.from(zipSync(girdiler)));
  fs.renameSync(gecici, hedef);
  db.setSetting("son_yedek", new Date().toISOString());
  return { ok: true, yol: hedef, dosya: Object.keys(girdiler).length - 1 };
}

// Zip yedeğini geçici klasöre güvenle açar (yol geçişi/mutlak yol reddedilir). Dönüş: klasör yolu.
function zipAc(zipYol) {
  const arsiv = unzipSync(new Uint8Array(fs.readFileSync(zipYol)));
  if (!arsiv["data.db"]) throw new Error("Zip içinde data.db yok; bu bir Eyüpspor yedeği değil");
  const hedef = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-geri-"));
  const kok = path.resolve(hedef);
  for (const [ad, veri] of Object.entries(arsiv)) {
    if (ad.endsWith("/")) continue; // klasör girdisi
    if (path.isAbsolute(ad) || ad.split("/").includes("..") || ad.includes("\\")) throw new Error("Yedek içinde geçersiz dosya yolu: " + ad);
    const tam = path.resolve(kok, ad);
    if (!tam.startsWith(kok + path.sep)) throw new Error("Yedek içinde geçersiz dosya yolu: " + ad);
    fs.mkdirSync(path.dirname(tam), { recursive: true });
    fs.writeFileSync(tam, Buffer.from(veri));
  }
  return hedef;
}

// Yedek zip mi klasör mü? Klasöre çevirip özet döner; zip için geçici klasör de döner (çağıran siler).
function yedekHazirla(yol) {
  try {
    if (fs.existsSync(yol) && fs.statSync(yol).isFile()) {
      if (!/\.zip$/i.test(yol)) return { error: "Yedek dosyası .zip olmalı" };
      const klasor = zipAc(yol);
      const bilgi = db.yedekBilgisi(path.join(klasor, "data.db"));
      if (bilgi.error) { fs.rmSync(klasor, { recursive: true, force: true }); return bilgi; }
      return { ok: true, klasor, gecici: true, ...bilgi };
    }
    const bilgi = db.yedekBilgisi(path.join(yol, "data.db"));
    return bilgi.error ? bilgi : { ok: true, klasor: yol, gecici: false, ...bilgi };
  } catch (e) { return { error: "Yedek açılamadı: " + e.message }; }
}

// Günde bir otomatik yedek (açılışta çağrılır). Hata uygulamayı durdurmaz.
function otomatikYedek() {
  try {
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor || !fs.existsSync(klasor)) return;
    const son = db.getSetting("son_yedek") || "";
    if (son.slice(0, 10) === new Date().toISOString().slice(0, 10)) return;
    yedekAl(klasor);
    // 30'dan eski yedekleri sil (zip ve eski biçim klasörler birlikte)
    const eski = fs.readdirSync(klasor).filter((a) => a.startsWith("eyupspor-yedek-") && !a.endsWith(".tmp")).sort();
    for (const a of eski.slice(0, Math.max(0, eski.length - 30))) fs.rmSync(path.join(klasor, a), { recursive: true, force: true });
  } catch (e) { console.error("[yedek] otomatik yedek başarısız:", e.message); }
}

// ── Geri yükleme çekirdeği (relaunch yapmaz; test edilebilir) ──
// Mevcut data.db ve uploads/ önce "<ad>.pre-restore-<damga>" olarak kenara alınır, sonra yedek
// kopyalanır. Herhangi bir adım patlarsa kenara alınanlar geri konur. Çağıran DB'yi kapatmış olmalı.
// yedekYolu: .zip dosyası (yeni) ya da içinde data.db olan klasör (eski biçim).
function geriYukleCekirdek(yedekYolu) {
  const hazir = yedekHazirla(String(yedekYolu || ""));
  if (hazir.error) return hazir;
  const kaynakDb = path.join(hazir.klasor, "data.db");
  const kaynakUp = path.join(hazir.klasor, "uploads");
  const bilgi = { ok: true, oyuncu: hazir.oyuncu, makbuz: hazir.makbuz, sonMakbuz: hazir.sonMakbuz, schema: hazir.schema };
  const temizle = () => { if (hazir.gecici) { try { fs.rmSync(hazir.klasor, { recursive: true, force: true }); } catch {} } };
  const hedefDb = db.getDbPath();
  const hedefUp = db.getUploadsDir();
  const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const kenarDb = hedefDb + ".pre-restore-" + damga;
  const kenarUp = hedefUp + ".pre-restore-" + damga;
  db.close();
  try {
    for (const ek of ["", "-wal", "-shm"]) { try { fs.rmSync(hedefDb + ek + ".tmp", { force: true }); } catch {} }
    if (fs.existsSync(hedefDb)) fs.renameSync(hedefDb, kenarDb);
    for (const ek of ["-wal", "-shm"]) { try { fs.rmSync(hedefDb + ek, { force: true }); } catch {} }
    if (fs.existsSync(hedefUp)) fs.renameSync(hedefUp, kenarUp);
    fs.copyFileSync(kaynakDb, hedefDb);
    kopyalaKlasor(kaynakUp, hedefUp);
    temizle();
    return { ok: true, kenarDb, kenarUp, bilgi };
  } catch (e) {
    // Geri al
    try { fs.rmSync(hedefDb, { force: true }); if (fs.existsSync(kenarDb)) fs.renameSync(kenarDb, hedefDb); } catch {}
    try { fs.rmSync(hedefUp, { recursive: true, force: true }); if (fs.existsSync(kenarUp)) fs.renameSync(kenarUp, hedefUp); } catch {}
    temizle();
    return { error: "Geri yükleme başarısız, eski veriler korundu: " + e.message };
  }
}

function registerYedekHandlers(getSession) {
  const yetki = () => { if (!getSession()) throw new Error("Oturum gerekli"); };
  const istemciHata = () => ({ error: "Yedek yalnızca sunucu bilgisayarında alınır" });
  ipcMain.handle("yedek:klasorSec", async (e) => {
    yetki();
    if (config.istemciMi()) return istemciHata();
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    db.setSetting("yedek_klasoru", r.filePaths[0]);
    return { ok: true, klasor: r.filePaths[0] };
  });
  ipcMain.handle("yedek:al", async () => {
    yetki();
    if (config.istemciMi()) return istemciHata();
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor) return { error: "Önce yedek klasörü seçin" };
    return yedekAl(klasor);
  });
  // Geri yükleme: klasör seç → doğrula (özet göster) → onay → geri yükle → uygulamayı yeniden başlat.
  ipcMain.handle("yedek:geriYukleSec", async (e) => {
    const s = getSession();
    if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) return istemciHata();
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: "Yedek dosyasını seçin (eyupspor-yedek-….zip)", properties: ["openFile"], filters: [{ name: "Eyüpspor yedeği", extensions: ["zip"] }] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    const yol = r.filePaths[0];
    const h = yedekHazirla(yol);
    if (h.error) return h;
    if (h.gecici) { try { fs.rmSync(h.klasor, { recursive: true, force: true }); } catch {} } // özet için açıldı; asıl geri yükleme yeniden açar
    return { ok: true, klasor: yol, oyuncu: h.oyuncu, makbuz: h.makbuz, sonMakbuz: h.sonMakbuz };
  });
  ipcMain.handle("yedek:geriYukle", async (_e, klasor) => {
    const s = getSession();
    if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) return istemciHata();
    const r = geriYukleCekirdek(String(klasor || ""));
    if (r.error) { try { db.init(); } catch {} return r; }
    // Yeni veriyle temiz açılış için uygulamayı yeniden başlat.
    setTimeout(() => { app.relaunch(); app.exit(0); }, 400);
    return { ok: true };
  });
  ipcMain.handle("yedek:durum", () => config.istemciMi() ? { klasor: null, son: null, istemci: true } : ({ klasor: db.getSetting("yedek_klasoru"), son: db.getSetting("son_yedek") }));
}

module.exports = { registerYedekHandlers, otomatikYedek, yedekAl, geriYukleCekirdek, yedekHazirla };
