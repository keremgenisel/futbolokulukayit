// Yol geçişi (path traversal) koruması — uploads klasörü dışına çıkışı engelleyen TEK birleştirme noktası.
// SAF: kök dizin parametre olarak gelir, I/O yok → vitest ile test edilir (tests/guvenli-yol.test.js).
// Çağıranlar ham `path.join` yapmaz; parçaları buraya verir: uploadsIci("oyuncu-5", "1-foto.jpg").
// "..", mutlak yol ("/etc/passwd", "C:\\...") ve NUL baytı reddedilir; kökün kendisi geçerlidir.
const path = require("path");

/**
 * @param {string} kok uploads kök dizini (mutlak)
 * @param {...(string|number)} parcalar birleştirilecek yol parçaları
 * @returns {string} kök içinde kaldığı doğrulanmış mutlak yol
 */
function uploadsIciYol(kok, ...parcalar) {
  const k = path.resolve(String(kok));
  const temiz = parcalar.map((p) => String(p ?? ""));
  if (temiz.some((p) => p.includes("\0"))) throw new Error("Geçersiz dosya yolu");
  const tam = path.resolve(k, ...temiz);
  if (tam !== k && !tam.startsWith(k + path.sep)) throw new Error("Geçersiz dosya yolu");
  return tam;
}

module.exports = { uploadsIciYol };
