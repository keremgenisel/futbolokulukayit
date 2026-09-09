// Aktivasyon sunucusuyla konuşan istemci (main süreç). Faz 2'de aktivasyon-sunucu/ deploy edilince
// AKTIVASYON_URL doldurulur. Boşken online aktivasyon KAPALI: uygulama yalnız elle "Lease yapıştır"
// ile aktive olur. Dış host'a standart public-CA TLS ile fetch (Node 18+ global fetch).
const AKTIVASYON_URL = "https://futbol-okulu-aktivasyon.keremgenisel.workers.dev";

const ayarli = () => !!AKTIVASYON_URL;

async function istek(yol, govde) {
  if (!AKTIVASYON_URL) return { error: "Aktivasyon sunucusu ayarlı değil (yalnız elle lease girişi açık)" };
  const ctrl = new AbortController();
  const zaman = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(AKTIVASYON_URL + yol, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(govde),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || `Aktivasyon sunucusu hatası (${r.status})` };
    return j; // { ok:true, lease }
  } catch {
    return { error: "Aktivasyon sunucusuna ulaşılamadı (internet/adres kontrol edin)" };
  } finally {
    clearTimeout(zaman);
  }
}

const aktive = (anahtar, makineId, surum) => istek("/aktivasyon", { anahtar, makineId, surum });
const yenile = (anahtar, makineId) => istek("/yenile", { anahtar, makineId });

module.exports = { aktive, yenile, ayarli, AKTIVASYON_URL };
