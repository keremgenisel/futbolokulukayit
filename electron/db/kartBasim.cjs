// ── Giriş kartı basım kaydı (plan §40.7, şema 20) ──
// "Basıldı" = basıma gönderildi (yazıcıya ya da PDF'e), fiziksel teslim değil. Kart no deterministik (sezon + oyuncu no):
// yeniden basım aynı numara; kayıt sayısı "N. basım". Yeni sezon = yeni kart (geçen sezonun basımı bu sezon sayılmaz).
const { db } = require("./baglanti.cjs");
const { playersWhere } = require("./oyuncular.cjs");
const { kartNo } = require("../../src/lib/kartHtml.js");

const TURLER = new Set(["tek", "toplu"]);

/** Basım kaydı: her oyuncu için bir satır (tek işlem). Kullanıcı IPC/sunucuda oturumdan enjekte edilir. */
function kartBasimKaydet(ids, sezon, tur = "tek", kullanici = "") {
  const liste = [...new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const sz = String(sezon || "").trim();
  if (!liste.length) throw new Error("Oyuncu seçilmedi");
  if (!/^\d{4}-\d{4}$/.test(sz)) throw new Error("Sezon 2026-2027 biçiminde olmalı");
  if (!TURLER.has(tur)) throw new Error("Geçersiz basım türü");
  const ekle = db.prepare("INSERT INTO card_prints (player_id, sezon, kullanici, tur, kart_no) VALUES (?,?,?,?,?)");
  const var_ = db.prepare("SELECT 1 FROM players WHERE id=?");
  return db.transaction(() => {
    let adet = 0;
    for (const id of liste) {
      if (!var_.get(id)) continue; // silinmiş oyuncu: sessizce atla
      ekle.run(id, sz, String(kullanici || "").slice(0, 120), tur, kartNo(id, sz));
      adet++;
    }
    return { ok: true, adet };
  })();
}

/** Bir basım kaydını siler ("Basılmadı say"; yalnız yönetici — yetki.cjs). */
function kartBasimSil(id) {
  const r = db.prepare("DELETE FROM card_prints WHERE id=?").run(Number(id));
  return { ok: r.changes > 0 };
}

/** Oyuncunun basım kayıtları (yeniden eskiye); sezon verilirse yalnız o sezon. */
function kartBasimlari(playerId, sezon = null) {
  return sezon
    ? db
        .prepare("SELECT * FROM card_prints WHERE player_id=? AND sezon=? ORDER BY basim_zamani DESC, id DESC")
        .all(Number(playerId), String(sezon))
    : db.prepare("SELECT * FROM card_prints WHERE player_id=? ORDER BY basim_zamani DESC, id DESC").all(Number(playerId));
}

/**
 * Kart basım penceresi listesi: Oyuncular süzgeci (q, yas_grubu_id, durum, sezon) + sezonun basım özeti.
 * `kart`: "tumu" | "basilmamis" | "basilmis". Sayfalama yok (pencere ≤200 sınırını kendi uyarır); satırda veli adı/telefonu da var.
 */
function kartBasimListesi({ sezon, q = "", yas_grubu_id = null, durum = "aktifler", kart = "tumu" } = {}) {
  const sz = String(sezon || "").trim();
  if (!/^\d{4}-\d{4}$/.test(sz)) throw new Error("Sezon 2026-2027 biçiminde olmalı");
  const simdi = new Date();
  const { govde, args } = playersWhere({ q, yas_grubu_id, durum, sezon: sz, yil: simdi.getFullYear(), ay: simdi.getMonth() + 1 });
  const ic = `SELECT p.id, p.ad_soyad, p.durum, p.dogum_tarihi, p.foto_yolu, g.ad AS yas_grubu_ad,
    (SELECT count(*) FROM card_prints cp WHERE cp.player_id=p.id AND cp.sezon=?) AS basim_sayisi,
    (SELECT max(cp.basim_zamani) FROM card_prints cp WHERE cp.player_id=p.id AND cp.sezon=?) AS son_basim,
    (SELECT gu.ad_soyad FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_ad,
    (SELECT COALESCE(NULLIF(gu.gsm,''), gu.whatsapp_no, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_tel
    ${govde}`;
  const dis = kart === "basilmamis" ? "WHERE basim_sayisi = 0" : kart === "basilmis" ? "WHERE basim_sayisi > 0" : "";
  return db.prepare(`SELECT * FROM (${ic}) ${dis} ORDER BY ad_soyad`).all(sz, sz, ...args);
}

module.exports = { kartBasimKaydet, kartBasimSil, kartBasimlari, kartBasimListesi };
