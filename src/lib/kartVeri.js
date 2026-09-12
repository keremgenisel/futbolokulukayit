// Giriş kartı verisi (renderer; plan §40): ayarlar + marka + sezon + oyuncu/veli + isteğe bağlı kodlar → kartHtml girdisi.
// Tarayıcı API'si (canvas) yalnız fotoğraf küçültmede ve korumalı — ana süreç bu dosyayı yüklemez.
import { db, files, bugun } from "./api.js";
import { ciktiMarkasi } from "./yazdir.js";
import { guncelSezon } from "./sezon.js";
import { guvenliResim } from "./metin.js";
import { KART_KURAL_VARSAYILAN, kartNo } from "./kartHtml.js";
import { qrSvg, code128Svg, kodMetni } from "./kartKod.js";

export const KART_AYAR_ANAHTARLARI = [
  "kulup_adres",
  "kulup_telefon",
  "kulup_web",
  "kart_kural_1",
  "kart_kural_2",
  "kart_kural_3",
  "kart_kural_4",
  "kart_qr",
  "kurulus_yili",
];

/** Ayarlar > Kulüp'teki kart ayarları + marka + aktif sezon → `KartAyar` (+ qr bayrağı). */
export async function kartAyarlariOku() {
  const a = {};
  for (const k of KART_AYAR_ANAHTARLARI) a[k] = (await db("getSetting", k)) || "";
  const marka = await ciktiMarkasi();
  let sezon = "";
  try {
    const d = await db("sezonDurumu");
    sezon = d?.aktifSezon || guncelSezon(bugun().iso, d?.baslangicAyi || 9);
  } catch {
    sezon = guncelSezon(bugun().iso, 9);
  }
  const kurallar = [1, 2, 3, 4].map((i) => a[`kart_kural_${i}`] || KART_KURAL_VARSAYILAN[i - 1]);
  return {
    ayar: {
      kulupAdi: marka.kulup,
      kurulusYili: a.kurulus_yili || "",
      logo: marka.logo,
      tema: marka.tema,
      adres: a.kulup_adres,
      telefon: a.kulup_telefon,
      web: a.kulup_web,
      sezon,
      kurallar,
    },
    qr: a.kart_qr === "1",
  };
}

/**
 * Fotoğrafı küçültür (toplu basımda HTML şişmesin): en uzun kenar `maks` px, JPEG. Canvas yoksa/başarısızsa olduğu gibi döner.
 * @param {string} dataUrl @param {number} [maks]
 */
export function fotoKucult(dataUrl, maks = 240) {
  const kaynak = guvenliResim(dataUrl);
  if (!kaynak || typeof document === "undefined" || typeof Image === "undefined") return Promise.resolve(kaynak);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const oran = Math.min(1, maks / Math.max(img.width, img.height, 1));
        if (oran >= 1) return res(kaynak);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * oran);
        cv.height = Math.round(img.height * oran);
        const ctx = cv.getContext("2d");
        if (!ctx) return res(kaynak);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        res(guvenliResim(cv.toDataURL("image/jpeg", 0.85)) || kaynak);
      } catch {
        res(kaynak);
      }
    };
    img.onerror = () => res(kaynak);
    img.src = kaynak;
  });
}

/**
 * Bir oyuncunun kart satırı: foto (verilmezse dosyadan), birincil veli, kodlar (qr açıksa).
 * @param {any} o getPlayer/listPlayersWithDue satırı @param {{ sezon: string, qr: boolean, foto?: string|null, veliler?: any[] }} p
 */
export async function kartOyuncusu(o, { sezon, qr, foto = undefined, veliler = undefined }) {
  const v = veliler ?? (await db("listGuardians", o.id).catch(() => []));
  const veli = (v || []).find((x) => x.veli_mi) || (v || [])[0] || null;
  let f = foto;
  if (f === undefined) {
    f = o.foto_yolu
      ? await files()
          .dataUrl(o.foto_yolu)
          .catch(() => "")
      : "";
  }
  const no = kartNo(o.id, sezon);
  return {
    id: o.id,
    ad_soyad: o.ad_soyad,
    yas_grubu_ad: o.yas_grubu_ad || "",
    dogum_tarihi: o.dogum_tarihi || null,
    foto: await fotoKucult(f || ""),
    veli_ad: veli?.ad_soyad || "",
    veli_tel: veli ? veli.gsm || veli.whatsapp_no || "" : "",
    qrSvg: qr ? await qrSvg(kodMetni(no)) : "",
    barkodSvg: qr ? code128Svg(kodMetni(no)) : "",
  };
}
