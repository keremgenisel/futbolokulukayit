// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ klasörünü zaman damgalı bir klasöre kopyalar.
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında günde bir kez.
const { ipcMain, dialog, BrowserWindow, app } = require("electron");
const fs = require("fs");
const path = require("path");
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

function yedekAl(hedefKok) {
  const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const hedef = path.join(hedefKok, `eyupspor-yedek-${damga}`);
  fs.mkdirSync(hedef, { recursive: true });
  db.checkpoint();
  fs.copyFileSync(db.getDbPath(), path.join(hedef, "data.db"));
  kopyalaKlasor(db.getUploadsDir(), path.join(hedef, "uploads"));
  db.setSetting("son_yedek", new Date().toISOString());
  return { ok: true, yol: hedef };
}

// Günde bir otomatik yedek (açılışta çağrılır). Hata uygulamayı durdurmaz.
function otomatikYedek() {
  try {
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor || !fs.existsSync(klasor)) return;
    const son = db.getSetting("son_yedek") || "";
    if (son.slice(0, 10) === new Date().toISOString().slice(0, 10)) return;
    yedekAl(klasor);
    // 30'dan eski yedekleri sil
    const eski = fs.readdirSync(klasor).filter((a) => a.startsWith("eyupspor-yedek-")).sort();
    for (const a of eski.slice(0, Math.max(0, eski.length - 30))) fs.rmSync(path.join(klasor, a), { recursive: true, force: true });
  } catch (e) { console.error("[yedek] otomatik yedek başarısız:", e.message); }
}

// ── Geri yükleme çekirdeği (relaunch yapmaz; test edilebilir) ──
// Mevcut data.db ve uploads/ önce "<ad>.pre-restore-<damga>" olarak kenara alınır, sonra yedek
// kopyalanır. Herhangi bir adım patlarsa kenara alınanlar geri konur. Çağıran DB'yi kapatmış olmalı.
function geriYukleCekirdek(yedekKlasoru) {
  const kaynakDb = path.join(yedekKlasoru, "data.db");
  const kaynakUp = path.join(yedekKlasoru, "uploads");
  const bilgi = db.yedekBilgisi(kaynakDb);
  if (bilgi.error) return bilgi;
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
    return { ok: true, kenarDb, kenarUp, bilgi };
  } catch (e) {
    // Geri al
    try { fs.rmSync(hedefDb, { force: true }); if (fs.existsSync(kenarDb)) fs.renameSync(kenarDb, hedefDb); } catch {}
    try { fs.rmSync(hedefUp, { recursive: true, force: true }); if (fs.existsSync(kenarUp)) fs.renameSync(kenarUp, hedefUp); } catch {}
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
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: "Yedek klasörünü seçin (içinde data.db olmalı)", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    const klasor = r.filePaths[0];
    const bilgi = db.yedekBilgisi(path.join(klasor, "data.db"));
    return bilgi.error ? bilgi : { ok: true, klasor, ...bilgi };
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

module.exports = { registerYedekHandlers, otomatikYedek, yedekAl, geriYukleCekirdek };
