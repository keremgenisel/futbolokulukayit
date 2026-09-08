// Aktivasyon kripto SÖZLEŞMESİ: uygulama (electron/lisans.cjs, Node crypto) ile aktivasyon sunucusu
// (aktivasyon-sunucu/src/kripto.js, Web Crypto) aynı Ed25519 biçimini üretmeli/doğrulamalı. İkisi
// ayrışırsa aktivasyon SESSİZCE kırılır (Node imzalı anahtar sunucuda geçmez ya da sunucu lease'i
// uygulamada geçmez). Bu test o köprüyü iki yönde de kilitler.
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { imzala, leaseDogrula } from "../electron/lisans.cjs";
import { lisansDogrula, leaseImzala, acikAnahtarYukle, ozelAnahtarYukle, sha256hex } from "../aktivasyon-sunucu/src/kripto.js";

let pubPem, privPem;
beforeAll(() => {
  const kp = crypto.generateKeyPairSync("ed25519");
  pubPem = kp.publicKey.export({ type: "spki", format: "pem" });
  privPem = kp.privateKey.export({ type: "pkcs8", format: "pem" });
});

describe("Aktivasyon kripto sözleşmesi — uygulama (Node) ↔ sunucu (Web Crypto)", () => {
  it("Node imzalı LİSANS anahtarı sunucuda (Web Crypto) doğrulanır, payload aynen döner", async () => {
    const payload = { firma: "Test A.Ş.", bitis: "2027-01-01", maksKullanici: 5, uretimTarihi: "2026-07-19", aktivasyonGerekli: true };
    const d = await lisansDogrula(imzala(payload, privPem), await acikAnahtarYukle(pubPem));
    expect(d.gecerli).toBe(true);
    expect(d.payload).toEqual(payload);
  });

  it("Sunucu (Web Crypto) imzalı LEASE uygulamada (Node) doğrulanır", async () => {
    process.env.EYUPSPOR_LEASE_PUBKEY = pubPem;
    const lease = await leaseImzala(
      { firma: "Test A.Ş.", makineId: "MAK-1", leaseBitis: "2026-08-01", iptal: false, uretimTarihi: "2026-07-19" },
      await ozelAnahtarYukle(privPem),
    );
    const d = leaseDogrula(lease);
    expect(d.gecerli).toBe(true);
    expect(d.payload.makineId).toBe("MAK-1");
    delete process.env.EYUPSPOR_LEASE_PUBKEY;
  });

  it("tahrif edilen anahtar sunucuda reddedilir (bitiş uzatma)", async () => {
    const anahtar = imzala({ firma: "X", bitis: "2026-01-01", uretimTarihi: "2026-07-19" }, privPem);
    const [on, veri, sig] = anahtar.split(".");
    const k = JSON.parse(Buffer.from(veri, "base64url").toString());
    k.bitis = "2099-01-01";
    const sahte = `${on}.${Buffer.from(JSON.stringify(k)).toString("base64url")}.${sig}`;
    expect((await lisansDogrula(sahte, await acikAnahtarYukle(pubPem))).gecerli).toBe(false);
  });

  it("yabancı anahtarla imzalı lease uygulamada reddedilir (çift eşleşmiyor)", async () => {
    process.env.EYUPSPOR_LEASE_PUBKEY = pubPem; // uygulama pub'ı bekliyor
    const yabanci = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
    const lease = await leaseImzala(
      { firma: "X", makineId: "MAK-1", leaseBitis: "2026-08-01", iptal: false, uretimTarihi: "2026-07-19" },
      await ozelAnahtarYukle(yabanci),
    );
    expect(leaseDogrula(lease).gecerli).toBe(false);
    delete process.env.EYUPSPOR_LEASE_PUBKEY;
  });

  it("sha256hex tutarlı ve 64 hex (D1'de ham anahtar yerine bu tutulur)", async () => {
    const h = await sha256hex("EYUPSPOR.abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256hex("EYUPSPOR.abc")).toBe(h);
    expect(await sha256hex("EYUPSPOR.xyz")).not.toBe(h);
  });
});
