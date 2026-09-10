// SAF: kulüp kimliği ayarlarının girdi doğrulaması (plan §32). `db.setSetting` her yazımda çağırır; renderer'dan gelen değer
// CSS değişkenine ve HTML şablonlarına gireceği için biçim burada sıkı tutulur. Bilinmeyen anahtarlar olduğu gibi geçer.
const { renkGecerliMi } = require("./tema.cjs");

const SINIR = { kulup_adi: 80, kulup_kisa_ad: 40, kulup_alt_yazi: 40, kulup_slogan: 120, tahsil_eden: 60 };

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
  if (anahtar in SINIR) {
    const t = v.replace(/[\r\n\t]/g, " ").trim();
    if (t.length > SINIR[anahtar]) throw new Error(`En çok ${SINIR[anahtar]} karakter`);
    return t;
  }
  return v;
}

module.exports = { ayarDogrula, SINIR };
