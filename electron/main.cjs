const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./db.cjs");
const { registerDataHandlers } = require("./ipc/data.cjs");

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
    registerDataHandlers();

    ipcMain.handle("app:version", () => app.getVersion());
    ipcMain.handle("app:printHtml", async (_e, html) => {
      const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
      await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      w.webContents.print({ silent: false, printBackground: true }, () => w.close());
      return { ok: true };
    });

    createWindow();

    if (autoUpdater && app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  });

  app.on("window-all-closed", () => {
    db.close();
    app.quit();
  });
}
