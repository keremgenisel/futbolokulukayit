// ── SQLite depolama katmanı ──
// Şifreli-yetenekli better-sqlite3-multiple-ciphers önce denenir; anahtar OS anahtarlığında
// (safeStorage: Windows DPAPI / macOS Keychain) şifreli dosyada tutulur. safeStorage yoksa
// DB düz kalır. Renderer bu modülü hiç görmez; ipc/data.cjs üzerinden çağrılır.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
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

let db = null;
const getDbPath = () => path.join(app.getPath("userData"), "data.db");
const getDbKeyPath = () => path.join(app.getPath("userData"), "db-key.enc");
const getUploadsDir = () => path.join(app.getPath("userData"), "uploads");

// ── Şifreleme anahtarı ──
let cachedDbKey; // undefined: hesaplanmadı, null: şifreleme yok, string: anahtar
function getDbKey() {
  if (cachedDbKey !== undefined) return cachedDbKey;
  if (!dbEncryptable) return (cachedDbKey = null);
  let canEncrypt = false;
  try { canEncrypt = !!safeStorage?.isEncryptionAvailable?.(); } catch { canEncrypt = false; }
  if (!canEncrypt) return (cachedDbKey = null);
  const p = getDbKeyPath();
  try {
    if (fs.existsSync(p)) return (cachedDbKey = safeStorage.decryptString(fs.readFileSync(p)));
  } catch (e) { console.error("[db] anahtar okunamadı:", e.message); }
  const key = crypto.randomBytes(32).toString("hex");
  try { fs.writeFileSync(p, safeStorage.encryptString(key)); cachedDbKey = key; }
  catch (e) { console.error("[db] anahtar kaydedilemedi, şifreleme kapalı:", e.message); cachedDbKey = null; }
  return cachedDbKey;
}
const isEncrypted = () => !!getDbKey();

// ── Şema ──
const SCHEMA_VERSION = 1;
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ad_soyad TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS age_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad TEXT NOT NULL,
  sezon TEXT NOT NULL DEFAULT '',
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tc_no TEXT UNIQUE,
  ad_soyad TEXT NOT NULL,
  dogum_tarihi TEXT,
  dogum_yeri TEXT DEFAULT '',
  okul TEXT DEFAULT '',
  gsm TEXT DEFAULT '',
  adres TEXT DEFAULT '',
  kan_grubu TEXT DEFAULT '',
  foto_yolu TEXT DEFAULT '',
  yas_grubu_id INTEGER REFERENCES age_groups(id) ON DELETE SET NULL,
  durum TEXT NOT NULL DEFAULT 'aktif',            -- aktif|deneme|pasif|ayrildi|sakat|dondurma
  ucret_tipi TEXT NOT NULL DEFAULT 'normal',      -- normal|burslu|indirimli|kardes|ucretsiz
  aylik_aidat REAL NOT NULL DEFAULT 0,
  odeme_donemi TEXT NOT NULL DEFAULT '1-10',      -- 1-10|11-20|21-31
  kayit_tarihi TEXT NOT NULL DEFAULT (date('now')),
  notlar TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_players_grup ON players(yas_grubu_id);
CREATE INDEX IF NOT EXISTS idx_players_durum ON players(durum);

CREATE TABLE IF NOT EXISTS guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tip TEXT NOT NULL DEFAULT 'veli',               -- anne|baba|veli
  ad_soyad TEXT NOT NULL,
  gsm TEXT DEFAULT '',
  whatsapp_no TEXT DEFAULT '',
  veli_mi INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ad_soyad TEXT NOT NULL,
  yakinlik TEXT DEFAULT '',
  telefon TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tip TEXT NOT NULL,                              -- saglik|foto|sporcu_kimlik|veli_kimlik|kayit_formu|makbuz|diger
  dosya_yolu TEXT NOT NULL,
  orijinal_ad TEXT DEFAULT '',
  gecerlilik_tarihi TEXT,
  yuklenme_tarihi TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fee_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  ad TEXT NOT NULL,
  varsayilan_fiyat REAL NOT NULL DEFAULT 0,
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS monthly_dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  yil INTEGER NOT NULL,
  ay INTEGER NOT NULL,
  tutar REAL NOT NULL DEFAULT 0,
  durum TEXT NOT NULL DEFAULT 'odenmedi',         -- odenmedi|odendi|muaf
  receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
  UNIQUE(player_id, yil, ay)
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  makbuz_no TEXT NOT NULL UNIQUE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  tarih TEXT NOT NULL,
  toplam REAL NOT NULL DEFAULT 0,
  odeme_yontemi TEXT NOT NULL DEFAULT 'nakit',    -- nakit|havale|kredi_karti|online
  tahsil_eden TEXT DEFAULT '',
  not_ TEXT DEFAULT '',
  pdf_yolu TEXT DEFAULT '',
  iptal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  fee_item_id INTEGER REFERENCES fee_items(id) ON DELETE SET NULL,
  aciklama TEXT DEFAULT '',
  tutar REAL NOT NULL DEFAULT 0,
  yil INTEGER,
  ay INTEGER
);

CREATE TABLE IF NOT EXISTS trainings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  age_group_id INTEGER NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  tarih TEXT NOT NULL,
  saat TEXT DEFAULT '',
  saha TEXT DEFAULT '',
  iptal INTEGER NOT NULL DEFAULT 0,
  iptal_nedeni TEXT DEFAULT '',
  notlar TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  durum TEXT NOT NULL,                            -- geldi|gelmedi|izinli
  UNIQUE(training_id, player_id)
);

CREATE TABLE IF NOT EXISTS message_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  kanal TEXT NOT NULL DEFAULT 'whatsapp',
  tip TEXT NOT NULL,
  metin TEXT NOT NULL,
  durum TEXT NOT NULL DEFAULT 'hazir',
  tarih TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`;

const FEE_ITEMS = [
  ["aidat", "Aidat"], ["forma", "Forma"], ["yagmurluk", "Yağmurluk"], ["esofman", "Eşofman Takımı"],
  ["mont", "Mont"], ["ayakkabi", "Ayakkabı"], ["canta", "Çanta"], ["top", "Top"],
  ["corap", "Çorap"], ["eldiven_bere", "Eldiven & Bere"],
];

function openDb(dbPath) {
  const conn = new Database(dbPath);
  const key = getDbKey();
  if (key) conn.pragma(`key='${key}'`);
  return conn;
}

function init() {
  if (db) return db; // zaten açık (idempotent)
  if (!Database) throw new Error("SQLite modülü yok");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.mkdirSync(getUploadsDir(), { recursive: true });
  db = openDb(getDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  migrate();
  seed();
  return db;
}

function migrate() {
  const cur = Number(getMetaValue("schema_version") || 0);
  // İleride: if (cur < 2) { ...ALTER TABLE...; }
  if (cur < SCHEMA_VERSION) setMetaValue("schema_version", String(SCHEMA_VERSION));
}

function seed() {
  const ins = db.prepare("INSERT OR IGNORE INTO fee_items (kod, ad, sira) VALUES (?, ?, ?)");
  FEE_ITEMS.forEach(([kod, ad], i) => ins.run(kod, ad, i));
  if (!getUserByUsername("admin")) {
    // İlk kurulum: admin/admin, ilk girişte parola değişimi zorunlu.
    createUser({ username: "admin", password: "admin", ad_soyad: "Yönetici", role: "admin", must_change_password: 1 });
  }
}

function close() { if (db) { db.close(); db = null; } }
const checkpoint = () => { try { db?.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* yoksay */ } };

// ── meta / settings ──
const getMetaValue = (k) => db.prepare("SELECT value FROM meta WHERE key=?").get(k)?.value ?? null;
const setMetaValue = (k, v) => db.prepare("INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);
const getSetting = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? null;
const setSetting = (k, v) => db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);

// ── users ──
const getUserByUsername = (u) => db.prepare("SELECT * FROM users WHERE username=?").get(u) || null;
function createUser({ username, password, ad_soyad = "", role = "admin", must_change_password = 0 }) {
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare("INSERT INTO users (username,password_hash,ad_soyad,role,must_change_password) VALUES (?,?,?,?,?)")
    .run(username, hash, ad_soyad, role, must_change_password);
  return { id: Number(r.lastInsertRowid), username, ad_soyad, role };
}
function verifyPassword(username, password) {
  const u = getUserByUsername(username);
  if (!u || !u.is_active) return null;
  if (!bcrypt.compareSync(password, u.password_hash)) return null;
  const { password_hash: _h, ...safe } = u;
  return safe;
}
function changePassword(username, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE username=?").run(hash, username);
}

// ── age groups ──
const listAgeGroups = () => db.prepare("SELECT * FROM age_groups ORDER BY sira, ad").all();
function createAgeGroup({ ad, sezon = "", sira = 0 }) {
  const r = db.prepare("INSERT INTO age_groups (ad,sezon,sira) VALUES (?,?,?)").run(ad, sezon, sira);
  return { id: Number(r.lastInsertRowid), ad, sezon, sira, aktif: 1 };
}
const updateAgeGroup = (id, { ad, sezon, sira, aktif }) =>
  db.prepare("UPDATE age_groups SET ad=COALESCE(?,ad), sezon=COALESCE(?,sezon), sira=COALESCE(?,sira), aktif=COALESCE(?,aktif) WHERE id=?").run(ad, sezon, sira, aktif, id);

// ── players ──
const PLAYER_FIELDS = ["tc_no","ad_soyad","dogum_tarihi","dogum_yeri","okul","gsm","adres","kan_grubu","foto_yolu","yas_grubu_id","durum","ucret_tipi","aylik_aidat","odeme_donemi","kayit_tarihi","notlar"];
function createPlayer(p) {
  const cols = PLAYER_FIELDS.filter((f) => p[f] !== undefined);
  const r = db.prepare(`INSERT INTO players (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => p[c]));
  return getPlayer(Number(r.lastInsertRowid));
}
function updatePlayer(id, p) {
  const cols = PLAYER_FIELDS.filter((f) => p[f] !== undefined);
  if (!cols.length) return getPlayer(id);
  db.prepare(`UPDATE players SET ${cols.map((c) => `${c}=?`).join(",")}, updated_at=datetime('now') WHERE id=?`).run(...cols.map((c) => p[c]), id);
  return getPlayer(id);
}
const getPlayer = (id) => db.prepare("SELECT p.*, g.ad AS yas_grubu_ad FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE p.id=?").get(id) || null;
function listPlayers({ q = "", yas_grubu_id = null, durum = null } = {}) {
  const where = []; const args = [];
  if (q) { where.push("(p.ad_soyad LIKE ? OR p.tc_no LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (yas_grubu_id) { where.push("p.yas_grubu_id=?"); args.push(yas_grubu_id); }
  if (durum) { where.push("p.durum=?"); args.push(durum); }
  const sql = `SELECT p.*, g.ad AS yas_grubu_ad FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.ad_soyad`;
  return db.prepare(sql).all(...args);
}
const deletePlayer = (id) => db.prepare("DELETE FROM players WHERE id=?").run(id);

// ── guardians / emergency ──
const listGuardians = (pid) => db.prepare("SELECT * FROM guardians WHERE player_id=? ORDER BY veli_mi DESC, id").all(pid);
function addGuardian(pid, g) {
  const r = db.prepare("INSERT INTO guardians (player_id,tip,ad_soyad,gsm,whatsapp_no,veli_mi) VALUES (?,?,?,?,?,?)")
    .run(pid, g.tip || "veli", g.ad_soyad, g.gsm || "", g.whatsapp_no || "", g.veli_mi ? 1 : 0);
  return Number(r.lastInsertRowid);
}
const deleteGuardian = (id) => db.prepare("DELETE FROM guardians WHERE id=?").run(id);
const listEmergency = (pid) => db.prepare("SELECT * FROM emergency_contacts WHERE player_id=? ORDER BY id").all(pid);
function addEmergency(pid, e) {
  const r = db.prepare("INSERT INTO emergency_contacts (player_id,ad_soyad,yakinlik,telefon) VALUES (?,?,?,?)").run(pid, e.ad_soyad, e.yakinlik || "", e.telefon || "");
  return Number(r.lastInsertRowid);
}
const deleteEmergency = (id) => db.prepare("DELETE FROM emergency_contacts WHERE id=?").run(id);

// ── documents ──
const listDocuments = (pid) => db.prepare("SELECT * FROM documents WHERE player_id=? ORDER BY yuklenme_tarihi DESC").all(pid);
function addDocument(pid, d) {
  const r = db.prepare("INSERT INTO documents (player_id,tip,dosya_yolu,orijinal_ad,gecerlilik_tarihi) VALUES (?,?,?,?,?)")
    .run(pid, d.tip, d.dosya_yolu, d.orijinal_ad || "", d.gecerlilik_tarihi || null);
  return Number(r.lastInsertRowid);
}
const deleteDocument = (id) => db.prepare("DELETE FROM documents WHERE id=?").run(id);
const getDocument = (id) => db.prepare("SELECT * FROM documents WHERE id=?").get(id) || null;

// ── fee items ──
const listFeeItems = () => db.prepare("SELECT * FROM fee_items ORDER BY sira, id").all();
const updateFeeItem = (id, { ad, varsayilan_fiyat, aktif }) =>
  db.prepare("UPDATE fee_items SET ad=COALESCE(?,ad), varsayilan_fiyat=COALESCE(?,varsayilan_fiyat), aktif=COALESCE(?,aktif) WHERE id=?").run(ad, varsayilan_fiyat, aktif, id);

// ── monthly dues ──
// Aidat ödemesi beklenen durumlar. Ücretsiz/burslu ücret tipi ve dondurma/pasif/ayrıldı durumu muaf.
const MUAF_UCRET = new Set(["ucretsiz", "burslu"]);
const AIDAT_DURUM = new Set(["aktif", "deneme", "sakat"]);
function ensureMonthlyDues(yil, ay) {
  const players = db.prepare("SELECT id, durum, ucret_tipi, aylik_aidat FROM players").all();
  const ins = db.prepare("INSERT OR IGNORE INTO monthly_dues (player_id,yil,ay,tutar,durum) VALUES (?,?,?,?,?)");
  let n = 0;
  const tx = db.transaction(() => {
    for (const p of players) {
      if (!AIDAT_DURUM.has(p.durum)) continue;
      const muaf = MUAF_UCRET.has(p.ucret_tipi) || !(p.aylik_aidat > 0);
      const r = ins.run(p.id, yil, ay, muaf ? 0 : p.aylik_aidat, muaf ? "muaf" : "odenmedi");
      n += r.changes;
    }
  });
  tx();
  return n;
}
const getDue = (pid, yil, ay) => db.prepare("SELECT * FROM monthly_dues WHERE player_id=? AND yil=? AND ay=?").get(pid, yil, ay) || null;
const listDues = (pid) => db.prepare("SELECT * FROM monthly_dues WHERE player_id=? ORDER BY yil DESC, ay DESC").all(pid);
const listUnpaid = (yil, ay) => db.prepare(
  "SELECT d.*, p.ad_soyad, p.odeme_donemi, g.ad AS yas_grubu_ad FROM monthly_dues d JOIN players p ON p.id=d.player_id LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE d.yil=? AND d.ay=? AND d.durum='odenmedi' ORDER BY p.ad_soyad"
).all(yil, ay);

// ── receipts ──
function nextReceiptNo(yil) {
  const last = db.prepare("SELECT makbuz_no FROM receipts WHERE makbuz_no LIKE ? ORDER BY makbuz_no DESC LIMIT 1").get(`${yil}-%`);
  const n = last ? Number(last.makbuz_no.split("-")[1]) + 1 : 1;
  return `${yil}-${String(n).padStart(4, "0")}`;
}
function createReceipt({ player_id, tarih, odeme_yontemi = "nakit", tahsil_eden = "", not_ = "", satirlar = [] }) {
  const yil = Number(String(tarih).slice(0, 4));
  const toplam = satirlar.reduce((s, l) => s + Number(l.tutar || 0), 0);
  const tx = db.transaction(() => {
    const makbuz_no = nextReceiptNo(yil);
    const r = db.prepare("INSERT INTO receipts (makbuz_no,player_id,tarih,toplam,odeme_yontemi,tahsil_eden,not_) VALUES (?,?,?,?,?,?,?)")
      .run(makbuz_no, player_id, tarih, toplam, odeme_yontemi, tahsil_eden, not_);
    const rid = Number(r.lastInsertRowid);
    const insLine = db.prepare("INSERT INTO receipt_lines (receipt_id,fee_item_id,aciklama,tutar,yil,ay) VALUES (?,?,?,?,?,?)");
    const aidatId = db.prepare("SELECT id FROM fee_items WHERE kod='aidat'").get()?.id;
    for (const l of satirlar) {
      insLine.run(rid, l.fee_item_id || null, l.aciklama || "", Number(l.tutar || 0), l.yil || null, l.ay || null);
      if (l.fee_item_id === aidatId && l.yil && l.ay) {
        db.prepare("INSERT INTO monthly_dues (player_id,yil,ay,tutar,durum,receipt_id) VALUES (?,?,?,?,'odendi',?) ON CONFLICT(player_id,yil,ay) DO UPDATE SET durum='odendi', receipt_id=excluded.receipt_id, tutar=excluded.tutar")
          .run(player_id, l.yil, l.ay, Number(l.tutar || 0), rid);
      }
    }
    return { id: rid, makbuz_no };
  });
  return tx();
}
function getReceipt(id) {
  const r = db.prepare("SELECT r.*, p.ad_soyad, p.dogum_tarihi, g.ad AS yas_grubu_ad FROM receipts r JOIN players p ON p.id=r.player_id LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE r.id=?").get(id);
  if (!r) return null;
  r.satirlar = db.prepare("SELECT l.*, f.ad AS kalem_ad, f.kod AS kalem_kod FROM receipt_lines l LEFT JOIN fee_items f ON f.id=l.fee_item_id WHERE l.receipt_id=? ORDER BY l.id").all(id);
  return r;
}
const listReceipts = (pid) => db.prepare("SELECT * FROM receipts WHERE player_id=? ORDER BY tarih DESC, id DESC").all(pid);
const listReceiptsByDate = (from, to) => db.prepare("SELECT r.*, p.ad_soyad FROM receipts r JOIN players p ON p.id=r.player_id WHERE r.tarih BETWEEN ? AND ? AND r.iptal=0 ORDER BY r.tarih, r.id").all(from, to);
const setReceiptPdf = (id, pdf_yolu) => db.prepare("UPDATE receipts SET pdf_yolu=? WHERE id=?").run(pdf_yolu, id);

// ── trainings / attendance ──
function createTraining({ age_group_id, tarih, saat = "", saha = "" }) {
  const r = db.prepare("INSERT INTO trainings (age_group_id,tarih,saat,saha) VALUES (?,?,?,?)").run(age_group_id, tarih, saat, saha);
  return { id: Number(r.lastInsertRowid), age_group_id, tarih, saat, saha };
}
const listTrainings = (from, to) => db.prepare("SELECT t.*, g.ad AS yas_grubu_ad FROM trainings t JOIN age_groups g ON g.id=t.age_group_id WHERE t.tarih BETWEEN ? AND ? ORDER BY t.tarih, t.saat").all(from, to);
const cancelTraining = (id, neden = "") => db.prepare("UPDATE trainings SET iptal=1, iptal_nedeni=? WHERE id=?").run(neden, id);
const setAttendance = (tid, pid, durum) => db.prepare("INSERT INTO attendance (training_id,player_id,durum) VALUES (?,?,?) ON CONFLICT(training_id,player_id) DO UPDATE SET durum=excluded.durum").run(tid, pid, durum);
const listAttendance = (tid) => db.prepare("SELECT a.*, p.ad_soyad FROM attendance a JOIN players p ON p.id=a.player_id WHERE a.training_id=? ORDER BY p.ad_soyad").all(tid);
const playerAttendance = (pid, from, to) => db.prepare("SELECT a.durum, t.tarih, t.saat FROM attendance a JOIN trainings t ON t.id=a.training_id WHERE a.player_id=? AND t.tarih BETWEEN ? AND ? ORDER BY t.tarih").all(pid, from, to);


// ── Ek sorgular (ekranlar) ──
const deleteAgeGroup = (id) => {
  const n = db.prepare("SELECT count(*) AS n FROM players WHERE yas_grubu_id=?").get(id).n;
  if (n > 0) return { error: `Bu grupta ${n} oyuncu var, önce oyuncuları taşıyın` };
  db.prepare("DELETE FROM age_groups WHERE id=?").run(id);
  return { ok: true };
};

// Oyuncu listesi + verilen ayın aidat durumu (liste ekranı ve tesise giriş kontrolü).
function listPlayersWithDue({ q = "", yas_grubu_id = null, durum = null, yil, ay, sadeceOdemeyen = false } = {}) {
  const where = []; const args = [yil, ay];
  if (q) { where.push("(p.ad_soyad LIKE ? OR p.tc_no LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (yas_grubu_id) { where.push("p.yas_grubu_id=?"); args.push(yas_grubu_id); }
  if (durum) { where.push("p.durum=?"); args.push(durum); }
  if (sadeceOdemeyen) where.push("d.durum='odenmedi'");
  const sql = `SELECT p.*, g.ad AS yas_grubu_ad, d.durum AS aidat_durum, d.tutar AS aidat_tutar
    FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id
    LEFT JOIN monthly_dues d ON d.player_id=p.id AND d.yil=? AND d.ay=?
    ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.ad_soyad`;
  return db.prepare(sql).all(...args);
}

// Pano özeti.
function panoOzet({ yil, ay, bugun }) {
  const aktif = db.prepare("SELECT count(*) AS n FROM players WHERE durum IN ('aktif','deneme','sakat')").get().n;
  const grup = db.prepare("SELECT count(*) AS n FROM age_groups WHERE aktif=1").get().n;
  const odeyen = db.prepare("SELECT count(*) AS n FROM monthly_dues WHERE yil=? AND ay=? AND durum='odendi'").get(yil, ay).n;
  const borclu = db.prepare("SELECT count(*) AS n FROM monthly_dues WHERE yil=? AND ay=? AND durum='odenmedi'").get(yil, ay).n;
  const antrenmanlar = db.prepare(`SELECT t.*, g.ad AS yas_grubu_ad,
      (SELECT count(*) FROM players p WHERE p.yas_grubu_id=t.age_group_id AND p.durum IN ('aktif','deneme','sakat')) AS oyuncu,
      (SELECT count(*) FROM attendance a WHERE a.training_id=t.id) AS isaretli,
      (SELECT count(*) FROM attendance a WHERE a.training_id=t.id AND a.durum='geldi') AS geldi
    FROM trainings t JOIN age_groups g ON g.id=t.age_group_id WHERE t.tarih=? ORDER BY t.saat`).all(bugun);
  const bugunTahsilat = db.prepare("SELECT COALESCE(sum(toplam),0) AS t FROM receipts WHERE tarih=? AND iptal=0").get(bugun).t;
  return { aktif, grup, odeyen, borclu, antrenmanlar, bugunTahsilat };
}

const cancelReceipt = (id) => {
  const tx = db.transaction(() => {
    db.prepare("UPDATE receipts SET iptal=1 WHERE id=?").run(id);
    db.prepare("UPDATE monthly_dues SET durum='odenmedi', receipt_id=NULL WHERE receipt_id=?").run(id);
  });
  tx();
  return { ok: true };
};

// Bir oyuncunun son N ay yoklama özeti.
const attendanceSummary = (pid, from, to) => db.prepare(
  "SELECT a.durum, count(*) AS n FROM attendance a JOIN trainings t ON t.id=a.training_id WHERE a.player_id=? AND t.tarih BETWEEN ? AND ? AND t.iptal=0 GROUP BY a.durum"
).all(pid, from, to);

// Yoklama raporu: tarih aralığında oyuncu bazında geldi/gelmedi/izinli sayıları.
const attendanceReport = (from, to, age_group_id = null) => db.prepare(`
  SELECT p.id, p.ad_soyad, g.ad AS yas_grubu_ad,
    sum(CASE WHEN a.durum='geldi' THEN 1 ELSE 0 END) AS geldi,
    sum(CASE WHEN a.durum='gelmedi' THEN 1 ELSE 0 END) AS gelmedi,
    sum(CASE WHEN a.durum='izinli' THEN 1 ELSE 0 END) AS izinli
  FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id
  LEFT JOIN attendance a ON a.player_id=p.id
  LEFT JOIN trainings t ON t.id=a.training_id AND t.tarih BETWEEN ? AND ? AND t.iptal=0
  WHERE (? IS NULL OR p.yas_grubu_id=?) AND p.durum IN ('aktif','deneme','sakat')
  GROUP BY p.id ORDER BY g.sira, p.ad_soyad`).all(from, to, age_group_id, age_group_id);

const listUsers = () => db.prepare("SELECT id, username, ad_soyad, role, is_active, must_change_password FROM users ORDER BY username").all();
const setUserActive = (id, aktif) => db.prepare("UPDATE users SET is_active=? WHERE id=?").run(aktif ? 1 : 0, id);
const resetUserPassword = (id, yeni) => db.prepare("UPDATE users SET password_hash=?, must_change_password=1, token_version=token_version+1 WHERE id=?").run(bcrypt.hashSync(yeni, 10), id);

// ── Lisans (GenCRM modeli; docs/plan.md §7) ──
const lisansM = require("./lisans.cjs");
const lisansKalici = require("./lisansKalici.cjs");
let lisansCache = null;     // { anahtar, makineId, kurulumTarihi, lease }
let sonGorulenCache = null; // bellek içi saat işareti (yalnız gün değişince diske yazılır)
const busimdi = () => new Date().toISOString().slice(0, 10);
const getLisansMetaPath = () => path.join(app.getPath("userData"), "lisans-meta.enc");
function getSafeStorage() {
  try { return safeStorage?.isEncryptionAvailable?.() ? safeStorage : null; } catch { return null; }
}
function kaliciMetaOku() {
  const ss = getSafeStorage();
  try { if (ss && fs.existsSync(getLisansMetaPath())) return JSON.parse(ss.decryptString(fs.readFileSync(getLisansMetaPath()))); } catch { /* bozuk → yok say */ }
  return null;
}
function kaliciMetaYaz(obj) {
  const ss = getSafeStorage();
  if (!ss) return;
  try { fs.writeFileSync(getLisansMetaPath(), ss.encryptString(JSON.stringify(obj))); } catch { /* sessiz, DB meta yedek */ }
}
function lisansDurumu() {
  if (!db) return lisansM.durumHesapla({});
  const bugun = busimdi();
  if (!lisansCache) {
    const dosya = kaliciMetaOku();
    const meta = { makineId: getMetaValue("makineId"), kurulumTarihi: getMetaValue("kurulumTarihi"), sonGorulen: getMetaValue("sonGorulenTarih"), lease: getMetaValue("lisansLease") || null };
    const m = lisansKalici.birlestir({ dosya, meta, bugun, yeniMakineId: crypto.randomUUID() });
    setMetaValue("makineId", m.makineId);
    setMetaValue("kurulumTarihi", m.kurulumTarihi);
    lisansCache = { anahtar: getMetaValue("lisansAnahtari"), makineId: m.makineId, kurulumTarihi: m.kurulumTarihi, lease: m.lease };
    sonGorulenCache = m.sonGorulen;
    kaliciMetaYaz({ makineId: m.makineId, kurulumTarihi: m.kurulumTarihi, sonGorulen: sonGorulenCache, lease: m.lease });
  }
  const durum = lisansM.durumHesapla({
    anahtar: lisansCache.anahtar, kurulumTarihi: lisansCache.kurulumTarihi,
    makineId: lisansCache.makineId, sonGorulen: sonGorulenCache, lease: lisansCache.lease, simdi: bugun,
  });
  const ileri = lisansKalici.enIleri(sonGorulenCache, bugun);
  if (ileri !== sonGorulenCache) {
    sonGorulenCache = ileri;
    setMetaValue("sonGorulenTarih", ileri);
    kaliciMetaYaz({ makineId: lisansCache.makineId, kurulumTarihi: lisansCache.kurulumTarihi, sonGorulen: ileri, lease: lisansCache.lease });
  }
  return { ...durum, makineId: lisansCache.makineId };
}
function lisansKaydet(anahtar) {
  const d = lisansM.dogrula(anahtar);
  if (!d.gecerli) return { error: d.neden === "imza" ? "Anahtar imzası geçersiz" : "Anahtar biçimi geçersiz" };
  setMetaValue("lisansAnahtari", String(anahtar).trim());
  lisansCache = null;
  return { ok: true, durum: lisansDurumu() };
}
function leaseKaydet(lease) {
  const temiz = String(lease || "").trim();
  const ld = lisansM.leaseDogrula(temiz);
  if (!ld.gecerli) return { error: ld.neden === "imza" ? "Lease imzası geçersiz" : "Lease biçimi geçersiz" };
  lisansDurumu();
  if (ld.payload.makineId != null && lisansCache?.makineId && ld.payload.makineId !== lisansCache.makineId) {
    return { error: "Bu lease bu makineye ait değil" };
  }
  lisansCache.lease = temiz;
  setMetaValue("lisansLease", temiz);
  kaliciMetaYaz({ makineId: lisansCache.makineId, kurulumTarihi: lisansCache.kurulumTarihi, sonGorulen: sonGorulenCache, lease: temiz });
  return { ok: true, durum: lisansDurumu() };
}
async function lisansAktiflestir(surum = "") {
  const anahtar = getMetaValue("lisansAnahtari");
  if (!anahtar) return { error: "Önce lisans anahtarını kaydedin, sonra Aktive Et'e basın" };
  const ai = require("./aktivasyonIstemci.cjs");
  const r = await ai.aktive(anahtar, lisansDurumu().makineId, surum);
  return r.error ? r : leaseKaydet(r.lease);
}
async function lisansYenile() {
  const anahtar = getMetaValue("lisansAnahtari");
  const ai = require("./aktivasyonIstemci.cjs");
  if (!anahtar || !ai.ayarli()) return { ok: true, durum: lisansDurumu() };
  const r = await ai.yenile(anahtar, lisansDurumu().makineId);
  return r.error ? r : leaseKaydet(r.lease);
}
const lisansSaltOkunurMu = () => lisansDurumu().mod === "saltOkunur";


// ── Yedek doğrulama (geri yükleme öncesi) ──
// Verilen data.db dosyasını BU makinenin anahtarıyla açmayı dener; açılırsa özet döner.
// Başka bir PC'de alınmış (farklı anahtarla şifreli) yedek burada açılamaz → { error }.
function yedekBilgisi(dbPath) {
  if (!Database) return { error: "SQLite modülü yok" };
  if (!fs.existsSync(dbPath)) return { error: "Yedek klasöründe data.db yok" };
  let conn = null;
  try {
    conn = new Database(dbPath, { readonly: true });
    const key = getDbKey();
    if (key) conn.pragma(`key='${key}'`);
    const sv = Number(conn.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value || 0);
    if (!sv) return { error: "Bu dosya bir Eyüpspor veritabanı değil" };
    if (sv > SCHEMA_VERSION) return { error: `Yedek daha yeni bir program sürümünden (şema ${sv}); önce programı güncelleyin` };
    const oyuncu = conn.prepare("SELECT count(*) AS n FROM players").get().n;
    const makbuz = conn.prepare("SELECT count(*) AS n FROM receipts").get().n;
    const sonMakbuz = conn.prepare("SELECT max(tarih) AS t FROM receipts").get().t;
    return { ok: true, oyuncu, makbuz, sonMakbuz, schema: sv };
  } catch (e) {
    const m = String(e.message || e);
    if (/not a database|file is encrypted|malformed/i.test(m)) return { error: "Yedek açılamadı: başka bir bilgisayarda alınmış olabilir (şifreleme anahtarı farklı) ya da dosya bozuk" };
    return { error: "Yedek açılamadı: " + m };
  } finally { try { conn?.close(); } catch {} }
}

module.exports = {
  init, close, checkpoint, isEncrypted, getUploadsDir, getDbPath, yedekBilgisi,
  getMetaValue, setMetaValue, getSetting, setSetting,
  getUserByUsername, createUser, verifyPassword, changePassword,
  listAgeGroups, createAgeGroup, updateAgeGroup,
  createPlayer, updatePlayer, getPlayer, listPlayers, deletePlayer,
  listGuardians, addGuardian, deleteGuardian, listEmergency, addEmergency, deleteEmergency,
  listDocuments, addDocument, deleteDocument, getDocument,
  listFeeItems, updateFeeItem,
  ensureMonthlyDues, getDue, listDues, listUnpaid,
  createReceipt, getReceipt, listReceipts, listReceiptsByDate, setReceiptPdf,
  createTraining, listTrainings, cancelTraining, setAttendance, listAttendance, playerAttendance,
  deleteAgeGroup, listPlayersWithDue, panoOzet, cancelReceipt, attendanceSummary, attendanceReport,
  listUsers, setUserActive, resetUserPassword,
  lisansDurumu, lisansKaydet, leaseKaydet, lisansAktiflestir, lisansYenile, lisansSaltOkunurMu,
};
