// @ts-check
// Raporlar ekranının SAF rapor üreticileri (refactor §3.4): veritabanından gelen satırları alır,
// { baslik, alt, yatay?, sutunlar, satirlar } döner. Önizleme, Excel ve PDF aynı yapıyı kullanır.
// Veri çekme (db çağrıları) bileşende kalır; burada yalnız dönüşüm ve metin vardır.
import { AY_ADLARI, ODEME_YONTEMLERI, DURUMLAR, tarihTR, paraTR, aidatEtiket } from "./aidat.js";

/** Dönem etiketi: ay seçiliyse "Eylül 2026 · 2026-2027 sezonu", Tümü ise "2026-2027 sezonu (tüm aylar)". @param {{ yil?: number|null, ay?: number|null, sezon?: string }} p */
export function donemEtiketi({ yil, ay, sezon = "" }) {
  if (ay) return `${AY_ADLARI[ay - 1]} ${yil}${sezon ? ` · ${sezon} sezonu` : ""}`;
  return sezon ? `${sezon} sezonu (tüm aylar)` : "Tüm aylar";
}
/** Sezon aidat özeti tek satır metni (ekran): "3/4 ay · 3.500 ₺ borç" | "Muaf" | "Kayıt yok". @param {any} o */
export function sezonAidatMetni(o) {
  if (!o || !o.acilan) return "Kayıt yok";
  if (o.muaf === o.acilan) return "Muaf";
  const odenen = `${o.odenen}/${o.acilan - o.muaf} ay`;
  return o.borc > 0 ? `${odenen} · ${paraTR(o.borc)} borç` : odenen;
}
/** Borçlu aylar kısa metni: "2026-9,2026-10" → "Eyl, Eki". @param {string} aylar */
export const borcluAylarMetni = (aylar) =>
  String(aylar || "")
    .split(",")
    .filter(Boolean)
    .map((x) => AY_ADLARI[Number(x.split("-")[1]) - 1]?.slice(0, 3))
    .join(", ");

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

/**
 * Her raporda AYNI filtreler (plan §20; Kerem 09.09.2026: "bütün filtreler Yoklama Özeti'ndeki gibi olsun"):
 * Dönem seçimi (`mod`), ona göre Sezon + Ay ya da Başlangıç + Bitiş, ve Yaş grubu. Hiçbir kutu rapora göre gizlenmez.
 * @param {string} kod @param {{ mod?: string }} [filtre]
 * @returns {("sezon"|"grup"|"mod"|"tarih")[]}
 */
export function raporFiltreleri(kod, { mod = "sezon" } = {}) {
  if (!["oyuncu", "borclu", "tahsilat", "yoklama", "saglik"].includes(kod)) return [];
  return mod === "tarih" ? ["mod", "tarih", "grup"] : ["mod", "sezon", "grup"];
}

/** Tarih aralığı → yil*100+ay sınırları ("2026-09-01", "2026-10-31" → [202609, 202610]). @param {string} from @param {string} to */
export function tarihAyAraligi(from, to) {
  /** @param {string} iso */
  const ya = (iso) => Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
  return [ya(from), ya(to)];
}

/** @typedef {{ baslik: string, anahtar: string, genislik?: number, sag?: boolean }} Sutun */
/** @typedef {{ baslik: string, alt: string, yatay?: boolean, sutunlar: Sutun[], satirlar: Record<string, unknown>[] }} Rapor */

/**
 * Oyuncu listesi: seçilen ayın aidat durumuyla.
 * ay null (Tümü) → "Sezon aidatı" sütunu (`ozet`: sezonAidatOzeti); Excel/PDF'de üç ayrı sütun (`disaSutunlar`; plan §19.2).
 * `donem` verilirse alt başlıkta o yazılır (tarih aralığı modu).
 * @param {{ liste: any[], yil?: number|null, ay?: number|null, grupEk?: string, ucretAd: (kod: string) => string, sezon?: string, ozet?: Record<number, any>, donem?: string }} p
 * @returns {Rapor & { disaSutunlar?: Sutun[] }}
 */
export function oyuncuListesiRaporu({ liste, yil = null, ay = null, grupEk = "", ucretAd, sezon = "", ozet = {}, donem = "" }) {
  const ortak = [
    { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
    { baslik: "TC / Pasaport", anahtar: "tc", genislik: 16 },
    { baslik: "Doğum", anahtar: "dogum", genislik: 12 },
    { baslik: "Grup", anahtar: "grup", genislik: 8 },
    { baslik: "Durum", anahtar: "durum", genislik: 10 },
    { baslik: "Ücret tipi", anahtar: "ucret", genislik: 16 },
    { baslik: "Aidat", anahtar: "aidat", genislik: 10, sag: true },
  ];
  const gsm = { baslik: "GSM", anahtar: "gsm", genislik: 16 };
  const sutunlar = ay
    ? [...ortak, { baslik: "Aidat durumu", anahtar: "ad_durum", genislik: 14 }, gsm]
    : [...ortak, { baslik: sezon ? "Sezon aidatı" : "Dönem aidatı", anahtar: "sezon_aidat", genislik: 22 }, gsm];
  const disaSutunlar = ay
    ? undefined
    : [
        ...ortak,
        { baslik: "Açılan ay", anahtar: "acilan_ay", genislik: 10, sag: true },
        { baslik: "Ödenen ay", anahtar: "odenen_ay", genislik: 10, sag: true },
        { baslik: "Borç", anahtar: "borc", genislik: 12, sag: true },
        gsm,
      ];
  return {
    baslik: "Oyuncu Listesi",
    alt: `${donem || donemEtiketi({ yil, ay, sezon })}${grupEk}`,
    yatay: true,
    sutunlar,
    disaSutunlar,
    satirlar: liste.map((o) => {
      const oz = ozet[o.id];
      return {
        ad: o.ad_soyad,
        tc: o.uyruk === "yabanci" ? "P: " + (o.pasaport_no || "") : o.tc_no || "",
        dogum: tarihTR(o.dogum_tarihi),
        grup: o.yas_grubu_ad || "",
        durum: DURUMLAR.find((d) => d.kod === o.durum)?.ad,
        ucret: ucretAd(o.ucret_tipi),
        aidat: o.aylik_aidat,
        ad_durum: aidatEtiket(o.aidat_durum),
        sezon_aidat: sezonAidatMetni(oz),
        acilan_ay: oz ? oz.acilan - oz.muaf : 0,
        odenen_ay: oz ? oz.odenen : 0,
        borc: oz ? oz.borc : 0,
        gsm: o.gsm || "",
      };
    }),
  };
}

/**
 * Borçlu listesi: `veliler` oyuncu id → veli listesi (birincil veli, yoksa ilk veli).
 * ay null (Tümü) → `liste` listUnpaidSezon çıktısı (oyuncu başına borçlu aylar + toplam; veli bilgisi satırda; plan §19.3).
 * `donem` verilirse alt başlıkta o yazılır (tarih aralığı modu).
 * @param {{ liste: any[], veliler?: Record<number, any[]>, yil?: number|null, ay?: number|null, sezon?: string, donem?: string, grupEk?: string }} p
 * @returns {Rapor}
 */
export function borcluListesiRaporu({ liste, veliler = {}, yil = null, ay = null, sezon = "", donem = "", grupEk = "" }) {
  const satirlar = liste.map((b) => {
    const v = veliler[b.player_id] || [];
    const veli = v.find((x) => x.veli_mi) || v[0];
    return {
      ad: b.ad_soyad,
      grup: b.yas_grubu_ad || "",
      aylar: ay ? "" : borcluAylarMetni(b.aylar),
      tutar: b.kalan ?? b.tutar,
      donem: b.odeme_donemi,
      veli: veli?.ad_soyad ?? b.veli_ad ?? "",
      tel: veli ? veli.whatsapp_no || veli.gsm || "" : b.veli_tel || "",
    };
  });
  const toplam = paraTR(liste.reduce((s, b) => s + (b.kalan ?? b.tutar), 0));
  return {
    baslik: "Borçlu Listesi",
    alt: `${donem || donemEtiketi({ yil, ay, sezon })}${grupEk} · ${liste.length} oyuncu · toplam ${toplam}`,
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad", genislik: 28 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      ...(ay ? [] : [{ baslik: "Borçlu aylar", anahtar: "aylar", genislik: 22 }]),
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
 * `donem` verilirse alt başlıkta tarih aralığı yerine o yazılır (sezon + ay modu).
 * @param {{ makbuzlar: any[], iptaller: any[], from: string, to: string, donem?: string, grupEk?: string }} p
 * @returns {Rapor}
 */
export function tahsilatRaporu({ makbuzlar, iptaller, from, to, donem = "", grupEk = "" }) {
  const toplam = makbuzlar.reduce((s, m) => s + m.toplam, 0);
  const yontemOzet = ODEME_YONTEMLERI.map(
    (y) => `${y.ad}: ${paraTR(makbuzlar.filter((m) => m.odeme_yontemi === y.kod).reduce((s, m) => s + m.toplam, 0))}`,
  ).join(" · ");
  /** @param {string} kod */
  const yontemAd = (kod) => ODEME_YONTEMLERI.find((y) => y.kod === kod)?.ad;
  return {
    baslik: "Tahsilat Raporu",
    alt: `${donem || `${tarihTR(from)} – ${tarihTR(to)}`}${grupEk} · ${makbuzlar.length} makbuz · toplam ${paraTR(toplam)} · ${yontemOzet} · iptal: ${iptaller.length} makbuz (${paraTR(iptaller.reduce((s, m) => s + m.toplam, 0))})`,
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
 * `bugunIso` referans tarih (ay seçilince ayın son günü); `sezon` alt başlıkta (plan §19.5).
 * @param {{ liste: any[], bugunIso: string, grupEk?: string, sezon?: string }} p
 * @returns {Rapor}
 */
export function saglikRaporu({ liste, bugunIso, grupEk = "", sezon = "" }) {
  /** @param {string} d */
  const sayi = (d) => liste.filter((x) => x.durum === d).length;
  return {
    baslik: "Sağlık Raporu Durumu",
    alt: `${tarihTR(bugunIso)} itibarıyla${sezon ? ` · ${sezon} sezonu` : ""}${grupEk} · ${sayi("doldu")} doldu · ${sayi("dolacak")} dolacak · ${sayi("yok") + sayi("tarihsiz")} yok · ${sayi("gecerli")} geçerli`,
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
 * `donem` verilirse alt başlıkta tarih aralığı yerine o yazılır (sezon + ay; plan §19.4).
 * @param {{ liste: any[], from: string, to: string, grupEk?: string, donem?: string }} p
 * @returns {Rapor}
 */
export function yoklamaOzetiRaporu({ liste, from, to, grupEk = "", donem = "" }) {
  return {
    baslik: "Yoklama Özeti",
    alt: `${donem || `${tarihTR(from)} – ${tarihTR(to)}`}${grupEk}`,
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
