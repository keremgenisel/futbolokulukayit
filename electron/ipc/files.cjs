// Belge ve fotoğraf dosyaları: kullanıcı dosya seçer, uploads/oyuncu-<id>/ altına kopyalanır,
// documents tablosuna kaydedilir. Renderer dosya sistemini görmez; görüntüleme data: URL ile.
const { ipcMain, dialog, shell, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const db = require("../db.cjs");
const config = require("../config.cjs");
const koruma = require("./koruma.cjs");
const istemci = require("../istemci.cjs");
const { optimizeImage } = require("../imageOptimize.cjs");
const { belgeGirdiDogrula } = require("../belgeDogrula.cjs");
const { kulupLogoKaydet, kulupLogoKaldir, LOGO_MAX_BAYT } = require("../kulupLogo.cjs");

// Güvenlik 2. inceleme #8: .doc/.docx YÜKLENMEZ (makro taşıyabilir; sistem uygulamasıyla açılır). Daha önce yüklenmiş dosyalar açılmaya devam eder.
const IZINLI_UZANTI = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"]);
const MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const guvenliAd = (ad) =>
  String(ad)
    .replace(/[^\w.\-çğıöşüÇĞİÖŞÜ ]+/g, "_")
    .slice(0, 80);

// Tekil belge (vesikalık) değiştirildiğinde eski dosyaları kaldır; kayıt zaten db.belgeEkle'de silindi.
function eskiDosyalariSil(yollar) {
  for (const y of yollar || []) {
    try {
      fs.unlinkSync(uploadsIci(y));
    } catch {
      /* dosya zaten yok */
    }
  }
}

// uploads dizini dışına çıkmayı engelle (yol geçişi).
function uploadsIci(p) {
  const kok = path.resolve(db.getUploadsDir());
  const tam = path.resolve(kok, p);
  if (!tam.startsWith(kok + path.sep) && tam !== kok) throw new Error("Geçersiz dosya yolu");
  return tam;
}

// Kişisel veri silme çekirdeği (IPC ve sunucu ortak): DB işlemi, ardından dosyalar ve oyuncu klasörü.
function kisiselVeriSilCekirdek(playerId, kullanici) {
  const r = db.oyuncuKisiselVeriSil(playerId, kullanici);
  eskiDosyalariSil(r.dosyalar);
  try {
    fs.rmSync(uploadsIci(r.klasor), { recursive: true, force: true });
  } catch {
    /* klasör yok */
  }
  return { ok: true, makbuz: r.makbuz };
}

function registerFileHandlers(getSession) {
  const yetki = koruma.firlatarak(getSession, { saltOkunurMu: () => !config.istemciMi() && db.lisansSaltOkunurMu() });
  const yonetici = koruma.firlatarak(getSession, { yonetici: true, saltOkunurMu: () => !config.istemciMi() && db.lisansSaltOkunurMu() });
  const oturum = koruma.firlatarak(getSession);

  // Belge yükle: dialog aç, kopyala, kaydet. Dönüş: yeni belge kaydı veya { iptal: true }.
  ipcMain.handle("files:addDocument", async (e, playerId, tip, gecerlilik) => {
    yetki();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: "Belge seç",
      properties: ["openFile"],
      filters: [{ name: "Belge", extensions: ["pdf", "jpg", "jpeg", "png", "webp", "heic"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    ({ playerId, tip, gecerlilik } = belgeGirdiDogrula({ playerId, tip, gecerlilik }));
    if (!config.istemciMi() && !db.getPlayer(playerId)) throw new Error("Oyuncu bulunamadı");
    const kaynak = r.filePaths[0];
    const uz = path.extname(kaynak).toLowerCase();
    if (!IZINLI_UZANTI.has(uz)) throw new Error("Bu dosya türü desteklenmiyor");
    if (fs.statSync(kaynak).size > 25 * 1024 * 1024) throw new Error("Dosya 25 MB'tan büyük");
    if (config.istemciMi()) {
      return istemci.istek("/api/files/addDocument", {
        method: "POST",
        timeoutMs: 120000,
        body: {
          playerId: Number(playerId),
          tip,
          gecerlilik: gecerlilik || null,
          ad: path.basename(kaynak),
          base64: fs.readFileSync(kaynak).toString("base64"),
        },
      });
    }
    const klasor = path.join("oyuncu-" + Number(playerId));
    fs.mkdirSync(uploadsIci(klasor), { recursive: true });
    const ad = `${Date.now()}-${tip}-${guvenliAd(path.basename(kaynak))}`;
    const hedef = path.join(klasor, ad);
    fs.writeFileSync(uploadsIci(hedef), optimizeImage(fs.readFileSync(kaynak), uz)); // jpg/png nazikçe küçültülür
    const { id, silinen } = db.belgeEkle(Number(playerId), {
      tip,
      dosya_yolu: hedef,
      orijinal_ad: path.basename(kaynak),
      gecerlilik_tarihi: gecerlilik || null,
    });
    eskiDosyalariSil(silinen);
    return { ok: true, id, dosya_yolu: hedef };
  });

  ipcMain.handle("files:deleteDocument", async (_e, docId) => {
    yetki();
    if (config.istemciMi()) return istemci.istek("/api/files/deleteDocument", { method: "POST", body: { docId: Number(docId) } });
    const belge = db.getDocument(Number(docId));
    if (belge) {
      try {
        fs.unlinkSync(uploadsIci(belge.dosya_yolu));
      } catch {
        /* dosya zaten yok */
      }
      db.deleteDocument(belge.id);
    }
    return { ok: true };
  });

  // Makbuzlu oyuncunun kişisel verilerini sil (plan §31): yalnız yönetici; DB satırları + belge/foto/makbuz PDF dosyaları +
  // uploads/oyuncu-<id>/ klasörü. Makbuzlar kalır. İstemci modunda sunucu yapar.
  ipcMain.handle("files:oyuncuKisiselVeriSil", async (_e, playerId) => {
    yonetici();
    if (config.istemciMi())
      return istemci.istek("/api/files/oyuncuKisiselVeriSil", { method: "POST", body: { playerId: Number(playerId) } });
    const s = getSession();
    return kisiselVeriSilCekirdek(Number(playerId), s.ad_soyad || s.username);
  });

  // Kulüp logosu (plan §32.3): yalnız yönetici; diyalogdan PNG/JPEG seçilir, küçültülüp uploads/kulup/ altına yazılır
  ipcMain.handle("files:kulupLogoSec", async (e) => {
    yonetici();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: "Kulüp logosu seç",
      properties: ["openFile"],
      filters: [{ name: "Logo (PNG, JPEG)", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    const kaynak = r.filePaths[0];
    const uz = path.extname(kaynak).toLowerCase();
    if (fs.statSync(kaynak).size > LOGO_MAX_BAYT) throw new Error("Logo 5 MB'tan büyük");
    if (config.istemciMi())
      return istemci.istek("/api/files/kulupLogoSec", {
        method: "POST",
        timeoutMs: 60000,
        body: { uzanti: uz, base64: fs.readFileSync(kaynak).toString("base64") },
      });
    return kulupLogoKaydet(fs.readFileSync(kaynak), uz);
  });
  ipcMain.handle("files:kulupLogoSil", async () => {
    yonetici();
    if (config.istemciMi()) return istemci.istek("/api/files/kulupLogoSil", { method: "POST", body: {} });
    return kulupLogoKaldir();
  });

  ipcMain.handle("files:open", async (_e, yol) => {
    oturum();
    if (config.istemciMi()) return shell.openPath(await istemci.dosyaIndir(String(yol)));
    return shell.openPath(uploadsIci(yol));
  });

  // Görsel/PDF önizleme için data URL (renderer sandbox'ta dosya okuyamaz).
  ipcMain.handle("files:dataUrl", async (_e, yol) => {
    oturum();
    if (config.istemciMi()) return (await istemci.istek("/api/files/dataUrl?yol=" + encodeURIComponent(String(yol)))).dataUrl;
    const tam = uploadsIci(yol);
    if (!fs.existsSync(tam)) return null;
    const mime = MIME[path.extname(tam).toLowerCase()];
    if (!mime) return null;
    return `data:${mime};base64,${fs.readFileSync(tam).toString("base64")}`;
  });
}

module.exports = { registerFileHandlers, uploadsIci, eskiDosyalariSil, kisiselVeriSilCekirdek };
