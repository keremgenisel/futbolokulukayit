const { app, BrowserWindow, ipcMain, shell, Menu, session, dialog } = require("electron");
const { pathToFileURL } = require("url");
const path = require("path");
const db = require("./db.cjs");
const { registerDataHandlers, getSession } = require("./ipc/data.cjs");
const { registerGuncellemeHandlers } = require("./ipc/guncelleme.cjs");
const { registerFileHandlers } = require("./ipc/files.cjs");
const { registerCiktiHandlers } = require("./ipc/cikti.cjs");
const { registerYedekHandlers, otomatikYedek, geciciArtiklariTemizle } = require("./ipc/yedek.cjs");
const { registerOptimizeHandlers } = require("./ipc/optimize.cjs");
const { registerAktarHandlers } = require("./ipc/aktar.cjs");
const config = require("./config.cjs");
const server = require("./server.cjs");
const istemci = require("./istemci.cjs");
const { markaOku } = require("./marka.cjs");
const { ciktiArtiklariTemizle } = require("./geciciCikti.cjs");
const { kenarKopyalariniTemizle } = require("./ipc/yedekCekirdek.cjs");

// ── Otomatik güncelleme (yalnızca paketlenmiş uygulamada) ──
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
} catch {
  /* geliştirme modu */
}

app.commandLine.appendSwitch("lang", "tr");

let mainWin = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Futbol Okulu Kayıt Programı",
    backgroundColor: "#F6F4FA",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged, // inceleme #11: paketli sürümde geliştirici araçları kapalı
    },
  });

  // Güvenlik (inceleme #12): yalnız uygulamanın kendi sayfasına (dist/index.html ya da dev sunucusu) gezinilir;
  // başka file:// adresleri dahil her şey engellenir. Yeni pencere yok.
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const kendiSayfasi = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  const izinliMi = (url) =>
    url === kendiSayfasi ||
    url.startsWith(kendiSayfasi + "#") ||
    url.startsWith(kendiSayfasi + "?") ||
    (!!devUrl && url.startsWith(devUrl));
  mainWin.webContents.on("will-navigate", (e, url) => {
    if (!izinliMi(url)) e.preventDefault();
  });
  mainWin.webContents.on("will-redirect", (e, url) => {
    if (!izinliMi(url)) e.preventDefault();
  });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.VITE_DEV_SERVER_URL) mainWin.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWin.loadFile(path.join(__dirname, "../dist/index.html"));

  mainWin.once("ready-to-show", () => mainWin.show());
  mainWin.on("closed", () => {
    mainWin = null;
  });
}

// Tek örnek: ikinci kez açılırsa mevcut pencereyi öne getir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(() => {
    // İnceleme #11: paketli sürümde menü çubuğu ve kısayolları kapalı (macOS'ta Cmd+C/V menüye bağlı olduğundan yalnız Windows/Linux);
    // kamera/mikrofon/konum gibi izin istekleri reddedilir (uygulama hiçbirini kullanmaz). Tek istisna panoya YAZMA:
    // telefon numarasına tıklayınca kopyalama (Telefon bileşeni) buna ihtiyaç duyar; pano OKUMA yine kapalı (09.09.2026).
    if (app.isPackaged && process.platform !== "darwin") Menu.setApplicationMenu(null);
    const PANO_YAZMA = "clipboard-sanitized-write";
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === PANO_YAZMA));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === PANO_YAZMA);
    geciciArtiklariTemizle(); // inceleme #8: kaba kapanıştan kalan düz (şifresiz) geçici kopyalar
    ciktiArtiklariTemizle(); // 2. inceleme #2: 24 saatten eski geçici makbuz/yoklama PDF'leri
    kenarKopyalariniTemizle(app.getPath("userData")); // 2. inceleme #5: 30 günden eski .pre-restore kopyaları
    try {
      db.init();
    } catch (e) {
      // Anahtar çözülemedi / dosya bozuk: sessizce boş pencere açmak yerine nedeni göster ve çık (veriye dokunulmaz)
      console.error("[db] açılamadı:", e.message);
      dialog.showErrorBox("Veritabanı açılamadı", e.message);
      app.exit(1);
      return;
    }
    // Bu ayın aidat kayıtlarını aç: açılışta, sonra saatte bir ve pencere öne gelince (uygulama ay sonunda
    // açık kalırsa yeni ayın borçları yeniden başlatma beklemeden görünsün). INSERT OR IGNORE → tekrar güvenli.
    const aidatKontrol = () => {
      try {
        const t = new Date();
        db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
      } catch (e) {
        console.error("[aidat]", e.message);
      }
    };
    aidatKontrol();
    setInterval(aidatKontrol, 60 * 60 * 1000).unref?.();
    app.on("browser-window-focus", aidatKontrol);
    otomatikYedek();

    registerDataHandlers();
    registerFileHandlers(getSession);
    registerCiktiHandlers(getSession);
    registerYedekHandlers(getSession);
    registerOptimizeHandlers(getSession);
    registerAktarHandlers(getSession);

    ipcMain.handle("app:version", () => app.getVersion());
    registerGuncellemeHandlers({ getSession, autoUpdater, getWin: () => mainWin });
    // WhatsApp "tıkla ve yaz" (plan §13): yalnız https://wa.me/<90…> açılır; renderer başka dış adres açamaz.
    ipcMain.handle("app:whatsappAc", async (_e, numara, metin) => {
      if (!getSession()) return { error: "Oturum gerekli" };
      const n = String(numara || "").replace(/\D/g, "");
      if (n && !/^90\d{10}$/.test(n)) return { error: "Geçersiz WhatsApp numarası" };
      // n boş → WhatsApp "sohbet seç" ekranı (veli grubuna tek mesaj); dolu → o kişiye
      const url = `https://wa.me/${n}?text=${encodeURIComponent(String(metin || "").slice(0, 4000))}`;
      try {
        await shell.openExternal(url);
        return { ok: true };
      } catch (e) {
        return { error: "WhatsApp açılamadı: " + e.message };
      }
    });
    // Marka (plan §32.5): giriş ekranı oturumsuzdur; yalnız kulüp adı/kısa ad/kuruluş yılı/logo/iki renk döner (kişisel veri yok).
    // İstemci modunda sunucunun oturumsuz /api/marka ucu; ulaşılamazsa uygulama varsayılanı.
    const yerelMarka = () => markaOku({ getSetting: db.getSetting, uploadsDir: db.getUploadsDir() });
    ipcMain.handle("app:marka", async () => {
      if (config.istemciMi()) {
        try {
          const r = await istemci.istek("/api/marka", { auth: false, timeoutMs: 5000 });
          if (r && r.ok && r.marka) return r.marka;
        } catch {
          /* sunucuya ulaşılamadı */
        }
        return markaOku({ getSetting: () => null, uploadsDir: "" });
      }
      return yerelMarka();
    });
    // Kulüp logosu (makbuz/yoklama formu/rapor başlığı): Ayarlar > Kulüp'ten yüklenen dosya; yoksa "" (logosuz basılır)
    ipcMain.handle("app:logo", async () => {
      if (config.istemciMi()) {
        try {
          const r = await istemci.istek("/api/marka", { auth: false, timeoutMs: 5000 });
          return (r && r.ok && r.marka && r.marka.logo) || "";
        } catch {
          return "";
        }
      }
      return yerelMarka().logo;
    });

    createWindow();

    // Sunucu modunda gömülü HTTPS sunucusunu aç (istemci PC'ler bağlanabilsin).
    if (config.sunucuMu())
      server.baslat({ port: config.oku().port, surum: app.getVersion() }).catch((e) => console.error("[server] başlatılamadı:", e.message));

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
