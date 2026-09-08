// JWT imza anahtarı: safeStorage ile şifreli dosyada (userData/jwt-secret.enc); safeStorage yoksa
// DB meta'da. Uygulama yeniden başlasa da istemci jetonları geçerli kalsın diye kalıcıdır.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app, safeStorage } = require("electron");

let cached = null;
function getSecret(db) {
  if (cached) return cached;
  const p = path.join(app.getPath("userData"), "jwt-secret.enc");
  let can = false;
  try {
    can = !!safeStorage?.isEncryptionAvailable?.();
  } catch {}
  try {
    if (can && fs.existsSync(p)) return (cached = safeStorage.decryptString(fs.readFileSync(p)));
  } catch {}
  const dbSecret = db.getMetaValue("jwtSecret");
  if (dbSecret) {
    cached = dbSecret;
    if (can) {
      try {
        fs.writeFileSync(p, safeStorage.encryptString(dbSecret));
        db.setMetaValue("jwtSecret", "");
      } catch {}
    }
    return cached;
  }
  cached = crypto.randomBytes(32).toString("hex");
  try {
    if (can) fs.writeFileSync(p, safeStorage.encryptString(cached));
    else db.setMetaValue("jwtSecret", cached);
  } catch (e) {
    console.error("[jwt] anahtar kaydedilemedi:", e.message);
  }
  return cached;
}
module.exports = { getSecret };
