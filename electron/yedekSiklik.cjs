// Otomatik yedek sıklığı — SAF karar mantığı (I/O yok, test edilebilir).
// Ayar anahtarı: yedek_sikligi. Açılışta otomatikYedek bu karara göre yedek alır.
const SIKLIKLAR = [
  { kod: "acilis", ad: "Her açılışta" },
  { kod: "gunluk", ad: "Günde bir (varsayılan)" },
  { kod: "haftalik", ad: "Haftada bir" },
  { kod: "kapali", ad: "Otomatik yedek kapalı (yalnız elle)" },
];
const VARSAYILAN_SIKLIK = "gunluk";
const sikliktNormalize = (k) => (SIKLIKLAR.some((s) => s.kod === k) ? k : VARSAYILAN_SIKLIK);

/**
 * @param {string} siklik acilis|gunluk|haftalik|kapali
 * @param {string|null} sonIso son yedeğin ISO zamanı (yoksa null)
 * @param {Date} simdi
 */
function yedekGerekliMi(siklik, sonIso, simdi = new Date()) {
  const s = sikliktNormalize(siklik);
  if (s === "kapali") return false;
  if (s === "acilis") return true;
  if (!sonIso) return true;
  const son = new Date(sonIso);
  if (Number.isNaN(son.getTime())) return true;
  if (s === "gunluk") return sonIso.slice(0, 10) !== simdi.toISOString().slice(0, 10);
  return simdi.getTime() - son.getTime() >= 7 * 24 * 60 * 60 * 1000; // haftalik
}

module.exports = { SIKLIKLAR, VARSAYILAN_SIKLIK, sikliktNormalize, yedekGerekliMi };
