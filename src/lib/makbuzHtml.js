// @ts-check
// Tahsilat makbuzu HTML şablonu — A4'e iki kopya (kulüp + veli). Yazdırma ve PDF için aynı HTML.
// Düzen design/Makbuz.dc.html ile birebir; kağıt makbuzdaki kalem sırası korunur.
import { paraTR, tarihTR, AY_ADLARI, ODEME_YONTEMLERI } from "./aidat.js";

/** @param {unknown} s */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);

/**
 * @param {{ makbuz: any, kalemler: any[], logo: string, kulupAdi?: string }} p
 */
export function makbuzHtml({ makbuz, kalemler, logo, kulupAdi = "EYÜPSPOR FUTBOL OKULU" }) {
  /** @type {any[]} */
  const satirlar_ = makbuz.satirlar || [];
  const satirMap = new Map(satirlar_.filter((l) => l.kalem_kod !== "aidat").map((l) => [l.fee_item_id, l]));
  // Aidat: birden fazla ay tek makbuzda olabilir → her ay ayrı satır (eskiden yeniye)
  const aidatSatirlari = satirlar_.filter((l) => l.kalem_kod === "aidat").sort((a, b) => (a.yil - b.yil) || (a.ay - b.ay));
  /** @param {any} l */
  const ayAdi = (l) => (l.yil && l.ay ? `${AY_ADLARI[l.ay - 1]} ${l.yil}` : "");
  const donem = aidatSatirlari.map(ayAdi).filter(Boolean).join(", ");
  const yontem = ODEME_YONTEMLERI.find((y) => y.kod === makbuz.odeme_yontemi)?.ad || makbuz.odeme_yontemi;
  /** @param {string} ad @param {any} l */
  const satir = (ad, l) => `<div class="r"><span class="k">${esc(ad)}</span><span class="v${l ? " b" : ""}">${l ? esc(paraTR(l.tutar)) : ""}</span></div>`;
  const satirlar = kalemler.map((k) => {
    if (k.kod === "aidat") {
      if (!aidatSatirlari.length) return satir("AİDAT", null);
      return aidatSatirlari.map((l) => satir(ayAdi(l) ? `AİDAT · ${ayAdi(l).toLocaleUpperCase("tr-TR")}` : "AİDAT", l)).join("");
    }
    return satir(k.ad.toLocaleUpperCase("tr-TR"), satirMap.get(k.id));
  }).join("");

  const blok = () => `
  <div class="mk">
    <div class="ust">
      ${logo ? `<img src="${logo}" alt="">` : ""}
      <div class="bas"><div class="t1">TAHSİLAT MAKBUZU</div><div class="t2">${esc(kulupAdi)}</div></div>
      <div class="sag"><div><span>Makbuz No:</span> <b>${esc(makbuz.makbuz_no)}</b></div><div><span>Tarih:</span> <b>${esc(tarihTR(makbuz.tarih))}</b></div></div>
    </div>
    <div class="cizgi"></div>
    <div class="tbl">
      <div class="r"><span class="k">ADI SOYADI</span><span class="v b sol">${esc(makbuz.ad_soyad)}</span></div>
      <div class="r"><span class="k">DOĞUM TARİHİ</span><span class="v sol">${esc(tarihTR(makbuz.dogum_tarihi))}${makbuz.yas_grubu_ad ? " · " + esc(makbuz.yas_grubu_ad) : ""}</span></div>
    </div>
    <div class="alt">
      <div class="tbl kal">${satirlar}<div class="r top"><span class="k">TOPLAM</span><span class="v">${esc(paraTR(makbuz.toplam))}</span></div></div>
      <div class="imza">
        <div class="bilgi"><div><span>Ödeme yöntemi:</span> <b>${esc(yontem)}</b></div>${donem ? `<div><span>Dönem:</span> <b>${esc(donem)}</b></div>` : ""}${makbuz.not_ ? `<div><span>Not:</span> ${esc(makbuz.not_)}</div>` : ""}</div>
        <div class="cizgiimza"><div class="line"></div><div class="l1">TAHSİL EDEN</div><div class="l2">${esc(makbuz.tahsil_eden || "")}</div></div>
      </div>
    </div>
  </div>`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Makbuz ${esc(makbuz.makbuz_no)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1B1530; }
  .sayfa { width: 210mm; height: 297mm; padding: 8mm 11mm; display: flex; flex-direction: column; gap: 4mm; }
  .mk { border: 2px solid #3F1D66; border-radius: 2mm; padding: 4mm 6mm; display: flex; flex-direction: column; gap: 3mm; }
  .ust { display: flex; align-items: center; gap: 5mm; }
  .ust img { width: 16mm; height: 16mm; object-fit: contain; }
  .bas { flex: 1; }
  .t1 { font-size: 18pt; font-weight: 800; color: #3F1D66; line-height: 1; letter-spacing: .02em; }
  .t2 { font-size: 11pt; font-weight: 700; color: #5B2D8E; letter-spacing: .04em; margin-top: 1mm; }
  .sag { text-align: right; font-size: 10pt; line-height: 1.6; }
  .sag span { color: #6B6480; }
  .cizgi { height: 1mm; background: linear-gradient(90deg, #5B2D8E 0 50%, #F5D000 50% 100%); }
  .tbl { border: 1px solid #CFC7DC; border-bottom: none; }
  .r { display: flex; align-items: center; border-bottom: 1px solid #CFC7DC; }
  .k { width: 52mm; padding: 1.4mm 3mm; font-weight: 700; font-size: 9.5pt; background: #EDE6F6; color: #3F1D66; border-right: 1px solid #CFC7DC; letter-spacing: .03em; }
  .v { flex: 1; padding: 1.4mm 3mm; font-size: 10pt; text-align: right; }
  .v.sol { text-align: left; }
  .v.b { font-weight: 700; }
  .alt { display: flex; gap: 6mm; }
  .kal { flex: 3; }
  .top { background: #FFF7C2; }
  .top .k { font-size: 12pt; color: #E0101F; }
  .top .v { font-size: 14pt; font-weight: 800; color: #3F1D66; }
  .imza { flex: 2; display: flex; flex-direction: column; justify-content: space-between; padding: 1mm 0; }
  .bilgi { font-size: 10pt; line-height: 1.7; }
  .bilgi span { color: #6B6480; }
  .cizgiimza { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
  .line { width: 44mm; height: 12mm; border-bottom: 1px solid #1B1530; }
  .l1 { font-size: 9pt; font-weight: 700; letter-spacing: .04em; }
  .l2 { font-size: 10pt; }
  .kes { display: flex; align-items: center; gap: 3mm; color: #6B6480; font-size: 8pt; }
  .kes div { flex: 1; border-top: 1px dashed #CFC7DC; }
</style></head><body><div class="sayfa">${blok()}<div class="kes"><div></div><span>kesme çizgisi</span><div></div></div>${blok()}</div></body></html>`;
}
