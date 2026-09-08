// Eyüpspor Futbol Okulu aktivasyon sunucusu (Cloudflare Worker + D1). Uygulama buradan kısa ömürlü imzalı LEASE alır.
// Uçlar:
//   POST /aktivasyon {anahtar, makineId, surum} → lease | 403(neden)
//   POST /yenile     {anahtar, makineId}        → lease | 403(neden)   (iptal buradan yayılır)
//   GET  /saglik                                 → {ok:true}
//   POST /admin/lisans (x-admin-token)           → lisans kaydet/iptal (satıcı)
//   GET  /admin/liste?anahtar=... (x-admin-token)→ kurulum listesi
// Secrets: LISANS_PUBLIC_PEM (pub1), LEASE_PRIVATE_PEM (priv2), ADMIN_TOKEN. Var: LEASE_GUN (vars.).
import { acikAnahtarYukle, ozelAnahtarYukle, lisansDogrula, leaseImzala, sha256hex } from "./kripto.js";
import {
  bugun, tariheGunEkle, enKucukTarih,
  lisansBul, lisansUpsert, kurulumBul, aktifKurulumSay, kurulumEkle, kurulumDokun, kurulumlariListele, tumLisanslar,
} from "./db.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// Anahtarı doğrula + kayıtlı lisansı getir (aktivasyon/yenile ortak ön adım).
async function anahtarVeLisans(env, anahtar) {
  const pub = await acikAnahtarYukle(env.LISANS_PUBLIC_PEM);
  const d = await lisansDogrula(anahtar, pub);
  if (!d.gecerli) return { hata: json({ error: "anahtar geçersiz" }, 403) };
  const p = d.payload;
  if (p.bitis && p.bitis < bugun()) return { hata: json({ error: "lisans süresi doldu" }, 403) };
  const lisans = await lisansBul(env, await sha256hex(anahtar));
  if (!lisans) return { hata: json({ error: "lisans kayıtlı değil (satıcıya başvurun)" }, 403) };
  if (lisans.iptal) return { hata: json({ error: "lisans iptal edildi" }, 403) };
  return { p, lisans };
}

// Bu makineye lease imzala; lease, lisansın bitişini AŞAMAZ (leaseBitis = min(bugün+LEASE_GUN, lisans.bitis)).
async function leaseVer(env, firma, makineId, bitis) {
  const priv = await ozelAnahtarYukle(env.LEASE_PRIVATE_PEM);
  const leaseBitis = enKucukTarih(tariheGunEkle(bugun(), Number(env.LEASE_GUN || 14)), bitis || null);
  return leaseImzala({ firma: firma || "", makineId, leaseBitis, iptal: false, uretimTarihi: bugun() }, priv);
}

async function aktivasyon(request, env) {
  const { anahtar, makineId, surum } = await request.json().catch(() => ({}));
  if (!anahtar || !makineId) return json({ error: "eksik parametre" }, 400);
  const r = await anahtarVeLisans(env, anahtar);
  if (r.hata) return r.hata;
  const mevcut = await kurulumBul(env, r.lisans.id, makineId);
  if (!mevcut) {
    const say = await aktifKurulumSay(env, r.lisans.id);
    if (r.lisans.maksKurulum != null && say >= r.lisans.maksKurulum)
      return json({ error: `kurulum limiti doldu (${r.lisans.maksKurulum})` }, 403);
    await kurulumEkle(env, r.lisans.id, makineId, surum);
  } else {
    await kurulumDokun(env, mevcut.id, surum);
  }
  return json({ ok: true, lease: await leaseVer(env, r.p.firma, makineId, r.p.bitis) });
}

async function yenile(request, env) {
  const { anahtar, makineId } = await request.json().catch(() => ({}));
  if (!anahtar || !makineId) return json({ error: "eksik parametre" }, 400);
  const r = await anahtarVeLisans(env, anahtar);
  if (r.hata) return r.hata;
  const mevcut = await kurulumBul(env, r.lisans.id, makineId);
  if (!mevcut || !mevcut.aktif) return json({ error: "kurulum bulunamadı — yeniden aktive edin" }, 403);
  await kurulumDokun(env, mevcut.id, mevcut.surum);
  return json({ ok: true, lease: await leaseVer(env, r.p.firma, makineId, r.p.bitis) });
}

// Satıcı: bir lisansı kaydet/güncelle (maksKurulum ayarla, iptal et). Anahtar doğrulanır; firma/bitis/
// maksKullanici imzalı payload'dan okunur (değiştirilemez), maksKurulum/iptal D1'de tutulur (dinamik).
async function adminLisans(request, env) {
  if (!tokenEsit(request.headers.get("x-admin-token"), env.ADMIN_TOKEN)) return json({ error: "yetkisiz" }, 401);
  const { anahtar, maksKurulum, iptal } = await request.json().catch(() => ({}));
  const pub = await acikAnahtarYukle(env.LISANS_PUBLIC_PEM);
  const d = await lisansDogrula(anahtar || "", pub);
  if (!d.gecerli) return json({ error: "anahtar geçersiz" }, 400);
  await lisansUpsert(env, {
    anahtarHash: await sha256hex(anahtar), firma: d.payload.firma, bitis: d.payload.bitis,
    maksKullanici: d.payload.maksKullanici, maksKurulum: maksKurulum ?? null, iptal: iptal ? 1 : 0,
  });
  return json({ ok: true });
}

async function adminHepsi(request, env) {
  if (!tokenEsit(request.headers.get("x-admin-token"), env.ADMIN_TOKEN)) return json({ error: "yetkisiz" }, 401);
  const r = await tumLisanslar(env);
  return json({ ok: true, lisanslar: r.results || [] });
}

async function adminListe(request, env) {
  if (!tokenEsit(request.headers.get("x-admin-token"), env.ADMIN_TOKEN)) return json({ error: "yetkisiz" }, 401);
  const anahtar = new URL(request.url).searchParams.get("anahtar");
  if (!anahtar) return json({ error: "anahtar gerekli" }, 400);
  const lisans = await lisansBul(env, await sha256hex(anahtar));
  if (!lisans) return json({ error: "lisans kayıtlı değil" }, 404);
  const k = await kurulumlariListele(env, lisans.id);
  return json({ ok: true, lisans: { firma: lisans.firma, bitis: lisans.bitis, maksKurulum: lisans.maksKurulum, iptal: !!lisans.iptal }, kurulumlar: k.results || [] });
}

// İnceleme #25: admin token sabit zamanlı karşılaştırma; /aktivasyon ve /yenile için IP başına basit hız sınırı
// (isolate belleğinde; tam koruma için Cloudflare "Rate limiting rules" de eklenmeli — plan §8.1).
function tokenEsit(a, b) {
  const x = new TextEncoder().encode(String(a || "")), y = new TextEncoder().encode(String(b || ""));
  if (x.length !== y.length) return false;
  let fark = 0; for (let i = 0; i < x.length; i++) fark |= x[i] ^ y[i];
  return fark === 0;
}
const hizSayac = new Map(); // ip → { n, t }
const HIZ_MAX = 30, HIZ_PENCERE = 60 * 1000;
function hizAsildi(ip, now = Date.now()) {
  const r = hizSayac.get(ip);
  if (!r || now - r.t > HIZ_PENCERE) { hizSayac.set(ip, { n: 1, t: now }); return false; }
  r.n += 1; return r.n > HIZ_MAX;
}
export { tokenEsit, hizAsildi };

export default {
  async fetch(request, env) {
    const yol = new URL(request.url).pathname;
    const m = request.method;
    try {
      if (m === "POST" && (yol === "/aktivasyon" || yol === "/yenile") && hizAsildi(request.headers.get("cf-connecting-ip") || "?")) return json({ error: "çok fazla istek" }, 429);
      if (m === "GET" && yol === "/saglik") return json({ ok: true });
      if (m === "POST" && yol === "/aktivasyon") return await aktivasyon(request, env);
      if (m === "POST" && yol === "/yenile") return await yenile(request, env);
      if (m === "POST" && yol === "/admin/lisans") return await adminLisans(request, env);
      if (m === "GET" && yol === "/admin/hepsi") return await adminHepsi(request, env);
      if (m === "GET" && yol === "/admin/liste") return await adminListe(request, env);
      return json({ error: "bulunamadı" }, 404);
    } catch (e) {
      return json({ error: "sunucu hatası" }, 500);
    }
  },
};
