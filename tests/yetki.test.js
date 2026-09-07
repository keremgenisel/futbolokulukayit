import { describe, it, expect } from "vitest";
import { cagriYetkisi, OKUMA, YAZMA, ADMIN } from "../electron/yetki.cjs";

const admin = { username: "a", role: "admin" }, kullanici = { username: "k", role: "kullanici" };

describe("cagriYetkisi — IPC ve sunucu için ortak yetki kararı", () => {
  it("oturumsuz her çağrı 401", () => { expect(cagriYetkisi("listAgeGroups", null, false).kod).toBe(401); });
  it("okuma herkese açık, salt okunurda bile", () => {
    expect(cagriYetkisi("listPlayers", kullanici, true).ok).toBe(true);
    for (const f of ["playersPage", "playerAttendanceSon"]) expect(cagriYetkisi(f, kullanici, true).ok).toBe(true);
  });
  it("yazma lisans salt okunurken 403, normalde serbest", () => {
    expect(cagriYetkisi("createPlayer", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("aidatAyarlariKaydet", kullanici, true).kod).toBe(403);
    const r = cagriYetkisi("createPlayer", kullanici, true);
    expect(r.ok).toBe(false); expect(r.kod).toBe(403); expect(r.mesaj).toMatch(/salt okunur/);
  });
  it("admin işlemleri yalnız yönetici", () => {
    expect(cagriYetkisi("createUser", kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("createUser", admin, false).ok).toBe(true);
    expect(cagriYetkisi("createUser", admin, true).kod).toBe(403);
  });
  it("beyaz liste dışı fonksiyon (ör. close, init, verifyPassword) 403", () => {
    for (const f of ["close", "init", "verifyPassword", "getMetaValue", "lisansKaydet", "changePassword", "kurtarmaIleSifirla", "kurtarmaKodlariUret"]) expect(cagriYetkisi(f, admin, false).kod).toBe(403);
  });
  it("kümeler kesişmez", () => {
    for (const f of YAZMA) expect(OKUMA.has(f) || ADMIN.has(f)).toBe(false);
    for (const f of ADMIN) expect(OKUMA.has(f)).toBe(false);
  });

  it("sezon: okuma herkese, geçiş yalnız yönetici", () => {
    expect(cagriYetkisi("sezonAdayListesi", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("sezonDurumu", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("yeniSezonaGec", kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("yeniSezonaGec", admin, false).ok).toBe(true);
  });
  it("deleteUser yalnız yönetici", () => {
    expect(cagriYetkisi("deleteUser", admin, false).ok).toBe(true);
    expect(cagriYetkisi("deleteUser", { username: "u", role: "kullanici" }, false).kod).toBe(403);
    expect(cagriYetkisi("deleteUser", admin, true).kod).toBe(403);
  });
});
