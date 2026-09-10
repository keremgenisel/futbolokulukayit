// @ts-check
// Tema → CSS değişkenleri (plan §32.4) ve logodan renk okuma (canvas). Saf hesaplar `tema.js`'te.
import { temaTuret, logodanRenkler } from "./tema.js";

/**
 * Ana ve vurgu rengini belge köküne CSS değişkeni olarak yazar. `kok` verilmezse `document.documentElement`.
 * @param {{ ana?: string, vurgu?: string }} tema
 * @param {HTMLElement} [kok]
 */
export function temaUygula(tema, kok) {
  const t = temaTuret(tema || {});
  const el = kok || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return t;
  const s = el.style;
  s.setProperty("--mor", t.mor);
  s.setProperty("--mor-koyu", t.morKoyu);
  s.setProperty("--mor-acik", t.morAcik);
  s.setProperty("--sari", t.sari);
  s.setProperty("--sari-acik", t.sariAcik);
  s.setProperty("--ana-ustu", t.anaUstuMetin);
  s.setProperty("--vurgu-ustu", t.vurguUstuMetin);
  s.setProperty("--ana-ustu-soluk", t.anaUstuSoluk);
  return t;
}

/**
 * Logo data URL'inden baskın renkler (renderer; canvas). Başarısızsa boş sonuç.
 * @param {string} dataUrl
 * @returns {Promise<{ renkler: string[], beyazVar: boolean }>}
 */
export function logodanRenklerOku(dataUrl) {
  return new Promise((res) => {
    if (!dataUrl || typeof Image === "undefined") return res({ renkler: [], beyazVar: false });
    const img = new Image();
    img.onload = () => {
      try {
        const N = 64;
        const cv = document.createElement("canvas");
        cv.width = cv.height = N;
        const ctx = cv.getContext("2d");
        if (!ctx) return res({ renkler: [], beyazVar: false });
        ctx.drawImage(img, 0, 0, N, N);
        res(logodanRenkler(ctx.getImageData(0, 0, N, N).data));
      } catch {
        res({ renkler: [], beyazVar: false });
      }
    };
    img.onerror = () => res({ renkler: [], beyazVar: false });
    img.src = dataUrl;
  });
}
