// @ts-check
// Raporlar ekranının SAF rapor üreticileri (refactor §3.4): veritabanından gelen satırları alır,
// { baslik, alt, yatay?, sutunlar, satirlar } döner. Önizleme, Excel ve PDF aynı yapıyı kullanır.
// Veri çekme (db çağrıları) bileşende kalır; burada yalnız dönüşüm ve metin vardır.
import { AY_ADLARI, ODEME_YONTEMLERI, DURUMLAR, tarihTR, paraTR, aidatEtiket } from "./aidat.js";

export const RAPORLAR = [
  { kod: "oyuncu", ad: "Oyuncu Listesi", aciklama: "Tüm oyuncular, grup, durum, ücret tipi ve seçilen ayın aidat durumu" },
  { kod: "borclu", ad: "Borçlu Listesi", aciklama: "Seçilen ayda aidatı ödenmemiş oyuncular ve veli telefonları" },
  { kod: "tahsilat", ad: "Tahsilat Raporu", aciklama: "Tarih aralığında kesilen makbuzlar, yöntem ve toplam" },
  { kod: "yoklama", ad: "Yoklama Özeti", aciklama: "Tarih aralığında oyuncu bazında geldi / gelmedi / izinli" },
  {
    kod: "saglik",
    ad: "Sağlık Raporu Durumu",
    aciklama: "Aktif oyuncuların sağlık raporu: süresi dolan, 30 gün içinde dolacak, yüklenmemiş ve geçerli (en acil önce)",
  },
];

/** @typedef {{ baslik: string, anahtar: string, genislik?: number, sag?: boolean }} Sutun */
/** @typedef {{ baslik: string, alt: string, yatay?: boolean, sutunlar: Sutun[], satirlar: Record<string, unknown>[] }} Rapor */

/**
 * Oyuncu listesi: seçilen ayın aidat durumuyla.
 * @param {{ liste: any[], yil: number, ay: number, grupEk?: string, ucretAd: (kod: string) => string, sezon?: string }} p
 * @returns {Rapor}
 */
export function oyuncuListesiRaporu({ liste, yil, ay, grupEk = "", ucretAd, sezon = "" }) {
  return {
    baslik: "Oyuncu Listesi",
    alt: `${AY_ADLARI[ay - 1]} ${yil}${sezon ? ` · ${sezon} sezonu` : ""}${grupEk}`,
    yatay: true,
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
      { baslik: "TC / Pasaport", anahtar: "tc", genislik: 16 },
      { baslik: "Doğum", anahtar: "dogum", genislik: 12 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      { baslik: "Durum", anahtar: "durum", genislik: 10 },
      { baslik: "Ücret tipi", anahtar: "ucret", genislik: 16 },
      { baslik: "Aidat", anahtar: "aidat", genislik: 10, sag: true },
      { baslik: "Aidat durumu", anahtar: "ad_durum", genislik: 14 },
      { baslik: "GSM", anahtar: "gsm", genislik: 16 },
    ],
    satirlar: liste.map((o) => ({
      ad: o.ad_soyad,
      tc: o.uyruk === "yabanci" ? "P: " + (o.pasaport_no || "") : o.tc_no || "",
      dogum: tarihTR(o.dogum_tarihi),
      grup: o.yas_grubu_ad || "",
      durum: DURUMLAR.find((d) => d.kod === o.durum)?.ad,
      ucret: ucretAd(o.ucret_tipi),
      aidat: o.aylik_aidat,
      ad_durum: aidatEtiket(o.aidat_durum),
      gsm: o.gsm || "",
    })),
  };
}

/**
 * Borçlu listesi: `veliler` oyuncu id → veli listesi (birincil veli, yoksa ilk veli).
 * @param {{ liste: any[], veliler: Record<number, any[]>, yil: number, ay: number, sezon?: string }} p
 * @returns {Rapor}
 */
export function borcluListesiRaporu({ liste, veliler, yil, ay, sezon = "" }) {
  const satirlar = liste.map((b) => {
    const v = veliler[b.player_id] || [];
    const veli = v.find((x) => x.veli_mi) || v[0];
    return {
      ad: b.ad_soyad,
      grup: b.yas_grubu_ad || "",
      tutar: b.kalan ?? b.tutar,
      donem: b.odeme_donemi,
      veli: veli?.ad_soyad || "",
      tel: veli?.whatsapp_no || veli?.gsm || "",
    };
  });
  return {
    baslik: "Borçlu Listesi",
    alt: `${AY_ADLARI[ay - 1]} ${yil}${sezon ? ` · ${sezon} sezonu` : ""} · ${liste.length} oyuncu · toplam ${paraTR(liste.reduce((s, b) => s + (b.kalan ?? b.tutar), 0))}`,
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      { baslik: "Tutar", anahtar: "tutar", genislik: 10, sag: true },
      { baslik: "Ödeme dönemi", anahtar: "donem", genislik: 14 },
      { baslik: "Veli", anahtar: "veli", genislik: 24 },
      { baslik: "Telefon", anahtar: "tel", genislik: 16 },
    ],
    satirlar,
  };
}

/**
 * Tahsilat raporu: geçerli makbuzlar + iptaller (tutar 0, açıklamada asıl tutar).
 * @param {{ makbuzlar: any[], iptaller: any[], from: string, to: string }} p
 * @returns {Rapor}
 */
export function tahsilatRaporu({ makbuzlar, iptaller, from, to }) {
  const toplam = makbuzlar.reduce((s, m) => s + m.toplam, 0);
  const yontemOzet = ODEME_YONTEMLERI.map(
    (y) => `${y.ad}: ${paraTR(makbuzlar.filter((m) => m.odeme_yontemi === y.kod).reduce((s, m) => s + m.toplam, 0))}`,
  ).join(" · ");
  /** @param {string} kod */
  const yontemAd = (kod) => ODEME_YONTEMLERI.find((y) => y.kod === kod)?.ad;
  return {
    baslik: "Tahsilat Raporu",
    alt: `${tarihTR(from)} – ${tarihTR(to)} · ${makbuzlar.length} makbuz · toplam ${paraTR(toplam)} · ${yontemOzet} · iptal: ${iptaller.length} makbuz (${paraTR(iptaller.reduce((s, m) => s + m.toplam, 0))})`,
    sutunlar: [
      { baslik: "Makbuz No", anahtar: "no", genislik: 12 },
      { baslik: "Tarih", anahtar: "tarih", genislik: 12 },
      { baslik: "Oyuncu", anahtar: "ad", genislik: 28 },
      { baslik: "Tutar", anahtar: "tutar", genislik: 10, sag: true },
      { baslik: "Yöntem", anahtar: "yontem", genislik: 14 },
      { baslik: "Tahsil eden", anahtar: "eden", genislik: 18 },
      { baslik: "Açıklama", anahtar: "not", genislik: 30 },
    ],
    satirlar: [
      ...makbuzlar.map((m) => ({
        no: m.makbuz_no,
        tarih: tarihTR(m.tarih),
        ad: m.ad_soyad,
        tutar: m.toplam,
        yontem: yontemAd(m.odeme_yontemi),
        eden: m.tahsil_eden,
        not: m.not_ || "",
      })),
      ...iptaller.map((m) => ({
        no: m.makbuz_no + " (İPTAL)",
        tarih: tarihTR(m.tarih),
        ad: m.ad_soyad,
        tutar: 0,
        yontem: yontemAd(m.odeme_yontemi),
        eden: m.tahsil_eden,
        not: `İptal: ${m.iptal_nedeni || ""}${m.iptal_eden ? " · " + m.iptal_eden : ""} · asıl tutar ${paraTR(m.toplam)}`,
      })),
    ],
  };
}

/** @type {Record<string, string>} */
const SAGLIK_ETIKET = { doldu: "Süresi doldu", dolacak: "Dolmak üzere", tarihsiz: "Tarihsiz rapor", yok: "Rapor yok", gecerli: "Geçerli" };

/**
 * Sağlık raporu durumu (db.saglikRaporuListesi çıktısı; en acil önce sıralı gelir).
 * @param {{ liste: any[], bugunIso: string, grupEk?: string }} p
 * @returns {Rapor}
 */
export function saglikRaporu({ liste, bugunIso, grupEk = "" }) {
  /** @param {string} d */
  const sayi = (d) => liste.filter((x) => x.durum === d).length;
  return {
    baslik: "Sağlık Raporu Durumu",
    alt: `${tarihTR(bugunIso)} itibarıyla${grupEk} · ${sayi("doldu")} doldu · ${sayi("dolacak")} dolacak · ${sayi("yok") + sayi("tarihsiz")} yok · ${sayi("gecerli")} geçerli`,
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      { baslik: "Veli telefonu", anahtar: "tel", genislik: 16 },
      { baslik: "Geçerlilik", anahtar: "gecerlilik", genislik: 12 },
      { baslik: "Kalan gün", anahtar: "kalan", genislik: 10, sag: true },
      { baslik: "Durum", anahtar: "durum", genislik: 16 },
    ],
    satirlar: liste.map((o) => ({
      ad: o.ad_soyad,
      grup: o.yas_grubu_ad || "",
      tel: o.veli_tel || "",
      gecerlilik: o.gecerlilik ? tarihTR(o.gecerlilik) : "",
      kalan: o.kalanGun === null ? "" : o.kalanGun,
      durum: SAGLIK_ETIKET[o.durum] || o.durum,
    })),
  };
}

/**
 * Yoklama özeti (db.attendanceReport çıktısı).
 * @param {{ liste: any[], from: string, to: string, grupEk?: string }} p
 * @returns {Rapor}
 */
export function yoklamaOzetiRaporu({ liste, from, to, grupEk = "" }) {
  return {
    baslik: "Yoklama Özeti",
    alt: `${tarihTR(from)} – ${tarihTR(to)}${grupEk}`,
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      { baslik: "Geldi", anahtar: "geldi", genislik: 8, sag: true },
      { baslik: "Gelmedi", anahtar: "gelmedi", genislik: 8, sag: true },
      { baslik: "İzinli", anahtar: "izinli", genislik: 8, sag: true },
      { baslik: "Katılım %", anahtar: "oran", genislik: 10, sag: true },
    ],
    satirlar: liste.map((o) => {
      const t = o.geldi + o.gelmedi + o.izinli;
      return {
        ad: o.ad_soyad,
        grup: o.yas_grubu_ad || "",
        geldi: o.geldi,
        gelmedi: o.gelmedi,
        izinli: o.izinli,
        oran: t ? Math.round((o.geldi / t) * 100) : "",
      };
    }),
  };
}
