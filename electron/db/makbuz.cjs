// ── receipts ──
const { db } = require("./baglanti.cjs");
const { getSetting } = require("./meta.cjs");
const { makbuzSezonu, makbuzOneki, sonrakiMakbuzNo } = require("../makbuzNo.cjs");

// Makbuz numarası sezon bazlı (plan §17.2): önek sezonun ilk yılı, sayaç önek içinde artar.
function nextReceiptNo(onek) {
  const last = db
    .prepare("SELECT makbuz_no FROM receipts WHERE makbuz_no LIKE ? ORDER BY length(makbuz_no) DESC, makbuz_no DESC LIMIT 1")
    .get(`${onek}-%`);
  return sonrakiMakbuzNo(onek, last?.makbuz_no);
}
// Ödenen tutara göre durumu yeniden hesapla (muaf değişmez).
function aidatDurumGuncelle(pid, yil, ay) {
  const d = db.prepare("SELECT tutar, odenen, durum FROM monthly_dues WHERE player_id=? AND yil=? AND ay=?").get(pid, yil, ay);
  if (!d) return;
  if (d.durum === "muaf" && d.odenen <= 0) return; // muaf kayıt ödeme almadıysa muaf kalır; ödeme geldiyse ödendi olur
  const durum = d.odenen <= 0 ? "odenmedi" : d.odenen >= d.tutar ? "odendi" : "kismi";
  db.prepare("UPDATE monthly_dues SET durum=? WHERE player_id=? AND yil=? AND ay=?").run(durum, pid, yil, ay);
}
function createReceipt({ player_id, tarih, odeme_yontemi = "nakit", tahsil_eden = "", not_ = "", satirlar = [] }) {
  // Makbuz aktif sezona damgalanır (ayar yoksa tarihten); numara sezonun ilk yılıyla başlar
  const sezon = makbuzSezonu(getSetting("aktif_sezon") || "", tarih, Number(getSetting("sezon_baslangic_ayi")) || 9);
  const toplam = satirlar.reduce((s, l) => s + Number(l.tutar || 0), 0);
  const tx = db.transaction(() => {
    const makbuz_no = nextReceiptNo(makbuzOneki(sezon, tarih));
    const r = db
      .prepare("INSERT INTO receipts (makbuz_no,player_id,tarih,toplam,odeme_yontemi,tahsil_eden,not_,sezon) VALUES (?,?,?,?,?,?,?,?)")
      .run(makbuz_no, player_id, tarih, toplam, odeme_yontemi, tahsil_eden, not_, sezon);
    const rid = Number(r.lastInsertRowid);
    const insLine = db.prepare("INSERT INTO receipt_lines (receipt_id,fee_item_id,aciklama,tutar,yil,ay) VALUES (?,?,?,?,?,?)");
    const aidatId = db.prepare("SELECT id FROM fee_items WHERE kod='aidat'").get()?.id;
    for (const l of satirlar) {
      insLine.run(rid, l.fee_item_id || null, l.aciklama || "", Number(l.tutar || 0), l.yil || null, l.ay || null);
      if (l.fee_item_id === aidatId && l.yil && l.ay) {
        // Kısmi ödeme: ödenen birikir; beklenen tutara ulaşınca 'odendi', eksikse 'kismi'. Kayıt yoksa (ileri ay) tutar = ödenen.
        const tut = Number(l.tutar || 0);
        db.prepare(
          "INSERT INTO monthly_dues (player_id,yil,ay,tutar,odenen,durum,receipt_id) VALUES (?,?,?,?,?,'odendi',?) ON CONFLICT(player_id,yil,ay) DO UPDATE SET odenen=odenen+excluded.odenen, receipt_id=excluded.receipt_id",
        ).run(player_id, l.yil, l.ay, tut, tut, rid);
        aidatDurumGuncelle(player_id, l.yil, l.ay);
      }
    }
    return { id: rid, makbuz_no, sezon };
  });
  return tx();
}
function getReceipt(id) {
  const r = db
    .prepare(
      "SELECT r.*, COALESCE(NULLIF(r.oyuncu_adi,''), p.ad_soyad) AS ad_soyad, p.dogum_tarihi, g.ad AS yas_grubu_ad FROM receipts r JOIN players p ON p.id=r.player_id LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE r.id=?",
    )
    .get(id);
  if (!r) return null;
  r.satirlar = db
    .prepare(
      "SELECT l.*, f.ad AS kalem_ad, f.kod AS kalem_kod FROM receipt_lines l LEFT JOIN fee_items f ON f.id=l.fee_item_id WHERE l.receipt_id=? ORDER BY l.id",
    )
    .all(id);
  return r;
}
const listReceipts = (pid, limit = null) =>
  limit
    ? db.prepare("SELECT * FROM receipts WHERE player_id=? ORDER BY tarih DESC, id DESC LIMIT ?").all(pid, Number(limit))
    : db.prepare("SELECT * FROM receipts WHERE player_id=? ORDER BY tarih DESC, id DESC").all(pid);
// sezon verilirse yalnız o sezona damgalı makbuzlar (Tahsilat > Bugün Kesilen Makbuzlar: aktif sezon; plan §17.2)
// grup verilirse oyuncusu o yaş grubunda olan makbuzlar (Raporlar > Tahsilat, ortak filtre; plan §20)
const listCancelledReceipts = (from, to, sezon = null, grup = null) =>
  db
    .prepare(
      "SELECT r.*, COALESCE(NULLIF(r.oyuncu_adi,''), p.ad_soyad) AS ad_soyad FROM receipts r JOIN players p ON p.id=r.player_id WHERE r.tarih BETWEEN ? AND ? AND r.iptal=1 AND (? IS NULL OR r.sezon=?) AND (? IS NULL OR p.yas_grubu_id=?) ORDER BY r.tarih, r.id",
    )
    .all(from, to, sezon, sezon, grup, grup);
const listReceiptsByDate = (from, to, sezon = null, grup = null) =>
  db
    .prepare(
      "SELECT r.*, COALESCE(NULLIF(r.oyuncu_adi,''), p.ad_soyad) AS ad_soyad FROM receipts r JOIN players p ON p.id=r.player_id WHERE r.tarih BETWEEN ? AND ? AND r.iptal=0 AND (? IS NULL OR r.sezon=?) AND (? IS NULL OR p.yas_grubu_id=?) ORDER BY r.tarih, r.id",
    )
    .all(from, to, sezon, sezon, grup, grup);
const setReceiptPdf = (id, pdf_yolu) => db.prepare("UPDATE receipts SET pdf_yolu=? WHERE id=?").run(pdf_yolu, id);

// İptal: neden zorunlu; iptal eden ve zaman kaydedilir (muhasebe izi). Aidat ödenenleri düşer.
const cancelReceipt = (id, neden = "", kullanici = "") => {
  const n = String(neden || "").trim();
  if (!n) throw new Error("İptal nedeni zorunlu");
  const tx = db.transaction(() => {
    const r = db.prepare("SELECT player_id, iptal FROM receipts WHERE id=?").get(id);
    if (!r) throw new Error("Makbuz bulunamadı");
    if (r.iptal) return;
    db.prepare("UPDATE receipts SET iptal=1, iptal_nedeni=?, iptal_eden=?, iptal_zamani=datetime('now') WHERE id=?").run(
      n,
      String(kullanici || ""),
      id,
    );
    // Makbuzun aidat satırları ödenenden düşülür; başka makbuzla kısmen ödenmişse 'kismi' kalır
    for (const l of db
      .prepare("SELECT tutar, yil, ay FROM receipt_lines WHERE receipt_id=? AND yil IS NOT NULL AND ay IS NOT NULL")
      .all(id)) {
      db.prepare("UPDATE monthly_dues SET odenen=MAX(0, odenen-?), receipt_id=NULL WHERE player_id=? AND yil=? AND ay=?").run(
        Number(l.tutar || 0),
        r.player_id,
        l.yil,
        l.ay,
      );
      aidatDurumGuncelle(r.player_id, l.yil, l.ay);
    }
  });
  tx();
  return { ok: true };
};

module.exports = { createReceipt, getReceipt, listReceipts, listReceiptsByDate, listCancelledReceipts, setReceiptPdf, cancelReceipt };
