// @ts-check
// SAF tema mantığı (plan §32.4): ana + vurgu renginden türetilen tonlar, kontrast, hazır paletler, logodan renk çıkarma.
// CSS değişkenlerine uygulama `temaUygula.js`'te; ana süreç doğrulaması `electron/tema.cjs` (ikiz; eşitlik testi var).

export const VARSAYILAN_TEMA = { ana: "#5b2d8e", vurgu: "#f5d000" };

/** Hazır paletler (Ayarlar > Kulüp ve Makbuz > Uygulama renkleri). */
export const PRESETLER = [
  { kod: "mor-sari", ad: "Mor · Sarı", ana: "#5b2d8e", vurgu: "#f5d000" },
  { kod: "kirmizi-beyaz", ad: "Kırmızı · Beyaz", ana: "#c8102e", vurgu: "#ffffff" },
  { kod: "lacivert-turuncu", ad: "Lacivert · Turuncu", ana: "#0b2a5b", vurgu: "#ff7a00" },
  { kod: "yesil-beyaz", ad: "Yeşil · Beyaz", ana: "#0f7b3e", vurgu: "#ffffff" },
  { kod: "siyah-sari", ad: "Siyah · Sarı", ana: "#1a1a1a", vurgu: "#ffd100" },
  { kod: "mavi-beyaz", ad: "Mavi · Beyaz", ana: "#1f5fbf", vurgu: "#ffffff" },
];

/** @param {unknown} s */
export const renkGecerliMi = (s) => /^#[0-9a-f]{6}$/i.test(String(s || ""));

/** @param {string} hex @returns {[number, number, number]} */
export function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** @param {number} r @param {number} g @param {number} b */
export const rgbToHex = (r, g, b) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** @param {number} r @param {number} g @param {number} b @returns {[number, number, number]} h 0-360, s 0-1, l 0-1 */
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** İki rengi RGB'de doğrusal karıştırır: oran 0 → hex, 1 → hedef. @param {string} hex @param {string} hedef @param {number} oran */
export function karistir(hex, hedef, oran) {
  const a = hexToRgb(hex),
    b = hexToRgb(hedef);
  return rgbToHex(a[0] + (b[0] - a[0]) * oran, a[1] + (b[1] - a[1]) * oran, a[2] + (b[2] - a[2]) * oran);
}

/** WCAG göreli parlaklık. @param {string} hex */
export function parlaklik(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG kontrast oranı (1–21). @param {string} a @param {string} b */
export function kontrastOrani(a, b) {
  const l1 = parlaklik(a),
    l2 = parlaklik(b);
  const [acik, koyu] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (acik + 0.05) / (koyu + 0.05);
}

const METIN = "#1b1530";
const BEYAZ = "#ffffff";

/**
 * Ana ve vurgu renginden CSS değişken seti. Anlam renkleri (kırmızı/yeşil) sabittir, burada yok.
 * @param {{ ana?: string, vurgu?: string }} t
 */
export function temaTuret(t = {}) {
  const ana = renkGecerliMi(t.ana) ? String(t.ana).toLowerCase() : VARSAYILAN_TEMA.ana;
  const vurgu = renkGecerliMi(t.vurgu) ? String(t.vurgu).toLowerCase() : VARSAYILAN_TEMA.vurgu;
  const morKoyu = karistir(ana, "#000000", 0.3);
  const morAcik = karistir(ana, BEYAZ, 0.88);
  // Vurgu çok açıksa (beyaz gibi) açık tonu görünmez → ana rengin açık tonuna düşer (uyarı şeridi, satır vurgusu okunur kalsın)
  const vurguAcikMi = rgbToHsl(...hexToRgb(vurgu))[2] > 0.9;
  const sariAcik = vurguAcikMi ? morAcik : karistir(vurgu, BEYAZ, 0.78);
  const anaUstuMetin = kontrastOrani(ana, BEYAZ) >= 4.5 ? BEYAZ : METIN;
  const vurguUstuMetin = kontrastOrani(vurgu, morKoyu) >= 3 ? morKoyu : kontrastOrani(vurgu, BEYAZ) >= 4.5 ? BEYAZ : METIN;
  const anaUstuSoluk = karistir(anaUstuMetin, ana, 0.22); // menüde pasif öğe/ikincil yazı (mor için #d8cce9 civarı)
  return {
    mor: ana,
    morKoyu,
    morAcik,
    sari: vurgu,
    sariAcik,
    anaUstuMetin,
    vurguUstuMetin,
    anaUstuSoluk,
    /** Ana renk üstünde beyaz yazı okunaklı mı (Ayarlar uyarısı) */
    anaOkunakli: anaUstuMetin === BEYAZ,
    kontrast: Math.round(kontrastOrani(ana, anaUstuMetin) * 10) / 10,
  };
}

/**
 * Logodan baskın renkler: RGBA piksellerden gri/beyaz/siyah/şeffaf olanlar atılır, ton 24 kutuya (15°) bölünür, en kalabalık
 * kutuların ortalama rengi döner (birbirine 30°'den yakın tonlar birleşir). Beyaz belirgin ise `beyazVar` true.
 * @param {ArrayLike<number>} pikseller RGBA dizisi (canvas ImageData.data)
 * @param {{ adet?: number, adim?: number }} [sec]
 * @returns {{ renkler: string[], beyazVar: boolean }}
 */
export function logodanRenkler(pikseller, { adet = 3, adim = 1 } = {}) {
  /** @type {Map<number, { n: number, r: number, g: number, b: number }>} */
  const kutular = new Map();
  let beyaz = 0,
    toplam = 0;
  for (let i = 0; i + 3 < pikseller.length; i += 4 * adim) {
    const a = pikseller[i + 3];
    if (a < 128) continue;
    toplam++;
    const r = pikseller[i],
      g = pikseller[i + 1],
      b = pikseller[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > 0.92 && s < 0.2) {
      beyaz++;
      continue;
    }
    if (s < 0.3 || l < 0.12 || l > 0.85) continue;
    const k = Math.floor(h / 15) % 24;
    const kutu = kutular.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    kutu.n++;
    kutu.r += r;
    kutu.g += g;
    kutu.b += b;
    kutular.set(k, kutu);
  }
  const sirali = [...kutular.entries()].sort((x, y) => y[1].n - x[1].n);
  /** @type {{ k: number, hex: string }[]} */
  const secilen = [];
  for (const [k, kutu] of sirali) {
    if (secilen.length >= adet) break;
    const yakin = secilen.some((s) => Math.min(Math.abs(s.k - k), 24 - Math.abs(s.k - k)) < 2); // < 30°
    if (yakin) continue;
    secilen.push({ k, hex: rgbToHex(kutu.r / kutu.n, kutu.g / kutu.n, kutu.b / kutu.n) });
  }
  return { renkler: secilen.map((s) => s.hex), beyazVar: toplam > 0 && beyaz / toplam > 0.15 };
}

/**
 * Logodan çıkan renklerden palet önerisi: ana = en baskın, vurgu = ikinci (yoksa beyaz belirginse beyaz, o da yoksa
 * varsayılan sarı). Ana çok açıksa ikinciyle yer değiştirir (kenar menü zemini koyu olsun).
 * @param {{ renkler: string[], beyazVar: boolean }} c
 */
export function logodanPalet(c) {
  if (!c.renkler.length) return null;
  let [ana, vurgu] = c.renkler;
  if (!vurgu) vurgu = c.beyazVar ? "#ffffff" : VARSAYILAN_TEMA.vurgu;
  if (kontrastOrani(ana, BEYAZ) < 3 && c.renkler[1] && kontrastOrani(c.renkler[1], BEYAZ) >= 3) [ana, vurgu] = [c.renkler[1], ana];
  return { ana, vurgu };
}
