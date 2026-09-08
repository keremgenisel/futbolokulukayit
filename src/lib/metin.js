// @ts-check
// SAF: arama için Türkçe duyarsız normalizasyon (ana süreçteki `electron/metin.cjs` ile birebir aynı kural).
/** @type {Record<string, string>} */
const KATLA = { ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u", â: "a", î: "i", û: "u" };
/** @param {unknown} s */
export function araNormalize(s) {
  return String(s ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ışçğöüâîû]/g, (c) => KATLA[c])
    .replace(/\s+/g, " ")
    .trim();
}
/** Metin, aranan parçayı Türkçe duyarsız içeriyor mu? @param {unknown} metin @param {unknown} aranan */
export const araEslesir = (metin, aranan) => araNormalize(metin).includes(araNormalize(aranan));

/** HTML metin/öznitelik kaçışı (yazdırma/PDF şablonları). Tek tırnak dahil. @param {unknown} s */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
/** Şablonlara yalnız base64 PNG/JPEG data URL logosu girer; başka her şey boş (öznitelik kaçışı/dış istek olmaz). @param {unknown} logo */
export const guvenliLogo = (logo) => (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(String(logo || "")) ? String(logo) : "");
