import { describe, it, expect } from "vitest";
import {
  RAPORLAR,
  oyuncuListesiRaporu,
  borcluListesiRaporu,
  tahsilatRaporu,
  saglikRaporu,
  yoklamaOzetiRaporu,
} from "../src/lib/raporlar.js";

describe("rapor üreticileri (saf)", () => {
  it("beş rapor tanımı", () => {
    expect(RAPORLAR.map((r) => r.kod)).toEqual(["oyuncu", "borclu", "tahsilat", "yoklama", "saglik"]);
  });
  it("oyuncu listesi: pasaportlu oyuncu 'P:' ile, aidat durumu etiketli, yatay sayfa, grup eki alt başlıkta", () => {
    const r = oyuncuListesiRaporu({
      liste: [
        {
          ad_soyad: "Kaan",
          uyruk: "tc",
          tc_no: "123",
          dogum_tarihi: "2015-11-02",
          yas_grubu_ad: "U11",
          durum: "aktif",
          ucret_tipi: "normal",
          aylik_aidat: 3500,
          aidat_durum: "odenmedi",
          gsm: "",
        },
        {
          ad_soyad: "John",
          uyruk: "yabanci",
          pasaport_no: "AB1",
          dogum_tarihi: "2015-01-01",
          durum: "deneme",
          ucret_tipi: "burslu",
          aylik_aidat: 0,
          aidat_durum: null,
        },
      ],
      yil: 2026,
      ay: 9,
      grupEk: " · U11",
      ucretAd: (k) => k.toUpperCase(),
    });
    expect(r.baslik).toBe("Oyuncu Listesi");
    expect(r.alt).toBe("Eylül 2026 · U11");
    expect(r.yatay).toBe(true);
    expect(r.sutunlar.map((s) => s.anahtar)).toEqual(["ad", "tc", "dogum", "grup", "durum", "ucret", "aidat", "ad_durum", "gsm"]);
    expect(r.satirlar[0]).toEqual({
      ad: "Kaan",
      tc: "123",
      dogum: "02.11.2015",
      grup: "U11",
      durum: "Aktif",
      ucret: "NORMAL",
      aidat: 3500,
      ad_durum: "Ödenmedi",
      gsm: "",
    });
    expect(r.satirlar[1].tc).toBe("P: AB1");
    expect(r.satirlar[1].ad_durum).toBe("Kayıt yok");
    expect(r.satirlar[1].durum).toBe("Deneme");
  });
  it("borçlu listesi: birincil veli ve numarası, kalan tutar, toplam alt başlıkta", () => {
    const r = borcluListesiRaporu({
      liste: [
        { player_id: 1, ad_soyad: "Kaan", yas_grubu_ad: "U11", tutar: 3500, kalan: 2500, odeme_donemi: "1-10" },
        { player_id: 2, ad_soyad: "Ali", tutar: 3000, odeme_donemi: "1-10" },
      ],
      veliler: {
        1: [
          { ad_soyad: "Anne", gsm: "111", veli_mi: 0 },
          { ad_soyad: "Baba", gsm: "222", whatsapp_no: "333", veli_mi: 1 },
        ],
      },
      yil: 2026,
      ay: 9,
    });
    expect(r.alt).toBe("Eylül 2026 · 2 oyuncu · toplam 5.500 ₺");
    expect(r.satirlar[0]).toEqual({ ad: "Kaan", grup: "U11", tutar: 2500, donem: "1-10", veli: "Baba", tel: "333" });
    expect(r.satirlar[1]).toEqual({ ad: "Ali", grup: "", tutar: 3000, donem: "1-10", veli: "", tel: "" });
  });
  it("tahsilat: yöntem özeti, iptal makbuzlar 0 tutarla ve açıklamada asıl tutar", () => {
    const r = tahsilatRaporu({
      makbuzlar: [
        {
          makbuz_no: "2026-0001",
          tarih: "2026-09-01",
          ad_soyad: "Kaan",
          toplam: 3500,
          odeme_yontemi: "nakit",
          tahsil_eden: "Şerif",
          not_: "",
        },
        {
          makbuz_no: "2026-0002",
          tarih: "2026-09-02",
          ad_soyad: "Ali",
          toplam: 1000,
          odeme_yontemi: "havale",
          tahsil_eden: "Şerif",
          not_: "forma",
        },
      ],
      iptaller: [
        {
          makbuz_no: "2026-0003",
          tarih: "2026-09-03",
          ad_soyad: "Veli",
          toplam: 500,
          odeme_yontemi: "nakit",
          tahsil_eden: "Şerif",
          iptal_nedeni: "yanlış",
          iptal_eden: "admin",
        },
      ],
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(r.alt).toContain("01.09.2026 – 30.09.2026 · 2 makbuz · toplam 4.500 ₺");
    expect(r.alt).toContain("Nakit: 3.500 ₺");
    expect(r.alt).toContain("iptal: 1 makbuz (500 ₺)");
    expect(r.satirlar).toHaveLength(3);
    expect(r.satirlar[1]).toMatchObject({ no: "2026-0002", yontem: "Havale / EFT", not: "forma", tutar: 1000 });
    expect(r.satirlar[2]).toMatchObject({ no: "2026-0003 (İPTAL)", tutar: 0, not: "İptal: yanlış · admin · asıl tutar 500 ₺" });
  });
  it("sağlık raporu: sayımlar alt başlıkta, durum etiketleri, tarihsiz kalan gün boş", () => {
    const r = saglikRaporu({
      liste: [
        { ad_soyad: "A", yas_grubu_ad: "U11", veli_tel: "1", gecerlilik: "2026-08-01", kalanGun: -38, durum: "doldu" },
        { ad_soyad: "B", yas_grubu_ad: "U11", veli_tel: "", gecerlilik: null, kalanGun: null, durum: "tarihsiz" },
        { ad_soyad: "C", yas_grubu_ad: "U12", veli_tel: "", gecerlilik: null, kalanGun: null, durum: "yok" },
        { ad_soyad: "D", yas_grubu_ad: "U12", veli_tel: "", gecerlilik: "2027-05-05", kalanGun: 240, durum: "gecerli" },
      ],
      bugunIso: "2026-09-08",
      grupEk: "",
    });
    expect(r.alt).toBe("08.09.2026 itibarıyla · 1 doldu · 0 dolacak · 2 yok · 1 geçerli");
    expect(r.satirlar.map((s) => s.durum)).toEqual(["Süresi doldu", "Tarihsiz rapor", "Rapor yok", "Geçerli"]);
    expect(r.satirlar[0]).toMatchObject({ gecerlilik: "01.08.2026", kalan: -38 });
    expect(r.satirlar[1]).toMatchObject({ gecerlilik: "", kalan: "" });
  });
  it("yoklama özeti: katılım yüzdesi, hiç kaydı olmayanda boş", () => {
    const r = yoklamaOzetiRaporu({
      liste: [
        { ad_soyad: "A", yas_grubu_ad: "U11", geldi: 3, gelmedi: 1, izinli: 0 },
        { ad_soyad: "B", yas_grubu_ad: null, geldi: 0, gelmedi: 0, izinli: 0 },
      ],
      from: "2026-09-01",
      to: "2026-09-30",
      grupEk: " · U11",
    });
    expect(r.alt).toBe("01.09.2026 – 30.09.2026 · U11");
    expect(r.satirlar[0]).toEqual({ ad: "A", grup: "U11", geldi: 3, gelmedi: 1, izinli: 0, oran: 75 });
    expect(r.satirlar[1].oran).toBe("");
  });
});
