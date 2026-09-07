// @ts-check
// SAF: arama için Türkçe duyarsız normalizasyon (ana süreçteki `electron/metin.cjs` ile birebir aynı kural).
/** @type {Record<string, string>} */
const KATLA = { ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u", â: "a", î: "i", û: "u" };
/** @param {unknown} s */
export function araNormalize(s) {
  return String(s ?? "").toLocaleLowerCase("tr-TR").replace(/[ışçğöüâîû]/g, (c) => KATLA[c]).replace(/\s+/g, " ").trim();
}
/** Metin, aranan parçayı Türkçe duyarsız içeriyor mu? @param {unknown} metin @param {unknown} aranan */
export const araEslesir = (metin, aranan) => araNormalize(metin).includes(araNormalize(aranan));
