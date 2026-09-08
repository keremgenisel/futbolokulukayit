// @ts-check
// WhatsApp "tıkla ve yaz" bağlantısıyla hatırlatma/bildirim — SAF mantık (plan §13). API yok: program mesajı
// hazırlar, kulübün WhatsApp'ı açılır, kullanıcı Gönder'e basar. Şablon doldurma, numara dönüşümü, uygunluk kararı.
import { gsmNormalize, paraTR, AY_ADLARI } from "./aidat.js";
import { uzunTarih } from "./takvim.js";

/** Ayar anahtarları (settings tablosu). */
export const SABLON_ANAHTARLARI = {
  aidat: "wa_sablon_aidat",
  genel: "wa_sablon_genel",
  iptal: "wa_sablon_iptal",
  degisiklik: "wa_sablon_degisiklik",
};
export const SABLON_ADLARI = {
  aidat: "Aidat hatırlatma",
  genel: "Genel mesaj",
  iptal: "Antrenman iptali",
  degisiklik: "Antrenman değişikliği",
};
/** @type {Record<string, string>} */
export const VARSAYILAN_SABLONLAR = {
  aidat:
    "Sayın {veli}, {oyuncu} için {ay} aidatı ({kalan}) henüz ödenmemiştir. Ödeme dönemi her ayın {donem} günleridir. Bilgilerinize sunarız.\n{kulup}",
  genel: "Sayın {veli}, {oyuncu} hakkında: ",
  iptal: "Sayın {veli}, {grup} grubunun {tarih} {saat} antrenmanı iptal edilmiştir. {neden}\n{kulup}",
  degisiklik:
    "Sayın {veli}, {grup} grubunun {eskiTarih} {eskiSaat} antrenmanı {yeniTarih} {yeniSaat} saatine alınmıştır ({saha}).\n{kulup}",
};
export const YER_TUTUCULAR = [
  "veli",
  "oyuncu",
  "ay",
  "tutar",
  "kalan",
  "donem",
  "grup",
  "tarih",
  "saat",
  "saha",
  "eskiTarih",
  "eskiSaat",
  "yeniTarih",
  "yeniSaat",
  "neden",
  "kulup",
];
export const VARSAYILAN_KULUP = "Eyüpspor Futbol Okulu";

/**
 * WhatsApp numarası: 05XXXXXXXXX / +90 5XX … / 90 5XX … → "905XXXXXXXXX"; geçersizse "".
 * @param {unknown} no
 */
export function waNumara(no) {
  const rakam = String(no ?? "").replace(/\D/g, "");
  if (/^90\d{10}$/.test(rakam)) return rakam;
  const n = gsmNormalize(rakam);
  return /^05\d{9}$/.test(n) ? "9" + n : "";
}

/**
 * Şablondaki {anahtar} yer tutucularını doldurur; bilinmeyen anahtar boş olur, boşluklar sadeleşir.
 * @param {string} sablon @param {Record<string, unknown>} degerler
 */
export function sablonDoldur(sablon, degerler = {}) {
  return String(sablon ?? "")
    .replace(/\{(\w+)\}/g, (_, k) => (degerler[k] === undefined || degerler[k] === null ? "" : String(degerler[k])))
    .replace(/[ \t]+/g, " ")
    .replace(/ \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Bağlantı: numara varsa o kişiye; numara boşsa WhatsApp "sohbet seç" ekranı açılır (metin hazır) — veli GRUBUNA tek
 * mesaj için (plan §13.7). @param {string} numara "905…" ya da "" @param {string} metin
 */
export const waBaglanti = (numara, metin) => `https://wa.me/${numara || ""}?text=${encodeURIComponent(metin)}`;
/** Grup mesajı: aynı şablon, hitap "Veliler" (tek tek {veli} yerine). @param {Record<string, unknown>} degerler */
export const grupDegerleri = (degerler) => ({ ...degerler, veli: "Veliler", oyuncu: "" });

/**
 * Bu veliye WhatsApp açılabilir mi? @param {{ numara?: unknown, onay?: unknown }} veli
 * @returns {{ ok: boolean, neden: string, numara: string }}
 */
export function hatirlatmaUygunMu(veli) {
  const numara = waNumara(veli?.numara);
  if (!numara) return { ok: false, neden: "Veli numarası yok", numara: "" };
  if (veli?.onay !== undefined && veli?.onay !== null && !Number(veli.onay)) return { ok: false, neden: "Mesaj onayı yok", numara };
  return { ok: true, neden: "", numara };
}

/**
 * Aidat hatırlatması yer tutucu değerleri (listUnpaid satırından).
 * @param {{ veli_ad?: string, ad_soyad: string, yil: number, ay: number, tutar: number, kalan?: number, odeme_donemi?: string, yas_grubu_ad?: string }} b
 * @param {string} [kulup]
 */
export function aidatDegerleri(b, kulup = VARSAYILAN_KULUP) {
  return {
    veli: b.veli_ad || "Veli",
    oyuncu: b.ad_soyad,
    ay: `${AY_ADLARI[b.ay - 1]} ${b.yil}`,
    tutar: paraTR(b.tutar),
    kalan: paraTR(b.kalan ?? b.tutar),
    donem: b.odeme_donemi || "",
    grup: b.yas_grubu_ad || "",
    kulup,
  };
}

/**
 * Antrenman iptali/değişikliği yer tutucu değerleri.
 * @param {{ tarih: string, saat?: string, saha?: string, yas_grubu_ad?: string, iptal_nedeni?: string, degisiklik_notu?: string }} t
 * @param {{ veli_ad?: string, ad_soyad: string }} satir
 * @param {string} [kulup]
 */
export function antrenmanDegerleri(t, satir, kulup = VARSAYILAN_KULUP) {
  /** @type {{ eskiTarih?: string, eskiSaat?: string }} */
  let eski = {};
  try {
    eski = t.degisiklik_notu ? JSON.parse(t.degisiklik_notu) : {};
  } catch {
    eski = {};
  }
  return {
    veli: satir.veli_ad || "Veli",
    oyuncu: satir.ad_soyad,
    grup: t.yas_grubu_ad || "",
    tarih: uzunTarih(t.tarih),
    saat: t.saat || "",
    saha: t.saha || "",
    neden: t.iptal_nedeni && t.iptal_nedeni !== "İptal" ? t.iptal_nedeni : "",
    eskiTarih: eski.eskiTarih ? uzunTarih(eski.eskiTarih) : uzunTarih(t.tarih),
    eskiSaat: eski.eskiSaat ?? t.saat ?? "",
    yeniTarih: uzunTarih(t.tarih),
    yeniSaat: t.saat || "",
    kulup,
  };
}
