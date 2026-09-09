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
