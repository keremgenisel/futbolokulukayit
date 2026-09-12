import { describe, it, expect } from "vitest";
import {
  aidatBaslangicDurumu,
  tesiseGirebilir,
  gorunenAidatDurumu,
  vadeTarihi,
  vadesiGectiMi,
  aidatEtiket,
  donemSonGunu,
  gecikmeGunu,
  paraTR,
  tarihTR,
  aidatHesapla,
  indirimYuzdesi,
  pasaportGecerliMi,
  pasaportNormalize,
  kimlikBilgisi,
  kimlikKisa,
  sayiAyikla,
  sayiBicimle,
  aidatDurumHesapla,
  aidatKalan,
  tcGecerliMi,
  gsmNormalize,
  gsmGecerliMi,
  yasGrubuOner,
  UCRET_TIPLERI,
  ayAraligi,
  ayEkle,
  gelecekAcikAidatMi,
} from "../src/lib/aidat.js";

describe("aidatBaslangicDurumu", () => {
  it("aktif + normal ücret → ödenmedi olarak açılır", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500 })).toBe("odenmedi");
  });
  it("ücretsiz her zaman muaf; burslu 0 ₺ ise muaf, kısmi bursta ödeme bekler", () => {
    expect(aidatBaslangicDurumu({ durum: "deneme", ucret_tipi: "ucretsiz", aylik_aidat: 0 })).toBe("muaf");
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "ucretsiz", aylik_aidat: 3500 })).toBe("muaf");
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "burslu", aylik_aidat: 0 })).toBe("muaf");
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "burslu", aylik_aidat: 1750 })).toBe("odenmedi");
  });
  it("indirimli ve kardeş indirimi ödeme bekler", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "indirimli", aylik_aidat: 2500 })).toBe("odenmedi");
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "kardes", aylik_aidat: 3000 })).toBe("odenmedi");
  });
  it("dondurma, pasif, ayrıldı → kayıt açılmaz", () => {
    for (const d of ["dondurma", "pasif", "ayrildi"]) {
      expect(aidatBaslangicDurumu({ durum: d, ucret_tipi: "normal", aylik_aidat: 3500 })).toBeNull();
    }
  });
  it("tutar 0 ise muaf", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "normal", aylik_aidat: 0 })).toBe("muaf");
  });
});

describe("tesiseGirebilir", () => {
  it("ödendi veya muaf → girebilir", () => {
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "odendi" })).toBe(true);
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "muaf" })).toBe(true);
  });
  it("ödenmedi veya kayıt yok → giremez", () => {
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "odenmedi" })).toBe(false);
    expect(tesiseGirebilir({ durum: "aktif" }, null)).toBe(false);
  });
  it("dondurmadaki oyuncu ödese bile giremez", () => {
    expect(tesiseGirebilir({ durum: "dondurma" }, { durum: "odendi" })).toBe(false);
  });
});

describe("ödeme dönemi", () => {
  it("dönem son günleri", () => {
    expect(donemSonGunu("1-10", 2026, 9)).toBe(10);
    expect(donemSonGunu("11-20", 2026, 9)).toBe(20);
    expect(donemSonGunu("21-31", 2026, 9)).toBe(30);
    expect(donemSonGunu("21-31", 2026, 2)).toBe(28);
  });
  it("gecikme günü hesaplanır, dönem geçmediyse 0", () => {
    expect(gecikmeGunu("1-10", 2026, 9, new Date(2026, 8, 16))).toBe(6);
    expect(gecikmeGunu("1-10", 2026, 9, new Date(2026, 8, 5))).toBe(0);
  });
});

describe("biçimleme", () => {
  it("para ve tarih Türkçe", () => {
    expect(paraTR(3500)).toBe("3.500 ₺");
    expect(paraTR(4850.5)).toBe("4.850,5 ₺");
    expect(tarihTR("2015-11-02")).toBe("02.11.2015");
    expect(tarihTR("")).toBe("");
  });
});

describe("aidatHesapla / indirimYuzdesi", () => {
  it("varsayılanlar: normal tam, burslu ve ücretsiz 0, indirimli/kardeş tam", () => {
    expect(aidatHesapla(3500, "normal")).toBe(3500);
    expect(aidatHesapla(3500, "burslu")).toBe(0);
    expect(aidatHesapla(3500, "ucretsiz")).toBe(0);
    expect(aidatHesapla(3500, "indirimli")).toBe(3500);
    expect(aidatHesapla(3500, "kardes")).toBe(3500);
  });
  it("ayarlardaki yüzdeler uygulanır, tam liraya yuvarlanır", () => {
    const ind = { indirimli: 25, kardes: "15", burslu: 50 };
    expect(aidatHesapla(3500, "indirimli", ind)).toBe(2625);
    expect(aidatHesapla(3500, "kardes", ind)).toBe(2975);
    expect(aidatHesapla(3500, "burslu", ind)).toBe(1750);
    expect(aidatHesapla(3333, "indirimli", { indirimli: 33 })).toBe(2233);
  });
  it("sabit tipler ayarla değişmez; yüzde 0-100 arasına sıkışır; bozuk değer varsayılana döner", () => {
    expect(aidatHesapla(3500, "normal", { normal: 50 })).toBe(3500);
    expect(aidatHesapla(3500, "ucretsiz", { ucretsiz: 0 })).toBe(0);
    expect(indirimYuzdesi("indirimli", 150)).toBe(100);
    expect(indirimYuzdesi("indirimli", -5)).toBe(0);
    expect(indirimYuzdesi("kardes", "abc")).toBe(0);
    expect(indirimYuzdesi("burslu", "")).toBe(100);
    expect(aidatHesapla(-10, "normal")).toBe(0);
  });
});

describe("kimlik: TC / pasaport", () => {
  it("pasaport doğrulama ve normalize (büyük harf, boşluksuz)", () => {
    expect(pasaportGecerliMi("u1234567")).toBe(true);
    expect(pasaportGecerliMi("AB12")).toBe(false);
    expect(pasaportGecerliMi("")).toBe(false);
    expect(pasaportGecerliMi("A-1234567")).toBe(false);
    expect(pasaportNormalize(" u 1234567 ")).toBe("U1234567");
    expect(pasaportNormalize("ıi123456")).toBe("Iİ123456");
  });
  it("kimlik etiketi uyruğa göre TC ya da pasaport", () => {
    expect(kimlikBilgisi({ uyruk: "tc", tc_no: "12345678901" })).toEqual({ etiket: "TC Kimlik No", deger: "12345678901" });
    expect(kimlikBilgisi({ uyruk: "yabanci", tc_no: null, pasaport_no: "U1234567" })).toEqual({ etiket: "Pasaport No", deger: "U1234567" });
    expect(kimlikBilgisi({ tc_no: "1" }).etiket).toBe("TC Kimlik No"); // uyruk eski kayıtta yoksa TC
    expect(kimlikKisa({ uyruk: "tc", tc_no: "12345678901" })).toBe("TC 12345678901");
    expect(kimlikKisa({ uyruk: "yabanci", pasaport_no: "U1234567" })).toBe("Pasaport U1234567");
    expect(kimlikKisa({ uyruk: "tc", tc_no: null })).toBe("Kimlik yok");
  });
});

describe("para girişi biçimleme", () => {
  it("rakamları ayıklar, binlik noktayla biçimler", () => {
    expect(sayiAyikla("5.000 ₺")).toBe("5000");
    expect(sayiAyikla("abc")).toBe("");
    expect(sayiAyikla("007")).toBe("7");
    expect(sayiAyikla(3500)).toBe("3500");
    expect(sayiBicimle("5000")).toBe("5.000");
    expect(sayiBicimle(1234567)).toBe("1.234.567");
    expect(sayiBicimle("")).toBe("");
    expect(sayiBicimle(null)).toBe("");
    expect(sayiBicimle("0")).toBe("0");
  });
});

describe("kısmi ödeme", () => {
  it("durum ödenen tutara göre: 0 ödenmedi, eksik kısmi, tam ödendi, muaf değişmez", () => {
    expect(aidatDurumHesapla(3500, 0)).toBe("odenmedi");
    expect(aidatDurumHesapla(3500, 1500)).toBe("kismi");
    expect(aidatDurumHesapla(3500, 3500)).toBe("odendi");
    expect(aidatDurumHesapla(3500, 4000)).toBe("odendi");
    expect(aidatDurumHesapla(0, 0, "muaf")).toBe("muaf");
  });
  it("kalan borç", () => {
    expect(aidatKalan({ tutar: 3500, odenen: 1500, durum: "kismi" })).toBe(2000);
    expect(aidatKalan({ tutar: 3500, odenen: 0, durum: "odenmedi" })).toBe(3500);
    expect(aidatKalan({ tutar: 3500, odenen: 3500, durum: "odendi" })).toBe(0);
    expect(aidatKalan({ tutar: 0, odenen: 0, durum: "muaf" })).toBe(0);
    expect(aidatKalan(null)).toBe(0);
  });
  it("kısmi ödemeyle tesise girilemez", () => {
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "kismi" })).toBe(false);
  });
});

describe("TC / GSM doğrulama ve yaş grubu önerisi", () => {
  it("TC sağlama algoritması", () => {
    expect(tcGecerliMi("10000000146")).toBe(true); // bilinen geçerli test numarası
    expect(tcGecerliMi("12345678901")).toBe(false); // sağlama tutmaz
    expect(tcGecerliMi("01234567890")).toBe(false); // 0 ile başlayamaz
    expect(tcGecerliMi("1234567890")).toBe(false); // 10 hane
    expect(tcGecerliMi("")).toBe(false);
  });
  it("GSM normalize ve doğrulama", () => {
    expect(gsmNormalize("+90 532 123 45 67")).toBe("05321234567");
    expect(gsmNormalize("532-123-4567")).toBe("05321234567");
    expect(gsmGecerliMi("0532 123 45 67")).toBe(true);
    expect(gsmGecerliMi("0212 123 45 67")).toBe(false);
    expect(gsmGecerliMi("532")).toBe(false);
  });
  it("yaş grubu önerisi: sezon bitiş yılı − doğum yılı", () => {
    const g = [
      { id: 1, ad: "U11", aktif: 1 },
      { id: 2, ad: "U 12", aktif: 1 },
      { id: 3, ad: "U13", aktif: 0 },
    ];
    expect(yasGrubuOner("2016-05-05", "2026-2027", g)).toEqual({ ad: "U11", id: 1, adaylar: [{ id: 1, ad: "U11" }] });
    expect(yasGrubuOner("2015-01-01", "2026-2027", g)).toEqual({ ad: "U12", id: 2, adaylar: [{ id: 2, ad: "U 12" }] });
    expect(yasGrubuOner("2014-01-01", "2026-2027", g)).toEqual({ ad: "U13", id: null, adaylar: [] }); // pasif grup önerilmez
    expect(yasGrubuOner("2000-01-01", "2026-2027", g)).toBeNull(); // 27 → aralık dışı
    expect(yasGrubuOner("", "2026-2027", g)).toBeNull();
    expect(yasGrubuOner("2016-01-01", "", g)).toBeNull();
  });
  it("yaş grubu önerisi: kalabalık yılda alt gruplar (U11 A / U11 B) aday olur, U1 → U11 karışmaz", () => {
    const g = [
      { id: 1, ad: "U11 A", aktif: 1 },
      { id: 2, ad: "U11 B", aktif: 1 },
      { id: 3, ad: "U11 C", aktif: 0 },
      { id: 4, ad: "U1", aktif: 1 },
      { id: 5, ad: "U12 Kız", aktif: 1 },
    ];
    expect(yasGrubuOner("2016-05-05", "2026-2027", g)).toEqual({
      ad: "U11",
      id: null,
      adaylar: [
        { id: 1, ad: "U11 A" },
        { id: 2, ad: "U11 B" },
      ],
    });
    expect(yasGrubuOner("2015-05-05", "2026-2027", g)).toEqual({ ad: "U12", id: 5, adaylar: [{ id: 5, ad: "U12 Kız" }] }); // tek alt grup → doğrudan seçilebilir
    expect(yasGrubuOner("2026-01-01", "2026-2027", g)).toBeNull(); // U1 aralık dışı
    // tam ad varsa alt gruplar yerine o gelir
    expect(yasGrubuOner("2016-05-05", "2026-2027", [...g, { id: 9, ad: "U11", aktif: 1 }])).toEqual({
      ad: "U11",
      id: 9,
      adaylar: [{ id: 9, ad: "U11" }],
    });
  });

  it("varsayılan ücret tipi sırası: normal, ücretsiz, burslu, indirimli, kardeş (09.09.2026)", () => {
    expect(UCRET_TIPLERI.map((t) => t.kod)).toEqual(["normal", "ucretsiz", "burslu", "indirimli", "kardes"]);
  });
});

describe("ayAraligi / ayEkle (Tahsilat > Uzun Dönem Seç, plan §24)", () => {
  it("aynı yıl içinde ay listesi, kronolojik", () => {
    expect(ayAraligi(2026, 9, 2026, 12)).toEqual([
      { yil: 2026, ay: 9 },
      { yil: 2026, ay: 10 },
      { yil: 2026, ay: 11 },
      { yil: 2026, ay: 12 },
    ]);
  });
  it("yıl sınırını aşan aralık (Aralık → Şubat)", () => {
    expect(ayAraligi(2026, 12, 2027, 2)).toEqual([
      { yil: 2026, ay: 12 },
      { yil: 2027, ay: 1 },
      { yil: 2027, ay: 2 },
    ]);
  });
  it("bitiş başlangıçtan önceyse yer değiştirir (elle aralıkta ters seçim)", () => {
    expect(ayAraligi(2027, 2, 2026, 9)).toEqual(ayAraligi(2026, 9, 2027, 2));
  });
  it("tek ay (başlangıç=bitiş) tek elemanlı liste döner", () => {
    expect(ayAraligi(2026, 9, 2026, 9)).toEqual([{ yil: 2026, ay: 9 }]);
  });
  it("ayEkle: N ay sonrası, yıl taşmasını doğru hesaplar", () => {
    expect(ayEkle(2026, 9, 5)).toEqual({ yil: 2027, ay: 2 }); // 6 ay seçimi: Eylül + 5 = Şubat (6 ay toplam)
    expect(ayEkle(2026, 9, 2)).toEqual({ yil: 2026, ay: 11 });
    expect(ayEkle(2026, 12, 1)).toEqual({ yil: 2027, ay: 1 });
  });
});

describe("gelecekAcikAidatMi (ileri tarihli açık ay borç değil, plan §24.3c)", () => {
  it("ileri ay + ödenmedi + hiç ödeme yok → true; bu ay/geçmiş, kısmi, ödendi, muaf → false", () => {
    expect(gelecekAcikAidatMi({ yil: 2027, ay: 3, durum: "odenmedi", odenen: 0 }, 2026, 9)).toBe(true);
    expect(gelecekAcikAidatMi({ yil: 2026, ay: 10, durum: "odenmedi" }, 2026, 9)).toBe(true); // odenen alanı yoksa da
    expect(gelecekAcikAidatMi({ yil: 2026, ay: 9, durum: "odenmedi", odenen: 0 }, 2026, 9)).toBe(false); // vadesi geldi
    expect(gelecekAcikAidatMi({ yil: 2026, ay: 6, durum: "odenmedi", odenen: 0 }, 2026, 9)).toBe(false);
    expect(gelecekAcikAidatMi({ yil: 2027, ay: 1, durum: "kismi", odenen: 1000 }, 2026, 9)).toBe(false);
    expect(gelecekAcikAidatMi({ yil: 2027, ay: 1, durum: "odendi", odenen: 5000 }, 2026, 9)).toBe(false);
    expect(gelecekAcikAidatMi({ yil: 2027, ay: 1, durum: "muaf", odenen: 0 }, 2026, 9)).toBe(false);
  });
  it("vade (plan §38): dönem son günü, sınır günü, görünen durum ve tesise giriş", () => {
    expect(vadeTarihi("1-10", 2026, 9)).toBe("2026-09-10");
    expect(vadeTarihi("11-20", 2026, 9)).toBe("2026-09-20");
    expect(vadeTarihi("21-31", 2026, 9)).toBe("2026-09-30");
    expect(vadeTarihi("21-31", 2028, 2)).toBe("2028-02-29");
    expect(vadesiGectiMi("11-20", 2026, 9, "2026-09-20")).toBe(false); // vade günü ödeme günü
    expect(vadesiGectiMi("11-20", 2026, 9, "2026-09-21")).toBe(true);
    expect(gorunenAidatDurumu("odenmedi", 0)).toBe("bekliyor");
    expect(gorunenAidatDurumu("kismi", 0)).toBe("bekliyor");
    expect(gorunenAidatDurumu("odenmedi", 1)).toBe("odenmedi");
    expect(gorunenAidatDurumu("odenmedi", undefined)).toBe("odenmedi"); // eski çağıran: vade bilgisi yoksa borç
    expect(gorunenAidatDurumu("odendi", 0)).toBe("odendi");
    expect(gorunenAidatDurumu(null, 0)).toBeNull();
    expect(aidatEtiket("bekliyor")).toBe("Vadesi gelmedi");
    const o = { durum: "aktif" };
    expect(tesiseGirebilir(o, { durum: "odenmedi", vade_gecti: 0 })).toBe(true); // vadesi gelmedi → girebilir
    expect(tesiseGirebilir(o, { durum: "odenmedi", vade_gecti: 1 })).toBe(false);
    expect(tesiseGirebilir(o, { durum: "odenmedi" })).toBe(false); // vade bilgisi yok → eski davranış
    expect(tesiseGirebilir({ durum: "dondurma" }, { durum: "odenmedi", vade_gecti: 0 })).toBe(false);
  });
});
