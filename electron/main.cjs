const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const db = require("./db.cjs");
const { registerDataHandlers, getSession } = require("./ipc/data.cjs");
const { registerFileHandlers } = require("./ipc/files.cjs");
const { registerCiktiHandlers } = require("./ipc/cikti.cjs");
const { registerYedekHandlers, otomatikYedek } = require("./ipc/yedek.cjs");
const { registerOptimizeHandlers } = require("./ipc/optimize.cjs");
const config = require("./config.cjs");
const server = require("./server.cjs");

// ── Otomatik güncelleme (yalnızca paketlenmiş uygulamada) ──
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
} catch { /* geliştirme modu */ }

app.commandLine.appendSwitch("lang", "tr");

let mainWin = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    show: false, autoHideMenuBar: true,
    title: "Eyüpspor Futbol Okulu",
    backgroundColor: "#F6F4FA",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Güvenlik: dış adreslere gezinme ve yeni pencere yok.
  mainWin.webContents.on("will-navigate", (e, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isLocal = url.startsWith("file://") || (devUrl && url.startsWith(devUrl));
    if (!isLocal) e.preventDefault();
  });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.VITE_DEV_SERVER_URL) mainWin.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWin.loadFile(path.join(__dirname, "../dist/index.html"));

  mainWin.once("ready-to-show", () => mainWin.show());
  mainWin.on("closed", () => { mainWin = null; });
}

// Tek örnek: ikinci kez açılırsa mevcut pencereyi öne getir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); }
  });

  app.whenReady().then(() => {
    db.init();
    // Bu ayın aidat kayıtlarını aç (her açılışta; INSERT OR IGNORE olduğundan tekrar güvenli).
    try { const t = new Date(); db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1); } catch (e) { console.error("[aidat]", e.message); }
    otomatikYedek();

    registerDataHandlers();
    registerFileHandlers(getSession);
    registerCiktiHandlers(getSession);
    registerYedekHandlers(getSession);
    registerOptimizeHandlers(getSession);

    ipcMain.handle("app:version", () => app.getVersion());
    let logoCache = null;
    ipcMain.handle("app:logo", () => {
      if (!logoCache) {
        try { logoCache = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "../build/icon.png")).toString("base64"); } catch { logoCache = ""; }
      }
      return logoCache;
    });

    createWindow();

    // Sunucu modunda gömülü HTTPS sunucusunu aç (istemci PC'ler bağlanabilsin).
    if (config.sunucuMu()) server.baslat({ port: config.oku().port, surum: app.getVersion() }).catch((e) => console.error("[server] başlatılamadı:", e.message));

    if (autoUpdater && app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  });

  app.on("window-all-closed", async () => {
    await server.durdur();
    db.close();
    app.quit();
  });
}
