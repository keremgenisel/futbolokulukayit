import { describe, it, expect } from "vitest";
import { makbuzHtml } from "../src/lib/makbuzHtml.js";

const kalemler = [
  { id: 1, kod: "aidat", ad: "Aidat" },
  { id: 2, kod: "forma", ad: "Forma" },
  { id: 3, kod: "corap", ad: "Çorap" },
];
const makbuz = {
  makbuz_no: "2026-0203",
  tarih: "2026-09-06",
  ad_soyad: "Kaan Yıldız",
  dogum_tarihi: "2015-11-02",
  yas_grubu_ad: "U11",
  toplam: 4850,
  odeme_yontemi: "nakit",
  tahsil_eden: "Şerif Çelik",
  not_: "",
  satirlar: [
    { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 },
    { fee_item_id: 2, kalem_kod: "forma", tutar: 1200 },
    { fee_item_id: 3, kalem_kod: "corap", tutar: 150 },
  ],
};

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
    const m = {
      ...makbuz,
      satirlar: [
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 10 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 },
        { fee_item_id: 2, kalem_kod: "forma", tutar: 1200 },
      ],
      toplam: 8200,
    };
    const h = makbuzHtml({ makbuz: m, kalemler, logo: "" });
    expect(h.indexOf("AİDAT · EYLÜL 2026")).toBeLessThan(h.indexOf("AİDAT · EKİM 2026"));
    expect(h.match(/AİDAT · EYLÜL 2026/g)).toHaveLength(2); // iki kopya
    expect(h).toContain("Eylül 2026, Ekim 2026");
    expect(h).toContain("FORMA");
    expect(h).toContain("8.200 ₺");
  });
  it("3 ay ve altı: her ay hâlâ ayrı satırda (eşik aşılmaz)", () => {
    const m = {
      ...makbuz,
      satirlar: [
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 10 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 11 },
      ],
      toplam: 10500,
    };
    const h = makbuzHtml({ makbuz: m, kalemler, logo: "" });
    expect(h.match(/AİDAT · /g)).toHaveLength(6); // 3 ay × 2 kopya, özetlenmemiş
    expect(h).toContain("Eylül 2026, Ekim 2026, Kasım 2026");
    expect(h).not.toContain("(3 AY)");
  });
  it("4+ ay: tek özet satır (aralık + toplam), Dönem bilgisi aralık gösterir, taşmayı önler", () => {
    const m = {
      ...makbuz,
      satirlar: [
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 9 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 10 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 11 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2026, ay: 12 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2027, ay: 1 },
        { fee_item_id: 1, kalem_kod: "aidat", tutar: 3500, yil: 2027, ay: 2 },
        { fee_item_id: 2, kalem_kod: "forma", tutar: 1200 },
        { fee_item_id: 3, kalem_kod: "corap", tutar: 150 },
      ],
      toplam: 22350,
    };
    const h = makbuzHtml({ makbuz: m, kalemler, logo: "" });
    expect(h.match(/AİDAT · EYLÜL 2026–ŞUBAT 2027 \(6 AY\)/g)).toHaveLength(2); // iki kopya, tek satır
    expect(h).not.toContain("AİDAT · EYLÜL 2026</span>"); // ay bazlı ayrı satır YOK
    expect(h).toContain("21.000 ₺"); // 6 × 3.500 toplamı
    expect(h).toContain("Dönem:</span> <b>Eylül 2026 – Şubat 2027</b>");
    expect(h).not.toContain("Eylül 2026, Ekim 2026"); // tam liste artık basılmıyor
    expect(h).toContain("22.350 ₺");
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
    expect(kotu).not.toContain("saldirgan");
    expect(kotu).not.toContain("<img");
  });
  it("tema: kulüp renkleri makbuz çerçevesi/başlık/şeride girer; tema verilmezse varsayılan mor/sarı (plan §32.4)", () => {
    const varsayilan = makbuzHtml({ makbuz, kalemler, logo: "" });
    expect(varsayilan).toContain("#5b2d8e");
    expect(varsayilan).toContain("#f5d000");
    const h = makbuzHtml({ makbuz, kalemler, logo: "", tema: { ana: "#1f3a93", vurgu: "#f58220" } });
    expect(h).toContain("#1f3a93");
    expect(h).toContain("#f58220");
    expect(h).not.toContain("#5b2d8e");
    expect(h).not.toContain("#F5D000");
    // geçersiz renk varsayılana düşer, şablona olduğu gibi girmez
    const g = makbuzHtml({ makbuz, kalemler, logo: "", tema: { ana: "red; background:url(x)", vurgu: "#f58220" } });
    expect(g).toContain("#5b2d8e");
    expect(g).not.toContain("url(x)");
  });
});
