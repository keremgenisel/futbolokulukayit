import { describe, it, expect } from "vitest";
import { araNormalize as ana } from "../electron/metin.cjs";
import { araNormalize as ren, araEslesir, esc, guvenliLogo } from "../src/lib/metin.js";

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

  it("esc: & < > \" ' kaçırılır (tek yer, tek tırnak dahil)", () => {
    expect(esc(`<b onclick='x("y")'>&`)).toBe("&lt;b onclick=&#39;x(&quot;y&quot;)&#39;&gt;&amp;");
    expect(esc(null)).toBe("");
    expect(esc(12)).toBe("12");
  });
  it("guvenliLogo: yalnız base64 PNG/JPEG data URL geçer; öznitelik kaçışı/dış adres boşa düşer", () => {
    expect(guvenliLogo("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(guvenliLogo("data:image/jpeg;base64,/9j/4AAQ")).toBe("data:image/jpeg;base64,/9j/4AAQ");
    for (const k of [
      '"><img src=http://x/',
      "http://x/logo.png",
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "",
      null,
    ])
      expect(guvenliLogo(k)).toBe("");
  });
});
