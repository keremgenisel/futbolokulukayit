// @ts-check
// Basit tablo raporu HTML'i (PDF çıktısı için). Başlık, alt başlık, sütunlar ve satırlar.
import { esc, guvenliLogo } from "./metin.js";

/**
 * @param {{ baslik: string, altBaslik?: string, sutunlar: {baslik: string, anahtar: string, sag?: boolean}[], satirlar: Record<string, unknown>[], logo?: string, yatay?: boolean }} p
 */
export function raporHtml({ baslik, altBaslik = "", sutunlar, satirlar, logo = "", yatay = false }) {
  const th = sutunlar.map((c) => `<th${c.sag ? ' class="sag"' : ""}>${esc(c.baslik)}</th>`).join("");
  const tr = satirlar
    .map((s) => `<tr>${sutunlar.map((c) => `<td${c.sag ? ' class="sag"' : ""}>${esc(s[c.anahtar])}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title>
<style>
  @page { size: A4 ${yatay ? "landscape" : "portrait"}; margin: 12mm; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1B1530; margin: 0; font-size: 10pt; }
  .ust { display: flex; align-items: center; gap: 4mm; border-bottom: 1mm solid #5B2D8E; padding-bottom: 3mm; margin-bottom: 4mm; }
  .ust img { width: 14mm; height: 14mm; object-fit: contain; }
  h1 { font-size: 16pt; margin: 0; color: #3F1D66; }
  .alt { color: #6B6480; font-size: 9.5pt; margin-top: 1mm; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #3F1D66; background: #EDE6F6; padding: 2mm; border-bottom: 1px solid #CFC7DC; }
  td { padding: 1.8mm 2mm; border-bottom: 1px solid #E2DCEC; }
  .sag { text-align: right; }
  tr:nth-child(even) td { background: #FAF8FD; }
  .dip { margin-top: 4mm; font-size: 8.5pt; color: #6B6480; }
</style></head><body>
<div class="ust">${guvenliLogo(logo) ? `<img src="${guvenliLogo(logo)}" alt="">` : ""}<div><h1>${esc(baslik)}</h1>${altBaslik ? `<div class="alt">${esc(altBaslik)}</div>` : ""}</div></div>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
<div class="dip">${satirlar.length} kayıt · Eyüpspor Futbol Okulu</div>
</body></html>`;
}
