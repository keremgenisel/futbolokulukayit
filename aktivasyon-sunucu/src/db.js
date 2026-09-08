// D1 (SQLite) erişimi + tarih yardımcıları. Şema: schema.sql.
// lisanslar: satıcının kaydettiği lisanslar (anahtarHash, iptal, maksKurulum). kurulumlar: makine başına.

export const bugun = () => new Date().toISOString().slice(0, 10);
export function tariheGunEkle(tarih, gun) {
  const d = new Date(tarih + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}
// İki YYYY-MM-DD tarihinin küçüğü (lexikografik = kronolojik). b null ise a döner.
export const enKucukTarih = (a, b) => (b == null ? a : a < b ? a : b);

export const lisansBul = (env, anahtarHash) => env.DB.prepare("SELECT * FROM lisanslar WHERE anahtarHash = ?").bind(anahtarHash).first();

export function lisansUpsert(env, { anahtarHash, firma, bitis, maksKullanici, maksKurulum, iptal }) {
  return env.DB.prepare(
    `INSERT INTO lisanslar (anahtarHash, firma, bitis, maksKullanici, maksKurulum, iptal, olusturuldu)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(anahtarHash) DO UPDATE SET
       firma=excluded.firma, bitis=excluded.bitis, maksKullanici=excluded.maksKullanici,
       maksKurulum=excluded.maksKurulum, iptal=excluded.iptal`,
  )
    .bind(anahtarHash, firma ?? null, bitis ?? null, maksKullanici ?? null, maksKurulum ?? null, iptal ? 1 : 0, bugun())
    .run();
}

export const kurulumBul = (env, lisansId, makineId) =>
  env.DB.prepare("SELECT * FROM kurulumlar WHERE lisansId = ? AND makineId = ?").bind(lisansId, makineId).first();

export async function aktifKurulumSay(env, lisansId) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM kurulumlar WHERE lisansId = ? AND aktif = 1").bind(lisansId).first();
  return r?.n ?? 0;
}

export const kurulumEkle = (env, lisansId, makineId, surum) =>
  env.DB.prepare("INSERT INTO kurulumlar (lisansId, makineId, ilkGoruldu, sonGoruldu, surum, aktif) VALUES (?, ?, ?, ?, ?, 1)")
    .bind(lisansId, makineId, bugun(), bugun(), surum ?? null)
    .run();

export const kurulumDokun = (env, id, surum) =>
  env.DB.prepare("UPDATE kurulumlar SET sonGoruldu = ?, surum = ?, aktif = 1 WHERE id = ?")
    .bind(bugun(), surum ?? null, id)
    .run();

export const kurulumlariListele = (env, lisansId) =>
  env.DB.prepare("SELECT makineId, ilkGoruldu, sonGoruldu, surum, aktif FROM kurulumlar WHERE lisansId = ?").bind(lisansId).all();

// Tüm lisanslar + her birinin AKTİF kurulum sayısı (yönetim panosu / lisans-yonet tumu).
export const tumLisanslar = (env) =>
  env.DB.prepare(
    `SELECT l.firma, l.bitis, l.maksKullanici, l.maksKurulum, l.iptal, l.olusturuldu,
       (SELECT COUNT(*) FROM kurulumlar k WHERE k.lisansId = l.id AND k.aktif = 1) AS kurulumSayisi
     FROM lisanslar l ORDER BY l.olusturuldu DESC`,
  ).all();
