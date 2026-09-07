// Makbuz yazdırma akışı (tek yer). Yazıcı yoksa / yazdırma başarısızsa makbuzun PDF'i açılır,
// kullanıcı sistem görüntüleyicisinden yazdırabilir. Dönüş: { ok, mesaj }.
import { db, cikti, files, uygulama } from "./api.js";
import { makbuzHtml } from "./makbuzHtml.js";

export async function makbuzHtmlUret(receiptId) {
  const [m, kalemler, logo, kulup] = await Promise.all([db("getReceipt", receiptId), db("listFeeItems"), uygulama().logo(), db("getSetting", "kulup_adi")]);
  return makbuzHtml({ makbuz: m, kalemler, logo, kulupAdi: kulup || "EYÜPSPOR FUTBOL OKULU" });
}

const HATA_TR = (h) => {
  const m = String(h || "");
  if (/no printers/i.test(m)) return "Bu bilgisayarda tanımlı yazıcı yok.";
  if (/cancel/i.test(m)) return "Yazdırma iptal edildi.";
  return m ? `Yazdırma başarısız: ${m}` : "Yazdırma başarısız.";
};

/**
 * Genel yazdırma (yoklama formu, rapor): yazıcı yoksa ya da yazdırma başarısızsa aynı HTML geçici PDF olarak
 * sistem görüntüleyicisinde açılır; kullanıcı oradan yazdırır. İptal ise yalnız mesaj döner.
 * @param {string} html @param {string} pdfAdi ör. "yoklama-U11-2026-09-07" @param {boolean=} yatay
 * @returns {Promise<{ ok: boolean, mesaj?: string }>}
 */
export async function htmlYazdir(html, pdfAdi, yatay = false) {
  const r = await cikti().yazdir(html);
  if (r?.ok) return { ok: true };
  const neden = HATA_TR(r?.hata);
  if (/iptal/.test(neden)) return { ok: false, mesaj: neden };
  const p = await cikti().pdfAc(html, pdfAdi, yatay);
  if (p?.ok) return { ok: false, mesaj: `${neden} Form PDF olarak açıldı, oradan yazdırabilirsiniz.` };
  return { ok: false, mesaj: `${neden} PDF de açılamadı: ${p?.error || ""}`.trim() };
}

/** @param {number} receiptId @param {string=} html hazırsa tekrar üretilmez */
export async function makbuzYazdir(receiptId, html) {
  const h = html || await makbuzHtmlUret(receiptId);
  const r = await cikti().yazdir(h);
  if (r?.ok) return { ok: true };
  const neden = HATA_TR(r?.hata);
  if (/iptal/.test(neden)) return { ok: false, mesaj: neden };
  // PDF yedek yolu: kayıtlı PDF yoksa üret, sonra sistem görüntüleyicisinde aç.
  let m = await db("getReceipt", receiptId);
  if (!m?.pdf_yolu) { await cikti().makbuzPdf(receiptId, h); m = await db("getReceipt", receiptId); }
  if (m?.pdf_yolu) { await files().open(m.pdf_yolu); return { ok: false, mesaj: `${neden} Makbuz PDF olarak açıldı, oradan yazdırabilirsiniz.` }; }
  return { ok: false, mesaj: neden };
}
