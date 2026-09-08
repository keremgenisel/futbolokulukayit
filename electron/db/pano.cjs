// ── Pano özeti ──
const { db } = require("./baglanti.cjs");

function panoOzet({ yil, ay, bugun }) {
  const aktif = db.prepare("SELECT count(*) AS n FROM players WHERE durum IN ('aktif','deneme','sakat')").get().n;
  const grup = db.prepare("SELECT count(*) AS n FROM age_groups WHERE aktif=1").get().n;
  const odeyen = db.prepare("SELECT count(*) AS n FROM monthly_dues WHERE yil=? AND ay=? AND durum='odendi'").get(yil, ay).n;
  const borclu = db.prepare("SELECT count(*) AS n FROM monthly_dues WHERE yil=? AND ay=? AND durum IN ('odenmedi','kismi')").get(yil, ay).n;
  const antrenmanlar = db
    .prepare(
      `SELECT t.*, g.ad AS yas_grubu_ad,
      (SELECT count(*) FROM players p WHERE p.yas_grubu_id=t.age_group_id AND p.durum IN ('aktif','deneme','sakat')) AS oyuncu,
      (SELECT count(*) FROM attendance a WHERE a.training_id=t.id) AS isaretli,
      (SELECT count(*) FROM attendance a WHERE a.training_id=t.id AND a.durum='geldi') AS geldi
    FROM trainings t JOIN age_groups g ON g.id=t.age_group_id WHERE t.tarih=? ORDER BY t.saat`,
    )
    .all(bugun);
  const bugunTahsilat = db.prepare("SELECT COALESCE(sum(toplam),0) AS t FROM receipts WHERE tarih=? AND iptal=0").get(bugun).t;
  return { aktif, grup, odeyen, borclu, antrenmanlar, bugunTahsilat };
}

module.exports = { panoOzet };
