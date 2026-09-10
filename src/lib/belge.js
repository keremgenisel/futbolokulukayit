// @ts-check
// Belge geçerliliği (sağlık raporu) — SAF mantık.
export const UYARI_GUN = 30;

/**
 * @param {string|null|undefined} gecerlilikIso yyyy-mm-dd
 * @param {string} bugunIso
 * @returns {{ durum: "yok"|"gecerli"|"dolacak"|"doldu", kalanGun: number|null }}
 */
export function belgeGecerlilik(gecerlilikIso, bugunIso, esik = UYARI_GUN) {
  if (!gecerlilikIso) return { durum: "yok", kalanGun: null };
  const g = new Date(gecerlilikIso + "T00:00:00"),
    b = new Date(bugunIso + "T00:00:00");
  const kalanGun = Math.round((g.getTime() - b.getTime()) / 86400000);
  if (kalanGun < 0) return { durum: "doldu", kalanGun };
  if (kalanGun <= esik) return { durum: "dolacak", kalanGun };
  return { durum: "gecerli", kalanGun };
}

/** Sağlık raporu için önerilen geçerlilik: yüklendiği günden bir yıl sonrası (kulüp: sporcu sağlık raporu yıllık). @param {string} bugunIso */
export function onerilenGecerlilik(bugunIso) {
  const d = new Date(bugunIso + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Kısa Türkçe etiket. @param {{durum:string, kalanGun:number|null}} d */
export function belgeEtiketi(d) {
  if (d.durum === "doldu") return `Süresi doldu (${Math.abs(d.kalanGun || 0)} gün önce)`;
  if (d.durum === "dolacak") return d.kalanGun === 0 ? "Bugün doluyor" : `${d.kalanGun} gün kaldı`;
  if (d.durum === "gecerli") return "Geçerli";
  return "Tarih girilmemiş";
}

/** Uyarı listesi aciliyet sırası: süresi dolan (en eski önce) → dolacak (en yakın önce) → rapor yok / tarihsiz (ada göre). */
/** @type {Record<string, number>} */
const ACILIYET = { doldu: 0, dolacak: 1, tarihsiz: 2, yok: 3 };
/** @param {{ durum: string, gecerlilik?: string|null, ad_soyad?: string }[]} uyarilar */
export function uyariSirala(uyarilar) {
  return [...uyarilar].sort(
    (a, b) =>
      (ACILIYET[a.durum] ?? 9) - (ACILIYET[b.durum] ?? 9) ||
      String(a.gecerlilik || "").localeCompare(String(b.gecerlilik || "")) ||
      String(a.ad_soyad || "").localeCompare(String(b.ad_soyad || ""), "tr"),
  );
}

/** Belge türleri (oyuncu kartı > Belgeler ile aynı liste). `istege`: isteğe bağlı — eksik sayılmaz. */
export const BELGE_TIPLERI = [
  { kod: "saglik", ad: "Sağlık raporu", gecerlilik: true },
  { kod: "foto", ad: "Vesikalık fotoğraf", tekil: true },
  { kod: "sporcu_kimlik", ad: "Sporcu kimlik fotokopisi" },
  { kod: "veli_kimlik", ad: "Veli kimlik fotokopisi" },
  { kod: "kayit_formu", ad: "İmzalı kayıt formu" },
  { kod: "diger", ad: "Diğer", istege: true }, // isteğe bağlı: yoksa "Eksik" değil "İsteğe bağlı" (09.09.2026)
];
/** Zorunlu belgeler: "Diğer" hariç hepsi (Kerem, 10.09.2026: eksik belge pili, diğeri dışında bırak). */
export const ZORUNLU_BELGELER = BELGE_TIPLERI.filter((t) => !t.istege);

/**
 * Oyuncuda bulunmayan zorunlu belgeler. `tipler`: mevcut belge türleri — dizi ya da virgüllü metin
 * (`playersPage` satırındaki `belge_tipleri`, group_concat); null/boş → hiç belge yok.
 * @param {string[]|string|null|undefined} tipler
 * @returns {{ kod: string, ad: string }[]}
 */
export function eksikBelgeler(tipler) {
  const var_ = new Set(
    Array.isArray(tipler)
      ? tipler
      : String(tipler || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
  );
  return ZORUNLU_BELGELER.filter((t) => !var_.has(t.kod)).map(({ kod, ad }) => ({ kod, ad }));
}
