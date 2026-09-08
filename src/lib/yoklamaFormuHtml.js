// @ts-check
// Saha yoklama formu (A4 dikey, yazdırma/PDF). Antrenör sahada elle işaretler; programda işaretli olanlar dolu gelir.
// SAF: I/O yok. Plan §12. Aidat/borç bilgisi kasıtlı olarak forma girmez (kâğıt sahada velilerin gözü önünde).
import { uzunTarih } from "./takvim.js";

import { esc, guvenliLogo } from "./metin.js";

/** Boş satır sayısı: sonradan gelen/deneme oyuncular elle yazılır. */
export const EK_BOS_SATIR = 3;
/** @type {Record<string, string>} */
const ETIKET = { deneme: "deneme", sakat: "sakat" };
const KUTU_IC = {
  geldi: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#1B1530" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  gelmedi: '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#1B1530" stroke-width="2.6" stroke-linecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9"/></svg>',
  izinli: '<span class="izin">İ</span>',
};

/**
 * @param {"geldi"|"gelmedi"|"izinli"} sutun
 * @param {string|undefined} isaret oyuncunun programdaki durumu
 */
const kutu = (sutun, isaret) => `<td class="k"><div class="kutu${isaret === sutun ? " dolu" : ""}">${isaret === sutun ? KUTU_IC[sutun] : ""}</div></td>`;

/**
 * @param {{ grup: string, tarih: string, saat?: string, saha?: string, oyuncular: { ad_soyad: string, durum?: string, isaret?: string }[], logo?: string, kulup?: string }} p
 */
export function yoklamaFormuHtml({ grup, tarih, saat = "", saha = "", oyuncular, logo = "", kulup = "EYÜPSPOR FUTBOL OKULU" }) {
  /** @param {number} no @param {{ ad_soyad: string, durum?: string, isaret?: string } | null} o */
  const satir = (no, o) => {
    const et = o && ETIKET[o.durum || ""] ? ` <span class="etiket">(${ETIKET[o.durum || ""]})</span>` : "";
    return `<tr><td class="no${o ? "" : " bos"}">${no}</td><td class="ad">${o ? esc(o.ad_soyad) + et : ""}</td>${kutu("geldi", o?.isaret)}${kutu("gelmedi", o?.isaret)}${kutu("izinli", o?.isaret)}<td class="not"></td></tr>`;
  };
  const satirlar = oyuncular.map((o, i) => satir(i + 1, o));
  for (let i = 0; i < EK_BOS_SATIR; i++) satirlar.push(satir(oyuncular.length + i + 1, null));
  const cizgi = (/** @type {number} */ w) => `<span class="cizgi" style="width:${w}mm"></span>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Yoklama Formu ${esc(grup)} ${esc(tarih)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1B1530; margin: 0; font-size: 11pt; }
  .ust { display: flex; align-items: center; gap: 5mm; }
  .ust img { width: 16mm; height: 16mm; object-fit: contain; }
  .baslik { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  h1 { font-size: 18pt; margin: 0; color: #3F1D66; line-height: 1; }
  .kulup { font-size: 11pt; color: #5B2D8E; font-weight: 600; letter-spacing: .04em; }
  .sag { display: flex; flex-direction: column; align-items: flex-end; gap: 1mm; font-size: 10.5pt; }
  .grup { font-size: 22pt; font-weight: 700; color: #3F1D66; line-height: 1; }
  .bant { height: 1mm; background: linear-gradient(90deg, #5B2D8E 0 50%, #F5D000 50% 100%); margin: 3mm 0; }
  .antrenor { display: flex; align-items: flex-end; gap: 3mm; font-size: 10.5pt; margin-bottom: 3mm; }
  .antrenor .ipucu { margin-left: auto; font-size: 8.5pt; color: #6B6480; }
  .cizgi { display: inline-block; border-bottom: .3mm solid #1B1530; height: 5mm; }
  .soluk { color: #6B6480; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #3F1D66; background: #EDE6F6; padding: 2mm; border: .25mm solid #CFC7DC; text-align: center; }
  th.ad { text-align: left; }
  td { padding: 0 2.5mm; height: 8mm; border: .25mm solid #CFC7DC; vertical-align: middle; }
  td.no { width: 7mm; text-align: center; color: #6B6480; font-size: 9.5pt; }
  td.no.bos { color: #A8A0B8; }
  td.ad { font-weight: 600; }
  td.k { width: 16mm; text-align: center; padding: 0; }
  td.not { width: 38mm; }
  .etiket { font-size: 9pt; color: #6B6480; font-weight: 400; }
  .kutu { width: 6mm; height: 6mm; border: .4mm solid #1B1530; border-radius: .8mm; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
  .izin { font-weight: 700; font-size: 11pt; line-height: 1; }
  .alt { display: flex; align-items: flex-end; gap: 6mm; font-size: 10.5pt; margin-top: 4mm; }
  .alt .imza { margin-left: auto; }
  .dip { margin-top: 5mm; text-align: center; font-size: 8.5pt; color: #5B2D8E; font-weight: 600; }
  tr { page-break-inside: avoid; }
</style></head><body>
<div class="ust">${guvenliLogo(logo) ? `<img src="${guvenliLogo(logo)}" alt="">` : ""}<div class="baslik"><h1>YOKLAMA FORMU</h1><span class="kulup">${esc(kulup)}</span></div>
<div class="sag"><span class="grup">${esc(grup)}</span><span><b>${esc(uzunTarih(tarih))}</b>${saat ? ` · ${esc(saat)}` : ""}</span>${saha ? `<span><span class="soluk">Saha:</span> <b>${esc(saha)}</b></span>` : ""}</div></div>
<div class="bant"></div>
<div class="antrenor"><span class="soluk">Antrenör:</span>${cizgi(60)}<span class="ipucu">Programda işaretli olanlar dolu gelir; kalanları sahada işaretleyin.</span></div>
<table><thead><tr><th>#</th><th class="ad">Ad Soyad</th><th>Geldi</th><th>Gelmedi</th><th>İzinli</th><th>Not</th></tr></thead><tbody>${satirlar.join("")}</tbody></table>
<div class="alt"><span><span class="soluk">Toplam:</span> <b>${oyuncular.length} oyuncu</b></span><span><span class="soluk">Geldi</span> ${cizgi(10)}</span><span><span class="soluk">Gelmedi</span> ${cizgi(10)}</span><span><span class="soluk">İzinli</span> ${cizgi(10)}</span><span class="imza"><span class="soluk">İmza</span> ${cizgi(45)}</span></div>
<div class="dip">#BirSemtinRüyası #SemtiMukaddes #HayaleAşıkOl</div>
</body></html>`;
}
