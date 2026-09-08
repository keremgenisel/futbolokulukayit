// Karakterizasyon testi (refactor hazırlığı): raporHtml çıktısının bugünkü davranışı sabitlenir.
import { describe, it, expect } from "vitest";
import { raporHtml } from "../src/lib/raporHtml.js";

const sutunlar = [
  { baslik: "Ad Soyad", anahtar: "ad" },
  { baslik: "Tutar", anahtar: "tutar", sag: true },
];
const satirlar = [
  { ad: "Kaan Yıldız", tutar: "3.500 ₺" },
  { ad: "<b>Ali</b> & Veli", tutar: "150 ₺" },
];

describe("raporHtml", () => {
  it("başlık, alt başlık, sütun başlıkları, satırlar ve kayıt sayısı yer alır; sağa hizalı sütun işaretlenir", () => {
    const h = raporHtml({ baslik: "Borçlu Listesi", altBaslik: "Eylül 2026", sutunlar, satirlar });
    expect(h).toContain("<title>Borçlu Listesi</title>");
    expect(h).toContain("<h1>Borçlu Listesi</h1>");
    expect(h).toContain('<div class="alt">Eylül 2026</div>');
    expect(h).toContain("<th>Ad Soyad</th>");
    expect(h).toContain('<th class="sag">Tutar</th>');
    expect(h).toContain("<td>Kaan Yıldız</td>");
    expect(h).toContain('<td class="sag">3.500 ₺</td>');
    expect(h).toContain("2 kayıt · Eyüpspor Futbol Okulu");
    expect(h).toContain("size: A4 portrait");
  });
  it("hücre içeriği kaçırılır (HTML enjeksiyonu yok)", () => {
    const h = raporHtml({ baslik: "x", sutunlar, satirlar });
    expect(h).toContain("&lt;b&gt;Ali&lt;/b&gt; &amp; Veli");
    expect(h).not.toContain("<b>Ali</b>");
  });
  it("yatay sayfa, alt başlık yoksa alt satırı yok, boş liste 0 kayıt", () => {
    const h = raporHtml({ baslik: "x", sutunlar, satirlar: [], yatay: true });
    expect(h).toContain("size: A4 landscape");
    expect(h).not.toContain('class="alt"');
    expect(h).toContain("0 kayıt");
  });
  it("logo yalnız güvenli data URL ise girer", () => {
    expect(raporHtml({ baslik: "x", sutunlar, satirlar, logo: "data:image/png;base64,iVBORw0KGgo=" })).toContain(
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="">',
    );
    expect(raporHtml({ baslik: "x", sutunlar, satirlar, logo: "http://x/logo.png" })).not.toContain("<img");
  });
});
