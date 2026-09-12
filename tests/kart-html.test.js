// Giriş kartı şablonu (plan §40): saf HTML; kaçırma, kod isteğe bağlı, tek/toplu/önizleme düzenleri, numaralar.
import { describe, it, expect } from "vitest";
import { girisKartiHtml, oyuncuNo, kartNo, telMaskele, KART_KURAL_VARSAYILAN, TOPLU_SAYFA_KART, kartAltYazi } from "../src/lib/kartHtml.js";

const oyuncu = (id, ad, ek = {}) => ({
  id,
  ad_soyad: ad,
  yas_grubu_ad: "U11",
  dogum_tarihi: "2015-11-02",
  veli_ad: "Ayşe <Yıldız>",
  veli_tel: "05321112233",
  ...ek,
});
const ayar = {
  kulupAdi: "Eyüpspor & Kulübü",
  kurulusYili: "1919",
  sezon: "2026-2027",
  telefon: "0212 000 00 00",
  adres: "Eyüp / İstanbul",
};

describe("giriş kartı şablonu", () => {
  it("numaralar ve maske", () => {
    expect(oyuncuNo(7)).toBe("0007");
    expect(oyuncuNo(12345)).toBe("12345");
    expect(kartNo(123, "2026-2027")).toBe("2026 0123");
    expect(kartNo(5, "")).toBe("0000 0005");
    expect(telMaskele("0532 111 22 33")).toBe("0532 ••• •• ••");
    expect(telMaskele("")).toBe("");
  });
  it("tek düzen: ön + arka yüz, tüm alanlar kaçırılmış, kod yoksa QR/barkod bloğu yok, 4 varsayılan kural, sezon pili", () => {
    const h = girisKartiHtml({ oyuncular: [oyuncu(123, 'Kaan <b>"Yıldız"</b>')], ayar, duzen: "tek" });
    expect(h).toContain("A4 landscape");
    expect(h).toContain('class="sayfa tek"');
    expect(h).toContain("OYUNCU GİRİŞ KARTI");
    expect(h).toContain("Kaan &lt;b&gt;&quot;Yıldız&quot;&lt;/b&gt;");
    expect(h).not.toContain("<b>Yıldız</b>");
    expect(h).toContain("Eyüpspor &amp; Kulübü");
    expect(h).toContain("Ayşe &lt;Yıldız&gt;");
    expect(h).toContain("0532 ••• •• ••");
    expect(h).toContain("2026 0123");
    expect(h).toContain("2026-2027");
    expect(h).toContain("Futbol Okulu · 1919"); // kısa ad yok → varsayılan
    expect(h).toContain("flex: 1; display: flex; gap: 3.5mm; padding: 1mm 4mm 6mm; align-items: center;"); // gövde dikeyde ortalı
    expect(h).toContain("Giriş için aidatın ödenmiş olması gerekir");
    expect(h).not.toContain("GİRİŞ KODU");
    expect(h).not.toContain('class="cubuk"');
    for (const k of KART_KURAL_VARSAYILAN) expect(h).toContain(k.replace("&", "&amp;"));
    expect(h).toContain("Doğum</span><span>2015");
  });
  it("kısa ad verilince ön yüzde kulüp adının altında kısa ad + kuruluş yılı; yoksa 'Futbol Okulu'", () => {
    const h = girisKartiHtml({ oyuncular: [oyuncu(1, "A")], ayar: { ...ayar, kisaAd: "EYÜPSPOR <FO>" }, duzen: "tek" });
    expect(h).toContain("EYÜPSPOR &lt;FO&gt; · 1919");
    expect(h).not.toContain("Futbol Okulu · 1919");
    expect(kartAltYazi("", "")).toBe("Futbol Okulu");
    expect(kartAltYazi(" Eyüpspor ", " 1919 ")).toBe("Eyüpspor · 1919");
  });
  it("kod verilince QR kutusu ve barkod basılır; özel kurallar, adres ve web arka yüzde; foto yalnız güvenli data URL", () => {
    const h = girisKartiHtml({
      oyuncular: [
        oyuncu(1, "A B", { qrSvg: "<svg id='qr'></svg>", barkodSvg: "<svg id='bk'></svg>", foto: "data:image/jpeg;base64,AAAA" }),
      ],
      ayar: { ...ayar, web: "eyupspor.org", kurallar: ["Bir", "İki", "", "Dört"] },
    });
    expect(h).toContain("GİRİŞ KODU");
    expect(h).toContain("<svg id='qr'></svg>");
    expect(h).toContain("<svg id='bk'></svg>");
    expect(h).toContain("<b>1.</b><span>Bir</span>");
    expect(h).toContain("<b>3.</b><span>Dört</span>"); // boş kural atlanır, numaralar sıkışır
    expect(h).toContain("eyupspor.org");
    expect(h).toContain('src="data:image/jpeg;base64,AAAA"');
    const kotu = girisKartiHtml({ oyuncular: [oyuncu(1, "A", { foto: "javascript:alert(1)" })], ayar });
    expect(kotu).not.toContain("javascript:");
  });
  it("toplu düzen: 6 kart/sayfa, her öbek için ön sayfa sonra arka sayfa; 7 oyuncu → 4 sayfa", () => {
    const h = girisKartiHtml({ oyuncular: Array.from({ length: 7 }, (_, i) => oyuncu(i + 1, `Oyuncu ${i + 1}`)), ayar, duzen: "toplu" });
    expect(TOPLU_SAYFA_KART).toBe(6);
    expect(h.match(/class="sayfa toplu"/g)).toHaveLength(4);
    const sayfalar = h.split('class="sayfa toplu"').slice(1);
    expect((sayfalar[0].match(/class="kart on"/g) || []).length).toBe(6);
    expect((sayfalar[1].match(/class="kart arka"/g) || []).length).toBe(6);
    expect((sayfalar[2].match(/class="kart on"/g) || []).length).toBe(1);
    expect((sayfalar[3].match(/class="kart arka"/g) || []).length).toBe(1);
  });
  it("önizleme düzeni: sayfa yok, iki kart alt alta; logo yoksa arma, kulüp adı yoksa varsayılan", () => {
    const h = girisKartiHtml({ oyuncular: [oyuncu(1, "A")], ayar: {}, duzen: "onizleme" });
    expect(h).not.toContain("@page");
    expect(h).toContain('class="onizleme"');
    expect(h).toContain("Futbol Okulu");
    expect(h).toContain('<svg viewBox="0 0 48 48"'); // arma
  });
});
