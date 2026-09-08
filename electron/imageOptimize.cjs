// Belge/fotoğraf resimleri için NAZİK optimizasyon (makina-crm modeli): yalnız jpg/jpeg/png;
// uzun kenar en fazla MAX_PX'e küçültülür, JPEG %JPEG_QUALITY ile yeniden sıkıştırılır, PNG kayıpsız
// kalır. Uzantı/tür değişmez. Sonuç yalnız GERÇEKTEN küçükse kullanılır; bozuk resim → dokunulmaz.
// PDF/Office belgeleri optimize edilmez (okunurluk ve imza/mühür bütünlüğü için).
const { nativeImage } = require("electron");

const MAX_PX = 2000;
const JPEG_QUALITY = 82;
const OPTIMIZE_UZANTI = new Set([".jpg", ".jpeg", ".png"]);

const optimizeEdilebilirMi = (ad) => OPTIMIZE_UZANTI.has(String(ad).slice(String(ad).lastIndexOf(".")).toLowerCase());
const MAX_PIKSEL = 50 * 1000 * 1000; // inceleme #22: dekompresyon bombasına karşı çözmeden önce başlıktan boyut kontrolü

// Başlıktan genişlik×yükseklik (PNG IHDR / JPEG SOFn); okunamazsa null — SAF.
function resimBoyutu(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR")
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) {
        i++;
        continue;
      }
      const m = buffer[i + 1];
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xff) {
        i += 2;
        continue;
      }
      const len = buffer.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf))
        return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** @param {Buffer} buffer @param {string} uzanti ".jpg" gibi */
function optimizeImage(buffer, uzanti) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;
  const e = String(uzanti || "").toLowerCase();
  if (!OPTIMIZE_UZANTI.has(e)) return buffer;
  const boyut = resimBoyutu(buffer);
  if (boyut && boyut.width * boyut.height > MAX_PIKSEL) return buffer; // çözülmeden atlanır (RAM patlaması yok)
  try {
    const img = nativeImage.createFromBuffer(buffer);
    if (img.isEmpty()) return buffer;
    const { width, height } = img.getSize();
    const uzun = Math.max(width, height, 1);
    const out =
      uzun > MAX_PX
        ? img.resize({ width: Math.round((width * MAX_PX) / uzun), height: Math.round((height * MAX_PX) / uzun), quality: "good" })
        : img;
    const enc = e === ".png" ? out.toPNG() : out.toJPEG(JPEG_QUALITY);
    return enc && enc.length > 0 && enc.length < buffer.length ? enc : buffer;
  } catch {
    return buffer;
  }
}

module.exports = { optimizeImage, optimizeEdilebilirMi, MAX_PX, JPEG_QUALITY, resimBoyutu, MAX_PIKSEL };
