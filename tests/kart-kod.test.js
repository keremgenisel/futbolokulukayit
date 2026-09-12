// Giriş kartı kodları (plan §40): Code 128 tablosu yapısal doğrulama (her sembol 11 modül, dur 13), barkod/QR SVG, kod metni.
import { describe, it, expect } from "vitest";
import { CODE128, code128Svg, qrSvg, kodMetni, KOD_ONEKI } from "../src/lib/kartKod.js";

describe("kart kodları", () => {
  it("Code 128 tablosu: 107 desen; 0–105 altı genişlik toplam 11, dur (106) yedi genişlik toplam 13", () => {
    expect(CODE128).toHaveLength(107);
    const top = (d) => [...d].reduce((s, c) => s + Number(c), 0);
    for (let i = 0; i <= 105; i++) {
      expect(CODE128[i]).toHaveLength(6);
      expect(top(CODE128[i])).toBe(11);
    }
    expect(CODE128[106]).toBe("2331112");
    expect(top(CODE128[106])).toBe(13);
    expect(new Set(CODE128).size).toBe(107); // desenler tekil
  });
  it("code128Svg: Başlangıç B + veri + sağlama + dur; sessiz bölge; ASCII dışı reddedilir", () => {
    const svg = code128Svg("FOK:20260123");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('preserveAspectRatio="none"');
    // modül sayısı: 10 + 11*(1 başlangıç + 12 veri + 1 sağlama) + 13 dur + 10 = 187
    expect(svg).toContain('viewBox="0 0 187 100"');
    expect((svg.match(/<rect /g) || []).length).toBeGreaterThan(30);
    expect(() => code128Svg("ÇÜ")).toThrow(/ASCII/);
  });
  it("kodMetni: FOK öneki ve boşluksuz kart no; qrSvg: qrcode paketiyle boyutsuz SVG", async () => {
    expect(KOD_ONEKI).toBe("FOK:");
    expect(kodMetni("2026 0123")).toBe("FOK:20260123");
    const svg = await qrSvg("FOK:20260123");
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="100%"');
    expect(svg).not.toMatch(/\swidth="\d+"/);
  });
});
