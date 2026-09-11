import { describe, it, expect } from "vitest";
import {
  waNumara,
  sablonDoldur,
  waBaglanti,
  hatirlatmaUygunMu,
  aidatDegerleri,
  antrenmanDegerleri,
  grupDegerleri,
  VARSAYILAN_SABLONLAR,
  YER_TUTUCULAR,
} from "../src/lib/whatsapp.js";

describe("WhatsApp saf mantık", () => {
  it("waNumara: 05xx, +90, boşluklu biçimler 905… olur; geçersiz boş", () => {
    expect(waNumara("0532 123 45 67")).toBe("905321234567");
    expect(waNumara("+90 532 123 45 67")).toBe("905321234567");
    expect(waNumara("905321234567")).toBe("905321234567");
    expect(waNumara("532 123 45 67")).toBe("905321234567");
    expect(waNumara("0212 123 45 67")).toBe(""); // sabit hat
    expect(waNumara("")).toBe("");
    expect(waNumara(null)).toBe("");
  });
  it("sablonDoldur: yer tutucular dolar, bilinmeyen boşalır, boşluklar sadeleşir, satır sonu korunur", () => {
    expect(
      sablonDoldur("Sayın {veli}, {oyuncu} için {ay} aidatı ({kalan}).\n{kulup}", {
        veli: "Ayşe Yıldız",
        oyuncu: "Kaan",
        ay: "Eylül 2026",
        kalan: "3.500 ₺",
        kulup: "Eyüpspor",
      }),
    ).toBe("Sayın Ayşe Yıldız, Kaan için Eylül 2026 aidatı (3.500 ₺).\nEyüpspor");
    expect(sablonDoldur("İptal. {neden} {kulup}", { neden: "", kulup: "K" })).toBe("İptal. K");
    expect(sablonDoldur("{bilinmeyen} x", {})).toBe("x");
  });
  it("waBaglanti: wa.me ve URL kodlu metin (satır sonu, Türkçe harf)", () => {
    const u = waBaglanti("905321234567", "Sayın Ayşe,\nmerhaba");
    expect(u).toBe("https://wa.me/905321234567?text=Say%C4%B1n%20Ay%C5%9Fe%2C%0Amerhaba");
  });
  it("numarasız bağlantı sohbet seçme ekranını açar (grup); grup değerleri hitabı 'Veliler' yapar", () => {
    expect(waBaglanti("", "Merhaba")).toBe("https://wa.me/?text=Merhaba");
    const d = grupDegerleri(
      antrenmanDegerleri(
        { tarih: "2026-09-08", saat: "18:30", yas_grubu_ad: "U11", iptal_nedeni: "İptal" },
        { veli_ad: "Ayşe", ad_soyad: "Kaan" },
      ),
    );
    expect(sablonDoldur(VARSAYILAN_SABLONLAR.iptal, d)).toBe(
      "Sayın Veliler, U11 grubunun 8 Eylül 2026 Salı 18:30 antrenmanı iptal edilmiştir.\nFutbol Okulu",
    );
  });
  it("hatirlatmaUygunMu: numara yok / onay yok / uygun", () => {
    expect(hatirlatmaUygunMu({ numara: "", onay: 1 })).toEqual({ ok: false, neden: "Veli numarası yok", numara: "" });
    expect(hatirlatmaUygunMu({ numara: "05321234567", onay: 0 })).toEqual({ ok: false, neden: "Mesaj onayı yok", numara: "905321234567" });
    expect(hatirlatmaUygunMu({ numara: "05321234567", onay: 1 })).toEqual({ ok: true, neden: "", numara: "905321234567" });
    expect(hatirlatmaUygunMu({ numara: "05321234567" }).ok).toBe(true); // onay alanı yoksa (eski satır) engellenmez
  });
  it("aidatDegerleri ve varsayılan aidat şablonu birlikte anlamlı mesaj üretir", () => {
    const d = aidatDegerleri({
      veli_ad: "Ayşe Yıldız",
      ad_soyad: "Kaan Yıldız",
      yil: 2026,
      ay: 9,
      tutar: 3500,
      kalan: 2500,
      odeme_donemi: "1-10",
      yas_grubu_ad: "U11",
    });
    expect(d).toMatchObject({
      veli: "Ayşe Yıldız",
      ay: "Eylül 2026",
      tutar: "3.500 ₺",
      kalan: "2.500 ₺",
      donem: "1-10",
      grup: "U11",
      kulup: "Futbol Okulu",
    });
    const m = sablonDoldur(VARSAYILAN_SABLONLAR.aidat, d);
    expect(m).toContain("Kaan Yıldız için Eylül 2026 aidatı (2.500 ₺)");
    expect(m).toContain("her ayın 1-10 günleridir");
    expect(m.endsWith("Futbol Okulu")).toBe(true);
  });
  it("antrenmanDegerleri: değişiklik notundan eski tarih/saat, iptal nedeni 'İptal' ise boş", () => {
    const t = {
      tarih: "2026-09-08",
      saat: "18:30",
      saha: "Saha 2",
      yas_grubu_ad: "U11",
      degisiklik_notu: JSON.stringify({ eskiTarih: "2026-09-07", eskiSaat: "17:00" }),
    };
    const d = antrenmanDegerleri(t, { veli_ad: "Ayşe", ad_soyad: "Kaan" });
    expect(d).toMatchObject({
      eskiTarih: "7 Eylül 2026 Pazartesi",
      eskiSaat: "17:00",
      yeniTarih: "8 Eylül 2026 Salı",
      yeniSaat: "18:30",
      saha: "Saha 2",
      grup: "U11",
    });
    expect(sablonDoldur(VARSAYILAN_SABLONLAR.degisiklik, d)).toBe(
      "Sayın Ayşe, U11 grubunun 7 Eylül 2026 Pazartesi 17:00 antrenmanı 8 Eylül 2026 Salı 18:30 saatine alınmıştır (Saha 2).\nFutbol Okulu",
    );
    const ip = antrenmanDegerleri({ tarih: "2026-09-08", saat: "18:30", yas_grubu_ad: "U11", iptal_nedeni: "İptal" }, { ad_soyad: "Kaan" });
    expect(sablonDoldur(VARSAYILAN_SABLONLAR.iptal, ip)).toBe(
      "Sayın Veli, U11 grubunun 8 Eylül 2026 Salı 18:30 antrenmanı iptal edilmiştir.\nFutbol Okulu",
    );
    expect(antrenmanDegerleri({ tarih: "2026-09-08", degisiklik_notu: "bozuk{", yas_grubu_ad: "U9" }, { ad_soyad: "A" }).eskiTarih).toBe(
      "8 Eylül 2026 Salı",
    );
  });
  it("her varsayılan şablon yalnız bilinen yer tutucuları kullanır", () => {
    for (const s of Object.values(VARSAYILAN_SABLONLAR)) for (const m of s.matchAll(/\{(\w+)\}/g)) expect(YER_TUTUCULAR).toContain(m[1]);
  });
  it("antrenmanDegerleri: bitiş saati varsa {saat} aralık olur, {bitis} ayrı; değişiklik notundaki eski bitiş de aralığa girer (plan §37)", () => {
    const d = antrenmanDegerleri(
      { tarih: "2026-09-07", saat: "17:00", bitis_saat: "18:30", saha: "Saha 1", yas_grubu_ad: "U11" },
      { ad_soyad: "Kaan" },
    );
    expect(d.saat).toBe("17:00–18:30");
    expect(d.bitis).toBe("18:30");
    expect(d.yeniSaat).toBe("17:00–18:30");
    const e = antrenmanDegerleri(
      {
        tarih: "2026-09-08",
        saat: "18:00",
        bitis_saat: "19:30",
        yas_grubu_ad: "U11",
        degisiklik_notu: JSON.stringify({ eskiTarih: "2026-09-07", eskiSaat: "17:00", eskiBitis: "18:30" }),
      },
      { ad_soyad: "Kaan" },
    );
    expect(e.eskiSaat).toBe("17:00–18:30");
    expect(e.yeniSaat).toBe("18:00–19:30");
    expect(antrenmanDegerleri({ tarih: "2026-09-07", saat: "17:00" }, { ad_soyad: "K" }).saat).toBe("17:00"); // bitişsiz eski kayıt
  });
});
