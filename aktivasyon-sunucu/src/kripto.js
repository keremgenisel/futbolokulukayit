// Ed25519 — hem Cloudflare Worker (Web Crypto) hem Node 18+ (globalThis.crypto.subtle) altında çalışır.
// Uygulama tarafı (electron/lisans.cjs) Node crypto.sign/verify(null,...) kullanır; ikisi de STANDART
// Ed25519 üretir → imzalar birebir uyumlu. Sözleşme testi (tests/aktivasyon-kripto.test.js) bunu kilitler.
//
// Bu sunucu: LİSANS anahtarını doğrular (pub1) ve LEASE imzalar (priv2). Kalıcı lisans ÖZEL anahtarı
// burada YOK (çevrimdışı, üreticide) → sunucu sızsa bile kalıcı lisans üretilemez, yalnız kısa lease.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function b64urlToBuf(s) {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u.buffer;
}

// PEM (spki/pkcs8) → DER ArrayBuffer.
function pemDer(pem) {
  const b64 = String(pem)
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

export const acikAnahtarYukle = (pem) => crypto.subtle.importKey("spki", pemDer(pem), { name: "Ed25519" }, false, ["verify"]);
export const ozelAnahtarYukle = (pem) => crypto.subtle.importKey("pkcs8", pemDer(pem), { name: "Ed25519" }, false, ["sign"]);

// Lisans anahtarını doğrula. Biçim "FOKLISANS.<b64url(payload)>.<b64url(imza)>" (electron/lisans.cjs ile aynı).
// İMZA, iletilen ham baytlar üzerinde doğrulanır (yeniden serileştirme YOK) → JSON kanonikleştirme derdi olmaz.
export async function lisansDogrula(anahtar, acikAnahtar) {
  const p = String(anahtar || "")
    .trim()
    .split(".");
  if (p.length !== 3 || p[0] !== "FOKLISANS") return { gecerli: false, neden: "bicim" };
  const veri = b64urlToBuf(p[1]);
  const ok = await crypto.subtle.verify({ name: "Ed25519" }, acikAnahtar, b64urlToBuf(p[2]), veri);
  if (!ok) return { gecerli: false, neden: "imza" };
  try {
    return { gecerli: true, payload: JSON.parse(dec.decode(veri)) };
  } catch {
    return { gecerli: false, neden: "bicim" };
  }
}

// Lease imzala. Biçim "FOKLEASE.<b64url(payload)>.<b64url(imza)>" (uygulamanın leaseDogrula'sıyla aynı).
export async function leaseImzala(payload, ozelAnahtar) {
  const veri = enc.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, ozelAnahtar, veri);
  return `FOKLEASE.${b64url(veri)}.${b64url(sig)}`;
}

// Anahtarın SHA-256 hex özeti — D1'de ham anahtar yerine bunu tutarız (KVKK: minimum veri).
export async function sha256hex(metin) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(String(metin)));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
