// Aktivasyon sunucusu (aktivasyon-sunucu/src/index.js) mantık testi — sahte (in-memory) D1 ile,
// wrangler'sız. Güvenlik davranışını kilitler: kurulum limiti, uzaktan iptal, kayıtsız anahtar reddi,
// admin token. Kripto uyumu ayrı testte (aktivasyon-kripto.test.js).
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { imzala } from "../electron/lisans.cjs";
import worker from "../aktivasyon-sunucu/src/index.js";

// Sahte D1: db.js'in kullandığı SQL'leri substring ile tanır, bellek dizileri üzerinde işler.
function sahteD1() {
  const t = { lisanslar: [], kurulumlar: [] };
  let seqL = 0, seqK = 0;
  return {
    prepare(sql) {
      let args = [];
      const api = {
        bind: (...a) => { args = a; return api; },
        first: async () => {
          if (sql.includes("FROM lisanslar WHERE anahtarHash")) return t.lisanslar.find(x => x.anahtarHash === args[0]) || null;
          if (sql.includes("COUNT(*) AS n FROM kurulumlar")) return { n: t.kurulumlar.filter(x => x.lisansId === args[0] && x.aktif === 1).length };
          if (sql.includes("FROM kurulumlar WHERE lisansId = ? AND makineId")) return t.kurulumlar.find(x => x.lisansId === args[0] && x.makineId === args[1]) || null;
          return null;
        },
        run: async () => {
          if (sql.includes("INSERT INTO lisanslar")) {
            const [anahtarHash, firma, bitis, maksKullanici, maksKurulum, iptal, olusturuldu] = args;
            const ex = t.lisanslar.find(x => x.anahtarHash === anahtarHash);
            if (ex) Object.assign(ex, { firma, bitis, maksKullanici, maksKurulum, iptal });
            else t.lisanslar.push({ id: ++seqL, anahtarHash, firma, bitis, maksKullanici, maksKurulum, iptal, olusturuldu });
          } else if (sql.includes("INSERT INTO kurulumlar")) {
            const [lisansId, makineId, ilkGoruldu, sonGoruldu, surum] = args;
            t.kurulumlar.push({ id: ++seqK, lisansId, makineId, ilkGoruldu, sonGoruldu, surum, aktif: 1 });
          } else if (sql.includes("UPDATE kurulumlar SET sonGoruldu")) {
            const [sonGoruldu, surum, id] = args;
            const r = t.kurulumlar.find(x => x.id === id); if (r) Object.assign(r, { sonGoruldu, surum, aktif: 1 });
          }
          return { success: true };
        },
        all: async () => {
          if (sql.includes("FROM lisanslar l")) {
            return { results: t.lisanslar.map(l => ({
              firma: l.firma, bitis: l.bitis, maksKullanici: l.maksKullanici, maksKurulum: l.maksKurulum,
              iptal: l.iptal, olusturuldu: l.olusturuldu,
              kurulumSayisi: t.kurulumlar.filter(k => k.lisansId === l.id && k.aktif === 1).length,
            })) };
          }
          return { results: t.kurulumlar.filter(x => x.lisansId === args[0]) };
        },
      };
      return api;
    },
  };
}

let pubPem, privPem, env, anahtar, baskaAnahtar;
const call = async (path, method, body, headers = {}) => {
  const req = new Request("https://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  const r = await worker.fetch(req, env);
  return { status: r.status, body: await r.json() };
};
const AKTIVE = (makineId) => call("/aktivasyon", "POST", { anahtar, makineId, surum: "3.0" });

beforeAll(() => {
  const kp = crypto.generateKeyPairSync("ed25519");
  pubPem = kp.publicKey.export({ type: "spki", format: "pem" });
  privPem = kp.privateKey.export({ type: "pkcs8", format: "pem" });
  env = { DB: sahteD1(), LISANS_PUBLIC_PEM: pubPem, LEASE_PRIVATE_PEM: privPem, LEASE_GUN: "14", ADMIN_TOKEN: "gizli" };
  anahtar = imzala({ firma: "T A.Ş.", bitis: "2027-01-01", maksKullanici: 5, uretimTarihi: "2026-07-19", aktivasyonGerekli: true }, privPem);
  baskaAnahtar = imzala({ firma: "Kayıtsız", bitis: "2027-01-01", uretimTarihi: "2026-07-19" }, privPem);
});

describe("Aktivasyon sunucusu — kurulum limiti + iptal + admin", () => {
  it("admin token yanlışsa 401", async () => {
    const r = await call("/admin/lisans", "POST", { anahtar, maksKurulum: 2 }, { "x-admin-token": "yanlis" });
    expect(r.status).toBe(401);
  });

  it("lisans kaydedilir (maksKurulum:2)", async () => {
    const r = await call("/admin/lisans", "POST", { anahtar, maksKurulum: 2 }, { "x-admin-token": "gizli" });
    expect(r.status).toBe(200); expect(r.body.ok).toBe(true);
  });

  it("kayıtlı OLMAYAN anahtar aktivasyonda 403", async () => {
    const r = await call("/aktivasyon", "POST", { anahtar: baskaAnahtar, makineId: "X" });
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/kayıtlı değil/);
  });

  it("ilk iki makine aktive olur, imzalı lease döner", async () => {
    const a = await AKTIVE("MAK-A"); expect(a.status).toBe(200); expect(a.body.lease.startsWith("EYUPLEASE.")).toBe(true);
    const b = await AKTIVE("MAK-B"); expect(b.status).toBe(200);
  });

  it("üçüncü makine kurulum limitine takılır (403)", async () => {
    const c = await AKTIVE("MAK-C");
    expect(c.status).toBe(403); expect(c.body.error).toMatch(/limit/);
  });

  it("var olan makinenin tekrar aktivasyonu yeni kurulum saymaz (limitli değil)", async () => {
    const a = await AKTIVE("MAK-A");
    expect(a.status).toBe(200);
  });

  it("bilinmeyen makine yenilemede 403 (önce aktive edilmeli)", async () => {
    const r = await call("/yenile", "POST", { anahtar, makineId: "MAK-Z" });
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/kurulum bulunamadı/);
  });

  it("kayıtlı makine yenilenir", async () => {
    const r = await call("/yenile", "POST", { anahtar, makineId: "MAK-A" });
    expect(r.status).toBe(200); expect(r.body.lease.startsWith("EYUPLEASE.")).toBe(true);
  });

  it("uzaktan iptal: iptal sonrası yenileme 403 (lease penceresi dolunca uygulama kilitlenir)", async () => {
    await call("/admin/lisans", "POST", { anahtar, iptal: true }, { "x-admin-token": "gizli" });
    const r = await call("/yenile", "POST", { anahtar, makineId: "MAK-A" });
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/iptal/);
  });

  it("/admin/hepsi tüm lisansları kurulum sayısıyla döndürür", async () => {
    const r = await call("/admin/hepsi", "GET", null, { "x-admin-token": "gizli" });
    expect(r.status).toBe(200);
    const l = (r.body.lisanslar || []).find(x => x.firma === "T A.Ş.");
    expect(l, "kayıtlı lisans listede olmalı").toBeTruthy();
    expect(l.kurulumSayisi).toBeGreaterThanOrEqual(1); // MAK-A/MAK-B aktive edildi
  });

  it("/admin/hepsi yetkisiz token → 401", async () => {
    expect((await call("/admin/hepsi", "GET", null, { "x-admin-token": "yanlis" })).status).toBe(401);
  });

  it("/saglik ok", async () => {
    expect((await call("/saglik", "GET")).body.ok).toBe(true);
  });
});
