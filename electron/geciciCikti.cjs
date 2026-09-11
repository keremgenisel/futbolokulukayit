// Geçici çıktı klasörü (güvenlik 2. inceleme #2, 11.09.2026): yazıcı yokken yedek yol olarak üretilen makbuz/yoklama formu PDF'leri
// (`cikti:pdfAc`) kişisel veri taşır; temp'te süresiz kalmasın. Tümü tek alt klasörde (`<temp>/futbolokulu-cikti/`) yazılır ve
// açılışta 24 saatten eski olanlar silinir. Eski sürümün doğrudan temp'e yazdığı `futbolokulu-*.pdf` artıkları da temizlenir.
const fs = require("fs");
const os = require("os");
const path = require("path");

const KLASOR_ADI = "futbolokulu-cikti";
const ARTIK_ESIK_MS = 24 * 60 * 60 * 1000;

/** @param {string} [kok] */
function ciktiKlasoru(kok = os.tmpdir()) {
  const k = path.join(kok, KLASOR_ADI);
  fs.mkdirSync(k, { recursive: true });
  return k;
}
/** @param {number} mtimeMs @param {number} now @param {number} [esik] */
const artikMi = (mtimeMs, now, esik = ARTIK_ESIK_MS) => now - mtimeMs > esik;

/**
 * 24 saatten eski geçici çıktı PDF'lerini siler. Dönüş: silinen dosya sayısı. Hatalar yutulur (başka süreç açık tutuyor olabilir).
 * @param {string} [kok] @param {number} [now]
 */
function ciktiArtiklariTemizle(kok = os.tmpdir(), now = Date.now()) {
  let silinen = 0;
  const sil = (yol) => {
    try {
      if (artikMi(fs.statSync(yol).mtimeMs, now)) {
        fs.rmSync(yol, { force: true });
        silinen++;
      }
    } catch {
      /* dosya kilitli ya da yok */
    }
  };
  try {
    const k = path.join(kok, KLASOR_ADI);
    if (fs.existsSync(k)) for (const ad of fs.readdirSync(k)) sil(path.join(k, ad));
    for (const ad of fs.readdirSync(kok)) if (/^futbolokulu-\d+-.*\.pdf$/i.test(ad)) sil(path.join(kok, ad)); // eski sürüm artıkları
  } catch {
    /* temp okunamadı */
  }
  return silinen;
}

module.exports = { ciktiKlasoru, ciktiArtiklariTemizle, artikMi, KLASOR_ADI, ARTIK_ESIK_MS };
