// @ts-check
// Yoklama takvim şeridi için SAF tarih yardımcıları. Saat dilimi kaymasını önlemek için
// ISO metin (yyyy-mm-dd) üzerinden, UTC-siz yerel Date ile çalışır.

export const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"];

/** @param {string} iso */
function parcala(iso) {
  const [y, a, g] = iso.split("-").map(Number);
  return new Date(y, a - 1, g);
}
/** @param {Date} d */
function isoYap(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO tarihe n gün ekler (negatif olabilir). @param {string} iso @param {number} n */
export function gunKaydir(iso, n) {
  const d = parcala(iso);
  d.setDate(d.getDate() + n);
  return isoYap(d);
}

/** Pazartesi başlangıçlı hafta indeksi: Pzt=0 … Paz=6. @param {string} iso */
export function haftaGunu(iso) {
  return (parcala(iso).getDay() + 6) % 7;
}

/** Verilen günün içinde bulunduğu haftanın pazartesisi. @param {string} iso */
export function haftaBasi(iso) {
  return gunKaydir(iso, -haftaGunu(iso));
}

/**
 * Şerit hücreleri: `baslangic` gününden itibaren `adet` gün.
 * @param {string} baslangic ISO
 * @param {number} adet
 * @param {string} bugun ISO
 * @returns {{ iso: string, gunAdi: string, gun: number, ay: string, ayEtiketi: boolean, bugunMu: boolean, haftaSonu: boolean }[]}
 */
export function gunSeridi(baslangic, adet, bugun) {
  const out = [];
  for (let i = 0; i < adet; i++) {
    const iso = gunKaydir(baslangic, i);
    const d = parcala(iso);
    const hg = haftaGunu(iso);
    out.push({
      iso,
      gunAdi: GUN_KISA[hg],
      gun: d.getDate(),
      ay: AY_KISA[d.getMonth()],
      ayEtiketi: i === 0 || d.getDate() === 1, // şeridin ilk hücresi ve her ay başı ay adını taşır
      bugunMu: iso === bugun,
      haftaSonu: hg >= 5,
    });
  }
  return out;
}

/**
 * Gün sezon tarihlerinin dışında mı (plan §37.6; bilgi amaçlı, engel değil). Tarihler yoksa hiçbir gün sezon dışı sayılmaz.
 * @param {string} iso @param {{ baslangic?: string, bitis?: string } | null | undefined} tarihler
 */
export function sezonDisiMi(iso, tarihler) {
  if (!tarihler || !tarihler.baslangic || !tarihler.bitis) return false;
  return iso < tarihler.baslangic || iso > tarihler.bitis;
}
/**
 * Pazartesi'den başlayan haftanın TAMAMI sezon dışında mı (kısmen dışarıda olan hafta sezon içi sayılır).
 * @param {string} haftaBasiIso @param {{ baslangic?: string, bitis?: string } | null | undefined} tarihler
 */
export function haftaSezonDisiMi(haftaBasiIso, tarihler) {
  if (!tarihler || !tarihler.baslangic || !tarihler.bitis) return false;
  const son = gunKaydir(haftaBasiIso, 6);
  return son < tarihler.baslangic || haftaBasiIso > tarihler.bitis;
}

/** Bugünü ortalayan 14 günlük şerit başlangıcı: bu haftanın pazartesisinden bir hafta önce. @param {string} bugun */
export function varsayilanBaslangic(bugun) {
  return gunKaydir(haftaBasi(bugun), -7);
}

/** "8 Eylül 2026 Salı" gibi uzun Türkçe başlık. @param {string} iso */
export function uzunTarih(iso) {
  const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const d = parcala(iso);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()} ${GUNLER[haftaGunu(iso)]}`;
}

/**
 * Bir günün antrenman özetinden nokta renk kodları: gri = yoklama alınmamış, mor = kısmen,
 * yeşil = tamamlanmış, kırmızı = iptal. Her antrenman bir nokta.
 * @param {{ iptal: number, oyuncu: number, isaretli: number }[]} antrenmanlar
 * @returns {("gri"|"mor"|"yesil"|"kirmizi")[]}
 */
export function gunNoktalari(antrenmanlar) {
  return antrenmanlar.map((t) => {
    if (t.iptal) return "kirmizi";
    if (t.isaretli === 0) return "gri";
    if (t.oyuncu > 0 && t.isaretli >= t.oyuncu) return "yesil";
    return "mor";
  });
}

/**
 * Gün kutusuna sığacak nokta özeti (Kerem 13.09.2026: 10+ antrenmanda noktalar kutudan taşıyordu). En çok `maks` nokta;
 * fazlaysa her türden BİR nokta (ilk görülme sırasıyla, en çok maks-1) ve kalan sayı "+N" olarak yazılır.
 * @param {string[]} noktalar gunNoktalari çıktısı @param {number} [maks]
 * @returns {{ goster: string[], fazla: number }}
 */
export function gunNoktaOzeti(noktalar, maks = 4) {
  if (noktalar.length <= maks) return { goster: noktalar, fazla: 0 };
  const turler = [...new Set(noktalar)].slice(0, maks - 1);
  return { goster: turler, fazla: noktalar.length - turler.length };
}
