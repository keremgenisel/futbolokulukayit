// Otomatik güncelleme köprüsü (electron-updater; GitHub Releases: keremgenisel/eyupspor — herkese açık tek depo).
// Yalnız paketli (Setup ile kurulmuş) sürümde iş yapar; geliştirme/test ortamında autoUpdater null → devMode.
// İndirme ve kurma yalnız yönetici; denetleme her oturum. Olaylar ana pencereye "updater:*" kanallarıyla gider.
const { ipcMain, app } = require("electron");

function registerGuncellemeHandlers({ getSession, autoUpdater = null, getWin = () => null }) {
  const guncellemeYok = () => !autoUpdater || !app.isPackaged;
  ipcMain.handle("updater:check", async () => {
    if (!getSession()) return { error: "Oturum gerekli" };
    if (guncellemeYok()) return { devMode: true, current: app.getVersion() };
    try {
      const r = await autoUpdater.checkForUpdates();
      const latest = r?.updateInfo?.version || null;
      return {
        current: app.getVersion(),
        latest,
        available: !!latest && latest !== app.getVersion(),
        notlar: typeof r?.updateInfo?.releaseNotes === "string" ? r.updateInfo.releaseNotes : "",
      };
    } catch (e) {
      return { error: "Güncelleme sunucusuna erişilemedi: " + (e.message || e) };
    }
  });
  ipcMain.handle("updater:download", async () => {
    const s = getSession();
    if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    if (guncellemeYok()) return { error: "Geliştirme modunda güncelleme yok" };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      return { error: "İndirme başarısız: " + (e.message || e) };
    }
  });
  ipcMain.handle("updater:install", () => {
    const s = getSession();
    if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    if (guncellemeYok()) return { error: "Geliştirme modunda güncelleme yok" };
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 300);
    return { ok: true };
  });
  if (autoUpdater) {
    const gonder = (kanal, veri) => {
      const w = getWin();
      if (w && !w.isDestroyed()) w.webContents.send(kanal, veri);
    };
    autoUpdater.on("update-available", (info) => gonder("updater:available", { version: info?.version }));
    autoUpdater.on("download-progress", (p) => gonder("updater:progress", Math.round(p?.percent || 0)));
    autoUpdater.on("update-downloaded", (info) => gonder("updater:downloaded", { version: info?.version }));
    autoUpdater.on("error", (e) => gonder("updater:error", e?.message || "Bilinmeyen hata"));
  }
}
module.exports = { registerGuncellemeHandlers };
