// SAF (CJS ikiz): ana süreçte tema doğrulaması ve Excel başlık dolgusu için açık ton. Renderer'daki `src/lib/tema.js` ile
// aynı sonuçları vermeli — `tests/tema.test.js` eşitliği sınar (plan §32.4).
const VARSAYILAN_TEMA = { ana: "#5b2d8e", vurgu: "#f5d000" };
const renkGecerliMi = (s) => /^#[0-9a-f]{6}$/i.test(String(s || ""));
const hexToRgb = (hex) => {
  const h = String(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = (r, g, b) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function karistir(hex, hedef, oran) {
  const a = hexToRgb(hex),
    b = hexToRgb(hedef);
  return rgbToHex(a[0] + (b[0] - a[0]) * oran, a[1] + (b[1] - a[1]) * oran, a[2] + (b[2] - a[2]) * oran);
}
/** Excel başlık dolgusu: ana rengin açık tonu (tema.js morAcik ile aynı karışım). */
const acikTon = (ana) => karistir(renkGecerliMi(ana) ? String(ana).toLowerCase() : VARSAYILAN_TEMA.ana, "#ffffff", 0.88);

module.exports = { VARSAYILAN_TEMA, renkGecerliMi, karistir, acikTon };
