// ── Şema, göç ve tohum ──
const { db, ac, acikMi, hamBaglanti } = require("./baglanti.cjs");
const { getMetaValue, setMetaValue } = require("./meta.cjs");
const { createUser } = require("./kullanicilar.cjs");
const { araNormalize } = require("../metin.cjs");

const SCHEMA_VERSION = 22; // 22: monthly_dues.muaf_neden/muaf_notu/muaf_eden (ay bazında muafiyet, plan §42); 21: players.tc_no/pasaport_no '' → NULL (UNIQUE çakışması; kişisel veri silme); 20: card_prints (giriş kartı basım kaydı; plan §40.7); 19: seasons (sezon başlangıç/bitiş tarihi) + trainings.bitis_saat (plan §37); 18: receipts.oyuncu_adi (kişisel veri silinen oyuncunun makbuzdaki adı; plan §31); 17: group_seasons (grupların geçmiş sezon üyeliği; plan §21); 16: player_seasons (geçmiş sezon üyeliği; plan §18.1); 15: sezonu boş aktif oyunculara aktif sezon (plan §18); 14: receipts.sezon (plan §17.2); 13: varsayılan ücret tipi sırası (ücretsiz normalin altına); 12: sezonu boş aktif gruplara aktif sezon (plan §15); …9: WhatsApp (guardians.mesaj_onayi, message_log, trainings.bildirim_gerekli/degisiklik_notu); 10: trainings.grup_bildirim; 11: bildirim olayı (trainings.bildirim_olay, message_log.olay)
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
  muaf_neden TEXT NOT NULL DEFAULT '',            -- şema 22: elle muafiyet nedeni (dondurma|sakatlik|burs|diger); ücret tipinden gelen muafta boş
  muaf_notu TEXT NOT NULL DEFAULT '',
  muaf_eden TEXT NOT NULL DEFAULT '',
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
  sezon TEXT NOT NULL DEFAULT '',                 -- makbuzun kesildiği sezon (şema 14; numara öneki sezonun ilk yılı)
  iptal INTEGER NOT NULL DEFAULT 0,
  iptal_nedeni TEXT DEFAULT '',
  iptal_eden TEXT DEFAULT '',
  iptal_zamani TEXT,
  oyuncu_adi TEXT NOT NULL DEFAULT '',            -- şema 18: kişisel verisi silinen oyuncunun makbuz kesildiği andaki adı (boşsa players.ad_soyad)
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
  bildirim_olay TEXT DEFAULT '',                      -- son iptal/değişiklik olayının damgası; bildirimler bu olaya bağlanır (şema 11)
  bitis_saat TEXT DEFAULT ''                          -- şema 19: bitiş saati (isteğe bağlı; plan §37)
);

${MESSAGE_LOG_SQL}

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  durum TEXT NOT NULL,                            -- geldi|gelmedi|izinli
  UNIQUE(training_id, player_id)
);

-- Oyuncunun geçtiği sezonlar (plan §18.1): kayıt ve her sezon yenilemesinde satır eklenir; sezon filtresi buna bakar.
-- players.sezon "şu anki sezon"dur; geçmiş sezon üyeliği burada kalır.
CREATE TABLE IF NOT EXISTS player_seasons (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sezon TEXT NOT NULL,
  PRIMARY KEY (player_id, sezon)
);

-- Grubun var olduğu sezonlar (plan §21): oluşturma, sezon düzenleme ve sezon geçişinde satır eklenir; Yaş Grupları sezon süzgeci.
CREATE TABLE IF NOT EXISTS group_seasons (
  group_id INTEGER NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  sezon TEXT NOT NULL,
  PRIMARY KEY (group_id, sezon)
);

CREATE TABLE IF NOT EXISTS seasons (                -- şema 19: sezon tarihleri (plan §37); aidat 12 ay açılmaya devam eder
  sezon TEXT PRIMARY KEY,
  baslangic TEXT NOT NULL,
  bitis TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_prints (            -- şema 20: giriş kartı basım kaydı (plan §40.7); "basıldı" = basıma gönderildi (yazıcı ya da PDF)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sezon TEXT NOT NULL,                                -- kart sezonu (yeni sezon = yeni kart)
  basim_zamani TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  kullanici TEXT DEFAULT '',                          -- basımı yapan (oturumdan enjekte)
  tur TEXT NOT NULL DEFAULT 'tek',                    -- tek | toplu
  kart_no TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_card_prints_oyuncu ON card_prints(player_id, sezon);

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
  ["ucretsiz", "Ücretsiz", 100, 1], // sabit tipler üstte (sıra 13. göçte de uygulanır)
  ["burslu", "Burslu", 100, 0],
  ["indirimli", "İndirimli", 0, 0],
  ["kardes", "Kardeş İndirimi", 0, 0],
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

// ── Göç (refactor 2. tur §8.5, 11.09.2026): önce idempotent sütun/indeks eklemeleri (PRAGMA table_info ile; yeni DB'de
// SCHEMA_SQL zaten içerir), sonra sürüm başına VERİ göçü haritası. `migrate()` `schema_version` < sürüm olan her göçü sırayla
// uygular. Yeni şema: SCHEMA_VERSION'ı artır, gerekiyorsa sütunu hem SCHEMA_SQL'e hem `sutunGocleri()`ne, veri dönüşümünü
// `VERI_GOCLERI[n]`e yaz. ──
const kolonlar = (tablo) =>
  new Set(
    db
      .prepare(`PRAGMA table_info(${tablo})`)
      .all()
      .map((c) => c.name),
  );
/** Sütun yoksa ekler. @param {string} tablo @param {string} kolon @param {string} tanim SQL tipi/varsayılan */
const kolonEkle = (tablo, kolon, tanim) => {
  if (!kolonlar(tablo).has(kolon)) db.exec(`ALTER TABLE ${tablo} ADD COLUMN ${kolon} ${tanim}`);
};
const ayar = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value || "";
const baslangicAyi = () => Number(ayar("sezon_baslangic_ayi")) || 9;

/** Sütun/indeks eklemeleri — sürümden bağımsız, her açılışta güvenle çalışır. */
function sutunGocleri() {
  // 3: yabancı uyruklu oyuncular için pasaport no; 4: players.sezon
  kolonEkle("players", "uyruk", "TEXT NOT NULL DEFAULT 'tc'");
  kolonEkle("players", "pasaport_no", "TEXT");
  kolonEkle("players", "sezon", "TEXT NOT NULL DEFAULT ''");
  kolonEkle("age_groups", "program", "TEXT NOT NULL DEFAULT '[]'"); // 6
  kolonEkle("receipts", "iptal_nedeni", "TEXT DEFAULT ''"); // 7
  kolonEkle("receipts", "iptal_eden", "TEXT DEFAULT ''");
  kolonEkle("receipts", "iptal_zamani", "TEXT");
  kolonEkle("receipts", "sezon", "TEXT NOT NULL DEFAULT ''"); // 14
  kolonEkle("receipts", "oyuncu_adi", "TEXT NOT NULL DEFAULT ''"); // 18
  kolonEkle("monthly_dues", "muaf_neden", "TEXT NOT NULL DEFAULT ''"); // 22: dondurma|sakatlik|burs|diger (plan §42)
  kolonEkle("monthly_dues", "muaf_notu", "TEXT NOT NULL DEFAULT ''");
  kolonEkle("monthly_dues", "muaf_eden", "TEXT NOT NULL DEFAULT ''");
  if (!kolonlar("monthly_dues").has("odenen")) {
    // 5: kısmi ödeme
    db.exec("ALTER TABLE monthly_dues ADD COLUMN odenen REAL NOT NULL DEFAULT 0");
    db.exec("UPDATE monthly_dues SET odenen=tutar WHERE durum='odendi'");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_pasaport ON players(pasaport_no) WHERE pasaport_no IS NOT NULL");
  // 9: WhatsApp — veli mesaj onayı (mevcut veliler onaylı: kulüp kararı 07.09.2026), antrenman bildirim alanları
  kolonEkle("guardians", "mesaj_onayi", "INTEGER NOT NULL DEFAULT 1");
  kolonEkle("trainings", "bildirim_gerekli", "INTEGER NOT NULL DEFAULT 0");
  kolonEkle("trainings", "degisiklik_notu", "TEXT DEFAULT ''");
  kolonEkle("trainings", "grup_bildirim", "TEXT DEFAULT ''"); // 10
  kolonEkle("trainings", "bildirim_olay", "TEXT DEFAULT ''"); // 11
  const mlKolon = kolonlar("message_log");
  if (mlKolon.size && !mlKolon.has("tur")) {
    // ilk iskeletin kullanılmayan message_log'u
    const dolu = db.prepare("SELECT count(*) AS n FROM message_log").get().n > 0;
    db.exec(dolu ? "ALTER TABLE message_log RENAME TO message_log_eski_v1" : "DROP TABLE message_log");
    db.exec(MESSAGE_LOG_SQL);
  }
  kolonEkle("message_log", "olay", "TEXT DEFAULT ''"); // 11
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_message_log_player ON message_log(player_id, tur, yil, ay); CREATE INDEX IF NOT EXISTS idx_message_log_training ON message_log(training_id)",
  );
  kolonEkle("trainings", "bitis_saat", "TEXT DEFAULT ''"); // 19
}

/** Sürüm → veri göçü. Anahtar: bu göçün getirdiği şema sürümü; `schema_version` ondan küçükse çalışır. */
const VERI_GOCLERI = {
  // 8: ücret tipleri tabloya; eski `indirim_<kod>` ayarları bir kez taşınır (yalnız ilk geçişte, sonra tablo esastır)
  8() {
    for (const r of db.prepare("SELECT key, value FROM settings WHERE key LIKE 'indirim_%'").all()) {
      const y = Math.min(100, Math.max(0, Math.round(Number(r.value) || 0)));
      db.prepare("UPDATE fee_types SET indirim=? WHERE kod=? AND sabit=0").run(y, r.key.slice(8));
    }
  },
  // 12: sezonu boş olan AKTİF gruplara aktif sezon (plan §15); pasif gruplara ve dolu değerlere dokunulmaz
  12() {
    const aktifSezon = ayar("aktif_sezon");
    if (aktifSezon) db.prepare("UPDATE age_groups SET sezon=? WHERE aktif=1 AND sezon=''").run(aktifSezon);
  },
  // 13: varsayılan ücret tiplerinin sırası FEE_TYPES ile aynı olsun (ücretsiz normalin hemen altında); kulübün eklediği tipler dokunulmaz
  13() {
    const sira = db.prepare("UPDATE fee_types SET sira=? WHERE kod=?");
    FEE_TYPES.forEach(([kod], i) => sira.run(i, kod));
  },
  // 14: mevcut makbuzlara tarihlerinden sezon (başlangıç ayı ayarıyla); numaralar değişmez
  14() {
    const { tarihinSezonu } = require("../makbuzNo.cjs");
    const bas = baslangicAyi();
    const guncelle = db.prepare("UPDATE receipts SET sezon=? WHERE id=?");
    for (const r of db.prepare("SELECT id, tarih FROM receipts WHERE sezon=''").all()) guncelle.run(tarihinSezonu(r.tarih, bas), r.id);
  },
  // 15: sezonu boş olan sahadaki oyunculara (aktif/deneme/sakat) aktif sezon; Oyuncular ekranı sezon filtresi (plan §18)
  15() {
    const { tarihinSezonu } = require("../makbuzNo.cjs");
    const aktifSezon = ayar("aktif_sezon") || tarihinSezonu(new Date().toISOString().slice(0, 10), baslangicAyi());
    db.prepare("UPDATE players SET sezon=? WHERE sezon='' AND durum IN ('aktif','deneme','sakat')").run(aktifSezon);
  },
  // 16: player_seasons doldurulur — players.sezon + aidat kayıtlarının ait olduğu sezonlar (o ayda sahadaydı) + makbuz sezonları
  16() {
    const { tarihinSezonu } = require("../makbuzNo.cjs");
    const bas = baslangicAyi();
    const ekle = db.prepare("INSERT OR IGNORE INTO player_seasons (player_id, sezon) VALUES (?,?)");
    for (const p of db.prepare("SELECT id, sezon FROM players WHERE sezon<>''").all()) ekle.run(p.id, p.sezon);
    for (const d of db.prepare("SELECT DISTINCT player_id, yil, ay FROM monthly_dues").all())
      ekle.run(d.player_id, tarihinSezonu(`${d.yil}-${String(d.ay).padStart(2, "0")}-01`, bas));
    for (const r of db.prepare("SELECT DISTINCT player_id, sezon FROM receipts WHERE sezon<>''").all()) ekle.run(r.player_id, r.sezon);
  },
  // 17: group_seasons doldurulur — age_groups.sezon + grubun antrenman tarihlerinin düştüğü sezonlar (o sezonda çalışıyordu)
  17() {
    const { tarihinSezonu } = require("../makbuzNo.cjs");
    const bas = baslangicAyi();
    const ekle = db.prepare("INSERT OR IGNORE INTO group_seasons (group_id, sezon) VALUES (?,?)");
    for (const g of db.prepare("SELECT id, sezon FROM age_groups WHERE sezon<>''").all()) ekle.run(g.id, g.sezon);
    for (const t of db.prepare("SELECT DISTINCT age_group_id, substr(tarih,1,7) AS ay FROM trainings").all())
      ekle.run(t.age_group_id, tarihinSezonu(t.ay + "-01", bas));
  },
  // 19: seasons — bilinen her sezona varsayılan aralık (1 Eyl – 31 Ağu) yazılır; kullanıcı Ayarlar'dan düzeltir (plan §37)
  19() {
    const { varsayilanSezonAraligi } = require("../../src/lib/sezon.js");
    const bas = baslangicAyi();
    const sezonlar = new Set(
      db
        .prepare(
          "SELECT sezon FROM players WHERE sezon<>'' UNION SELECT sezon FROM player_seasons UNION SELECT sezon FROM age_groups WHERE sezon<>'' UNION SELECT sezon FROM receipts WHERE sezon<>'' UNION SELECT sezon FROM group_seasons",
        )
        .all()
        .map((r) => r.sezon),
    );
    const aktif = ayar("aktif_sezon");
    if (aktif) sezonlar.add(aktif);
    const ekle = db.prepare("INSERT OR IGNORE INTO seasons (sezon, baslangic, bitis) VALUES (?,?,?)");
    for (const sz of sezonlar) {
      const a = varsayilanSezonAraligi(sz, bas);
      if (a) ekle.run(sz, a.baslangic, a.bitis);
    }
  },
};

VERI_GOCLERI[21] = () => {
  // '' benzersizlikte değer sayılır: ikinci boş TC/pasaport (kişisel veri silme, pasaportsuz yabancı) UNIQUE hatası veriyordu
  db.prepare("UPDATE players SET tc_no=NULL WHERE tc_no=''").run();
  db.prepare("UPDATE players SET pasaport_no=NULL WHERE pasaport_no=''").run();
};

function migrate() {
  const cur = Number(getMetaValue("schema_version") || 0);
  sutunGocleri();
  // 8: varsayılan ücret tipleri YALNIZ BİR KEZ tohumlanır (meta bayrağı); yoksa kullanıcının sildiği tip her açılışta geri gelirdi.
  if (!getMetaValue("tohum_fee_types")) {
    const insTip = db.prepare("INSERT OR IGNORE INTO fee_types (kod, ad, indirim, sira, aktif, sabit) VALUES (?,?,?,?,1,?)");
    FEE_TYPES.forEach(([kod, ad, ind, sabit], i) => insTip.run(kod, ad, ind, i, sabit));
    setMetaValue("tohum_fee_types", "1");
  }
  for (const surum of Object.keys(VERI_GOCLERI)
    .map(Number)
    .sort((a, b) => a - b))
    if (cur < surum) VERI_GOCLERI[surum]();
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

module.exports = { SCHEMA_VERSION, init, migrate, seed, FEE_ITEMS, FEE_TYPES, VERI_GOCLERI };
