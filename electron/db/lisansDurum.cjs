// ── Lisans durumu (GenCRM modeli; docs/plan.md §7) — saf çekirdek ../lisans.cjs, kalıcılık kararı ../lisansKalici.cjs ──
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app, safeStorage } = require("electron");
const { acikMi } = require("./baglanti.cjs");
const { getMetaValue, setMetaValue } = require("./meta.cjs");
// ── Lisans (GenCRM modeli; docs/plan.md §7) ──
const lisansM = require("../lisans.cjs");
const lisansKalici = require("../lisansKalici.cjs");
let lisansCache = null; // { anahtar, makineId, kurulumTarihi, lease }
let sonGorulenCache = null; // bellek içi saat işareti (yalnız gün değişince diske yazılır)
const busimdi = () => new Date().toISOString().slice(0, 10);
const getLisansMetaPath = () => path.join(app.getPath("userData"), "lisans-meta.enc");
function getSafeStorage() {
  try {
    return safeStorage?.isEncryptionAvailable?.() ? safeStorage : null;
  } catch {
    return null;
  }
}
function kaliciMetaOku() {
  const ss = getSafeStorage();
  try {
    if (ss && fs.existsSync(getLisansMetaPath())) return JSON.parse(ss.decryptString(fs.readFileSync(getLisansMetaPath())));
  } catch {
    /* bozuk → yok say */
  }
  return null;
}
function kaliciMetaYaz(obj) {
  const ss = getSafeStorage();
  if (!ss) return;
  try {
    fs.writeFileSync(getLisansMetaPath(), ss.encryptString(JSON.stringify(obj)), { mode: 0o600 });
  } catch {
    /* sessiz, DB meta yedek */
  }
}
function lisansDurumu() {
  if (!acikMi()) return lisansM.durumHesapla({});
  const bugun = busimdi();
  if (!lisansCache) {
    const dosya = kaliciMetaOku();
    const meta = {
      makineId: getMetaValue("makineId"),
      kurulumTarihi: getMetaValue("kurulumTarihi"),
      sonGorulen: getMetaValue("sonGorulenTarih"),
      lease: getMetaValue("lisansLease") || null,
    };
    const m = lisansKalici.birlestir({ dosya, meta, bugun, yeniMakineId: crypto.randomUUID() });
    setMetaValue("makineId", m.makineId);
    setMetaValue("kurulumTarihi", m.kurulumTarihi);
    lisansCache = { anahtar: getMetaValue("lisansAnahtari"), makineId: m.makineId, kurulumTarihi: m.kurulumTarihi, lease: m.lease };
    sonGorulenCache = m.sonGorulen;
    kaliciMetaYaz({ makineId: m.makineId, kurulumTarihi: m.kurulumTarihi, sonGorulen: sonGorulenCache, lease: m.lease });
  }
  const durum = lisansM.durumHesapla({
    anahtar: lisansCache.anahtar,
    kurulumTarihi: lisansCache.kurulumTarihi,
    makineId: lisansCache.makineId,
    sonGorulen: sonGorulenCache,
    lease: lisansCache.lease,
    simdi: bugun,
  });
  const ileri = lisansKalici.enIleri(sonGorulenCache, bugun);
  if (ileri !== sonGorulenCache) {
    sonGorulenCache = ileri;
    setMetaValue("sonGorulenTarih", ileri);
    kaliciMetaYaz({
      makineId: lisansCache.makineId,
      kurulumTarihi: lisansCache.kurulumTarihi,
      sonGorulen: ileri,
      lease: lisansCache.lease,
    });
  }
  return { ...durum, makineId: lisansCache.makineId };
}
function lisansKaydet(anahtar) {
  const d = lisansM.dogrula(anahtar);
  if (!d.gecerli) return { error: d.neden === "imza" ? "Anahtar imzası geçersiz" : "Anahtar biçimi geçersiz" };
  setMetaValue("lisansAnahtari", String(anahtar).replace(/\s+/g, "")); // sohbetten yapıştırılan anahtarda satır sonu olabilir; sunucu hash'i tam metne bakar
  lisansCache = null;
  return { ok: true, durum: lisansDurumu() };
}
function leaseKaydet(lease) {
  const temiz = String(lease || "").trim();
  const ld = lisansM.leaseDogrula(temiz);
  if (!ld.gecerli) return { error: ld.neden === "imza" ? "Lease imzası geçersiz" : "Lease biçimi geçersiz" };
  lisansDurumu();
  if (ld.payload.makineId != null && lisansCache?.makineId && ld.payload.makineId !== lisansCache.makineId) {
    return { error: "Bu lease bu makineye ait değil" };
  }
  lisansCache.lease = temiz;
  setMetaValue("lisansLease", temiz);
  kaliciMetaYaz({ makineId: lisansCache.makineId, kurulumTarihi: lisansCache.kurulumTarihi, sonGorulen: sonGorulenCache, lease: temiz });
  return { ok: true, durum: lisansDurumu() };
}
async function lisansAktiflestir(surum = "") {
  const anahtar = getMetaValue("lisansAnahtari");
  if (!anahtar) return { error: "Önce lisans anahtarını kaydedin, sonra Aktive Et'e basın" };
  const ai = require("../aktivasyonIstemci.cjs");
  const r = await ai.aktive(anahtar, lisansDurumu().makineId, surum);
  return r.error ? r : leaseKaydet(r.lease);
}
// Anahtarı kaydet ve aktivasyon gerekiyorsa hemen online aktive et (tek adım; "Aktive Et"e ayrıca basmak gerekmez).
// Aktivasyon başarısızsa anahtar yine kayıtlı kalır, `uyari` ile ne yapılacağı söylenir (internet yoksa elle lease).
async function lisansKaydetVeAktiflestir(anahtar, surum = "", aktifle = lisansAktiflestir) {
  const r = lisansKaydet(anahtar);
  if (r.error) return r;
  const ai = require("../aktivasyonIstemci.cjs");
  if (!lisansM.otomatikAktivasyonGerekli(r.durum) || !ai.ayarli()) return r;
  const a = await aktifle(surum);
  if (a.error)
    return {
      ok: true,
      durum: r.durum,
      uyari: `Anahtar kaydedildi ama online aktivasyon yapılamadı: ${a.error} İnternet bağlantısını kontrol edip "Aktive Et (online)" düğmesine basın; internet yoksa makine kimliğini satıcıya iletip lease alın.`,
    };
  return { ok: true, durum: a.durum, otomatikAktivasyon: true };
}
async function lisansYenile() {
  const anahtar = getMetaValue("lisansAnahtari");
  const ai = require("../aktivasyonIstemci.cjs");
  if (!anahtar || !ai.ayarli()) return { ok: true, durum: lisansDurumu() };
  const r = await ai.yenile(anahtar, lisansDurumu().makineId);
  return r.error ? r : leaseKaydet(r.lease);
}
const lisansSaltOkunurMu = () => lisansDurumu().mod === "saltOkunur";

module.exports = {
  lisansDurumu,
  lisansKaydet,
  leaseKaydet,
  lisansAktiflestir,
  lisansYenile,
  lisansSaltOkunurMu,
  lisansKaydetVeAktiflestir,
};
