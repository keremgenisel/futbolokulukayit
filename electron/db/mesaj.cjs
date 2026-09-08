// ── WhatsApp mesaj kayıtları (plan §13): "WhatsApp'ta Aç" tıklandığında yazılır; gönderimi program göremez ──
const { db } = require("./baglanti.cjs");

const MESAJ_TURLERI = new Set(["aidat", "genel", "iptal", "degisiklik"]);
function mesajKaydet({ player_id, guardian_id = null, tur, yil = null, ay = null, training_id = null, metin = "", kullanici = "" }) {
  if (!MESAJ_TURLERI.has(tur)) throw new Error("Geçersiz mesaj türü: " + tur);
  if (!db.prepare("SELECT 1 FROM players WHERE id=?").get(Number(player_id))) throw new Error("Oyuncu bulunamadı");
  // İptal/değişiklik bildirimi antrenmanın O ANKİ olayına bağlanır: sonraki iptal/değişiklik yeni olay, eski bildirim sayılmaz
  const olay = training_id
    ? db.prepare("SELECT bildirim_olay FROM trainings WHERE id=?").get(Number(training_id))?.bildirim_olay || ""
    : "";
  const r = db
    .prepare("INSERT INTO message_log (player_id,guardian_id,tur,yil,ay,training_id,metin,kullanici,olay) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(
      Number(player_id),
      guardian_id ? Number(guardian_id) : null,
      tur,
      yil,
      ay,
      training_id ? Number(training_id) : null,
      String(metin || "").slice(0, 2000),
      String(kullanici || ""),
      olay,
    );
  return { id: Number(r.lastInsertRowid) };
}
const mesajSil = (id) => db.prepare("DELETE FROM message_log WHERE id=?").run(Number(id));
const sonMesajlar = (pid, n = 12) =>
  db
    .prepare(
      "SELECT m.*, g.ad_soyad AS veli_ad FROM message_log m LEFT JOIN guardians g ON g.id=m.guardian_id WHERE m.player_id=? ORDER BY m.id DESC LIMIT ?",
    )
    .all(pid, Number(n));
// Antrenmanın velileri (grubun aktif oyuncuları + birincil veli + onay/numara) ve bu antrenman için açılmış bildirim.
const antrenmanVelileri = (tid) =>
  db
    .prepare(
      `SELECT p.id AS player_id, p.ad_soyad, p.durum, gu.id AS guardian_id, gu.ad_soyad AS veli_ad,
    COALESCE(NULLIF(gu.whatsapp_no,''), gu.gsm, '') AS veli_wa, gu.mesaj_onayi AS veli_onay,
    (SELECT m.id FROM message_log m WHERE m.training_id=t.id AND m.player_id=p.id AND m.olay=t.bildirim_olay ORDER BY m.id DESC LIMIT 1) AS mesaj_id
  FROM trainings t JOIN players p ON p.yas_grubu_id=t.age_group_id AND p.durum IN ('aktif','deneme','sakat')
  LEFT JOIN guardians gu ON gu.id=(SELECT g2.id FROM guardians g2 WHERE g2.player_id=p.id ORDER BY g2.veli_mi DESC, g2.id LIMIT 1)
  WHERE t.id=? ORDER BY p.ad_soyad`,
    )
    .all(Number(tid));

module.exports = { mesajKaydet, mesajSil, sonMesajlar, antrenmanVelileri };
