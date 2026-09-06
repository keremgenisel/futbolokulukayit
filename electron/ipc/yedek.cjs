// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ klasörünü zaman damgalı bir klasöre kopyalar.
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında günde bir kez.
const { ipcMain, dialog, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const db = require("../db.cjs");

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

function registerYedekHandlers(getSession) {
  const yetki = () => { if (!getSession()) throw new Error("Oturum gerekli"); };
  ipcMain.handle("yedek:klasorSec", async (e) => {
    yetki();
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    db.setSetting("yedek_klasoru", r.filePaths[0]);
    return { ok: true, klasor: r.filePaths[0] };
  });
  ipcMain.handle("yedek:al", async () => {
    yetki();
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor) return { error: "Önce yedek klasörü seçin" };
    return yedekAl(klasor);
  });
  ipcMain.handle("yedek:durum", () => ({ klasor: db.getSetting("yedek_klasoru"), son: db.getSetting("son_yedek") }));
}

module.exports = { registerYedekHandlers, otomatikYedek, yedekAl };
