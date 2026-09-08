// Lisans çekirdeği (Faz 6) — SAF modül: Electron/SQLite bağımlılığı yok, node altında
// test edilir. Anahtar biçimi: "EYUPSPOR.<b64url(payloadJson)>.<b64url(ed25519 imza)>".
// Payload üretici makinesindeki ÖZEL anahtarla imzalanır (scripts/lisans-uret.cjs,
// scripts/keys/lisans-private.pem — repoya GİRMEZ, .gitignore'da); uygulama yalnız
// gömülü AÇIK anahtarla doğrular. Payload alanları:
//   { firma, bitis: "YYYY-MM-DD" | null (süresiz), maksKullanici: sayı | null (sınırsız), uretimTarihi }
//
// Durum makinesi (kullanıcı kararı, 2026-07-13):
//   geçerli anahtar + bitiş geçmemiş → "lisansli"
//   anahtar yok/geçersiz + kurulumdan ≤ 30 gün → "deneme" (tam özellik)
//   diğer her şey → "saltOkunur": sunucu tüm /api yazmalarını 403'ler (muaf: /api/lisans),
//   arayüz salt-okunur izinlere düşer; okuma/arama/dışa aktarma hep açık kalır.
// Not: deneme başlangıcı yerel meta'daki kurulumTarihi'dir; DB'yi silmek denemeyi
// sıfırlar — v1'de bilinçli kabul (yaptırımın sertleştirilmesi ayrı karar).
const crypto = require("crypto");

const DENEME_GUN = 30;

// Üretici açık anahtarı (özel eşi: scripts/keys/lisans-private.pem, repo dışı).
// Testler EYUPSPOR_LISANS_PUBKEY ortam değişkeniyle kendi çiftlerini kullanır.
const VARSAYILAN_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAc2A6GAI4cfZYBetKAx8S+p8MGUsvqm7PBzCOyt2t62s=
-----END PUBLIC KEY-----`;

const publicPem = () => process.env.EYUPSPOR_LISANS_PUBKEY || VARSAYILAN_PUBLIC_PEM;

// ── Lease (kiralama) açık anahtarı — İKİNCİ, AYRI çift (Faz B1) ────────────────
// Kalıcı lisans anahtarının özel eşi çevrimdışı senin makinende kalır; lease'in özel eşi
// aktivasyon sunucusunda durur. Sunucu sızsa bile yalnız KISA ÖMÜRLÜ lease basılabilir,
// kalıcı lisans üretilemez → hasar yarıçapı 1 lease penceresiyle sınırlı; Anahtar 2'yi bir
// güncellemeyle döndürüp eski lease'leri geçersiz kılarsın. Aşağıdaki değer YER TUTUCU:
// B2'ye geçerken `node scripts/lisans-anahtar-cifti.cjs` lease çiftini de üretir, açık eşini
// buraya göm. Testler EYUPSPOR_LEASE_PUBKEY ortam değişkeniyle kendi çiftini kullanır.
const VARSAYILAN_LEASE_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAI/08vA3cuUu5LgeXWZJ4kFL3rFg6PpSK9dDeex/Knuw=
-----END PUBLIC KEY-----`;
const leasePublicPem = () => process.env.EYUPSPOR_LEASE_PUBKEY || VARSAYILAN_LEASE_PUBLIC_PEM;

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const bugun = () => new Date().toISOString().slice(0, 10);

// Üretici tarafı: payload'ı imzalayıp anahtar dizesi üretir (script + testler kullanır).
function imzala(payload, privatePem) {
  const veri = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = crypto.sign(null, veri, privatePem); // ed25519: digest null
  return `EYUPSPOR.${b64url(veri)}.${b64url(sig)}`;
}

// Anahtar dizesini doğrular. Dönüş: { gecerli: true, payload } | { gecerli: false, neden }.
function dogrula(anahtar) {
  try {
    const parcalar = String(anahtar || "")
      .trim()
      .split(".");
    if (parcalar.length !== 3 || parcalar[0] !== "EYUPSPOR") return { gecerli: false, neden: "bicim" };
    const veri = Buffer.from(parcalar[1], "base64url");
    const sig = Buffer.from(parcalar[2], "base64url");
    if (!crypto.verify(null, veri, publicPem(), sig)) return { gecerli: false, neden: "imza" };
    const payload = JSON.parse(veri.toString("utf8"));
    if (!payload || typeof payload !== "object") return { gecerli: false, neden: "bicim" };
    if (payload.bitis != null && !/^\d{4}-\d{2}-\d{2}$/.test(payload.bitis)) return { gecerli: false, neden: "bicim" };
    return { gecerli: true, payload };
  } catch {
    return { gecerli: false, neden: "bicim" };
  }
}

// Lease imzalama (aktivasyon SUNUCUSU kullanır) — biçim "EYUPLEASE.<payload>.<imza>".
// Lease payload: { firma, makineId, leaseBitis: "YYYY-MM-DD" | null, iptal: bool, uretimTarihi }
function leaseImzala(payload, leasePrivatePem) {
  const veri = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = crypto.sign(null, veri, leasePrivatePem);
  return `EYUPLEASE.${b64url(veri)}.${b64url(sig)}`;
}

// Lease doğrulama (UYGULAMA). Dönüş: { gecerli: true, payload } | { gecerli: false, neden }.
function leaseDogrula(lease) {
  try {
    const parcalar = String(lease || "")
      .trim()
      .split(".");
    if (parcalar.length !== 3 || parcalar[0] !== "EYUPLEASE") return { gecerli: false, neden: "bicim" };
    const veri = Buffer.from(parcalar[1], "base64url");
    const sig = Buffer.from(parcalar[2], "base64url");
    if (!crypto.verify(null, veri, leasePublicPem(), sig)) return { gecerli: false, neden: "imza" };
    const payload = JSON.parse(veri.toString("utf8"));
    if (!payload || typeof payload !== "object") return { gecerli: false, neden: "bicim" };
    if (payload.leaseBitis != null && !/^\d{4}-\d{2}-\d{2}$/.test(payload.leaseBitis)) return { gecerli: false, neden: "bicim" };
    return { gecerli: true, payload };
  } catch {
    return { gecerli: false, neden: "bicim" };
  }
}

const gunFarki = (a, b) => Math.floor((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);

// Lease şu an bu makine için geçerli mi: imza + iptal değil + süresi geçmemiş + makineId uyumlu.
function leaseGecerliMi(lease, makineId, simdi) {
  const ld = lease ? leaseDogrula(lease) : null;
  if (!ld?.gecerli) return false;
  const p = ld.payload;
  if (p.iptal === true) return false;
  if (p.leaseBitis != null && gunFarki(p.leaseBitis, simdi) < 0) return false;
  if (p.makineId != null && makineId != null && p.makineId !== makineId) return false;
  return true;
}

// Tek durum kaynağı. simdi test edilebilirlik için parametre (YYYY-MM-DD).
// sonGorulen: uygulamanın gördüğü EN SON tarih (monotonik saat işareti). Sistem saati
// geri alınırsa (deneme/lisans süresini geri kazanmak için) efektif tarih bu işaretin
// gerisine gidemez — böylece saat geri alma yaptırımı atlatmaz. sonGorulen sistem
// saatinin İLERİSİNDEyse (geri alma tespiti) o kullanılır; normalde simdi kullanılır.
// makineId: bu kurulumun kararlı kimliği (varsa makine bağlama + lease eşleşmesi kontrol edilir).
// lease: aktivasyon sunucusundan alınan imzalı kiralama (varsa/gerekliyse doğrulanır).
// aktivasyonGerekli: B2 açıldığında true — geçerli anahtar TEK BAŞINA yetmez, geçerli lease de gerekir.
//   B1'de varsayılan false → mevcut kurulumlar aynen çalışır (lease uykuda).
function durumHesapla({
  anahtar = null,
  kurulumTarihi = null,
  sonGorulen = null,
  simdi = bugun(),
  makineId = null,
  lease = null,
  aktivasyonGerekli = false,
} = {}) {
  const efektif = sonGorulen && sonGorulen > simdi ? sonGorulen : simdi;
  return durumCekirdek({
    anahtar,
    kurulumTarihi,
    simdi: efektif,
    saatGeriAlindi: !!(sonGorulen && sonGorulen > simdi),
    makineId,
    lease,
    aktivasyonGerekli,
  });
}

function durumCekirdek({ anahtar, kurulumTarihi, simdi, saatGeriAlindi, makineId = null, lease = null, aktivasyonGerekli = false }) {
  const ekle = saatGeriAlindi ? { saatGeriAlindi: true } : {};
  const d = anahtar ? dogrula(anahtar) : null;
  if (d?.gecerli) {
    const p = d.payload;
    const ortak = { firma: p.firma || "", bitis: p.bitis ?? null, maksKullanici: p.maksKullanici ?? null };
    // Makine bağlama: anahtar bir makineId'ye kilitliyse yalnız o makinede geçerli (offline anti-paylaşım).
    if (p.makineId != null && makineId != null && p.makineId !== makineId) {
      return { mod: "saltOkunur", neden: "makineUyumsuz", ...ortak, kalanGun: 0, ...ekle };
    }
    if (p.bitis != null && gunFarki(p.bitis, simdi) < 0) {
      return { mod: "saltOkunur", neden: "lisansBitti", ...ortak, kalanGun: 0, ...ekle };
    }
    // Aktivasyon zorunluluğu: çağrı parametresinden VEYA anahtar payload'ından gelebilir. Payload'a
    // koymak, üreticiye anahtar başına karar verdirir (air-gapped müşteriye bayrağı KAPALI anahtar).
    const aktGerekli = aktivasyonGerekli || p.aktivasyonGerekli === true;
    // Aktivasyon zorunluysa: geçerli + süresi geçmemiş + bu makineye ait + iptal edilmemiş lease iste.
    if (aktGerekli && !leaseGecerliMi(lease, makineId, simdi)) {
      return { mod: "saltOkunur", neden: "aktivasyonGerekli", ...ortak, kalanGun: 0, ...ekle };
    }
    return { mod: "lisansli", ...ortak, kalanGun: p.bitis == null ? null : gunFarki(p.bitis, simdi), ...ekle };
  }
  // Anahtar yok/geçersiz → deneme penceresi (kurulum tarihi bilinmiyorsa bugün başlar say)
  const baslangic = kurulumTarihi || simdi;
  const gecen = Math.max(0, gunFarki(simdi, baslangic));
  if (gecen < DENEME_GUN) {
    return {
      mod: "deneme",
      kalanGun: DENEME_GUN - gecen,
      bitis: null,
      firma: "",
      maksKullanici: null,
      ...(anahtar ? { anahtarNeden: d.neden } : {}),
      ...ekle,
    };
  }
  return {
    mod: "saltOkunur",
    neden: anahtar ? "lisansGecersiz" : "denemeBitti",
    kalanGun: 0,
    bitis: null,
    firma: "",
    maksKullanici: null,
    ...ekle,
  };
}

module.exports = { imzala, dogrula, leaseImzala, leaseDogrula, leaseGecerliMi, durumHesapla, DENEME_GUN };
