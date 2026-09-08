// SAF: arama için Türkçe duyarsız metin normalizasyonu. Küçük harfe (tr-TR) indirir, sonra Türkçe harfleri
// ASCII karşılığına katlar: "İbrahim" → "ibrahim", "IŞIK" → "isik". Böylece "i" yazınca İbrahim, "isik" yazınca Işık gelir.
// Aynı kural renderer'da `src/lib/metin.js` içinde; ikisi testle eşit tutulur.
const KATLA = { ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u", â: "a", î: "i", û: "u" };
function araNormalize(s) {
  return String(s ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ışçğöüâîû]/g, (c) => KATLA[c])
    .replace(/\s+/g, " ")
    .trim();
}
module.exports = { araNormalize };
