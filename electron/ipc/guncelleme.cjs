// Otomatik güncelleme köprüsü (electron-updater; GitHub Releases: keremgenisel/futbolokulukayit — herkese açık tek depo).
// Yalnız paketli (Setup ile kurulmuş) sürümde iş yapar; geliştirme/test ortamında autoUpdater null → devMode.
// İndirme ve kurma yalnız yönetici; denetleme her oturum. Olaylar ana pencereye "updater:*" kanallarıyla gider.
// 12.09.2026 (kulüp: "1.1.0'da banner gelmedi"): açılış denetimi giriş ekranındayken biter, şerit ise girişten SONRA bağlanır →
// olay kaçıyordu. Son durum burada saklanır (`sonDurum`), şerit bağlanınca `updater:durum` ile okur.
const { ipcMain, app } = require("electron");
const koruma = require("./koruma.cjs");

/** Son güncelleyici olayı → şerit durumu (saf; test edilir). */
function sonDurumGuncelle(onceki, olay, veri) {
  if (olay === "available")
    return onceki.asama === "indiriliyor" || onceki.asama === "indirildi" ? onceki : { asama: "var", surum: veri?.version || "" };
  if (olay === "progress") return { ...onceki, asama: "indiriliyor", yuzde: Number(veri) || 0 };
  if (olay === "downloaded") return { asama: "indirildi", surum: veri?.version || onceki.surum || "" };
  if (olay === "error") return onceki.asama === "yok" ? onceki : { ...onceki, asama: "hata", mesaj: String(veri || "Bilinmeyen hata") };
  return onceki;
}

function registerGuncellemeHandlers({ getSession, autoUpdater = null, getWin = () => null }) {
  const guncellemeYok = () => !autoUpdater || !app.isPackaged;
  let sonDurum = { asama: "yok" }; // { asama: yok|var|indiriliyor|indirildi|hata, surum?, yuzde?, mesaj? }
  const oturumHata = koruma.donerek(getSession);
  const yoneticiHata = koruma.donerek(getSession, { yonetici: true });
  // Şerit bağlanınca (girişten sonra) kaçırdığı olayı buradan alır
  ipcMain.handle("updater:durum", () => {
    const hata = oturumHata();
    if (hata) return hata;
    return { ...sonDurum };
  });
  ipcMain.handle("updater:check", async () => {
    const hata = oturumHata();
    if (hata) return hata;
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
    const hata = yoneticiHata();
    if (hata) return hata;
    if (guncellemeYok()) return { error: "Geliştirme modunda güncelleme yok" };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      return { error: "İndirme başarısız: " + (e.message || e) };
    }
  });
  ipcMain.handle("updater:install", () => {
    const hata = yoneticiHata();
    if (hata) return hata;
    if (guncellemeYok()) return { error: "Geliştirme modunda güncelleme yok" };
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 300);
    return { ok: true };
  });
  if (autoUpdater) {
    const gonder = (olay, veri) => {
      sonDurum = sonDurumGuncelle(sonDurum, olay, veri);
      const w = getWin();
      if (w && !w.isDestroyed()) w.webContents.send("updater:" + olay, veri);
    };
    autoUpdater.on("update-available", (info) => gonder("available", { version: info?.version }));
    autoUpdater.on("download-progress", (p) => gonder("progress", Math.round(p?.percent || 0)));
    autoUpdater.on("update-downloaded", (info) => gonder("downloaded", { version: info?.version }));
    autoUpdater.on("error", (e) => gonder("error", e?.message || "Bilinmeyen hata"));
  }
}
module.exports = { registerGuncellemeHandlers, sonDurumGuncelle };
