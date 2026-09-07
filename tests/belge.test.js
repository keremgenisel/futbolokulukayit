import { describe, it, expect } from "vitest";
import { belgeGecerlilik, belgeEtiketi } from "../src/lib/belge.js";

describe("sağlık raporu geçerliliği", () => {
  it("yok / geçerli / dolacak (≤30 gün) / doldu", () => {
    expect(belgeGecerlilik(null, "2026-09-07")).toEqual({ durum: "yok", kalanGun: null });
    expect(belgeGecerlilik("2027-03-01", "2026-09-07").durum).toBe("gecerli");
    expect(belgeGecerlilik("2026-10-07", "2026-09-07")).toEqual({ durum: "dolacak", kalanGun: 30 });
    expect(belgeGecerlilik("2026-09-07", "2026-09-07")).toEqual({ durum: "dolacak", kalanGun: 0 });
    expect(belgeGecerlilik("2026-09-01", "2026-09-07")).toEqual({ durum: "doldu", kalanGun: -6 });
  });
  it("etiketler", () => {
    expect(belgeEtiketi({ durum: "doldu", kalanGun: -6 })).toBe("Süresi doldu (6 gün önce)");
    expect(belgeEtiketi({ durum: "dolacak", kalanGun: 12 })).toBe("12 gün kaldı");
    expect(belgeEtiketi({ durum: "dolacak", kalanGun: 0 })).toBe("Bugün doluyor");
    expect(belgeEtiketi({ durum: "gecerli", kalanGun: 100 })).toBe("Geçerli");
    expect(belgeEtiketi({ durum: "yok", kalanGun: null })).toBe("Tarih girilmemiş");
  });
});
