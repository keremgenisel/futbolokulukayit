-- Eyüpspor Futbol Okulu aktivasyon sunucusu D1 şeması.
-- lisanslar: satıcının kaydettiği lisanslar. Ham anahtar TUTULMAZ; yalnız SHA-256 özeti (KVKK).
--   maksKullanici/bitis imzalı anahtardan gelir (referans); maksKurulum/iptal satıcı tarafından yönetilir.
CREATE TABLE IF NOT EXISTS lisanslar (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  anahtarHash   TEXT UNIQUE NOT NULL,
  firma         TEXT,
  bitis         TEXT,           -- YYYY-MM-DD | NULL (süresiz)
  maksKullanici INTEGER,        -- NULL = sınırsız
  maksKurulum   INTEGER,        -- NULL = sınırsız; kurulum sayımı bununla karşılaştırılır
  iptal         INTEGER NOT NULL DEFAULT 0,
  olusturuldu   TEXT NOT NULL
);

-- kurulumlar: makine başına bir satır. Aynı lisansta maksKurulum kadar aktif makineye izin verilir.
CREATE TABLE IF NOT EXISTS kurulumlar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lisansId    INTEGER NOT NULL,
  makineId    TEXT NOT NULL,
  ilkGoruldu  TEXT NOT NULL,
  sonGoruldu  TEXT NOT NULL,
  surum       TEXT,
  aktif       INTEGER NOT NULL DEFAULT 1,
  UNIQUE(lisansId, makineId)
);
CREATE INDEX IF NOT EXISTS idx_kurulum_lisans ON kurulumlar(lisansId);
