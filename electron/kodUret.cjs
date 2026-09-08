// SAF: kullanıcı adından makine kodu üretir (aidat kalemi / ücret tipi). Türkçe harfler ASCII'ye çevrilir,
// yalnız a-z 0-9 _ kalır; mevcut kodlarla çakışırsa _2, _3 … eklenir.
const TR = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** @param {string} ad @param {Iterable<string>} [mevcut] @param {string} [varsayilan] */
function kodUret(ad, mevcut = [], varsayilan = "kalem") {
  let s = String(ad || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşüâîû]/g, (c) => TR[c] || c)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  if (!s || !/^[a-z_]/.test(s)) s = varsayilan + (s ? "_" + s : "");
  const var_ = new Set([...mevcut].map((k) => String(k).toLowerCase()));
  if (!var_.has(s)) return s;
  for (let i = 2; ; i++) if (!var_.has(`${s}_${i}`)) return `${s}_${i}`;
}
const KOD_GECERLI = /^[a-z_][a-z0-9_]{0,40}$/;

module.exports = { kodUret, KOD_GECERLI };
