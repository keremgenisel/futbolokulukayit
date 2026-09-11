// SAF: kulüp kimliği ayarlarının girdi doğrulaması (plan §32) ve ayar yazma izni (güvenlik 2. inceleme #1, 11.09.2026).
// `db.setSetting` her yazımda `ayarDogrula` çağırır: renderer'dan gelen değer CSS değişkenine ve HTML şablonlarına gireceği için
// biçim burada sıkı tutulur. `ayarYazmaIzni` yalnız IPC/HTTP yolunda (yetki.cjs) uygulanır: renderer YALNIZ İZİNLİ anahtarları yazar;
// KORUMALI anahtarlar (yedek klasörü/sıklığı, logo yolu, sunucu adresi, damgalar) ana sürecin kendi işleyicileriyle yazılır.
// Ana süreç içi çağrılar (göç, tohum, testlerdeki eski `indirim_*`) izin kümesine bağlı değildir.
const { renkGecerliMi } = require("../src/lib/tema.js"); // ESM tek kaynak (refactor 2. tur §8.6)

const SINIR = { kulup_adi: 80, kulup_kisa_ad: 40, kulup_alt_yazi: 40, tahsil_eden: 60 };
const WA_SABLON_MAX = 2000;
/** Renderer'ın `setSetting` ile yazabildiği anahtarlar (Ayarlar > Kulüp / WhatsApp / Sezon, ilk kurulum sihirbazı). */
const IZINLI_ANAHTARLAR = new Set([
  "kulup_adi",
  "kulup_kisa_ad",
  "kulup_alt_yazi",
  "kurulus_yili",
  "tahsil_eden",
  "tema_ana",
  "tema_vurgu",
  "aktif_sezon",
  "sezon_baslangic_ayi",
  "kurulum_tamam",
  "wa_sablon_aidat",
  "wa_sablon_genel",
  "wa_sablon_iptal",
  "wa_sablon_degisiklik",
]);
/** Yalnız ana sürecin kendi IPC'siyle (diyalog/işlem sonucu) yazılan anahtarlar — renderer `setSetting`'i reddedilir. */
const KORUMALI_ANAHTARLAR = new Set(["yedek_klasoru", "yedek_sikligi", "son_yedek", "kulup_logo", "son_sezon_gecisi", "sunucu_adres"]);

/** IPC/HTTP `setSetting` için anahtar izni. @param {unknown} anahtar @returns {{ ok: boolean, neden?: string }} */
function ayarYazmaIzni(anahtar) {
  const k = String(anahtar ?? "");
  if (KORUMALI_ANAHTARLAR.has(k)) return { ok: false, neden: `Bu ayar (${k}) yalnız ilgili ekrandan değiştirilebilir` };
  if (!IZINLI_ANAHTARLAR.has(k)) return { ok: false, neden: `Bilinmeyen ayar: ${k}` };
  return { ok: true };
}

/**
 * @param {string} anahtar
 * @param {unknown} deger
 * @returns {string} normalize edilmiş değer
 */
function ayarDogrula(anahtar, deger) {
  const v = deger === null || deger === undefined ? "" : String(deger);
  if (anahtar === "tema_ana" || anahtar === "tema_vurgu") {
    if (v === "") return "";
    if (!renkGecerliMi(v)) throw new Error("Renk #rrggbb biçiminde olmalı");
    return v.toLowerCase();
  }
  if (anahtar === "kurulus_yili") {
    const t = v.trim();
    if (t !== "" && !/^\d{4}$/.test(t)) throw new Error("Kuruluş yılı 4 haneli olmalı (ör. 1974)");
    return t;
  }
  if (anahtar === "kulup_logo") {
    if (v !== "" && !/^kulup\/logo\.(png|jpg)$/.test(v)) throw new Error("Logo yolu geçersiz");
    return v;
  }
  if (anahtar === "aktif_sezon") {
    const t = v.trim();
    const m = /^(\d{4})-(\d{4})$/.exec(t);
    if (t !== "" && !(m && Number(m[2]) === Number(m[1]) + 1)) throw new Error("Sezon 2026-2027 biçiminde olmalı");
    return t;
  }
  if (anahtar === "sezon_baslangic_ayi") {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error("Sezon başlangıç ayı 1–12 olmalı");
    return String(n);
  }
  if (anahtar === "kurulum_tamam") {
    if (v !== "" && v !== "1") throw new Error("Geçersiz değer");
    return v;
  }
  if (anahtar === "sunucu_adres") {
    const t = v.trim();
    if (t !== "" && !/^[A-Za-z0-9.:-]{1,64}$/.test(t)) throw new Error("Sunucu adresi geçersiz");
    return t;
  }
  if (anahtar.startsWith("wa_sablon_")) {
    if (v.length > WA_SABLON_MAX) throw new Error(`Şablon en çok ${WA_SABLON_MAX} karakter`);
    return v;
  }
  if (anahtar in SINIR) {
    const t = v.replace(/[\r\n\t]/g, " ").trim();
    if (t.length > SINIR[anahtar]) throw new Error(`En çok ${SINIR[anahtar]} karakter`);
    return t;
  }
  return v;
}

module.exports = { ayarDogrula, ayarYazmaIzni, SINIR, IZINLI_ANAHTARLAR, KORUMALI_ANAHTARLAR, WA_SABLON_MAX };
