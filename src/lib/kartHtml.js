// @ts-check
// Oyuncu giriş kartı (plan §40): 11 × 6 cm yatay, Yön C (koyu mor zemin, sarı vurgu). SAF: I/O yok; foto/logo/QR hazır data URL / SVG
// olarak gelir. Tek kart: A4 yatay, ön + arka yüz yan yana. Toplu: A4 yatay 2 sütun × 3 satır = 6 kart/sayfa; arka yüzler
// sonraki sayfada aynı düzende. Kesim çizgileri 0,3 mm gri. Aidat durumu / son kullanma tarihi KARTA YAZILMAZ.
import { esc, guvenliLogo, guvenliResim } from "./metin.js";
import { VARSAYILAN_KULUP } from "./marka.js";
import { temaTuret } from "./tema.js";

export const KART_KURAL_VARSAYILAN = [
  "Kart kişiseldir; başkasına verilemez.",
  "Tesise girişte kart okutulur; aidatı ödenmemiş oyuncu giriş yapamaz.",
  "Kayıp ve hasar durumunda kulübe bildiriniz; yeni kart ücrete tabidir.",
  "Lütfen kartınızı yanınızda bulundurunuz; kartı olmayan antrenmana katılamayacaktır.",
];
/** Ön yüzde kulüp adının altındaki yazı: Kulüp ve Makbuz'daki kısa ad (yoksa "Futbol Okulu") + kuruluş yılı. @param {string} [kisaAd] @param {string} [kurulusYili] */
export const kartAltYazi = (kisaAd = "", kurulusYili = "") =>
  `${String(kisaAd || "").trim() || "Futbol Okulu"}${String(kurulusYili || "").trim() ? ` · ${String(kurulusYili).trim()}` : ""}`;
export const KART_EN_MM = 110;
export const KART_BOY_MM = 60;
export const TOPLU_SAYFA_KART = 6; // A4 yatay 2 × 3

/** Oyuncu no: kayıt numarası 4 hane. @param {number|string} id */
export const oyuncuNo = (id) => String(Number(id) || 0).padStart(4, "0");
/** Kart no: sezonun ilk yılı + oyuncu no. @param {number|string} id @param {string} [sezon] */
export const kartNo = (id, sezon = "") => `${String(sezon || "").slice(0, 4) || "0000"} ${oyuncuNo(id)}`;
/** Telefonu maskele: "0532 123 45 67" → "0532 ••• •• ••". @param {string} tel */
export const telMaskele = (tel) => {
  const r = String(tel || "").replace(/\D/g, "");
  return r.length >= 4 ? `${r.slice(0, 4)} ••• •• ••` : "";
};

/**
 * @typedef {{ ad_soyad: string, id: number|string, yas_grubu_ad?: string, dogum_tarihi?: string|null, foto?: string, veli_ad?: string,
 *   veli_tel?: string, qrSvg?: string, barkodSvg?: string }} KartOyuncu
 * @typedef {{ kulupAdi?: string, kisaAd?: string, kurulusYili?: string, logo?: string, tema?: { ana?: string, vurgu?: string },
 *   adres?: string, telefon?: string, web?: string, sezon?: string, kurallar?: string[] }} KartAyar
 */

const SILUET =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#8F7FB0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:60%;height:60%"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
/** @param {string} renk @param {string} ic */
const ARMA = (renk, ic) =>
  `<svg viewBox="0 0 48 48" style="width:9mm;height:9mm;display:block"><path d="M24 3 L42 9 V24 C42 34 34 42 24 45 C14 42 6 34 6 24 V9 Z" fill="${renk}"/><path d="M24 8 L37 12.5 V24 C37 31.5 31 37.5 24 40 C17 37.5 11 31.5 11 24 V12.5 Z" fill="none" stroke="${ic}" stroke-width="1.6"/><circle cx="24" cy="25" r="7.5" fill="none" stroke="${ic}" stroke-width="1.6"/></svg>`;

/** Kart CSS (her iki yüz). @param {ReturnType<typeof temaTuret>} t */
function kartCss(t) {
  return `
  .kart { width: ${KART_EN_MM}mm; height: ${KART_BOY_MM}mm; box-sizing: border-box; border-radius: 3mm; overflow: hidden; position: relative;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1B1530; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .on { background: ${t.morKoyu}; color: ${t.anaUstuMetin}; display: flex; flex-direction: column; }
  .on .daire { position: absolute; right: -10mm; top: -12mm; width: 58mm; height: 58mm; border-radius: 50%; background: ${t.mor}; }
  .on .halka { position: absolute; right: -18mm; bottom: -23mm; width: 50mm; height: 50mm; border-radius: 50%; border: 3.5mm solid ${t.sari}; opacity: .14; }
  .ust { position: relative; display: flex; align-items: center; gap: 2.5mm; padding: 3.5mm 4mm 0; }
  .ust img { width: 9mm; height: 9mm; object-fit: contain; display: block; }
  .ust .k { flex: 1; display: flex; flex-direction: column; }
  .ust .ad { font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif; font-size: 11.5pt; font-weight: 700; line-height: 1; letter-spacing: .04em; text-transform: uppercase; }
  .ust .alt { font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; color: ${t.sari}; }
  .sezon { font-size: 7pt; font-weight: 700; color: ${t.vurguUstuMetin}; background: ${t.sari}; border-radius: 99px; padding: .8mm 2.4mm; letter-spacing: .04em; }
  /* Başlık ile alt yazı arasındaki alanı doldurur; foto, bilgiler ve QR dikeyde ORTALANIR (Kerem 12.09.2026: bilgiler üstte kalıyordu) */
  .govde { position: relative; flex: 1; display: flex; gap: 3.5mm; padding: 1mm 4mm 6mm; align-items: center; }
  .foto { width: 17mm; height: 22mm; border-radius: 1.5mm; background: #fff; border: .4mm solid ${t.sari}; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
  .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bilgi { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1.8mm; }
  .etiket { font-size: 6pt; letter-spacing: .16em; color: ${t.sari}; font-weight: 600; }
  .isim { font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif; font-size: 19pt; font-weight: 700; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .satir { display: flex; gap: 4.5mm; }
  .alan { display: flex; flex-direction: column; }
  .alan span:first-child { font-size: 6pt; letter-spacing: .1em; color: ${t.anaUstuSoluk}; text-transform: uppercase; font-weight: 600; }
  .alan span:last-child { font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif; font-size: 12.5pt; font-weight: 600; }
  .qr { display: flex; flex-direction: column; align-items: center; gap: .8mm; background: #fff; border-radius: 2mm; padding: 1.3mm; flex-shrink: 0; }
  .qr .kutu { width: 15mm; height: 15mm; }
  .qr span { font-size: 5.5pt; color: ${t.morKoyu}; letter-spacing: .06em; font-weight: 600; }
  .dip { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 4mm 2.6mm; font-size: 6.3pt; color: ${t.anaUstuSoluk}; }
  .dip b { color: ${t.sari}; font-weight: 600; }
  .arka { display: flex; flex-direction: column; }
  .arka .serit { height: 1.8mm; background: ${t.mor}; }
  .arka .ic { display: flex; gap: 4mm; padding: 3mm 4mm 0; flex: 1; }
  .arka .sol { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1.5mm; }
  .arka h4 { font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif; margin: 0; font-size: 8pt; font-weight: 700; color: ${t.mor}; letter-spacing: .14em; }
  .kural { display: flex; gap: 1.5mm; font-size: 6.4pt; line-height: 1.3; }
  .kural b { color: ${t.mor}; }
  .veli { margin-top: auto; padding-top: 1.5mm; border-top: .25mm solid #E2DCEC; font-size: 7pt; }
  .veli span:first-child { display: block; font-size: 6pt; letter-spacing: .1em; color: #6B6480; text-transform: uppercase; font-weight: 600; }
  .arka .sag { width: 40mm; flex-shrink: 0; display: flex; flex-direction: column; gap: 1mm; }
  .arka .sag .kad { font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif; font-size: 10.5pt; font-weight: 700; color: ${t.morKoyu}; line-height: 1; text-transform: uppercase; }
  .arka .sag .iletisim { font-size: 6.4pt; color: #6B6480; line-height: 1.35; white-space: pre-line; }
  .barkod { margin-top: auto; display: flex; flex-direction: column; gap: .6mm; }
  .barkod .cubuk { width: 40mm; height: 7mm; }
  .barkod span { font-size: 6pt; color: #6B6480; letter-spacing: .14em; text-align: center; }
  .arka .dip2 { display: flex; justify-content: space-between; padding: 1.6mm 4mm 2.2mm; background: #F6F4FA; margin-top: 2mm; font-size: 6pt; color: #6B6480; }`;
}

/** @param {KartOyuncu} o @param {KartAyar} a @param {ReturnType<typeof temaTuret>} t */
function onYuz(o, a, t) {
  const logo = guvenliLogo(a.logo);
  const foto = guvenliResim(o.foto);
  const yil = o.dogum_tarihi ? String(o.dogum_tarihi).slice(0, 4) : "";
  return `<div class="kart on">
  <div class="daire"></div><div class="halka"></div>
  <div class="ust">${logo ? `<img src="${logo}" alt="">` : ARMA(t.sari, t.morKoyu)}<div class="k"><div class="ad">${esc(a.kulupAdi || VARSAYILAN_KULUP)}</div><div class="alt">${esc(kartAltYazi(a.kisaAd, a.kurulusYili))}</div></div>${a.sezon ? `<div class="sezon">${esc(a.sezon)}</div>` : ""}</div>
  <div class="govde">
    <div class="foto">${foto ? `<img src="${foto}" alt="">` : SILUET}</div>
    <div class="bilgi"><div class="etiket">OYUNCU GİRİŞ KARTI</div><div class="isim">${esc(o.ad_soyad)}</div>
      <div class="satir"><div class="alan"><span>Yaş grubu</span><span>${esc(o.yas_grubu_ad || "—")}</span></div><div class="alan"><span>Oyuncu no</span><span>${oyuncuNo(o.id)}</span></div>${yil ? `<div class="alan"><span>Doğum</span><span>${esc(yil)}</span></div>` : ""}</div>
    </div>
    ${o.qrSvg ? `<div class="qr"><div class="kutu">${o.qrSvg}</div><span>GİRİŞ KODU</span></div>` : ""}
  </div>
  <div class="dip"><span>Kart kişiseldir · Giriş için aidatın ödenmiş olması gerekir</span>${a.telefon ? `<b>${esc(a.telefon)}</b>` : ""}</div>
</div>`;
}

/** @param {KartOyuncu} o @param {KartAyar} a @param {string} sezon */
function arkaYuz(o, a, sezon) {
  const kurallar = (a.kurallar && a.kurallar.length ? a.kurallar : KART_KURAL_VARSAYILAN).filter((k) => String(k || "").trim());
  const iletisim = [a.adres, a.telefon, a.web]
    .filter((x) => String(x || "").trim())
    .map((x) => esc(x))
    .join("\n");
  const no = kartNo(o.id, sezon);
  return `<div class="kart arka">
  <div class="serit"></div>
  <div class="ic">
    <div class="sol"><h4>KART SAHİBİNİN BİLGİSİNE</h4>${kurallar.map((k, i) => `<div class="kural"><b>${i + 1}.</b><span>${esc(k)}</span></div>`).join("")}
      ${o.veli_ad ? `<div class="veli"><span>Veli</span><b>${esc(o.veli_ad)}</b>${o.veli_tel ? ` <span style="color:#6B6480;display:inline">${esc(telMaskele(o.veli_tel))}</span>` : ""}</div>` : ""}
    </div>
    <div class="sag"><div class="kad">${esc(a.kulupAdi || VARSAYILAN_KULUP)}</div>${iletisim ? `<div class="iletisim">${iletisim}</div>` : ""}
      <div class="barkod">${o.barkodSvg ? `<div class="cubuk">${o.barkodSvg}</div>` : ""}<span>${esc(no)}</span></div>
    </div>
  </div>
  <div class="dip2"><span>Bulunması hâlinde kulübe teslim ediniz.</span><span>Futbol Okulu Kayıt Programı</span></div>
</div>`;
}

/**
 * Yazdırma HTML'i. `duzen`: "tek" → A4 yatay, bir oyuncunun ön + arka yüzü yan yana; "toplu" → A4 yatay 2 × 3, ön yüz sayfaları
 * sonra aynı sırayla arka yüz sayfaları; "onizleme" → yalnız iki kart alt alta (Ayarlar önizlemesi, sayfa yok).
 * @param {{ oyuncular: KartOyuncu[], ayar: KartAyar, duzen?: "tek"|"toplu"|"onizleme" }} p
 */
export function girisKartiHtml({ oyuncular, ayar, duzen = "tek" }) {
  const t = temaTuret(ayar.tema || {});
  const sezon = ayar.sezon || "";
  const on = oyuncular.map((o) => onYuz(o, ayar, t));
  const arka = oyuncular.map((o) => arkaYuz(o, ayar, sezon));
  let govde = "";
  let sayfa = "@page { size: A4 landscape; margin: 10mm; }";
  if (duzen === "onizleme") {
    sayfa = "";
    govde = `<div class="onizleme">${on[0] || ""}${arka[0] || ""}</div>`;
  } else if (duzen === "tek") {
    govde = oyuncular.map((_, i) => `<div class="sayfa tek">${on[i]}${arka[i]}</div>`).join("");
  } else {
    const sayfalar = [];
    for (let i = 0; i < on.length; i += TOPLU_SAYFA_KART) {
      sayfalar.push(`<div class="sayfa toplu">${on.slice(i, i + TOPLU_SAYFA_KART).join("")}</div>`);
      sayfalar.push(`<div class="sayfa toplu">${arka.slice(i, i + TOPLU_SAYFA_KART).join("")}</div>`);
    }
    govde = sayfalar.join("");
  }
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Giriş Kartı</title>
<style>
  ${sayfa}
  body { margin: 0; background: #fff; }
  .sayfa { display: grid; gap: 6mm; page-break-after: always; break-after: page; align-content: start; justify-content: start; }
  .sayfa.tek { grid-template-columns: repeat(2, ${KART_EN_MM}mm); }
  .sayfa.toplu { grid-template-columns: repeat(2, ${KART_EN_MM}mm); grid-auto-rows: ${KART_BOY_MM}mm; }
  .sayfa .kart { outline: .3mm solid #B9B2C6; outline-offset: 0; border-radius: 0; }
  .onizleme { display: flex; flex-direction: column; gap: 4mm; padding: 2mm; width: ${KART_EN_MM}mm; }
  ${kartCss(t)}
</style></head><body>${govde}</body></html>`;
}
