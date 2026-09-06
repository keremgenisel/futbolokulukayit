// @ts-check
// Aidat ile ilgili SAF mantık (I/O yok, test edilebilir). Kaynak: docs/plan.md §3.

/** Aidat ödemesi beklenen oyuncu durumları. */
export const AIDAT_ODENEN_DURUMLAR = new Set(["aktif", "deneme", "sakat"]);
/** Aidat muafiyeti veren ücret tipleri. */
export const MUAF_UCRET_TIPLERI = new Set(["ucretsiz", "burslu"]);

export const DURUMLAR = [
  { kod: "aktif", ad: "Aktif" }, { kod: "deneme", ad: "Deneme" }, { kod: "pasif", ad: "Pasif" },
  { kod: "ayrildi", ad: "Ayrıldı" }, { kod: "sakat", ad: "Sakat" }, { kod: "dondurma", ad: "Dondurma" },
];
export const UCRET_TIPLERI = [
  { kod: "normal", ad: "Normal" }, { kod: "burslu", ad: "Burslu" }, { kod: "indirimli", ad: "İndirimli" },
  { kod: "kardes", ad: "Kardeş İndirimi" }, { kod: "ucretsiz", ad: "Ücretsiz" },
];
export const ODEME_YONTEMLERI = [
  { kod: "nakit", ad: "Nakit" }, { kod: "havale", ad: "Havale / EFT" },
  { kod: "kredi_karti", ad: "Kredi Kartı" }, { kod: "online", ad: "Online Ödeme" },
];
export const ODEME_DONEMLERI = ["1-10", "11-20", "21-31"];

/**
 * Bir oyuncu için verilen ayda aidat kaydının hangi durumda açılacağı.
 * @param {{durum: string, ucret_tipi: string, aylik_aidat: number}} oyuncu
 * @returns {"odenmedi"|"muaf"|null} null → kayıt açılmaz (pasif/ayrıldı/dondurma)
 */
export function aidatBaslangicDurumu(oyuncu) {
  if (!AIDAT_ODENEN_DURUMLAR.has(oyuncu.durum)) return null;
  if (MUAF_UCRET_TIPLERI.has(oyuncu.ucret_tipi)) return "muaf";
  if (!(Number(oyuncu.aylik_aidat) > 0)) return "muaf";
  return "odenmedi";
}

/**
 * Tesise girebilir mi? Bu ayın aidat kaydı ödendi/muaf ise evet.
 * @param {{durum: string}} oyuncu
 * @param {{durum: string}|null} buAyAidat
 */
export function tesiseGirebilir(oyuncu, buAyAidat) {
  if (!AIDAT_ODENEN_DURUMLAR.has(oyuncu.durum)) return false;
  if (!buAyAidat) return false;
  return buAyAidat.durum === "odendi" || buAyAidat.durum === "muaf";
}

/**
 * Ödeme döneminin son günü. "1-10" → 10, "11-20" → 20, "21-31" → ayın son günü.
 * @param {string} donem
 * @param {number} yil
 * @param {number} ay 1-12
 */
export function donemSonGunu(donem, yil, ay) {
  const aySonu = new Date(yil, ay, 0).getDate();
  if (donem === "1-10") return 10;
  if (donem === "11-20") return 20;
  return aySonu;
}

/**
 * Gecikme gün sayısı. Dönem sonu geçmediyse 0.
 * @param {string} donem
 * @param {number} yil
 * @param {number} ay
 * @param {Date} bugun
 */
export function gecikmeGunu(donem, yil, ay, bugun) {
  const son = new Date(yil, ay - 1, donemSonGunu(donem, yil, ay));
  const fark = Math.floor((bugun.getTime() - son.getTime()) / 86400000);
  return fark > 0 ? fark : 0;
}

/**
 * Türkçe para biçimi: 3500 → "3.500 ₺"
 * @param {number|string|null|undefined} tutar
 */
export function paraTR(tutar) {
  const n = Number(tutar || 0);
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " ₺";
}

/**
 * ISO tarihi (2015-11-02) → 02.11.2015
 * @param {string|null|undefined} iso
 */
export function tarihTR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(iso);
}

export const AY_ADLARI = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
