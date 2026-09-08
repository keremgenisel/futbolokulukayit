// SAF: taşıma paketi şifrelemesi (plan §14). Yedek zip'i kullanıcı PAROLASIYLA şifrelenir; böylece makinenin safeStorage
// anahtarından bağımsız olarak başka bilgisayarda açılır. scrypt (parola → anahtar) + AES-256-GCM (bütünlük dahil).
// Dosya: MAGIC(9) | salt(16) | iv(12) | tag(16) | şifreli veri.  Uzantı: .eyupspor
// Aynı kap, farklı MAGIC ile normal yedek için de kullanılır (inceleme #6): parola = makine anahtarı, uzantı .eyupyedek.
const crypto = require("crypto");
const MAGIC = Buffer.from("EYUPTASI1", "ascii");
const YEDEK_MAGIC = Buffer.from("EYUPYDK1.", "ascii");
const SCRYPT = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }; // inceleme #24: daha yavaş türetme (~0,3 s)
const PAROLA_MIN = 10;

const parolaGecerliMi = (p) => typeof p === "string" && p.length >= PAROLA_MIN;
const anahtar = (parola, salt) => crypto.scryptSync(Buffer.from(String(parola), "utf8"), salt, 32, SCRYPT);

/** @param {Buffer} veri @param {string} parola @param {{ magic?: Buffer }} [sec] */
function sifrele(veri, parola, { magic = MAGIC } = {}) {
  if (!parolaGecerliMi(parola)) throw new Error(`Parola en az ${PAROLA_MIN} karakter olmalı`);
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", anahtar(parola, salt), iv);
  const sifreli = Buffer.concat([c.update(veri), c.final()]);
  return Buffer.concat([magic, salt, iv, c.getAuthTag(), sifreli]);
}
const paketMi = (buf, magic = MAGIC) => Buffer.isBuffer(buf) && buf.length >= magic.length + 44 && buf.subarray(0, magic.length).equals(magic);
/** @param {Buffer} paket @param {string} parola @param {{ magic?: Buffer }} [sec] */
function coz(paket, parola, { magic = MAGIC } = {}) {
  if (!paketMi(paket, magic)) throw new Error(magic.equals(YEDEK_MAGIC) ? "Bu bir Eyüpspor yedeği değil" : "Bu bir Eyüpspor taşıma paketi değil");
  let o = magic.length;
  const salt = paket.subarray(o, o + 16); o += 16;
  const iv = paket.subarray(o, o + 12); o += 12;
  const tag = paket.subarray(o, o + 16); o += 16;
  const d = crypto.createDecipheriv("aes-256-gcm", anahtar(parola, salt), iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(paket.subarray(o)), d.final()]); }
  catch { throw new Error("Parola yanlış ya da paket bozuk"); }
}
module.exports = { sifrele, coz, paketMi, parolaGecerliMi, PAROLA_MIN, MAGIC, YEDEK_MAGIC };
