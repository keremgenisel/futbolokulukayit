// ── SQLite bağlantısı, şifreleme anahtarı ve yollar ──
// Şifreli-yetenekli better-sqlite3-multiple-ciphers önce denenir; anahtar OS anahtarlığında
// (safeStorage: Windows DPAPI / macOS Keychain) şifreli dosyada tutulur. safeStorage yoksa DB düz kalır.
// Diğer db/ modülleri `db` üzerinden canlı bağlantıya erişir: `db` bir Proxy'dir, her erişimde o anki açık
// bağlantıya yönlenir (bağlantı kapalıyken "Veritabanı açık değil" fırlatır). Böylece modüller bağlantının
// açılıp kapanmasını (init/close/geri yükleme) bilmek zorunda kalmaz.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app, safeStorage } = require("electron");

let Database = null;
let dbEncryptable = false;
try {
  Database = require("better-sqlite3-multiple-ciphers");
  dbEncryptable = true;
} catch (errMc) {
  try {
    Database = require("better-sqlite3");
    console.warn("[db] multiple-ciphers yok, şifrelemesiz better-sqlite3:", errMc.message);
  } catch (err) {
    console.error("[db] SQLite native modülü yüklenemedi:", err);
  }
}

let canli = null; // açık better-sqlite3 bağlantısı ya da null
const acikMi = () => !!canli;
const hamBaglanti = () => canli; // YALNIZ testler: göç senaryoları için ham SQL
const db = new Proxy(
  {},
  {
    get(_, k) {
      if (!canli) throw new Error("Veritabanı açık değil");
      const v = canli[k];
      return typeof v === "function" ? v.bind(canli) : v;
    },
  },
);
const getDbPath = () => path.join(app.getPath("userData"), "data.db");
const getDbKeyPath = () => path.join(app.getPath("userData"), "db-key.enc");
const getUploadsDir = () => path.join(app.getPath("userData"), "uploads");

// ── Şifreleme anahtarı ──
let cachedDbKey; // undefined: hesaplanmadı, null: şifreleme yok, string: anahtar
function getDbKey() {
  if (cachedDbKey !== undefined) return cachedDbKey;
  if (!dbEncryptable) return (cachedDbKey = null);
  let canEncrypt = false;
  try {
    canEncrypt = !!safeStorage?.isEncryptionAvailable?.();
  } catch {
    canEncrypt = false;
  }
  if (!canEncrypt) return (cachedDbKey = null);
  const p = getDbKeyPath();
  try {
    if (fs.existsSync(p)) return (cachedDbKey = safeStorage.decryptString(fs.readFileSync(p)));
  } catch (e) {
    console.error("[db] anahtar okunamadı:", e.message);
  }
  const key = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(p, safeStorage.encryptString(key), { mode: 0o600 });
    cachedDbKey = key;
  } catch (e) {
    console.error("[db] anahtar kaydedilemedi, şifreleme kapalı:", e.message);
    cachedDbKey = null;
  }
  return cachedDbKey;
}
const isEncrypted = () => !!getDbKey();

function openDb(dbPath) {
  const conn = new Database(dbPath);
  const key = getDbKey();
  if (key) conn.pragma(`key='${key}'`);
  return conn;
}

// Bağlantıyı açar (idempotent): klasörler, anahtar, WAL. Şema/göç/tohum sema.cjs `init` içinde.
function ac() {
  if (canli) return canli;
  if (!Database) throw new Error("SQLite modülü yok");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.mkdirSync(getUploadsDir(), { recursive: true });
  canli = openDb(getDbPath());
  canli.pragma("journal_mode = WAL");
  return canli;
}
function close() {
  if (canli) {
    canli.close();
    canli = null;
  }
}
const checkpoint = () => {
  try {
    canli?.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* yoksay */
  }
};

// Dış modüller için işlem sarmalayıcı (aktarım gibi çok adımlı yazımlar tek işlemde olsun).
const islem = (fn) => db.transaction(fn);

module.exports = {
  Database,
  db,
  acikMi,
  hamBaglanti,
  ac,
  close,
  checkpoint,
  getDbKey,
  isEncrypted,
  getDbPath,
  getDbKeyPath,
  getUploadsDir,
  islem,
};
