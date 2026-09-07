// SAF: taşıma paketi şifrelemesi (plan §14). Yedek zip'i kullanıcı PAROLASIYLA şifrelenir; böylece makinenin safeStorage
// anahtarından bağımsız olarak başka bilgisayarda açılır. scrypt (parola → anahtar) + AES-256-GCM (bütünlük dahil).
// Dosya: MAGIC(9) | salt(16) | iv(12) | tag(16) | şifreli veri.  Uzantı: .eyupspor
const crypto = require("crypto");
const MAGIC = Buffer.from("EYUPTASI1", "ascii");
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PAROLA_MIN = 8;

const parolaGecerliMi = (p) => typeof p === "string" && p.length >= PAROLA_MIN;
const anahtar = (parola, salt) => crypto.scryptSync(Buffer.from(String(parola), "utf8"), salt, 32, SCRYPT);

/** @param {Buffer} veri @param {string} parola */
function sifrele(veri, parola) {
  if (!parolaGecerliMi(parola)) throw new Error(`Parola en az ${PAROLA_MIN} karakter olmalı`);
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", anahtar(parola, salt), iv);
  const sifreli = Buffer.concat([c.update(veri), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), sifreli]);
}
const paketMi = (buf) => Buffer.isBuffer(buf) && buf.length >= MAGIC.length + 44 && buf.subarray(0, MAGIC.length).equals(MAGIC);
/** @param {Buffer} paket @param {string} parola */
function coz(paket, parola) {
  if (!paketMi(paket)) throw new Error("Bu bir Eyüpspor taşıma paketi değil");
  let o = MAGIC.length;
  const salt = paket.subarray(o, o + 16); o += 16;
  const iv = paket.subarray(o, o + 12); o += 12;
  const tag = paket.subarray(o, o + 16); o += 16;
  const d = crypto.createDecipheriv("aes-256-gcm", anahtar(parola, salt), iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(paket.subarray(o)), d.final()]); }
  catch { throw new Error("Parola yanlış ya da paket bozuk"); }
}
module.exports = { sifrele, coz, paketMi, parolaGecerliMi, PAROLA_MIN, MAGIC };
