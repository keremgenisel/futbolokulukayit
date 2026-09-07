// Belge/fotoğraf resimleri için NAZİK optimizasyon (makina-crm modeli): yalnız jpg/jpeg/png;
// uzun kenar en fazla MAX_PX'e küçültülür, JPEG %JPEG_QUALITY ile yeniden sıkıştırılır, PNG kayıpsız
// kalır. Uzantı/tür değişmez. Sonuç yalnız GERÇEKTEN küçükse kullanılır; bozuk resim → dokunulmaz.
// PDF/Office belgeleri optimize edilmez (okunurluk ve imza/mühür bütünlüğü için).
const { nativeImage } = require("electron");

const MAX_PX = 2000;
const JPEG_QUALITY = 82;
const OPTIMIZE_UZANTI = new Set([".jpg", ".jpeg", ".png"]);

const optimizeEdilebilirMi = (ad) => OPTIMIZE_UZANTI.has(String(ad).slice(String(ad).lastIndexOf(".")).toLowerCase());

/** @param {Buffer} buffer @param {string} uzanti ".jpg" gibi */
function optimizeImage(buffer, uzanti) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;
  const e = String(uzanti || "").toLowerCase();
  if (!OPTIMIZE_UZANTI.has(e)) return buffer;
  try {
    const img = nativeImage.createFromBuffer(buffer);
    if (img.isEmpty()) return buffer;
    const { width, height } = img.getSize();
    const uzun = Math.max(width, height, 1);
    const out = uzun > MAX_PX
      ? img.resize({ width: Math.round((width * MAX_PX) / uzun), height: Math.round((height * MAX_PX) / uzun), quality: "good" })
      : img;
    const enc = e === ".png" ? out.toPNG() : out.toJPEG(JPEG_QUALITY);
    return enc && enc.length > 0 && enc.length < buffer.length ? enc : buffer;
  } catch { return buffer; }
}

module.exports = { optimizeImage, optimizeEdilebilirMi, MAX_PX, JPEG_QUALITY };
