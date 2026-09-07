import { describe, it, expect } from "vitest";
import { yoklamaFormuHtml, EK_BOS_SATIR } from "../src/lib/yoklamaFormuHtml.js";

const oyuncular = [
  { ad_soyad: "Ada Kaya", durum: "aktif", isaret: "geldi" },
  { ad_soyad: "Barış <Güneş>", durum: "deneme" },
  { ad_soyad: "Can Yılmaz", durum: "sakat", isaret: "izinli" },
  { ad_soyad: "Deniz Aksoy", durum: "aktif", isaret: "gelmedi" },
];
const html = yoklamaFormuHtml({ grup: "U11", tarih: "2026-09-07", saat: "17:00", saha: "Saha 2", oyuncular, logo: "data:image/png;base64,AAA" });
const satirlar = html.split("<tr>").slice(2); // 1: başlık satırı

describe("saha yoklama formu HTML'i", () => {
  it("başlık: grup, Türkçe uzun tarih, saat, saha, logo; A4 dikey", () => {
    expect(html).toContain("YOKLAMA FORMU");
    expect(html).toContain('<span class="grup">U11</span>');
    expect(html).toContain("7 Eylül 2026 Pazartesi");
    expect(html).toContain("17:00"); expect(html).toContain("Saha 2");
    expect(html).toContain('<img src="data:image/png;base64,AAA"');
    expect(html).toContain("size: A4 portrait");
  });
  it("işaretli oyuncu dolu kutuyla, işaretsiz üç boş kutuyla gelir; sonda ek boş satırlar", () => {
    expect(satirlar).toHaveLength(oyuncular.length + EK_BOS_SATIR);
    const [ada, baris, can, deniz] = satirlar;
    expect((ada.match(/kutu dolu/g) || []).length).toBe(1); expect(ada.indexOf("kutu dolu")).toBeLessThan(ada.indexOf("Gelmedi") === -1 ? Infinity : 0); // ilk kutu
    expect(ada).toMatch(/Ada Kaya.*<div class="kutu dolu">.*<div class="kutu">.*<div class="kutu">/s);
    expect(baris.match(/class="kutu"/g)).toHaveLength(3); expect(baris).not.toContain("kutu dolu");
    expect(can).toMatch(/<div class="kutu">.*<div class="kutu">.*<div class="kutu dolu"><span class="izin">İ<\/span>/s);
    expect(deniz).toMatch(/<div class="kutu">.*<div class="kutu dolu">.*<div class="kutu">/s);
    const bos = satirlar.slice(-EK_BOS_SATIR);
    for (const b of bos) { expect(b).toContain('class="no bos"'); expect(b.match(/class="kutu"/g)).toHaveLength(3); }
    expect(bos[0]).toContain(`>${oyuncular.length + 1}</td>`);
  });
  it("deneme/sakat etiketi var, aktifte yok; ad HTML'den kaçırılır", () => {
    expect(satirlar[1]).toContain("(deneme)"); expect(satirlar[2]).toContain("(sakat)"); expect(satirlar[0]).not.toContain("etiket");
    expect(satirlar[1]).toContain("Barış &lt;Güneş&gt;"); expect(html).not.toContain("<Güneş>");
  });
  it("aidat/borç bilgisi forma girmez; toplam ve imza alanı var", () => {
    expect(html.toLowerCase()).not.toMatch(/aidat|borç|₺/);
    expect(html).toContain("<b>4 oyuncu</b>"); expect(html).toContain("İmza"); expect(html).toContain("Antrenör:");
  });
  it("saat/saha boşsa satırları düşer, logo yoksa img yok", () => {
    const h = yoklamaFormuHtml({ grup: "U9", tarih: "2026-09-08", oyuncular: [] });
    expect(h).not.toContain("Saha:"); expect(h).not.toContain("<img"); expect(h).toContain("8 Eylül 2026 Salı");
    expect(h.split("<tr>").slice(2)).toHaveLength(EK_BOS_SATIR);
  });
});
