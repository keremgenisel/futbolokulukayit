// @ts-check
// Aidat ile ilgili SAF mantık (I/O yok, test edilebilir). Kaynak: docs/plan.md §3.

/** Aidat ödemesi beklenen oyuncu durumları. */
export const AIDAT_ODENEN_DURUMLAR = new Set(["aktif", "deneme", "sakat"]);
/** Aidat muafiyeti veren ücret tipleri. Burslu artık indirim yüzdesiyle yönetilir (varsayılan %100 → 0 ₺ → muaf). */
export const MUAF_UCRET_TIPLERI = new Set(["ucretsiz"]);

export const DURUMLAR = [
  { kod: "aktif", ad: "Aktif" },
  { kod: "deneme", ad: "Deneme" },
  { kod: "pasif", ad: "Pasif" },
  { kod: "ayrildi", ad: "Ayrıldı" },
  { kod: "sakat", ad: "Sakat" },
  { kod: "dondurma", ad: "Dondurma" },
];
/** Varsayılan ücret tipleri (tohum). Asıl liste veritabanında `fee_types`; arayüz `useUcretTipleri()` ile alır. */
// Sıra: iki sabit tip (normal, ücretsiz) en üstte, sonra indirimli tipler (kulüp isteği 09.09.2026).
export const UCRET_TIPLERI = [
  { kod: "normal", ad: "Normal" },
  { kod: "ucretsiz", ad: "Ücretsiz" },
  { kod: "burslu", ad: "Burslu" },
  { kod: "indirimli", ad: "İndirimli" },
  { kod: "kardes", ad: "Kardeş İndirimi" },
];
/** Ücret tipi başına varsayılan indirim yüzdesi (Ayarlar > Aidat Kalemleri'nden değiştirilir). */
/** @type {Record<string, number>} */
export const VARSAYILAN_INDIRIM = { normal: 0, burslu: 100, indirimli: 0, kardes: 0, ucretsiz: 100 };
/** İndirimi ayarlardan değiştirilemeyen tipler. */
export const SABIT_INDIRIM = new Set(["normal", "ucretsiz"]);
/** Ayar anahtarı: indirim_<ucret tipi>. @param {string} kod */
export const indirimAnahtari = (kod) => `indirim_${kod}`;

/**
 * Yüzdeyi 0-100 arasına sıkıştırır; sabit tipler kendi değerini korur.
 * @param {string} kod @param {unknown} deger
 */
export function indirimYuzdesi(kod, deger) {
  if (SABIT_INDIRIM.has(kod)) return VARSAYILAN_INDIRIM[kod];
  const n = Number(deger);
  if (deger === null || deger === undefined || deger === "" || !Number.isFinite(n)) return VARSAYILAN_INDIRIM[kod] ?? 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Oyuncunun aylık aidatı: taban fiyat − ücret tipinin indirimi (tam liraya yuvarlanır).
 * @param {number} taban Aidat kaleminin fiyatı
 * @param {string} ucretTipi
 * @param {Record<string, unknown>} indirimler kod → yüzde (ayarlardan); eksikse varsayılan
 */
export function aidatHesapla(taban, ucretTipi, indirimler = {}) {
  const t = Number(taban) > 0 ? Number(taban) : 0;
  const y = indirimYuzdesi(ucretTipi, indirimler[ucretTipi]);
  return Math.round((t * (100 - y)) / 100);
}

export const ODEME_YONTEMLERI = [
  { kod: "nakit", ad: "Nakit" },
  { kod: "havale", ad: "Havale / EFT" },
  { kod: "kredi_karti", ad: "Kredi Kartı" },
  { kod: "online", ad: "Online Ödeme" },
];
export const ODEME_DONEMLERI = ["1-10", "11-20", "21-31"];

/**
 * Bir oyuncu için verilen ayda aidat kaydının hangi durumda açılacağı.
 * @param {{durum: string, ucret_tipi: string, aylik_aidat: number}} oyuncu
 * @returns {"odenmedi"|"muaf"|null} null → kayıt açılmaz (pasif/ayrıldı/dondurma)
 */
export function aidatBaslangicDurumu(oyuncu) {
  if (!AIDAT_ODENEN_DURUMLAR.has(oyuncu.durum)) return null;
  if (MUAF_UCRET_TIPLERI.has(oyuncu.ucret_tipi)) return "muaf";
  if (!(Number(oyuncu.aylik_aidat) > 0)) return "muaf";
  return "odenmedi";
}

/**
 * Aidat kaydının durumu ödenen tutara göre: 0 → ödenmedi, eksik → kısmi, tam/fazla → ödendi. Muaf değişmez.
 * @param {number} tutar beklenen aylık aidat @param {number} odenen toplam tahsil edilen @param {string} [mevcut]
 * @returns {"odenmedi"|"kismi"|"odendi"|"muaf"}
 */
export function aidatDurumHesapla(tutar, odenen, mevcut = "odenmedi") {
  if (mevcut === "muaf") return "muaf";
  const t = Number(tutar) || 0,
    o = Number(odenen) || 0;
  if (o <= 0) return "odenmedi";
  return o >= t ? "odendi" : "kismi";
}
/** Kalan borç (negatif olmaz). @param {{tutar:number, odenen?:number, durum?:string}} d */
export function aidatKalan(d) {
  if (!d || d.durum === "muaf" || d.durum === "odendi") return 0;
  return Math.max(0, (Number(d.tutar) || 0) - (Number(d.odenen) || 0));
}

/**
 * Tesise girebilir mi? Bu ayın aidat kaydı ödendi/muaf ise evet.
 * @param {{durum: string}} oyuncu
 * @param {{durum: string}|null} buAyAidat
 */
export function tesiseGirebilir(oyuncu, buAyAidat) {
  if (!AIDAT_ODENEN_DURUMLAR.has(oyuncu.durum)) return false;
  if (!buAyAidat) return false;
  return buAyAidat.durum === "odendi" || buAyAidat.durum === "muaf";
}

/**
 * Ödeme döneminin son günü. "1-10" → 10, "11-20" → 20, "21-31" → ayın son günü.
 * @param {string} donem
 * @param {number} yil
 * @param {number} ay 1-12
 */
export function donemSonGunu(donem, yil, ay) {
  const aySonu = new Date(yil, ay, 0).getDate();
  if (donem === "1-10") return 10;
  if (donem === "11-20") return 20;
  return aySonu;
}

/**
 * Gecikme gün sayısı. Dönem sonu geçmediyse 0.
 * @param {string} donem
 * @param {number} yil
 * @param {number} ay
 * @param {Date} bugun
 */
export function gecikmeGunu(donem, yil, ay, bugun) {
  const son = new Date(yil, ay - 1, donemSonGunu(donem, yil, ay));
  const fark = Math.floor((bugun.getTime() - son.getTime()) / 86400000);
  return fark > 0 ? fark : 0;
}

/**
 * Türkçe para biçimi: 3500 → "3.500 ₺"
 * @param {number|string|null|undefined} tutar
 */
export function paraTR(tutar) {
  const n = Number(tutar || 0);
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " ₺";
}

/**
 * ISO tarihi (2015-11-02) → 02.11.2015
 * @param {string|null|undefined} iso
 */
export function tarihTR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(iso);
}

export const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/**
 * Başlangıçtan bitişe (dahil) ay listesi, kronolojik sırayla; bitiş başlangıçtan önceyse ikisi yer değiştirir.
 * Tahsilat > Uzun Dönem Seç için (plan §24): hızlı seçim (N ay) ve elle aralık, tek yolla ay listesi üretir.
 * @param {number} yilBas @param {number} ayBas @param {number} yilBit @param {number} ayBit
 * @returns {{ yil: number, ay: number }[]}
 */
export function ayAraligi(yilBas, ayBas, yilBit, ayBit) {
  let b = yilBas * 12 + (ayBas - 1);
  let s = yilBit * 12 + (ayBit - 1);
  if (s < b) [b, s] = [s, b];
  const liste = [];
  for (let i = b; i <= s; i++) liste.push({ yil: Math.floor(i / 12), ay: (i % 12) + 1 });
  return liste;
}

/**
 * İleri tarihli, hiç ödenmemiş aidat kaydı mı? (Uzun dönem makbuzu iptal edilince ya da peşin ödeme için aralık
 * açılınca oluşan "odenmedi" satırları.) Vadesi gelmediği için BORÇ sayılmaz: oyuncu kartı/Tahsilat listelemez,
 * borç rozeti saymaz (Kerem, 10.09.2026). Kısmi ödenmiş ya da ödenmiş ileri ay gösterilmeye devam eder.
 * @param {{ yil: number, ay: number, durum?: string, odenen?: number }} a @param {number} yil bugünün yılı @param {number} ay bugünün ayı
 */
export function gelecekAcikAidatMi(a, yil, ay) {
  return a.durum === "odenmedi" && !(Number(a.odenen) > 0) && a.yil * 12 + a.ay > yil * 12 + ay;
}

/** N ay sonrasının (yil, ay) çifti — "3 Ay"/"6 Ay" hızlı seçimi için. @param {number} yil @param {number} ay @param {number} n */
export function ayEkle(yil, ay, n) {
  const t = yil * 12 + (ay - 1) + n;
  return { yil: Math.floor(t / 12), ay: (t % 12) + 1 };
}

// ── Kimlik: TC vatandaşı → TC kimlik no; yabancı uyruklu → pasaport no ──
export const UYRUKLAR = [
  { kod: "tc", ad: "T.C. vatandaşı" },
  { kod: "yabanci", ad: "Yabancı uyruklu" },
];
/** Pasaport no: 5-15 harf/rakam, büyük harfe çevrilmiş. @param {string} p */
export function pasaportGecerliMi(p) {
  return /^[A-Z0-9]{5,15}$/.test(String(p || "").toLocaleUpperCase("tr-TR"));
}
/** @param {string} p */
export const pasaportNormalize = (p) =>
  String(p || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, "");
/**
 * Listelerde/kartta gösterilecek kimlik satırı.
 * @param {{ uyruk?: string, tc_no?: string|null, pasaport_no?: string|null }} o
 * @returns {{ etiket: string, deger: string }}
 */
export function kimlikBilgisi(o) {
  if (o.uyruk === "yabanci") return { etiket: "Pasaport No", deger: o.pasaport_no || "" };
  return { etiket: "TC Kimlik No", deger: o.tc_no || "" };
}
/** "TC 12345678901" | "Pasaport U1234567" | "Kimlik yok" @param {{ uyruk?: string, tc_no?: string|null, pasaport_no?: string|null }} o */
export function kimlikKisa(o) {
  const k = kimlikBilgisi(o);
  if (!k.deger) return "Kimlik yok";
  return (o.uyruk === "yabanci" ? "Pasaport " : "TC ") + k.deger;
}

// ── Para girişi: "5000" ↔ "5.000" (tam lira; binlik ayırıcı nokta) ──
/** Metindeki rakamları bırakır ("5.000 ₺" → "5000"). @param {unknown} metin */
export const sayiAyikla = (metin) =>
  String(metin ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
/** Rakam dizisini binlik noktayla biçimler ("5000" → "5.000"; boş → ""). @param {unknown} deger */
export function sayiBicimle(deger) {
  const r = sayiAyikla(deger);
  return r ? Number(r).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "";
}

// ── Kimlik/iletişim doğrulama ──
/** TC kimlik no: 11 hane, ilk hane 0 değil, 10. ve 11. hane sağlama. @param {unknown} tc */
export function tcGecerliMi(tc) {
  const t = String(tc ?? "").trim();
  if (!/^[1-9]\d{10}$/.test(t)) return false;
  const d = t.split("").map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8],
    cift = d[1] + d[3] + d[5] + d[7];
  if (d[9] !== (((tek * 7 - cift) % 10) + 10) % 10) return false;
  return d[10] === d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
}
/** GSM'i 05xxxxxxxxx biçimine indirger (boşluk, +90, 90 önekleri temizlenir). @param {unknown} v */
export function gsmNormalize(v) {
  let r = String(v ?? "").replace(/\D/g, "");
  if (r.startsWith("90") && r.length === 12) r = r.slice(2);
  if (r.length === 10 && r.startsWith("5")) r = "0" + r;
  return r;
}
/** 05 ile başlayan 11 hane. @param {unknown} v */
export const gsmGecerliMi = (v) => /^05\d{9}$/.test(gsmNormalize(v));

/**
 * Doğum yılından yaş grubu önerisi (yalnız ipucu; grup elle seçilir). Kural: U(N), N = sezon bitiş yılı − doğum yılı.
 * Tam ad ("U11") yoksa aynı yaşın alt grupları ("U11 A", "U11 B") aday olur; tek adaysa id dolu, birden fazlaysa
 * id boş ve `adaylar` listesi arayüzde seçenek olarak gösterilir.
 * @param {string} dogumIso @param {string} sezon "2026-2027" @param {{id:number, ad:string, aktif?:number}[]} gruplar
 * @returns {{ ad: string, id: number|null, adaylar: {id:number, ad:string}[] } | null}
 */
export function yasGrubuOner(dogumIso, sezon, gruplar = []) {
  const yil = Number(String(dogumIso || "").slice(0, 4));
  const bitis = Number(String(sezon || "").slice(5, 9));
  if (!yil || !bitis || bitis <= yil) return null;
  const n = bitis - yil;
  if (n < 5 || n > 20) return null;
  const ad = `U${n}`;
  const norm = (/** @type {{ad:string}} */ x) => String(x.ad).toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
  const aktif = gruplar.filter((x) => x.aktif !== 0);
  const tam = aktif.find((x) => norm(x) === ad);
  const altOnek = new RegExp(`^${ad}(?!\\d)`); // "U11A" evet, "U110" hayır
  const adaylar = (tam ? [tam] : aktif.filter((x) => altOnek.test(norm(x)))).map((x) => ({ id: x.id, ad: x.ad }));
  return { ad, id: adaylar.length === 1 ? adaylar[0].id : null, adaylar };
}

/** Aidat dönem durumunun ekran etiketi (null/bilinmeyen → "Kayıt yok"). @param {string|null|undefined} d */
export function aidatEtiket(d) {
  /** @type {Record<string, string>} */
  const e = { odendi: "Ödendi", odenmedi: "Ödenmedi", kismi: "Kısmi", muaf: "Muaf" };
  return (d && e[d]) || "Kayıt yok";
}
