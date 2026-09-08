// Belge ve fotoğraf dosyaları: kullanıcı dosya seçer, uploads/oyuncu-<id>/ altına kopyalanır,
// documents tablosuna kaydedilir. Renderer dosya sistemini görmez; görüntüleme data: URL ile.
const { ipcMain, dialog, shell, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const db = require("../db.cjs");
const config = require("../config.cjs");
const istemci = require("../istemci.cjs");
const { optimizeImage } = require("../imageOptimize.cjs");
const { belgeGirdiDogrula } = require("../belgeDogrula.cjs");

const IZINLI_UZANTI = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".doc", ".docx"]);
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

function registerFileHandlers(getSession) {
  const yetki = () => {
    if (!getSession()) throw new Error("Oturum gerekli");
    if (!config.istemciMi() && db.lisansSaltOkunurMu()) throw new Error("Lisans salt okunur modda");
  };

  // Belge yükle: dialog aç, kopyala, kaydet. Dönüş: yeni belge kaydı veya { iptal: true }.
  ipcMain.handle("files:addDocument", async (e, playerId, tip, gecerlilik) => {
    yetki();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: "Belge seç",
      properties: ["openFile"],
      filters: [{ name: "Belge", extensions: ["pdf", "jpg", "jpeg", "png", "webp", "heic", "doc", "docx"] }],
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

  ipcMain.handle("files:open", async (_e, yol) => {
    if (!getSession()) throw new Error("Oturum gerekli");
    if (config.istemciMi()) return shell.openPath(await istemci.dosyaIndir(String(yol)));
    return shell.openPath(uploadsIci(yol));
  });

  // Görsel/PDF önizleme için data URL (renderer sandbox'ta dosya okuyamaz).
  ipcMain.handle("files:dataUrl", async (_e, yol) => {
    if (!getSession()) throw new Error("Oturum gerekli");
    if (config.istemciMi()) return (await istemci.istek("/api/files/dataUrl?yol=" + encodeURIComponent(String(yol)))).dataUrl;
    const tam = uploadsIci(yol);
    if (!fs.existsSync(tam)) return null;
    const mime = MIME[path.extname(tam).toLowerCase()];
    if (!mime) return null;
    return `data:${mime};base64,${fs.readFileSync(tam).toString("base64")}`;
  });
}

module.exports = { registerFileHandlers, uploadsIci, eskiDosyalariSil };
