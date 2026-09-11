// Tema mantığı (plan §32.4): türetilen tonlar, kontrast, hazır paletler, logodan renk çıkarma; CJS ikizi (electron/tema.cjs) ile
// aynı sonuç; ayar doğrulaması (electron/ayarDogrula.cjs); marka hesabı (electron/marka.cjs).
import { describe, it, expect } from "vitest";
import {
  temaTuret,
  kontrastOrani,
  karistir,
  renkGecerliMi,
  PRESETLER,
  VARSAYILAN_TEMA,
  logodanRenkler,
  logodanPalet,
  rgbToHsl,
} from "../src/lib/tema.js";
import * as temaCjs from "../electron/tema.cjs";
import { ayarDogrula } from "../electron/ayarDogrula.cjs";
import { markaHesapla } from "../electron/marka.cjs";

describe("tema.js", () => {
  it("varsayılan tema bugünkü mor/sarı; türetilen tonlar ui.css ile uyumlu (koyu, açık, ana üstü beyaz)", () => {
    const t = temaTuret({});
    expect(t.mor).toBe("#5b2d8e");
    expect(t.sari).toBe("#f5d000");
    expect(t.morKoyu).toBe(karistir("#5b2d8e", "#000000", 0.3));
    expect(t.morAcik).toBe(karistir("#5b2d8e", "#ffffff", 0.88));
    expect(t.anaUstuMetin).toBe("#ffffff");
    expect(t.vurguUstuMetin).toBe(t.morKoyu); // sarı düğme üstünde koyu mor (bugünkü "Makbuz Kes")
    expect(t.anaOkunakli).toBe(true);
    expect(t.kontrast).toBeGreaterThan(7);
  });
  it("geçersiz renk varsayılana düşer; geçerli renk küçük harfe çevrilir", () => {
    expect(temaTuret({ ana: "kırmızı", vurgu: "#GGGGGG" })).toMatchObject(VARSAYILAN_TEMA.ana ? { mor: "#5b2d8e", sari: "#f5d000" } : {});
    expect(temaTuret({ ana: "#C8102E" }).mor).toBe("#c8102e");
    expect(renkGecerliMi("#abc")).toBe(false);
    expect(renkGecerliMi("#AABBCC")).toBe(true);
  });
  it("açık ana renkte (sarı) yazı koyuya döner ve anaOkunakli false", () => {
    const t = temaTuret({ ana: "#f5d000", vurgu: "#5b2d8e" });
    expect(t.anaUstuMetin).toBe("#1b1530");
    expect(t.anaOkunakli).toBe(false);
  });
  it("beyaz vurguda açık ton görünmez olmasın diye ana rengin açık tonu kullanılır", () => {
    const t = temaTuret({ ana: "#c8102e", vurgu: "#ffffff" });
    expect(t.sariAcik).toBe(t.morAcik);
    expect(t.vurguUstuMetin).toBe(t.morKoyu); // beyaz düğme üstünde koyu kırmızı yazı
  });
  it("kontrast oranı WCAG: siyah/beyaz 21, aynı renk 1", () => {
    expect(kontrastOrani("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(kontrastOrani("#5b2d8e", "#5b2d8e")).toBe(1);
  });
  it("hazır paletlerin hepsi geçerli renk ve ana renk üzerinde beyaz okunaklı", () => {
    expect(PRESETLER.length).toBeGreaterThanOrEqual(6);
    for (const p of PRESETLER) {
      expect(renkGecerliMi(p.ana) && renkGecerliMi(p.vurgu)).toBe(true);
      expect(temaTuret(p).anaOkunakli).toBe(true);
    }
    expect(PRESETLER[0]).toMatchObject(VARSAYILAN_TEMA);
  });
  it("CJS ikizi aynı karışımı ve doğrulamayı üretir (Excel başlık dolgusu = morAcik)", () => {
    for (const p of PRESETLER) {
      expect(temaCjs.acikTon(p.ana)).toBe(temaTuret(p).morAcik);
      expect(temaCjs.karistir(p.ana, "#000000", 0.3)).toBe(karistir(p.ana, "#000000", 0.3));
    }
    expect(temaCjs.acikTon("bozuk")).toBe(temaTuret({}).morAcik);
    expect(temaCjs.renkGecerliMi("#12ab34")).toBe(true);
    expect(temaCjs.VARSAYILAN_TEMA).toEqual(VARSAYILAN_TEMA);
  });
  it("logodan renkler: lacivert+turuncu+beyaz logo → iki doygun renk ve beyaz; gri/şeffaf sayılmaz", () => {
    const px = [];
    const ekle = (r, g, b, a, n) => {
      for (let i = 0; i < n; i++) px.push(r, g, b, a);
    };
    ekle(31, 58, 147, 255, 500); // lacivert
    ekle(245, 130, 32, 255, 300); // turuncu
    ekle(255, 255, 255, 255, 400); // beyaz
    ekle(128, 128, 128, 255, 200); // gri (atlanır)
    ekle(255, 0, 0, 10, 900); // şeffaf kırmızı (atlanır)
    const c = logodanRenkler(px);
    expect(c.renkler.length).toBe(2);
    expect(rgbToHsl(...[31, 58, 147])[0]).toBeGreaterThan(200); // lacivert ton
    expect(c.renkler[0]).toBe("#1f3a93");
    expect(c.renkler[1]).toBe("#f58220");
    expect(c.beyazVar).toBe(true);
    const p = logodanPalet(c);
    expect(p).toEqual({ ana: "#1f3a93", vurgu: "#f58220" });
  });
  it("logodan palet: tek renk + beyaz → vurgu beyaz; açık ana ile koyu ikinci yer değiştirir; boş → null", () => {
    expect(logodanPalet({ renkler: ["#0f7b3e"], beyazVar: true })).toEqual({ ana: "#0f7b3e", vurgu: "#ffffff" });
    expect(logodanPalet({ renkler: ["#0f7b3e"], beyazVar: false })).toEqual({ ana: "#0f7b3e", vurgu: VARSAYILAN_TEMA.vurgu });
    expect(logodanPalet({ renkler: ["#ffd100", "#1a1a5e"], beyazVar: false })).toEqual({ ana: "#1a1a5e", vurgu: "#ffd100" });
    expect(logodanPalet({ renkler: [], beyazVar: true })).toBeNull();
  });
});

describe("ayarDogrula (ana süreç)", () => {
  it("tema renkleri #rrggbb, küçük harf; boş silmek için serbest", () => {
    expect(ayarDogrula("tema_ana", "#C8102E")).toBe("#c8102e");
    expect(ayarDogrula("tema_vurgu", "")).toBe("");
    expect(() => ayarDogrula("tema_ana", "red")).toThrow(/#rrggbb/);
    expect(() => ayarDogrula("tema_ana", "#fff; background:url(x)")).toThrow();
  });
  it("kuruluş yılı 4 hane ya da boş; kulüp metinleri kırpılır, satır sonu temizlenir, uzunluk sınırı", () => {
    expect(ayarDogrula("kurulus_yili", " 1974 ")).toBe("1974");
    expect(ayarDogrula("kurulus_yili", "")).toBe("");
    expect(() => ayarDogrula("kurulus_yili", "74")).toThrow(/4 haneli/);
    expect(ayarDogrula("kulup_kisa_ad", "  ANADOLU\nSK ")).toBe("ANADOLU SK");
    expect(() => ayarDogrula("kulup_kisa_ad", "x".repeat(41))).toThrow(/40/);
    expect(() => ayarDogrula("kulup_adi", "x".repeat(81))).toThrow(/80/);
  });
  it("kulup_logo yalnız kulup/logo.png|jpg ya da boş; diğer anahtarlar olduğu gibi", () => {
    expect(ayarDogrula("kulup_logo", "kulup/logo.png")).toBe("kulup/logo.png");
    expect(() => ayarDogrula("kulup_logo", "../etc/passwd")).toThrow();
    expect(ayarDogrula("yedek_sikligi", "gunluk")).toBe("gunluk");
    expect(ayarDogrula("aktif_sezon", null)).toBe("");
  });
});

describe("markaHesapla", () => {
  const ayar = (o) => (k) => o[k] ?? null;
  it("boş ayarlarda uygulama varsayılanları: Futbol Okulu, alt yazı Kayıt Programı, kuruluş boş, logo yok, mor/sarı", () => {
    expect(markaHesapla(ayar({}))).toEqual({
      kulupAdi: "Futbol Okulu",
      kisaAd: "Futbol Okulu",
      altYazi: "Kayıt Programı",
      kurulusYili: "",
      logo: "",
      tema: VARSAYILAN_TEMA,
    });
  });
  it("kısa ad yoksa kulüp adı; kısa ad varsa alt yazı 'Futbol Okulu'; geçersiz tema rengi varsayılana düşer", () => {
    expect(markaHesapla(ayar({ kulup_adi: "Anadolu SK Futbol Okulu" })).kisaAd).toBe("Anadolu SK Futbol Okulu");
    const m = markaHesapla(
      ayar({
        kulup_adi: "Anadolu SK Futbol Okulu",
        kulup_kisa_ad: "ANADOLU SK",
        kurulus_yili: "1974",
        tema_ana: "#1F3A93",
        tema_vurgu: "bozuk",
      }),
      "data:image/png;base64,AAA",
    );
    expect(m).toMatchObject({
      kisaAd: "ANADOLU SK",
      altYazi: "Futbol Okulu",
      kurulusYili: "1974",
      logo: "data:image/png;base64,AAA",
      tema: { ana: "#1f3a93", vurgu: "#f5d000" },
    });
  });
});
