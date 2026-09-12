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
  } catch (e) {
    // Uzaktan tanı için gerçek neden mesaja eklenir (12.09.2026 kulüp: "internet vardı ama olmadı"): DNS (ENOTFOUND), TLS
    // araya girme (UNABLE_TO_VERIFY_LEAF_SIGNATURE), zaman aşımı (AbortError), vekil sunucu (ECONNREFUSED) ayırt edilsin.
    return { error: `Aktivasyon sunucusuna ulaşılamadı (internet/adres kontrol edin) [${hataKodu(e)}]` };
  } finally {
    clearTimeout(zaman);
  }
}

/** Ağ hatasının kısa kodu: cause.code (ENOTFOUND, ECONNREFUSED, ETIMEDOUT, CERT_*), yoksa ad/mesaj. */
function hataKodu(e) {
  const c = e?.cause?.code || e?.code;
  if (c) return String(c);
  if (e?.name === "AbortError") return "ZAMAN_ASIMI_10s";
  return String(e?.cause?.message || e?.message || e?.name || "bilinmeyen").slice(0, 80);
}
/** Bağlantı sınaması (Ayarlar > Lisans): GET /saglik; { ok, ms } ya da { error }. Lisans/kurulum tüketmez. */
async function baglantiSina() {
  if (!AKTIVASYON_URL) return { error: "Aktivasyon sunucusu ayarlı değil" };
  const t0 = Date.now();
  const ctrl = new AbortController();
  const zaman = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(AKTIVASYON_URL + "/saglik", { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? { ok: true, ms: Date.now() - t0 } : { error: `Sunucu beklenmeyen yanıt verdi (${r.status})` };
  } catch (e) {
    return { error: `Sunucuya ulaşılamadı [${hataKodu(e)}]` };
  } finally {
    clearTimeout(zaman);
  }
}

const aktive = (anahtar, makineId, surum) => istek("/aktivasyon", { anahtar, makineId, surum });
const yenile = (anahtar, makineId) => istek("/yenile", { anahtar, makineId });

module.exports = { aktive, yenile, ayarli, baglantiSina, hataKodu, AKTIVASYON_URL };
