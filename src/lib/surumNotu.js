// @ts-check
// Güncelleme sürüm notları (electron-updater GitHub sağlayıcısı releaseNotes'u HTML verir; bazen Markdown) → okunur düz metin.
// Ayarlar > Hakkında'da etiketler "kod" gibi görünüyordu (Kerem 13.09.2026). SAF: tarayıcı API'si yok.

/** @type {Record<string, string>} */
const VARLIKLAR = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
/** @param {string} s */
const varlikCoz = (s) =>
  s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, k) => {
    const kk = String(k).toLowerCase();
    if (kk.startsWith("#x")) return String.fromCodePoint(parseInt(kk.slice(2), 16));
    if (kk.startsWith("#")) return String.fromCodePoint(Number(kk.slice(1)));
    return VARLIKLAR[kk] ?? m;
  });

/** HTML ya da Markdown sürüm notunu düz metne çevirir: başlıklar satır, liste öğeleri "• ", vurgu ve kod işaretleri kalkar. @param {string} notlar */
export function surumNotuMetni(notlar) {
  let t = String(notlar || "");
  if (/<[a-z][^>]*>/i.test(t)) {
    t = t
      .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li|\/tr)\s*\/?>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "");
    t = varlikCoz(t);
  }
  // Markdown kalıntıları (GitHub notu Markdown olarak gelirse)
  t = t
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
  return t
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean) // boş satırlar atılır
    .filter((s) => !/^(co-authored-by|claude-session)\s*:/i.test(s) && !/claude\.ai\/code\//i.test(s)) // commit imzası kullanıcıya gösterilmez
    .join("\n")
    .trim();
}
