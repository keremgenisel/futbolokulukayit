// SAF: belge yükleme girdisi doğrulama (güvenlik incelemesi 08.09.2026 #15). tip beyaz listesi, pozitif tam sayı oyuncu id, ISO tarih.
const BELGE_TIPLERI = new Set(["saglik", "foto", "sporcu_kimlik", "veli_kimlik", "kayit_formu", "diger"]);
function belgeGirdiDogrula({ playerId, tip, gecerlilik }) {
  const id = Number(playerId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Geçersiz oyuncu");
  if (!BELGE_TIPLERI.has(String(tip))) throw new Error("Geçersiz belge türü");
  const g = gecerlilik ? String(gecerlilik) : null;
  if (g && !/^\d{4}-\d{2}-\d{2}$/.test(g)) throw new Error("Geçerlilik tarihi geçersiz");
  return { playerId: id, tip: String(tip), gecerlilik: g };
}
// Zorunlu belgeler: "diger" hariç (src/lib/belge.js ZORUNLU_BELGELER ile aynı; test bunu denetler). Oyuncular > "Eksik belgesi olanlar".
const ZORUNLU_BELGELER = [...BELGE_TIPLERI].filter((t) => t !== "diger");
module.exports = { belgeGirdiDogrula, BELGE_TIPLERI, ZORUNLU_BELGELER };
