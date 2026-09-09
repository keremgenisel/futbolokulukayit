// ── Yedek doğrulama ve taşıma paketi kopyaları ──
const fs = require("fs");
const { Database, db, getDbKey, checkpoint } = require("./baglanti.cjs");
const { SCHEMA_VERSION } = require("./sema.cjs");

// ── Yedek doğrulama (geri yükleme öncesi) ──
// Verilen data.db dosyasını BU makinenin anahtarıyla açmayı dener; açılırsa özet döner.
// Başka bir PC'de alınmış (farklı anahtarla şifreli) yedek burada açılamaz → { error }.
// Taşıma paketi (plan §14): veritabanının ŞİFRESİZ kopyası. VACUUM INTO makine anahtarıyla şifreli kopya üretir;
// kopya aynı anahtarla açılıp `rekey=''` ile düz hale getirilir. Kopya yalnız parola korumalı pakete girer, sonra silinir.
function duzKopyaOlustur(hedefYol) {
  checkpoint();
  try {
    fs.rmSync(hedefYol, { force: true });
  } catch {}
  db.exec(`VACUUM INTO '${String(hedefYol).replace(/'/g, "''")}'`);
  const key = getDbKey();
  if (key) {
    const c = new Database(hedefYol);
    c.pragma(`key='${key}'`);
    c.pragma("rekey=''");
    c.close();
  }
  // Güvenlik (inceleme 08.09.2026 #1): makine kimliği ve lease pakete GİRMEZ; yoksa makineye kilitli lisans her PC'de
  // geçerli olurdu. Lisans anahtarı kalır (yeni PC kendi makineId'sini üretir, gerekirse yeniden aktive edilir).
  const c2 = new Database(hedefYol);
  c2.prepare("DELETE FROM meta WHERE key IN ('makineId','lisansLease')").run();
  c2.close();
  return hedefYol;
}
// Yedek/paket özeti bellek içinden (düz data.db baytları) — diske düz kopya yazmadan (inceleme #8).
function yedekBilgisiBuffer(buf) {
  if (!Database) return { error: "SQLite modülü yok" };
  let conn = null;
  try {
    conn = new Database(Buffer.from(buf));
    const sv = Number(conn.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value || 0);
    if (!sv) return { error: "Bu dosya bir Futbol Okulu Kayıt Programı veritabanı değil" };
    if (sv > SCHEMA_VERSION) return { error: `Yedek daha yeni bir program sürümünden (şema ${sv}); önce programı güncelleyin` };
    return {
      ok: true,
      oyuncu: conn.prepare("SELECT count(*) AS n FROM players").get().n,
      makbuz: conn.prepare("SELECT count(*) AS n FROM receipts").get().n,
      sonMakbuz: conn.prepare("SELECT max(tarih) AS t FROM receipts").get().t,
      schema: sv,
    };
  } catch (e) {
    return { error: "Paket açılamadı: " + String(e.message || e) };
  } finally {
    try {
      conn?.close();
    } catch {}
  }
}
// Düz (şifresiz) bir veritabanı dosyasını bu makinenin anahtarıyla şifreler (taşıma paketinden geri yükleme).
function duzVeritabaniniSifrele(yol) {
  const key = getDbKey();
  if (!key) return false;
  const c = new Database(yol);
  c.pragma(`rekey='${key}'`);
  c.close();
  return true;
}
// duz=true: dosya şifresiz (taşıma paketinden); yoksa bu makinenin anahtarıyla açılır.
function yedekBilgisi(dbPath, { duz = false } = {}) {
  if (!Database) return { error: "SQLite modülü yok" };
  if (!fs.existsSync(dbPath)) return { error: "Yedek klasöründe data.db yok" };
  let conn = null;
  try {
    conn = new Database(dbPath, { readonly: true });
    const key = duz ? null : getDbKey();
    if (key) conn.pragma(`key='${key}'`);
    const sv = Number(conn.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value || 0);
    if (!sv) return { error: "Bu dosya bir Futbol Okulu Kayıt Programı veritabanı değil" };
    if (sv > SCHEMA_VERSION) return { error: `Yedek daha yeni bir program sürümünden (şema ${sv}); önce programı güncelleyin` };
    const oyuncu = conn.prepare("SELECT count(*) AS n FROM players").get().n;
    const makbuz = conn.prepare("SELECT count(*) AS n FROM receipts").get().n;
    const sonMakbuz = conn.prepare("SELECT max(tarih) AS t FROM receipts").get().t;
    return { ok: true, oyuncu, makbuz, sonMakbuz, schema: sv };
  } catch (e) {
    const m = String(e.message || e);
    if (/not a database|file is encrypted|malformed/i.test(m))
      return { error: "Yedek açılamadı: başka bir bilgisayarda alınmış olabilir (şifreleme anahtarı farklı) ya da dosya bozuk" };
    return { error: "Yedek açılamadı: " + m };
  } finally {
    try {
      conn?.close();
    } catch {}
  }
}

module.exports = { duzKopyaOlustur, yedekBilgisiBuffer, duzVeritabaniniSifrele, yedekBilgisi };
