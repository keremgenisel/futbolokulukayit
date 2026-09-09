import { describe, it, expect } from "vitest";
import { tarihinSezonu, makbuzSezonu, makbuzOneki, sonrakiMakbuzNo } from "../electron/makbuzNo.cjs";

describe("makbuz numarası ve sezonu (plan §17.2)", () => {
  it("tarihten sezon: başlangıç ayı ve sonrası ilk yıl, öncesi bir önceki sezon", () => {
    expect(tarihinSezonu("2026-09-09", 9)).toBe("2026-2027");
    expect(tarihinSezonu("2027-01-15", 9)).toBe("2026-2027");
    expect(tarihinSezonu("2027-09-01", 9)).toBe("2027-2028");
    expect(tarihinSezonu("", 9)).toBe("");
  });
  it("makbuz sezonu: aktif sezon geçerliyse o, değilse tarihten", () => {
    expect(makbuzSezonu("2027-2028", "2026-09-09")).toBe("2027-2028");
    expect(makbuzSezonu("", "2026-09-09")).toBe("2026-2027");
    expect(makbuzSezonu("bozuk", "2026-03-01")).toBe("2025-2026");
  });
  it("önek sezonun ilk yılı; sezon ortasında Ocak'ta da aynı önek", () => {
    expect(makbuzOneki("2027-2028", "2026-09-09")).toBe("2027");
    expect(makbuzOneki("2027-2028", "2028-01-10")).toBe("2027");
    expect(makbuzOneki("", "2026-09-09")).toBe("2026");
  });
  it("sonraki numara önek içinde artar", () => {
    expect(sonrakiMakbuzNo("2027", null)).toBe("2027-0001");
    expect(sonrakiMakbuzNo("2027", "2027-0012")).toBe("2027-0013");
    expect(sonrakiMakbuzNo("2027", "2027-9999")).toBe("2027-10000");
  });
});
