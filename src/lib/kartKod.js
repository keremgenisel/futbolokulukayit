// @ts-check
// Giriş kartı kodları (plan §40): QR `qrcode` paketiyle (saf JS, ağ yok), kart no barkodu Code 128 B (saf). Yalnız `kart_qr`
// ayarı açıkken çağrılır. Kod içeriği `FOK:<kart no>` — ileride kartla giriş sistemi (§40.4) bu biçimi tanır.
import QRCode from "qrcode";

export const KOD_ONEKI = "FOK:";
/** @param {string} kartNo ör. "2026 0123" */
export const kodMetni = (kartNo) => KOD_ONEKI + String(kartNo).replace(/\s+/g, "");

/**
 * QR kodu SVG (boyutsuz; sarmalayan kutu ölçer). Hata düzeltme M.
 * @param {string} metin
 * @returns {Promise<string>}
 */
export async function qrSvg(metin) {
  const svg = await QRCode.toString(metin, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
  return svg
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace("<svg", '<svg width="100%" height="100%"');
}

// Code 128 çubuk desenleri (değer → 6 modül genişliği; her sembol 11 modül). 103/104/105 başlangıç A/B/C, 106 dur (13 modül).
export const CODE128 = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

/**
 * Code 128 B çubuk kodu (ASCII 32–126) SVG: yükseklik 100 birim, genişlik modül sayısı; `preserveAspectRatio="none"` ile kutuya sığar.
 * @param {string} metin
 */
export function code128Svg(metin) {
  const s = String(metin);
  const degerler = [104];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error("Code 128 B yalnız ASCII 32–126 kabul eder");
    degerler.push(c - 32);
  }
  let toplam = 104;
  for (let i = 1; i < degerler.length; i++) toplam += degerler[i] * i;
  degerler.push(toplam % 103, 106);
  let x = 10; // sessiz bölge
  const rects = [];
  for (const d of degerler) {
    const desen = CODE128[d];
    for (let i = 0; i < desen.length; i++) {
      const w = Number(desen[i]);
      if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="100"/>`);
      x += w;
    }
  }
  x += 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 100" preserveAspectRatio="none" width="100%" height="100%" fill="#1B1530" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}
