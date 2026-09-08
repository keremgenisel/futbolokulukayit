import { describe, it, expect } from "vitest";
import { belgeGecerlilik, belgeEtiketi, uyariSirala, onerilenGecerlilik } from "../src/lib/belge.js";

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

  it("uyariSirala: doldu (en eski önce) → dolacak (en yakın önce) → tarihsiz → rapor yok (ada göre)", () => {
    const l = [
      { ad_soyad: "Zeynep", durum: "yok" },
      { ad_soyad: "Ali", durum: "dolacak", gecerlilik: "2026-09-20" },
      { ad_soyad: "Bora", durum: "doldu", gecerlilik: "2026-08-01" },
      { ad_soyad: "Ceren", durum: "yok" },
      { ad_soyad: "Deniz", durum: "doldu", gecerlilik: "2025-01-01" },
      { ad_soyad: "Ece", durum: "dolacak", gecerlilik: "2026-09-10" },
      { ad_soyad: "Fatma", durum: "tarihsiz" },
    ];
    expect(uyariSirala(l).map((u) => u.ad_soyad)).toEqual(["Deniz", "Bora", "Ece", "Ali", "Fatma", "Ceren", "Zeynep"]);
    expect(l[0].ad_soyad).toBe("Zeynep"); // girdi değişmez
  });

  it("onerilenGecerlilik: bir yıl sonrası (artık yıl dahil)", () => {
    expect(onerilenGecerlilik("2026-09-08")).toBe("2027-09-08");
    expect(onerilenGecerlilik("2028-02-29")).toBe("2029-03-01"); // 29 Şubat yoksa 1 Mart
    expect(onerilenGecerlilik("2026-12-31")).toBe("2027-12-31");
  });
});
