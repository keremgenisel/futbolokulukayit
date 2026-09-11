// @ts-check
// Sezon mantığı — SAF (I/O yok). Sezon adı "2026-2027"; başlangıç ayı ayarlardan (varsayılan Eylül = 9).

export const VARSAYILAN_SEZON_AYI = 9;

/** Verilen tarihin içinde bulunduğu sezon. @param {string} iso yyyy-mm-dd @param {number} baslangicAyi 1-12 */
export function guncelSezon(iso, baslangicAyi = VARSAYILAN_SEZON_AYI) {
  const yil = Number(iso.slice(0, 4)),
    ay = Number(iso.slice(5, 7));
  const bas = ay >= baslangicAyi ? yil : yil - 1;
  return `${bas}-${bas + 1}`;
}

/**
 * Sezon seçim kutusunun seçenekleri (plan §15): aktif sezon (ayar boşsa bugünün sezonu) ve sonraki sezon.
 * `mevcut` verilirse ve iki seçenekten biri değilse (eski elle girilmiş değer) üçüncü seçenek olarak eklenir ki kayıt bozulmasın.
 * @param {{ aktifSezon?: string, bugunIso: string, baslangicAyi?: number, mevcut?: string }} p
 * @returns {{ kod: string, ad: string }[]}
 */
export function sezonSecenekleri({ aktifSezon = "", bugunIso, baslangicAyi = VARSAYILAN_SEZON_AYI, mevcut = "" }) {
  const aktif = sezonGecerliMi(aktifSezon) ? aktifSezon : guncelSezon(bugunIso, baslangicAyi);
  const l = [
    { kod: aktif, ad: `${aktif} (aktif sezon)` },
    { kod: sonrakiSezon(aktif), ad: `${sonrakiSezon(aktif)} (sonraki sezon)` },
  ];
  if (mevcut && !l.some((s) => s.kod === mevcut)) l.push({ kod: mevcut, ad: `${mevcut} (eski kayıt)` });
  return l;
}

/**
 * Sezon + ay → takvim yılı (plan §17.5): başlangıç ayı ve sonrası sezonun ilk yılı, öncesi ikinci yılı.
 * ("2027-2028", 9) → 2027; ("2027-2028", 1) → 2028. Sezon bozuksa null.
 * @param {string} sezon @param {number} ay 1-12 @param {number} baslangicAyi
 */
export function sezonAyYili(sezon, ay, baslangicAyi = VARSAYILAN_SEZON_AYI) {
  if (!sezonGecerliMi(sezon)) return null;
  const ilk = Number(sezon.slice(0, 4));
  return Number(ay) >= baslangicAyi ? ilk : ilk + 1;
}

/**
 * Sezonun ayları, başlangıç ayından itibaren sıralı (plan §19): [{ yil, ay }] — Eylül … Ağustos. Sezon bozuksa boş.
 * @param {string} sezon @param {number} baslangicAyi
 */
export function sezonAylari(sezon, baslangicAyi = VARSAYILAN_SEZON_AYI) {
  if (!sezonGecerliMi(sezon)) return [];
  const l = [];
  for (let i = 0; i < 12; i++) {
    const ay = ((baslangicAyi - 1 + i) % 12) + 1;
    l.push({ yil: sezonAyYili(sezon, ay, baslangicAyi), ay });
  }
  return l;
}

/** Ayın son günü (yyyy-aa-gg). @param {number} yil @param {number} ay */
export function ayinSonGunu(yil, ay) {
  const son = new Date(yil, ay, 0).getDate();
  return `${yil}-${String(ay).padStart(2, "0")}-${String(son).padStart(2, "0")}`;
}

/** Sezonun tarih aralığı: ilk ayın 1'i – son ayın son günü. Sezon bozuksa null. @param {string} sezon @param {number} baslangicAyi */
export function sezonAraligi(sezon, baslangicAyi = VARSAYILAN_SEZON_AYI) {
  const aylar = sezonAylari(sezon, baslangicAyi);
  if (!aylar.length) return null;
  const ilk = aylar[0],
    son = aylar[aylar.length - 1];
  return { from: `${ilk.yil}-${String(ilk.ay).padStart(2, "0")}-01`, to: ayinSonGunu(Number(son.yil), son.ay) };
}

/**
 * Sezon tarihleri doğrulaması (plan §37): bitiş > başlangıç, başlangıç yılı etiketin ilk yılı, aralık en çok 14 ay.
 * @param {string} sezon @param {string} baslangic ISO @param {string} bitis ISO @returns {{ gecerli: boolean, neden?: string }}
 */
export function sezonTarihDogrula(sezon, baslangic, bitis) {
  if (!sezonGecerliMi(sezon)) return { gecerli: false, neden: "Sezon 2026-2027 biçiminde olmalı" };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(String(baslangic || "")) || !iso.test(String(bitis || ""))) return { gecerli: false, neden: "Tarihler yyyy-aa-gg olmalı" };
  if (bitis <= baslangic) return { gecerli: false, neden: "Bitiş başlangıçtan sonra olmalı" };
  if (Number(baslangic.slice(0, 4)) !== Number(sezon.slice(0, 4)))
    return { gecerli: false, neden: `Başlangıç ${sezon.slice(0, 4)} yılında olmalı` };
  const ayFarki =
    (Number(bitis.slice(0, 4)) - Number(baslangic.slice(0, 4))) * 12 + (Number(bitis.slice(5, 7)) - Number(baslangic.slice(5, 7)));
  if (ayFarki > 14) return { gecerli: false, neden: "Sezon en çok 14 ay olabilir" };
  return { gecerli: true };
}

/** Bitişe kalan gün (bugün dahil değil); geçmişse negatif. @param {string} bitisIso @param {string} bugunIso */
export function sezonKalanGun(bitisIso, bugunIso) {
  const a = Date.UTC(Number(bitisIso.slice(0, 4)), Number(bitisIso.slice(5, 7)) - 1, Number(bitisIso.slice(8, 10)));
  const b = Date.UTC(Number(bugunIso.slice(0, 4)), Number(bugunIso.slice(5, 7)) - 1, Number(bugunIso.slice(8, 10)));
  return Math.round((a - b) / 86400000);
}
const AY_KISA_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
/** "1 Eyl – 30 Haz" (yıllar farklıysa yıl eklenmez; etiket zaten sezonu söyler). @param {string} baslangic @param {string} bitis */
export function kisaAralik(baslangic, bitis) {
  const k = (/** @type {string} */ iso) => `${Number(iso.slice(8, 10))} ${AY_KISA_TR[Number(iso.slice(5, 7)) - 1]}`;
  return `${k(baslangic)} – ${k(bitis)}`;
}
/** ISO tarihten {yil, ay}. @param {string} iso */
export const isoYilAy = (iso) => ({ yil: Number(String(iso).slice(0, 4)), ay: Number(String(iso).slice(5, 7)) });

/** "2026-2027" → "2027-2028". Biçim bozuksa boş döner. @param {string} sezon */
export function sonrakiSezon(sezon) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(sezon || ""));
  if (!m) return "";
  const b = Number(m[1]) + 1;
  return `${b}-${b + 1}`;
}

/** @param {string} sezon */
export const sezonGecerliMi = (sezon) => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(sezon || ""));
  return !!m && Number(m[2]) === Number(m[1]) + 1;
};

/**
 * Sezon sonu geldi mi? Kayıtlı aktif sezon, bugünün sezonundan eskiyse evet (yeni sezon başladı, geçiş yapılmadı).
 * @param {string} aktifSezon @param {string} bugunIso @param {number} baslangicAyi
 */
export function sezonSonuMu(aktifSezon, bugunIso, baslangicAyi = VARSAYILAN_SEZON_AYI) {
  if (!sezonGecerliMi(aktifSezon)) return false;
  return Number(guncelSezon(bugunIso, baslangicAyi).slice(0, 4)) > Number(aktifSezon.slice(0, 4));
}

/**
 * Yaş grubu adından bir üst grubu önerir: "U11" → "U12" (adı böyle olmayan grupta öneri yok).
 * @param {string} ad
 */
export function ustGrupAdi(ad) {
  const m = /^(\D*)U\s*(\d{1,2})(.*)$/i.exec(String(ad || "").trim());
  if (!m) return "";
  return `${m[1]}U${Number(m[2]) + 1}${m[3]}`;
}

/**
 * Oyuncunun mevcut grubuna göre yeni sezonda önerilen grup id'si; üst grup yoksa mevcut grup kalır.
 * @param {{ id: number, ad: string, aktif?: number }[]} gruplar
 * @param {number|null} mevcutId
 */
export function ustGrupOner(gruplar, mevcutId) {
  const mevcut = gruplar.find((g) => g.id === mevcutId);
  if (!mevcut) return mevcutId;
  const norm = (/** @type {string} */ ad) => String(ad).toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
  const bul = (/** @type {string} */ ad) => ad && gruplar.find((g) => g.aktif !== 0 && norm(g.ad) === norm(ad));
  const hedef = bul(ustGrupAdi(mevcut.ad));
  if (hedef) return hedef.id;
  // "U11 A" → "U12 A" yoksa alt gruplar birleşmiş olabilir: sonek atılıp "U12" denenir.
  const m = /^(\D*U\s*\d{1,2})(.+)$/i.exec(String(mevcut.ad).trim());
  const govde = m ? bul(ustGrupAdi(m[1])) : null;
  return govde ? govde.id : mevcutId;
}
