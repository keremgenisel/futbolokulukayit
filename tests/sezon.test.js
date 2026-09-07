import { describe, it, expect } from "vitest";
import { guncelSezon, sonrakiSezon, sezonGecerliMi, sezonSonuMu, ustGrupAdi, ustGrupOner } from "../src/lib/sezon.js";

describe("sezon mantığı", () => {
  it("güncel sezon başlangıç ayına göre belirlenir", () => {
    expect(guncelSezon("2026-09-07", 9)).toBe("2026-2027");
    expect(guncelSezon("2027-06-15", 9)).toBe("2026-2027");
    expect(guncelSezon("2027-09-01", 9)).toBe("2027-2028");
    expect(guncelSezon("2027-01-10", 1)).toBe("2027-2028");
  });
  it("sonraki sezon ve geçerlilik", () => {
    expect(sonrakiSezon("2026-2027")).toBe("2027-2028");
    expect(sonrakiSezon("bozuk")).toBe("");
    expect(sezonGecerliMi("2026-2027")).toBe(true);
    expect(sezonGecerliMi("2026-2028")).toBe(false);
    expect(sezonGecerliMi("")).toBe(false);
  });
  it("sezon sonu: yeni sezon başladı ama geçiş yapılmadıysa", () => {
    expect(sezonSonuMu("2026-2027", "2027-06-01", 9)).toBe(false);
    expect(sezonSonuMu("2026-2027", "2027-09-01", 9)).toBe(true);
    expect(sezonSonuMu("2027-2028", "2027-09-01", 9)).toBe(false);
    expect(sezonSonuMu("", "2027-09-01", 9)).toBe(false);
  });
  it("üst grup önerisi: U11 → U12; ad uymuyorsa mevcut grup kalır", () => {
    expect(ustGrupAdi("U11")).toBe("U12");
    expect(ustGrupAdi("u 9")).toBe("U10");
    expect(ustGrupAdi("U12 Kız")).toBe("U13 Kız");
    expect(ustGrupAdi("Minikler")).toBe("");
    const g = [{ id: 1, ad: "U11", aktif: 1 }, { id: 2, ad: "U12", aktif: 1 }, { id: 3, ad: "U13", aktif: 0 }, { id: 4, ad: "Minikler", aktif: 1 }];
    expect(ustGrupOner(g, 1)).toBe(2);
    expect(ustGrupOner(g, 2)).toBe(2); // U13 pasif → kal
    expect(ustGrupOner(g, 4)).toBe(4);
    expect(ustGrupOner(g, null)).toBe(null);
  });
  it("üst grup önerisi: alt gruplu ad (U11 A) → U12 A; yoksa U12; o da yoksa mevcut kalır", () => {
    const g = [{ id: 1, ad: "U11 A", aktif: 1 }, { id: 2, ad: "U11 B", aktif: 1 }, { id: 3, ad: "U12 A", aktif: 1 }, { id: 4, ad: "U12", aktif: 1 }, { id: 5, ad: "U13 B", aktif: 1 }, { id: 6, ad: "U12 B", aktif: 0 }];
    expect(ustGrupOner(g, 1)).toBe(3); // U12 A var
    expect(ustGrupOner(g, 2)).toBe(4); // U12 B pasif → gövde U12
    expect(ustGrupOner(g, 3)).toBe(3); // U13 A yok, U13 yok → kal
    expect(ustGrupOner(g, 5)).toBe(5);
  });
});
