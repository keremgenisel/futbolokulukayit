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
  const g = new Date(gecerlilikIso + "T00:00:00"), b = new Date(bugunIso + "T00:00:00");
  const kalanGun = Math.round((g.getTime() - b.getTime()) / 86400000);
  if (kalanGun < 0) return { durum: "doldu", kalanGun };
  if (kalanGun <= esik) return { durum: "dolacak", kalanGun };
  return { durum: "gecerli", kalanGun };
}

/** Kısa Türkçe etiket. @param {{durum:string, kalanGun:number|null}} d */
export function belgeEtiketi(d) {
  if (d.durum === "doldu") return `Süresi doldu (${Math.abs(d.kalanGun || 0)} gün önce)`;
  if (d.durum === "dolacak") return d.kalanGun === 0 ? "Bugün doluyor" : `${d.kalanGun} gün kaldı`;
  if (d.durum === "gecerli") return "Geçerli";
  return "Tarih girilmemiş";
}
