// ── trainings / attendance ──
const { db } = require("./baglanti.cjs");

const { saatAraligiDogrula } = require("../saatAralik.cjs");
function createTraining({ age_group_id, tarih, saat = "", saha = "", bitis_saat = "" }) {
  const d = saatAraligiDogrula(saat, bitis_saat);
  if (!d.gecerli) throw new Error(d.neden);
  const r = db
    .prepare("INSERT INTO trainings (age_group_id,tarih,saat,saha,bitis_saat) VALUES (?,?,?,?,?)")
    .run(age_group_id, tarih, saat, saha, String(bitis_saat || ""));
  return { id: Number(r.lastInsertRowid), age_group_id, tarih, saat, saha, bitis_saat: String(bitis_saat || "") };
}
// Takvim şeridi: aralıktaki antrenmanlar, grup adı ve yoklama ilerlemesiyle (oyuncu/işaretli/geldi).
const trainingCalendar = (from, to) =>
  db
    .prepare(
      `SELECT t.*, g.ad AS yas_grubu_ad,
    (SELECT count(*) FROM players p WHERE p.yas_grubu_id=t.age_group_id AND p.durum IN ('aktif','deneme','sakat')) AS oyuncu,
    (SELECT count(*) FROM attendance a WHERE a.training_id=t.id) AS isaretli,
    (SELECT count(*) FROM attendance a WHERE a.training_id=t.id AND a.durum='geldi') AS geldi,
    (SELECT count(DISTINCT m.player_id) FROM message_log m WHERE m.training_id=t.id AND m.olay=t.bildirim_olay) AS bildirilen
  FROM trainings t JOIN age_groups g ON g.id=t.age_group_id WHERE t.tarih BETWEEN ? AND ? ORDER BY t.tarih, t.saat`,
    )
    .all(from, to);
const listTrainings = (from, to) =>
  db
    .prepare(
      "SELECT t.*, g.ad AS yas_grubu_ad FROM trainings t JOIN age_groups g ON g.id=t.age_group_id WHERE t.tarih BETWEEN ? AND ? ORDER BY t.tarih, t.saat",
    )
    .all(from, to);
// Elle iptal: veliler bilgilendirilene kadar bildirim_gerekli=1 (programdan otomatik dolan antrenmanlar bu yoldan geçmez).
// Olay damgası: zaman + rastgele ek (aynı milisaniyede iki olay bile ayrışsın)
const yeniOlay = () => new Date().toISOString() + "-" + require("crypto").randomBytes(3).toString("hex");
const cancelTraining = (id, neden = "") =>
  db
    .prepare("UPDATE trainings SET iptal=1, iptal_nedeni=?, bildirim_gerekli=1, bildirim_olay=?, grup_bildirim='' WHERE id=?")
    .run(neden, yeniOlay(), id);
// Antrenman düzenleme (tarih/saat/saha): yoklaması alınmış antrenmanda tarih değişmez; eski değerler degisiklik_notu'na.
function updateTraining(id, { tarih, saat, saha, bitis_saat } = {}) {
  const t = db.prepare("SELECT * FROM trainings WHERE id=?").get(Number(id));
  if (!t) throw new Error("Antrenman bulunamadı");
  if (t.iptal) throw new Error("İptal edilmiş antrenman düzenlenemez");
  const yeni = {
    tarih: tarih === undefined ? t.tarih : String(tarih),
    saat: saat === undefined ? t.saat : String(saat || ""),
    bitis_saat: bitis_saat === undefined ? t.bitis_saat || "" : String(bitis_saat || ""),
    saha: saha === undefined ? t.saha : String(saha || ""),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yeni.tarih)) throw new Error("Tarih geçersiz");
  const dg = saatAraligiDogrula(yeni.saat, yeni.bitis_saat);
  if (!dg.gecerli) throw new Error(dg.neden);
  const degisti = yeni.tarih !== t.tarih || yeni.saat !== t.saat || yeni.saha !== t.saha || yeni.bitis_saat !== (t.bitis_saat || "");
  if (!degisti) return { ...t, degisti: false };
  const yoklamaVar = db.prepare("SELECT count(*) AS n FROM attendance WHERE training_id=?").get(t.id).n > 0;
  if (yoklamaVar && yeni.tarih !== t.tarih) throw new Error("Yoklaması alınmış antrenmanın tarihi değiştirilemez; yalnız saat ve saha");
  const not_ = JSON.stringify({
    eskiTarih: t.tarih,
    eskiSaat: t.saat,
    eskiBitis: t.bitis_saat || "",
    eskiSaha: t.saha,
    zaman: new Date().toISOString(),
  });
  const olay = yeniOlay();
  db.prepare(
    "UPDATE trainings SET tarih=?, saat=?, saha=?, bitis_saat=?, bildirim_gerekli=1, degisiklik_notu=?, bildirim_olay=?, grup_bildirim='' WHERE id=?",
  ).run(yeni.tarih, yeni.saat, yeni.saha, yeni.bitis_saat, not_, olay, t.id);
  return { ...t, ...yeni, bildirim_gerekli: 1, degisiklik_notu: not_, bildirim_olay: olay, grup_bildirim: "", degisti: true };
}
const bildirimGerekliAyarla = (id, deger) =>
  db.prepare("UPDATE trainings SET bildirim_gerekli=? WHERE id=?").run(deger ? 1 : 0, Number(id));
// Veli WhatsApp grubuna tek mesaj açıldı (plan §13.7): bildirim gereği iner, kim/ne zaman kaydedilir.
function grupBildirimKaydet(id, kullanici = "") {
  if (!db.prepare("SELECT 1 FROM trainings WHERE id=?").get(Number(id))) throw new Error("Antrenman bulunamadı");
  const not_ = JSON.stringify({ zaman: new Date().toISOString(), kullanici: String(kullanici || "") });
  db.prepare("UPDATE trainings SET grup_bildirim=?, bildirim_gerekli=0 WHERE id=?").run(not_, Number(id));
  return { ok: true, grup_bildirim: not_ };
}
// Geri al: grup kaydı silinir; bildirim gereği yeniden açılır (tek tek bildirilenler pencere kapanışında yeniden değerlendirilir)
const grupBildirimSil = (id) => db.prepare("UPDATE trainings SET grup_bildirim='', bildirim_gerekli=1 WHERE id=?").run(Number(id));
// durum boş/null → işaret kaldırılır (satır silinir): seçili düğmeye yeniden tıklayınca "işaretlenmedi"ye döner (Kerem, 10.09.2026).
const setAttendance = (tid, pid, durum) =>
  durum
    ? db
        .prepare(
          "INSERT INTO attendance (training_id,player_id,durum) VALUES (?,?,?) ON CONFLICT(training_id,player_id) DO UPDATE SET durum=excluded.durum",
        )
        .run(tid, pid, durum)
    : db.prepare("DELETE FROM attendance WHERE training_id=? AND player_id=?").run(tid, pid);
const listAttendance = (tid) =>
  db
    .prepare("SELECT a.*, p.ad_soyad FROM attendance a JOIN players p ON p.id=a.player_id WHERE a.training_id=? ORDER BY p.ad_soyad")
    .all(tid);
// Son N yoklama (yeniden eskiye) — oyuncu kartı; tam liste için playerAttendance.
const playerAttendanceSon = (pid, n = 40) =>
  db
    .prepare(
      "SELECT a.durum, t.tarih, t.saat FROM attendance a JOIN trainings t ON t.id=a.training_id WHERE a.player_id=? ORDER BY t.tarih DESC, t.saat DESC LIMIT ?",
    )
    .all(pid, Number(n));
const playerAttendance = (pid, from, to) =>
  db
    .prepare(
      "SELECT a.durum, t.tarih, t.saat FROM attendance a JOIN trainings t ON t.id=a.training_id WHERE a.player_id=? AND t.tarih BETWEEN ? AND ? ORDER BY t.tarih",
    )
    .all(pid, from, to);

// Bir oyuncunun son N ay yoklama özeti.
const attendanceSummary = (pid, from, to) =>
  db
    .prepare(
      "SELECT a.durum, count(*) AS n FROM attendance a JOIN trainings t ON t.id=a.training_id WHERE a.player_id=? AND t.tarih BETWEEN ? AND ? AND t.iptal=0 GROUP BY a.durum",
    )
    .all(pid, from, to);

// Yoklama raporu: tarih aralığında oyuncu bazında geldi/gelmedi/izinli sayıları.
// sezon verilirse oyuncu kümesi o sezonun oyuncuları (bugün pasif olsa da; plan §19.4); verilmezse sahadakiler.
// Yalnız aralıktaki, iptal edilmemiş antrenmanların yoklaması sayılır (t.id IS NOT NULL) — 09.09.2026 raporlar e2e'de
// aralık dışı yoklamaların da toplandığı görüldü.
// herkes=true (Raporlar tarih aralığı modu, 09.09.2026): durum/sezon süzgeci yok, tüm oyuncular.
const attendanceReport = (from, to, age_group_id = null, sezon = null, herkes = false) =>
  db
    .prepare(
      `
  SELECT p.id, p.ad_soyad, g.ad AS yas_grubu_ad,
    sum(CASE WHEN t.id IS NOT NULL AND a.durum='geldi' THEN 1 ELSE 0 END) AS geldi,
    sum(CASE WHEN t.id IS NOT NULL AND a.durum='gelmedi' THEN 1 ELSE 0 END) AS gelmedi,
    sum(CASE WHEN t.id IS NOT NULL AND a.durum='izinli' THEN 1 ELSE 0 END) AS izinli
  FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id
  LEFT JOIN attendance a ON a.player_id=p.id
  LEFT JOIN trainings t ON t.id=a.training_id AND t.tarih BETWEEN ? AND ? AND t.iptal=0
  WHERE (? IS NULL OR p.yas_grubu_id=?)
    AND CASE WHEN ? THEN 1
             WHEN ? IS NULL THEN p.durum IN ('aktif','deneme','sakat')
             ELSE (p.sezon=? OR EXISTS (SELECT 1 FROM player_seasons ps WHERE ps.player_id=p.id AND ps.sezon=?)) END
  GROUP BY p.id ORDER BY g.sira, p.ad_soyad`,
    )
    .all(from, to, age_group_id, age_group_id, herkes ? 1 : 0, sezon, sezon, sezon);

module.exports = {
  createTraining,
  trainingCalendar,
  listTrainings,
  cancelTraining,
  updateTraining,
  bildirimGerekliAyarla,
  grupBildirimKaydet,
  grupBildirimSil,
  setAttendance,
  listAttendance,
  playerAttendanceSon,
  playerAttendance,
  attendanceSummary,
  attendanceReport,
};
