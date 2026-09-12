// Lisans çekirdeği (Faz 6) — saf modül testleri: imza turu, tahrifat reddi ve
// durum makinesi (lisanslı / deneme / salt-okunur; 30 gün deneme, süresi geçmiş lisans).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { imzala, dogrula, leaseImzala, leaseDogrula, durumHesapla, otomatikAktivasyonGerekli, DENEME_GUN } from "../electron/lisans.cjs";

// Testler kendi anahtar çiftlerini üretir; modül açık anahtarları FOKLISANS_LISANS_PUBKEY /
// FOKLISANS_LEASE_PUBKEY'den okur (lisans ve lease AYRI çift).
let privatePem, leasePrivatePem;
beforeAll(() => {
  const l = crypto.generateKeyPairSync("ed25519");
  privatePem = l.privateKey.export({ type: "pkcs8", format: "pem" });
  process.env.FOKLISANS_LISANS_PUBKEY = l.publicKey.export({ type: "spki", format: "pem" });
  const le = crypto.generateKeyPairSync("ed25519");
  leasePrivatePem = le.privateKey.export({ type: "pkcs8", format: "pem" });
  process.env.FOKLISANS_LEASE_PUBKEY = le.publicKey.export({ type: "spki", format: "pem" });
});
afterAll(() => {
  delete process.env.FOKLISANS_LISANS_PUBKEY;
  delete process.env.FOKLISANS_LEASE_PUBKEY;
});

const ornekPayload = { firma: "Test Gıda A.Ş.", bitis: "2027-01-01", maksKullanici: 5, uretimTarihi: "2026-07-13" };

describe("imzala/dogrula", () => {
  it("imzalanan anahtar doğrulanır ve payload aynen döner", () => {
    const anahtar = imzala(ornekPayload, privatePem);
    expect(anahtar.startsWith("FOKLISANS.")).toBe(true);
    const d = dogrula(anahtar);
    expect(d.gecerli).toBe(true);
    expect(d.payload).toEqual(ornekPayload);
  });
  it("payload'ı tahrif edilen anahtar reddedilir (bitiş tarihi uzatma denemesi)", () => {
    const anahtar = imzala(ornekPayload, privatePem);
    const [on, veri, sig] = anahtar.split(".");
    const kurcalanmis = JSON.parse(Buffer.from(veri, "base64url").toString());
    kurcalanmis.bitis = "2099-01-01";
    const sahte = `${on}.${Buffer.from(JSON.stringify(kurcalanmis)).toString("base64url")}.${sig}`;
    expect(dogrula(sahte)).toEqual({ gecerli: false, neden: "imza" });
  });
  it("içinde satır sonu/boşluk olan anahtar (sohbetten kopya) doğrulanır", () => {
    const anahtar = imzala(ornekPayload, privatePem);
    const bozuk = anahtar.slice(0, 40) + "\n" + anahtar.slice(40, 120) + " " + anahtar.slice(120) + "\n";
    expect(dogrula(bozuk).gecerli).toBe(true);
    expect(dogrula(bozuk).payload).toEqual(dogrula(anahtar).payload);
  });
  it("bozuk biçim ve boş anahtar reddedilir", () => {
    expect(dogrula("FOKLISANS.abc").gecerli).toBe(false);
    expect(dogrula("").gecerli).toBe(false);
    expect(dogrula("BASKA.x.y").gecerli).toBe(false);
  });
  it("farklı özel anahtarla imzalanan anahtar reddedilir", () => {
    const yabanci = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
    expect(dogrula(imzala(ornekPayload, yabanci)).neden).toBe("imza");
  });
});

describe("durumHesapla", () => {
  const anahtarUret = (p) => imzala({ ...ornekPayload, ...p }, privatePem);

  it("geçerli anahtar + bitiş gelmemiş → lisanslı, kalan gün doğru", () => {
    const d = durumHesapla({ anahtar: anahtarUret({ bitis: "2026-07-23" }), simdi: "2026-07-13" });
    expect(d.mod).toBe("lisansli");
    expect(d.kalanGun).toBe(10);
    expect(d.firma).toBe("Test Gıda A.Ş.");
    expect(d.maksKullanici).toBe(5);
  });
  it("bitiş günü dahil lisanslı, ertesi gün salt-okunur", () => {
    expect(durumHesapla({ anahtar: anahtarUret({ bitis: "2026-07-13" }), simdi: "2026-07-13" }).mod).toBe("lisansli");
    const d = durumHesapla({ anahtar: anahtarUret({ bitis: "2026-07-12" }), simdi: "2026-07-13" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("lisansBitti");
  });
  it("süresiz lisans (bitis null) hep lisanslı, kalanGun null", () => {
    const d = durumHesapla({ anahtar: anahtarUret({ bitis: null }), simdi: "2099-12-31" });
    expect(d.mod).toBe("lisansli");
    expect(d.kalanGun).toBeNull();
  });
  it("anahtarsız kurulum: 30 gün deneme, sonra salt-okunur (denemeBitti)", () => {
    const d1 = durumHesapla({ kurulumTarihi: "2026-07-01", simdi: "2026-07-13" });
    expect(d1.mod).toBe("deneme");
    expect(d1.kalanGun).toBe(DENEME_GUN - 12);
    const d2 = durumHesapla({ kurulumTarihi: "2026-06-01", simdi: "2026-07-13" });
    expect(d2.mod).toBe("saltOkunur");
    expect(d2.neden).toBe("denemeBitti");
  });
  it("geçersiz anahtar deneme penceresinde denemeye düşer, pencere dışında lisansGecersiz", () => {
    expect(durumHesapla({ anahtar: "FOKLISANS.bozuk.anahtar", kurulumTarihi: "2026-07-10", simdi: "2026-07-13" }).mod).toBe("deneme");
    const d = durumHesapla({ anahtar: "FOKLISANS.bozuk.anahtar", kurulumTarihi: "2026-01-01", simdi: "2026-07-13" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("lisansGecersiz");
  });
  it("kurulum tarihi bilinmiyorsa deneme bugünden başlar (kilitlemez)", () => {
    expect(durumHesapla({ simdi: "2026-07-13" }).mod).toBe("deneme");
  });
});

// ── Faz B1: lease (kiralama) doğrulama + AYRI anahtar çifti ──────────────────
describe("leaseImzala/leaseDogrula", () => {
  const leasePayload = { firma: "Test Gıda A.Ş.", makineId: "MAK-1", leaseBitis: "2026-08-01", iptal: false, uretimTarihi: "2026-07-19" };
  it("imzalanan lease doğrulanır, payload aynen döner", () => {
    const lease = leaseImzala(leasePayload, leasePrivatePem);
    expect(lease.startsWith("FOKLEASE.")).toBe(true);
    const d = leaseDogrula(lease);
    expect(d.gecerli).toBe(true);
    expect(d.payload).toEqual(leasePayload);
  });
  it("tahrif edilen lease reddedilir (leaseBitis uzatma)", () => {
    const lease = leaseImzala(leasePayload, leasePrivatePem);
    const [on, veri, sig] = lease.split(".");
    const k = JSON.parse(Buffer.from(veri, "base64url").toString());
    k.leaseBitis = "2099-01-01";
    const sahte = `${on}.${Buffer.from(JSON.stringify(k)).toString("base64url")}.${sig}`;
    expect(leaseDogrula(sahte)).toEqual({ gecerli: false, neden: "imza" });
  });
  it("LİSANS özel anahtarıyla imzalanan lease reddedilir (çiftler ayrı)", () => {
    // Kritik: lease, lisans anahtarıyla değil YALNIZ lease anahtarıyla imzalanmalı.
    expect(leaseDogrula(leaseImzala(leasePayload, privatePem)).neden).toBe("imza");
  });
  it("bozuk biçim / yanlış önek reddedilir", () => {
    expect(leaseDogrula("FOKLEASE.abc").gecerli).toBe(false);
    expect(leaseDogrula("FOKLISANS.x.y").gecerli).toBe(false); // lisans önekiyle karışmaz
    expect(leaseDogrula("").gecerli).toBe(false);
  });
});

describe("durumHesapla — makine bağlama (offline anti-paylaşım)", () => {
  const anahtarUret = (p) => imzala({ ...ornekPayload, ...p }, privatePem);
  it("makineId'ye kilitli anahtar yalnız o makinede lisanslı", () => {
    const anahtar = anahtarUret({ makineId: "MAK-A" });
    expect(durumHesapla({ anahtar, makineId: "MAK-A", simdi: "2026-07-13" }).mod).toBe("lisansli");
    const d = durumHesapla({ anahtar, makineId: "MAK-B", simdi: "2026-07-13" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("makineUyumsuz");
  });
  it("makineId taşımayan anahtar her makinede çalışır (geri uyum)", () => {
    expect(durumHesapla({ anahtar: anahtarUret({}), makineId: "MAK-X", simdi: "2026-07-13" }).mod).toBe("lisansli");
  });
});

describe("durumHesapla — aktivasyon (lease) zorunluluğu", () => {
  // anahtarUret/leaseUret imza için privatePem'i kullanır; bunlar beforeAll'da atanır → çağrılar
  // yalnız it() içinde (koşum zamanı), describe gövdesinde (toplama zamanı) DEĞİL.
  const anahtarUret = (p) => imzala({ ...ornekPayload, ...p }, privatePem);
  const leaseUret = (p) =>
    leaseImzala(
      { firma: "T", makineId: "MAK-1", leaseBitis: "2026-08-01", iptal: false, uretimTarihi: "2026-07-13", ...p },
      leasePrivatePem,
    );
  const anahtar = () => anahtarUret({ bitis: "2027-01-01" });

  it("aktivasyonGerekli=false → lease aranmaz (B1 varsayılanı, mevcut kurulumlar bozulmaz)", () => {
    expect(durumHesapla({ anahtar: anahtar(), simdi: "2026-07-13" }).mod).toBe("lisansli");
  });
  it("aktivasyonGerekli=true + geçerli lease → lisanslı", () => {
    const d = durumHesapla({ anahtar: anahtar(), lease: leaseUret({}), makineId: "MAK-1", aktivasyonGerekli: true, simdi: "2026-07-13" });
    expect(d.mod).toBe("lisansli");
  });
  it("aktivasyonGerekli=true + lease YOK → saltOkunur (aktivasyonGerekli)", () => {
    const d = durumHesapla({ anahtar: anahtar(), makineId: "MAK-1", aktivasyonGerekli: true, simdi: "2026-07-13" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("aktivasyonGerekli");
  });
  it("süresi geçmiş lease → saltOkunur", () => {
    const d = durumHesapla({
      anahtar: anahtar(),
      lease: leaseUret({ leaseBitis: "2026-07-10" }),
      makineId: "MAK-1",
      aktivasyonGerekli: true,
      simdi: "2026-07-13",
    });
    expect(d.mod).toBe("saltOkunur");
  });
  it("iptal edilmiş lease → saltOkunur (uzaktan iptal)", () => {
    const d = durumHesapla({
      anahtar: anahtar(),
      lease: leaseUret({ iptal: true }),
      makineId: "MAK-1",
      aktivasyonGerekli: true,
      simdi: "2026-07-13",
    });
    expect(d.mod).toBe("saltOkunur");
  });
  it("başka makineye ait lease → saltOkunur", () => {
    const d = durumHesapla({
      anahtar: anahtar(),
      lease: leaseUret({ makineId: "MAK-9" }),
      makineId: "MAK-1",
      aktivasyonGerekli: true,
      simdi: "2026-07-13",
    });
    expect(d.mod).toBe("saltOkunur");
  });
  it("aktivasyonGerekli anahtar PAYLOAD'ında ise param olmadan da lease şarttır (üretici kararı)", () => {
    const aktAnahtar = anahtarUret({ bitis: "2027-01-01", aktivasyonGerekli: true });
    // param verilmese bile (aktivasyonGerekli varsayılan false) payload zorunlu kılar
    expect(durumHesapla({ anahtar: aktAnahtar, makineId: "MAK-1", simdi: "2026-07-13" }).mod).toBe("saltOkunur");
    expect(durumHesapla({ anahtar: aktAnahtar, lease: leaseUret({}), makineId: "MAK-1", simdi: "2026-07-13" }).mod).toBe("lisansli");
  });
});

describe("durumHesapla — saat geri alma koruması (sonGorulen monotonik)", () => {
  const anahtarUret = (p) => imzala({ ...ornekPayload, ...p }, privatePem);

  it("sistem saati geri alınsa da efektif tarih sonGorulen'in gerisine gitmez", () => {
    // Deneme: kurulum 07-01, en son 07-25 görülmüş; kullanıcı saati 07-05'e geri aldı
    const d = durumHesapla({ kurulumTarihi: "2026-07-01", sonGorulen: "2026-07-25", simdi: "2026-07-05" });
    // Efektif tarih 07-25 → 24 gün geçti (30 pencere), hâlâ deneme ama kalanGun az; saatGeriAlindi işareti var
    expect(d.mod).toBe("deneme");
    expect(d.kalanGun).toBe(DENEME_GUN - 24);
    expect(d.saatGeriAlindi).toBe(true);
  });
  it("saat geri alma denemeyi geri KAZANDIRMAZ: sonGorulen deneme sonrasıysa salt-okunur kalır", () => {
    // 40 gün ileri görülmüş (deneme bitmiş), kullanıcı saati kuruluma geri aldı
    const d = durumHesapla({ kurulumTarihi: "2026-06-01", sonGorulen: "2026-07-11", simdi: "2026-06-02" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("denemeBitti");
    expect(d.saatGeriAlindi).toBe(true);
  });
  it("süresi biten lisans, saat geri alınınca da salt-okunur kalır (sonGorulen bitişten sonra)", () => {
    const d = durumHesapla({ anahtar: anahtarUret({ bitis: "2026-07-10" }), sonGorulen: "2026-07-20", simdi: "2026-07-05" });
    expect(d.mod).toBe("saltOkunur");
    expect(d.neden).toBe("lisansBitti");
    expect(d.saatGeriAlindi).toBe(true);
  });
  it("sonGorulen sistem saatinin gerisindeyse (normal ileri akış) simdi kullanılır, işaret yok", () => {
    const d = durumHesapla({ kurulumTarihi: "2026-07-01", sonGorulen: "2026-07-03", simdi: "2026-07-10" });
    expect(d.mod).toBe("deneme");
    expect(d.kalanGun).toBe(DENEME_GUN - 9);
    expect(d.saatGeriAlindi).toBeUndefined();
  });
  it("otomatikAktivasyonGerekli: yalnız aktivasyon bekleyen salt okunur lisans (12.09.2026 kulüp aktivasyon sorunu)", () => {
    expect(otomatikAktivasyonGerekli({ mod: "saltOkunur", neden: "aktivasyonGerekli" })).toBe(true);
    expect(otomatikAktivasyonGerekli({ mod: "saltOkunur", neden: "lisansBitti" })).toBe(false);
    expect(otomatikAktivasyonGerekli({ mod: "lisansli" })).toBe(false);
    expect(otomatikAktivasyonGerekli(null)).toBe(false);
  });
});
