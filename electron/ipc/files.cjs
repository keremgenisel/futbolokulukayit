// Belge ve fotoğraf dosyaları: kullanıcı dosya seçer, uploads/oyuncu-<id>/ altına kopyalanır,
// documents tablosuna kaydedilir. Renderer dosya sistemini görmez; görüntüleme data: URL ile.
const { ipcMain, dialog, shell, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const db = require("../db.cjs");

const IZINLI_UZANTI = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".doc", ".docx"]);
const MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const guvenliAd = (ad) => String(ad).replace(/[^\w.\-çğıöşüÇĞİÖŞÜ ]+/g, "_").slice(0, 80);

// uploads dizini dışına çıkmayı engelle (yol geçişi).
function uploadsIci(p) {
  const kok = path.resolve(db.getUploadsDir());
  const tam = path.resolve(kok, p);
  if (!tam.startsWith(kok + path.sep) && tam !== kok) throw new Error("Geçersiz dosya yolu");
  return tam;
}

function registerFileHandlers(getSession) {
  const yetki = () => { if (!getSession()) throw new Error("Oturum gerekli"); if (db.lisansSaltOkunurMu()) throw new Error("Lisans salt okunur modda"); };

  // Belge yükle: dialog aç, kopyala, kaydet. Dönüş: yeni belge kaydı veya { iptal: true }.
  ipcMain.handle("files:addDocument", async (e, playerId, tip, gecerlilik) => {
    yetki();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: "Belge seç", properties: ["openFile"],
      filters: [{ name: "Belge", extensions: ["pdf", "jpg", "jpeg", "png", "webp", "heic", "doc", "docx"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    const kaynak = r.filePaths[0];
    const uz = path.extname(kaynak).toLowerCase();
    if (!IZINLI_UZANTI.has(uz)) throw new Error("Bu dosya türü desteklenmiyor");
    if (fs.statSync(kaynak).size > 25 * 1024 * 1024) throw new Error("Dosya 25 MB'tan büyük");
    const klasor = path.join("oyuncu-" + Number(playerId));
    fs.mkdirSync(uploadsIci(klasor), { recursive: true });
    const ad = `${Date.now()}-${tip}-${guvenliAd(path.basename(kaynak))}`;
    const hedef = path.join(klasor, ad);
    fs.copyFileSync(kaynak, uploadsIci(hedef));
    const id = db.addDocument(Number(playerId), { tip, dosya_yolu: hedef, orijinal_ad: path.basename(kaynak), gecerlilik_tarihi: gecerlilik || null });
    if (tip === "foto") db.updatePlayer(Number(playerId), { foto_yolu: hedef });
    return { ok: true, id, dosya_yolu: hedef };
  });

  ipcMain.handle("files:deleteDocument", (_e, docId) => {
    yetki();
    const belge = db.getDocument(Number(docId));
    if (belge) {
      try { fs.unlinkSync(uploadsIci(belge.dosya_yolu)); } catch { /* dosya zaten yok */ }
      db.deleteDocument(belge.id);
    }
    return { ok: true };
  });

  ipcMain.handle("files:open", (_e, yol) => {
    if (!getSession()) throw new Error("Oturum gerekli");
    return shell.openPath(uploadsIci(yol));
  });

  // Görsel/PDF önizleme için data URL (renderer sandbox'ta dosya okuyamaz).
  ipcMain.handle("files:dataUrl", (_e, yol) => {
    if (!getSession()) throw new Error("Oturum gerekli");
    const tam = uploadsIci(yol);
    if (!fs.existsSync(tam)) return null;
    const mime = MIME[path.extname(tam).toLowerCase()];
    if (!mime) return null;
    return `data:${mime};base64,${fs.readFileSync(tam).toString("base64")}`;
  });
}

module.exports = { registerFileHandlers, uploadsIci };
