// Marka bilgisi (plan §32.5): giriş ekranı oturumsuzdur; `app:marka` yalnız bu alanları verir (kişisel veri yok).
// Saf kısım `markaHesapla` (ayar → alanlar, varsayılanlar); dosya okuma `markaOku`.
const fs = require("fs");
const path = require("path");
const { VARSAYILAN_TEMA, renkGecerliMi } = require("./tema.cjs");

const VARSAYILAN_KULUP = "Futbol Okulu"; // src/lib/marka.js VARSAYILAN_KULUP ile aynı
const KULUP_LOGO_KLASORU = "kulup";

/**
 * @param {(k: string) => string | null} getSetting
 * @param {string} [logoDataUrl]
 */
function markaHesapla(getSetting, logoDataUrl = "") {
  const ad = (k) => String(getSetting(k) || "").trim();
  const kulupAdi = ad("kulup_adi") || VARSAYILAN_KULUP;
  const ana = ad("tema_ana"),
    vurgu = ad("tema_vurgu");
  return {
    kulupAdi,
    kisaAd: ad("kulup_kisa_ad") || kulupAdi,
    altYazi: ad("kulup_alt_yazi") || (ad("kulup_kisa_ad") ? "Futbol Okulu" : "Kayıt Programı"),
    kurulusYili: ad("kurulus_yili"),
    slogan: ad("kulup_slogan"), // yoklama formu alt yazısı (boşsa basılmaz)
    logo: logoDataUrl || "",
    tema: {
      ana: renkGecerliMi(ana) ? ana.toLowerCase() : VARSAYILAN_TEMA.ana,
      vurgu: renkGecerliMi(vurgu) ? vurgu.toLowerCase() : VARSAYILAN_TEMA.vurgu,
    },
  };
}

/** Kulüp logosu data URL (yalnız png/jpg; `guvenliLogo` regex'i başka mime kabul etmez). Dosya yoksa "". */
function kulupLogoDataUrl(uploadsDir, yol) {
  if (!yol || !/^kulup\/logo\.(png|jpg)$/.test(yol)) return "";
  try {
    const tam = path.join(uploadsDir, yol);
    const mime = yol.endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(tam).toString("base64")}`;
  } catch {
    return "";
  }
}

/** @param {{ getSetting: (k: string) => string | null, uploadsDir: string }} p */
function markaOku({ getSetting, uploadsDir }) {
  return markaHesapla(getSetting, kulupLogoDataUrl(uploadsDir, String(getSetting("kulup_logo") || "")));
}

module.exports = { markaHesapla, markaOku, kulupLogoDataUrl, KULUP_LOGO_KLASORU, VARSAYILAN_KULUP };
