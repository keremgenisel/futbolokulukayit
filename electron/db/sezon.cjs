// ── Yeni sezon geçişi (docs/plan.md §10) ──
const { db } = require("./baglanti.cjs");
const { getSetting, setSetting } = require("./meta.cjs");
const { ensureMonthlyDues } = require("./aidat.cjs");
const { sezonTarihDogrula, varsayilanSezonAraligi } = require("../sezonTarih.cjs");

const SEZON_DURUMLARI = ["aktif", "deneme", "sakat"];
// Sihirbaz listesi: sezonda aktif sayılan oyuncular + geçmiş ödenmemiş aidat sayısı/tutarı.
const sezonAdayListesi = () =>
  db
    .prepare(
      `SELECT p.id, p.ad_soyad, p.durum, p.yas_grubu_id, p.sezon, p.aylik_aidat, p.ucret_tipi, g.ad AS yas_grubu_ad,
    (SELECT count(*) FROM monthly_dues d WHERE d.player_id=p.id AND d.durum IN ('odenmedi','kismi')) AS borc_adet,
    (SELECT COALESCE(sum(MAX(0, tutar-odenen)),0) FROM monthly_dues d WHERE d.player_id=p.id AND d.durum IN ('odenmedi','kismi')) AS borc_tutar
  FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE p.durum IN ('aktif','deneme','sakat') ORDER BY g.sira, p.ad_soyad`,
    )
    .all();
// Raporlar sezon kutusu (plan §17.5): kayıtlarda geçen tüm sezonlar + aktif sezon, yeniden eskiye
const sezonListesi = () => {
  const s = new Set(
    db
      .prepare(
        "SELECT sezon FROM players WHERE sezon<>'' UNION SELECT sezon FROM player_seasons UNION SELECT sezon FROM age_groups WHERE sezon<>'' UNION SELECT sezon FROM receipts WHERE sezon<>''",
      )
      .all()
      .map((r) => r.sezon),
  );
  const aktif = getSetting("aktif_sezon");
  if (aktif) s.add(aktif);
  return [...s]
    .filter((x) => /^\d{4}-\d{4}$/.test(x))
    .sort()
    .reverse();
};
// Sezon tarihleri (plan §37): kayıt yoksa etiketten varsayılan aralık (kaydedilmez; kullanıcı Ayarlar'dan yazar)
function sezonTarihleri(sezon) {
  if (!sezon) return null;
  const r = db.prepare("SELECT sezon, baslangic, bitis FROM seasons WHERE sezon=?").get(String(sezon));
  if (r) return { ...r, kayitli: true };
  const a = varsayilanSezonAraligi(String(sezon), Number(getSetting("sezon_baslangic_ayi")) || 9);
  return a ? { sezon: String(sezon), ...a, kayitli: false } : null;
}
function sezonTarihKaydet(sezon, baslangic, bitis) {
  const d = sezonTarihDogrula(sezon, baslangic, bitis);
  if (!d.gecerli) throw new Error(d.neden);
  // Sezonlar çakışmasın: başka bir sezonun aralığıyla kesişme
  const cakisan = db
    .prepare("SELECT sezon FROM seasons WHERE sezon<>? AND baslangic<=? AND bitis>=?")
    .get(String(sezon), String(bitis), String(baslangic));
  if (cakisan) throw new Error(`Tarihler ${cakisan.sezon} sezonuyla çakışıyor`);
  db.prepare(
    "INSERT INTO seasons (sezon, baslangic, bitis) VALUES (?,?,?) ON CONFLICT(sezon) DO UPDATE SET baslangic=excluded.baslangic, bitis=excluded.bitis",
  ).run(String(sezon), String(baslangic), String(bitis));
  return { ok: true, ...sezonTarihleri(sezon) };
}
const sezonListesiTarihli = () => sezonListesi().map((s) => sezonTarihleri(s));

function sezonDurumu() {
  const aktifSezon = getSetting("aktif_sezon") || "";
  return {
    aktifSezon,
    tarihler: sezonTarihleri(aktifSezon), // { baslangic, bitis, kayitli } | null
    baslangicAyi: Number(getSetting("sezon_baslangic_ayi")) || 9,
    sonGecis: getSetting("son_sezon_gecisi") || null,
    adaySayisi: db.prepare("SELECT count(*) AS n FROM players WHERE durum IN ('aktif','deneme','sakat')").get().n,
  };
}
// Tek işlem: yenileyenler yeni sezona (isteğe bağlı yeni grup), diğerleri pasif + not; gruplar ve aktif sezon güncellenir.
function yeniSezonaGec({ sezon, yenileyenler = [], eskiBorcSil = false, baslangic = "", bitis = "" } = {}) {
  if (!/^\d{4}-\d{4}$/.test(String(sezon || ""))) throw new Error("Sezon adı 2027-2028 biçiminde olmalı");
  if (baslangic || bitis) {
    const d = sezonTarihDogrula(sezon, baslangic, bitis);
    if (!d.gecerli) throw new Error(d.neden);
  }
  const eskiSezon = getSetting("aktif_sezon") || "";
  const tx = db.transaction(() => {
    const adaylar = db.prepare("SELECT id, notlar, yas_grubu_id FROM players WHERE durum IN ('aktif','deneme','sakat')").all();
    const yenile = new Map(yenileyenler.map((y) => [Number(y.id), y]));
    let yenilenen = 0,
      pasif = 0,
      grupDegisen = 0,
      borcSilinen = 0,
      ilkAyBorcu = 0;
    // Yeni sezonun ilk ayı (başlangıç ayı, sezonun ilk yılı): yenileyenlerin aidat kaydı hemen açılır (plan §17.4)
    const ilkAy = { yil: Number(sezon.slice(0, 4)), ay: Number(getSetting("sezon_baslangic_ayi")) || 9 };
    for (const p of adaylar) {
      const y = yenile.get(p.id);
      if (y) {
        const grup = y.yas_grubu_id ? Number(y.yas_grubu_id) : p.yas_grubu_id;
        if (grup !== p.yas_grubu_id) grupDegisen++;
        db.prepare("UPDATE players SET sezon=?, yas_grubu_id=?, updated_at=datetime('now') WHERE id=?").run(sezon, grup, p.id);
        db.prepare("INSERT OR IGNORE INTO player_seasons (player_id, sezon) VALUES (?,?)").run(p.id, sezon); // geçmiş üyelik kalır (plan §18.1)
        yenilenen++;
        ilkAyBorcu += ensureMonthlyDues(ilkAy.yil, ilkAy.ay, p.id);
      } else {
        const notEk = `${eskiSezon || "Önceki"} sezonu sonunda yenilemedi (${new Date().toISOString().slice(0, 10)})`;
        const notlar = p.notlar ? `${p.notlar}\n${notEk}` : notEk;
        db.prepare("UPDATE players SET durum='pasif', notlar=?, updated_at=datetime('now') WHERE id=?").run(notlar, p.id);
        pasif++;
        if (eskiBorcSil)
          borcSilinen += db
            .prepare("UPDATE monthly_dues SET durum='muaf' WHERE player_id=? AND durum IN ('odenmedi','kismi')")
            .run(p.id).changes;
      }
    }
    db.prepare("UPDATE age_groups SET sezon=? WHERE aktif=1").run(sezon);
    db.prepare("INSERT OR IGNORE INTO group_seasons (group_id, sezon) SELECT id, ? FROM age_groups WHERE aktif=1").run(sezon); // geçmiş üyelik kalır (plan §21)
    setSetting("aktif_sezon", sezon);
    if (baslangic && bitis) sezonTarihKaydet(sezon, baslangic, bitis); // plan §37: yeni sezonun tarihleri
    setSetting("son_sezon_gecisi", new Date().toISOString());
    return { ok: true, sezon, yenilenen, pasif, grupDegisen, borcSilinen, ilkAyBorcu, ilkAy };
  });
  return tx();
}

module.exports = {
  SEZON_DURUMLARI,
  sezonAdayListesi,
  sezonListesi,
  sezonDurumu,
  yeniSezonaGec,
  sezonTarihleri,
  sezonTarihKaydet,
  sezonListesiTarihli,
};
