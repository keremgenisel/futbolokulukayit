import { describe, it, expect } from "vitest";
import { araNormalize as ana } from "../electron/metin.cjs";
import { araNormalize as ren, araEslesir } from "../src/lib/metin.js";

const ORNEKLER = ["İbrahim", "IŞIK Işık", "Çağla ÖZGÜR", "  Gül  Şen ", "ÜMİT", "Iğdır", "", null, 123];
describe("araNormalize: Türkçe duyarsız arama", () => {
  it("İ/I/ı/i hepsi i olur; ş ç ğ ö ü katlanır; boşluklar tekleşir", () => {
    expect(ana("İbrahim")).toBe("ibrahim");
    expect(ana("IŞIK Işık")).toBe("isik isik");
    expect(ana("Çağla ÖZGÜR")).toBe("cagla ozgur");
    expect(ana("  Gül  Şen ")).toBe("gul sen");
    expect(ana("ÜMİT")).toBe("umit");
  });
  it("ana süreç ve arayüz sürümleri birebir aynı sonucu verir", () => {
    for (const s of ORNEKLER) expect(ren(s)).toBe(ana(s));
  });
  it("araEslesir: 'i' İbrahim'i, 'isik' Işık'ı, 'ozgur' ÖZGÜR'ü bulur", () => {
    expect(araEslesir("İbrahim Yılmaz", "i")).toBe(true);
    expect(araEslesir("Işık Kaya", "isik")).toBe(true);
    expect(araEslesir("Çağla ÖZGÜR", "ozgur")).toBe(true);
    expect(araEslesir("Çağla ÖZGÜR", "ÖZGÜR")).toBe(true);
    expect(araEslesir("Ahmet", "i")).toBe(false);
  });
});
