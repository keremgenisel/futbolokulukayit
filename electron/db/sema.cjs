// ── Şema, göç ve tohum ──
const { db, ac, acikMi, hamBaglanti } = require("./baglanti.cjs");
const { getMetaValue, setMetaValue } = require("./meta.cjs");
const { createUser } = require("./kullanicilar.cjs");
const { araNormalize } = require("../metin.cjs");

const SCHEMA_VERSION = 11; // …9: WhatsApp (guardians.mesaj_onayi, message_log, trainings.bildirim_gerekli/degisiklik_notu); 10: trainings.grup_bildirim; 11: bildirim olayı (trainings.bildirim_olay, message_log.olay)
// WhatsApp mesaj kayıtları (şema 9). İlk iskelette (06.09.2026) aynı adla farklı sütunlu, hiç yazılmamış bir tablo vardı;
// migrate() onu tanıyıp (tur sütunu yok) boşsa siler, doluysa message_log_eski_v1 olarak kenara alır.
const MESSAGE_LOG_SQL = `CREATE TABLE IF NOT EXISTS message_log (             -- WhatsApp'ta açılan hatırlatma/bildirimler (gönderim program dışında)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guardian_id INTEGER REFERENCES guardians(id) ON DELETE SET NULL,
  tur TEXT NOT NULL,                                  -- aidat|genel|iptal|degisiklik
  yil INTEGER, ay INTEGER,                            -- aidat hatırlatmasının dönemi
  training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
  metin TEXT NOT NULL DEFAULT '',
  tarih TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  kullanici TEXT DEFAULT '',
  olay TEXT DEFAULT ''                                -- iptal/değişiklik bildirimi: antrenmanın o anki bildirim_olay damgası (şema 11)
);`;

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

-- Parola kurtarma kodları: tek kullanımlık, bcrypt ile saklanır; kullanıcı başına yeni set eskisini siler.
CREATE TABLE IF NOT EXISTS recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS age_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad TEXT NOT NULL,
  sezon TEXT NOT NULL DEFAULT '',
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1,
  program TEXT NOT NULL DEFAULT '[]'              -- haftalık antrenman programı JSON: [{gun:1..7, saat, saha}]
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tc_no TEXT UNIQUE,
  uyruk TEXT NOT NULL DEFAULT 'tc',               -- tc | yabanci (yabancıda TC yerine pasaport no)
  pasaport_no TEXT,
  sezon TEXT NOT NULL DEFAULT '',                 -- son yenilenen sezon (2027-2028); yeni sezon sihirbazı yazar
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
  veli_mi INTEGER NOT NULL DEFAULT 0,
  mesaj_onayi INTEGER NOT NULL DEFAULT 1              -- WhatsApp ile bilgilendirme onayı (KVKK; kulüp kararı: varsayılan onaylı)
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

CREATE TABLE IF NOT EXISTS fee_types (           -- ücret tipleri (Ayarlar > Aidat Kalemleri; players.ucret_tipi = kod)
  kod TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  indirim INTEGER NOT NULL DEFAULT 0,             -- aidat taban fiyatından düşülen yüzde (0-100)
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1,
  sabit INTEGER NOT NULL DEFAULT 0                -- 1: normal/ucretsiz — indirimi ve varlığı değiştirilemez
);

CREATE TABLE IF NOT EXISTS monthly_dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  yil INTEGER NOT NULL,
  ay INTEGER NOT NULL,
  tutar REAL NOT NULL DEFAULT 0,                  -- beklenen aylık aidat
  odenen REAL NOT NULL DEFAULT 0,                 -- makbuzlarla tahsil edilen toplam (kısmi ödeme)
  durum TEXT NOT NULL DEFAULT 'odenmedi',         -- odenmedi|kismi|odendi|muaf
  receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,  -- son makbuz
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
  iptal_nedeni TEXT DEFAULT '',
  iptal_eden TEXT DEFAULT '',
  iptal_zamani TEXT,
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
  notlar TEXT DEFAULT '',
  bildirim_gerekli INTEGER NOT NULL DEFAULT 0,        -- elle iptal/değişiklik yapıldı, veliler henüz bilgilendirilmedi
  degisiklik_notu TEXT DEFAULT '',                    -- son değişikliğin eski değerleri JSON {eskiTarih, eskiSaat, eskiSaha, zaman}
  grup_bildirim TEXT DEFAULT '',                      -- veli WhatsApp grubuna tek mesaj açıldı: JSON {zaman, kullanici} (şema 10)
  bildirim_olay TEXT DEFAULT ''                       -- son iptal/değişiklik olayının damgası; bildirimler bu olaya bağlanır (şema 11)
);

${MESSAGE_LOG_SQL}

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  durum TEXT NOT NULL,                            -- geldi|gelmedi|izinli
  UNIQUE(training_id, player_id)
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`;

const FEE_ITEMS = [
  ["aidat", "Aidat"],
  ["forma", "Forma"],
  ["yagmurluk", "Yağmurluk"],
  ["esofman", "Eşofman Takımı"],
  ["mont", "Mont"],
  ["ayakkabi", "Ayakkabı"],
  ["canta", "Çanta"],
  ["top", "Top"],
  ["corap", "Çorap"],
  ["eldiven_bere", "Eldiven & Bere"],
];

// Varsayılan ücret tipleri: [kod, ad, indirim %, sabit]. Kalanlar Ayarlar'dan eklenir/silinir.
const FEE_TYPES = [
  ["normal", "Normal", 0, 1],
  ["burslu", "Burslu", 100, 0],
  ["indirimli", "İndirimli", 0, 0],
  ["kardes", "Kardeş İndirimi", 0, 0],
  ["ucretsiz", "Ücretsiz", 100, 1],
];

function init() {
  if (acikMi()) return hamBaglanti(); // zaten açık (idempotent)
  const conn = ac();
  // Türkçe duyarsız arama: SQLite LIKE yalnız ASCII'de büyük/küçük harf duyarsızdır ("i" → "İbrahim" bulunmazdı)
  conn.function("tr_ara", { deterministic: true }, (s) => araNormalize(s));
  conn.exec(SCHEMA_SQL);
  migrate();
  seed();
  return conn;
}

function migrate() {
  const cur = Number(getMetaValue("schema_version") || 0);
  // 3: yabancı uyruklu oyuncular için pasaport no (eski DB'lerde sütun yoksa ekle; CREATE TABLE yenilerde zaten içerir)
  const kolonlar = new Set(
    db
      .prepare("PRAGMA table_info(players)")
      .all()
      .map((c) => c.name),
  );
  if (!kolonlar.has("uyruk")) db.exec("ALTER TABLE players ADD COLUMN uyruk TEXT NOT NULL DEFAULT 'tc'");
  if (!kolonlar.has("pasaport_no")) db.exec("ALTER TABLE players ADD COLUMN pasaport_no TEXT");
  if (!kolonlar.has("sezon")) db.exec("ALTER TABLE players ADD COLUMN sezon TEXT NOT NULL DEFAULT ''");
  const grupKolon = new Set(
    db
      .prepare("PRAGMA table_info(age_groups)")
      .all()
      .map((c) => c.name),
  );
  if (!grupKolon.has("program")) db.exec("ALTER TABLE age_groups ADD COLUMN program TEXT NOT NULL DEFAULT '[]'");
  const makbuzKolon = new Set(
    db
      .prepare("PRAGMA table_info(receipts)")
      .all()
      .map((c) => c.name),
  );
  if (!makbuzKolon.has("iptal_nedeni")) db.exec("ALTER TABLE receipts ADD COLUMN iptal_nedeni TEXT DEFAULT ''");
  if (!makbuzKolon.has("iptal_eden")) db.exec("ALTER TABLE receipts ADD COLUMN iptal_eden TEXT DEFAULT ''");
  if (!makbuzKolon.has("iptal_zamani")) db.exec("ALTER TABLE receipts ADD COLUMN iptal_zamani TEXT");
  const dueKolon = new Set(
    db
      .prepare("PRAGMA table_info(monthly_dues)")
      .all()
      .map((c) => c.name),
  );
  if (!dueKolon.has("odenen")) {
    db.exec("ALTER TABLE monthly_dues ADD COLUMN odenen REAL NOT NULL DEFAULT 0");
    db.exec("UPDATE monthly_dues SET odenen=tutar WHERE durum='odendi'");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_pasaport ON players(pasaport_no) WHERE pasaport_no IS NOT NULL");
  // 9: WhatsApp — veli mesaj onayı (mevcut veliler onaylı: kulüp kararı 07.09.2026), antrenman bildirim alanları
  const veliKolon = new Set(
    db
      .prepare("PRAGMA table_info(guardians)")
      .all()
      .map((c) => c.name),
  );
  if (!veliKolon.has("mesaj_onayi")) db.exec("ALTER TABLE guardians ADD COLUMN mesaj_onayi INTEGER NOT NULL DEFAULT 1");
  const antKolon = new Set(
    db
      .prepare("PRAGMA table_info(trainings)")
      .all()
      .map((c) => c.name),
  );
  if (!antKolon.has("bildirim_gerekli")) db.exec("ALTER TABLE trainings ADD COLUMN bildirim_gerekli INTEGER NOT NULL DEFAULT 0");
  if (!antKolon.has("degisiklik_notu")) db.exec("ALTER TABLE trainings ADD COLUMN degisiklik_notu TEXT DEFAULT ''");
  if (!antKolon.has("grup_bildirim")) db.exec("ALTER TABLE trainings ADD COLUMN grup_bildirim TEXT DEFAULT ''"); // 10
  if (!antKolon.has("bildirim_olay")) db.exec("ALTER TABLE trainings ADD COLUMN bildirim_olay TEXT DEFAULT ''"); // 11
  const mlKolon = new Set(
    db
      .prepare("PRAGMA table_info(message_log)")
      .all()
      .map((c) => c.name),
  );
  if (mlKolon.size && !mlKolon.has("tur")) {
    // ilk iskeletin kullanılmayan message_log'u
    const dolu = db.prepare("SELECT count(*) AS n FROM message_log").get().n > 0;
    db.exec(dolu ? "ALTER TABLE message_log RENAME TO message_log_eski_v1" : "DROP TABLE message_log");
    db.exec(MESSAGE_LOG_SQL);
  }
  const mlKolon2 = new Set(
    db
      .prepare("PRAGMA table_info(message_log)")
      .all()
      .map((c) => c.name),
  );
  if (!mlKolon2.has("olay")) db.exec("ALTER TABLE message_log ADD COLUMN olay TEXT DEFAULT ''"); // 11
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_message_log_player ON message_log(player_id, tur, yil, ay); CREATE INDEX IF NOT EXISTS idx_message_log_training ON message_log(training_id)",
  );
  // 8: ücret tipleri tabloya; eski `indirim_<kod>` ayarları bir kez taşınır (yalnız ilk geçişte, sonra tablo esastır)
  // Varsayılan tipler YALNIZ BİR KEZ tohumlanır (meta bayrağı); yoksa kullanıcının sildiği tip her açılışta geri gelirdi.
  if (!getMetaValue("tohum_fee_types")) {
    const insTip = db.prepare("INSERT OR IGNORE INTO fee_types (kod, ad, indirim, sira, aktif, sabit) VALUES (?,?,?,?,1,?)");
    FEE_TYPES.forEach(([kod, ad, ind, sabit], i) => insTip.run(kod, ad, ind, i, sabit));
    setMetaValue("tohum_fee_types", "1");
  }
  if (cur < 8) {
    for (const r of db.prepare("SELECT key, value FROM settings WHERE key LIKE 'indirim_%'").all()) {
      const y = Math.min(100, Math.max(0, Math.round(Number(r.value) || 0)));
      db.prepare("UPDATE fee_types SET indirim=? WHERE kod=? AND sabit=0").run(y, r.key.slice(8));
    }
  }
  if (cur < SCHEMA_VERSION) setMetaValue("schema_version", String(SCHEMA_VERSION));
}

function seed() {
  // Varsayılan kalemler yalnız bir kez (meta bayrağı): kullanıcının sildiği kalem yeniden açılışta geri gelmemeli.
  if (!getMetaValue("tohum_fee_items")) {
    const ins = db.prepare("INSERT OR IGNORE INTO fee_items (kod, ad, sira) VALUES (?, ?, ?)");
    FEE_ITEMS.forEach(([kod, ad], i) => ins.run(kod, ad, i));
    setMetaValue("tohum_fee_items", "1");
  }
  // İlk kurulum: hiç kullanıcı yoksa admin/admin, ilk girişte parola değişimi zorunlu.
  // (Yalnız "admin yoksa" değil: yeni yönetici ilk admin'i sildiğinde açılışta geri gelmemeli.)
  if (db.prepare("SELECT count(*) AS n FROM users").get().n === 0) {
    createUser({ username: "admin", password: "admin", ad_soyad: "Yönetici", role: "admin", must_change_password: 1 });
  }
}

module.exports = { SCHEMA_VERSION, init, migrate, seed, FEE_ITEMS, FEE_TYPES };
