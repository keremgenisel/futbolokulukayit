// ── documents, sağlık raporu durumu ──
const { db } = require("./baglanti.cjs");
const { updatePlayer } = require("./oyuncular.cjs");

const listDocuments = (pid) => db.prepare("SELECT * FROM documents WHERE player_id=? ORDER BY yuklenme_tarihi DESC").all(pid);
// Oyuncu başına EN FAZLA BİR dosya tutulan belge tipleri: yenisi eskisinin yerine geçer.
// Diğer tiplere (sağlık raporu, kimlik fotokopileri vb.) birden fazla dosya yüklenebilir.
const TEKIL_BELGE_TIPLERI = new Set(["foto"]);
const tekilBelgeMi = (tip) => TEKIL_BELGE_TIPLERI.has(tip);
// Belge kaydı ekler; tekil tipte eski kayıtları siler ve silinen dosya yollarını döner (çağıran dosyaları temizler).
function belgeEkle(pid, d) {
  const eskiler = tekilBelgeMi(d.tip) ? db.prepare("SELECT id, dosya_yolu FROM documents WHERE player_id=? AND tip=?").all(pid, d.tip) : [];
  const id = db.transaction(() => {
    const r = db
      .prepare("INSERT INTO documents (player_id,tip,dosya_yolu,orijinal_ad,gecerlilik_tarihi) VALUES (?,?,?,?,?)")
      .run(pid, d.tip, d.dosya_yolu, d.orijinal_ad || "", d.gecerlilik_tarihi || null);
    for (const e of eskiler) deleteDocument(e.id);
    if (d.tip === "foto") updatePlayer(pid, { foto_yolu: d.dosya_yolu });
    return Number(r.lastInsertRowid);
  })();
  return { id, silinen: eskiler.map((e) => e.dosya_yolu) };
}
const addDocument = (pid, d) => belgeEkle(pid, d).id;
const deleteDocument = (id) => db.prepare("DELETE FROM documents WHERE id=?").run(id);
// Belgenin geçerlilik tarihini sonradan gir/değiştir (tarihsiz yüklenmiş sağlık raporu için; 08.09.2026)
function updateDocument(id, { gecerlilik_tarihi }) {
  const g = gecerlilik_tarihi ? String(gecerlilik_tarihi) : null;
  if (g && !/^\d{4}-\d{2}-\d{2}$/.test(g)) throw new Error("Geçerlilik tarihi geçersiz");
  const r = db.prepare("UPDATE documents SET gecerlilik_tarihi=? WHERE id=?").run(g, Number(id));
  if (r.changes === 0) throw new Error("Belge bulunamadı");
  return { ok: true };
}
const getDocument = (id) => db.prepare("SELECT * FROM documents WHERE id=?").get(id) || null;

// Sağlık raporu uyarıları: aktif oyuncuların EN SON sağlık raporu; yoksa, süresi dolduysa ya da esik gün içinde dolacaksa listelenir.
// Sağlık raporu satırları: aktif/deneme/sakat oyuncular, son raporun geçerliliği ve durum (gecerli|dolacak|doldu|tarihsiz|yok).
function saglikSatirlari(bugun, esikGun = 30, age_group_id = null) {
  const rows = db
    .prepare(
      `SELECT p.id, p.ad_soyad, p.durum AS oyuncu_durum, g.ad AS yas_grubu_ad, g.sira,
      (SELECT d.gecerlilik_tarihi FROM documents d WHERE d.player_id=p.id AND d.tip='saglik' ORDER BY COALESCE(d.gecerlilik_tarihi,'') DESC, d.id DESC LIMIT 1) AS gecerlilik,
      (SELECT count(*) FROM documents d WHERE d.player_id=p.id AND d.tip='saglik') AS rapor_adet,
      (SELECT COALESCE(NULLIF(gu.gsm,''), gu.whatsapp_no, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_tel
    FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE p.durum IN ('aktif','deneme','sakat') AND (? IS NULL OR p.yas_grubu_id=?) ORDER BY g.sira, p.ad_soyad`,
    )
    .all(age_group_id, age_group_id);
  const esik = new Date(bugun + "T00:00:00");
  esik.setDate(esik.getDate() + esikGun);
  const esikIso = esik.toISOString().slice(0, 10);
  const b = new Date(bugun + "T00:00:00").getTime();
  return rows.map((r) => {
    const durum =
      r.rapor_adet === 0
        ? "yok"
        : !r.gecerlilik
          ? "tarihsiz"
          : r.gecerlilik < bugun
            ? "doldu"
            : r.gecerlilik <= esikIso
              ? "dolacak"
              : "gecerli";
    const kalanGun = r.gecerlilik ? Math.round((new Date(r.gecerlilik + "T00:00:00").getTime() - b) / 86400000) : null;
    return {
      player_id: r.id,
      ad_soyad: r.ad_soyad,
      yas_grubu_ad: r.yas_grubu_ad,
      oyuncu_durum: r.oyuncu_durum,
      veli_tel: r.veli_tel || "",
      gecerlilik: r.gecerlilik || null,
      durum,
      kalanGun,
    };
  });
}
function saglikRaporuDurumu(bugun, esikGun = 30) {
  const rows = saglikSatirlari(bugun, esikGun);
  const uyarilar = rows
    .filter((r) => r.durum !== "gecerli")
    .map(({ player_id, ad_soyad, yas_grubu_ad, gecerlilik, durum }) => ({ player_id, ad_soyad, yas_grubu_ad, gecerlilik, durum }));
  return {
    toplam: rows.length,
    uyarilar,
    doldu: uyarilar.filter((u) => u.durum === "doldu").length,
    dolacak: uyarilar.filter((u) => u.durum === "dolacak").length,
    yok: uyarilar.filter((u) => u.durum === "yok").length,
    tarihsiz: uyarilar.filter((u) => u.durum === "tarihsiz").length,
  };
}
// Raporlar > Sağlık Raporu Durumu: tüm satırlar (geçerliler dahil), en acil önce.
const ACILIYET_SIRA = { doldu: 0, dolacak: 1, tarihsiz: 2, yok: 3, gecerli: 4 };
const saglikRaporuListesi = (bugun, age_group_id = null, esikGun = 30) =>
  saglikSatirlari(bugun, esikGun, age_group_id ? Number(age_group_id) : null).sort(
    (a, b) =>
      ACILIYET_SIRA[a.durum] - ACILIYET_SIRA[b.durum] ||
      String(a.gecerlilik || "").localeCompare(String(b.gecerlilik || "")) ||
      a.ad_soyad.localeCompare(b.ad_soyad, "tr"),
  );

module.exports = {
  listDocuments,
  addDocument,
  belgeEkle,
  tekilBelgeMi,
  deleteDocument,
  updateDocument,
  getDocument,
  saglikRaporuDurumu,
  saglikRaporuListesi,
};
