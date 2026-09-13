// ── fee items, fee types, monthly dues ──
const { vadeSecimi } = require("./vade.cjs");
const { db } = require("./baglanti.cjs");
const { getSetting } = require("./meta.cjs");
const { kodUret, KOD_GECERLI } = require("../kodUret.cjs");

// Ayarlar > Aidat Kalemleri: taban aidat + ücret tipi indirimleri (tek çağrıda, oyuncu formu için).
function aidatAyarlari() {
  const taban = db.prepare("SELECT varsayilan_fiyat FROM fee_items WHERE kod='aidat'").get()?.varsayilan_fiyat ?? 0;
  const ucretTipleri = listFeeTypes();
  const indirimler = Object.fromEntries(ucretTipleri.map((t) => [t.kod, t.indirim]));
  return { taban: Number(taban) || 0, indirimler, ucretTipleri, sezon: getSetting("aktif_sezon") || "" };
}
const listFeeTypes = () => db.prepare("SELECT kod, ad, indirim, sira, aktif, sabit FROM fee_types ORDER BY sira, kod").all();

// ── fee items ──
const listFeeItems = () => db.prepare("SELECT * FROM fee_items ORDER BY sira, id").all();
const updateFeeItem = (id, { ad, varsayilan_fiyat, aktif }) =>
  db
    .prepare("UPDATE fee_items SET ad=COALESCE(?,ad), varsayilan_fiyat=COALESCE(?,varsayilan_fiyat), aktif=COALESCE(?,aktif) WHERE id=?")
    .run(ad, varsayilan_fiyat, aktif, id);
// Ayarlar > Aidat Kalemleri: kalemler (güncelle / yeni / sil) + ücret tipleri (güncelle / yeni / sil) + indirim
// yüzdeleri TEK işlemde (biri hata verirse hiçbiri yazılmaz).
//   kalemler:     [{ id, ad?, varsayilan_fiyat?, aktif? } | { yeni: true, ad, varsayilan_fiyat? } | { id, sil: true }]
//   ucretTipleri: [{ kod, ad?, indirim?, aktif? } | { yeni: true, ad, indirim? } | { kod, sil: true }]
//   indirimler:   { kod: yüzde }  (ilk kurulum sihirbazı; ucretTipleri ile aynı işi yapar)
// "aidat" kalemi ve sabit tipler (normal, ucretsiz) silinemez; makbuzda geçen kalem ve oyuncusu olan tip silinemez → pasife alınır.
function yuzdeDogrula(yuzde) {
  const y = Number(yuzde);
  if (!Number.isFinite(y) || y < 0 || y > 100) throw new Error("İndirim yüzdesi 0-100 arası olmalı");
  return Math.round(y);
}
function aidatAyarlariKaydet({ kalemler = [], indirimler = {}, ucretTipleri = [] } = {}) {
  const tx = db.transaction(() => {
    let kalemSayisi = 0,
      tipSayisi = 0;
    for (const k of kalemler) {
      kalemSayisi++;
      if (k.yeni) {
        const ad = String(k.ad || "").trim();
        if (!ad) throw new Error("Kalem adı boş olamaz");
        const kod = kodUret(
          ad,
          db
            .prepare("SELECT kod FROM fee_items")
            .all()
            .map((x) => x.kod),
          "kalem",
        );
        const sira = (db.prepare("SELECT MAX(sira) AS m FROM fee_items").get().m ?? 0) + 1;
        db.prepare("INSERT INTO fee_items (kod, ad, varsayilan_fiyat, sira, aktif) VALUES (?,?,?,?,1)").run(
          kod,
          ad,
          Math.max(0, Number(k.varsayilan_fiyat) || 0),
          sira,
        );
        continue;
      }
      const mevcut = db.prepare("SELECT * FROM fee_items WHERE id=?").get(Number(k.id));
      if (!mevcut) throw new Error("Kalem bulunamadı: " + k.id);
      if (k.sil) {
        if (mevcut.kod === "aidat") throw new Error("Aidat kalemi silinemez");
        const n = db.prepare("SELECT count(*) AS n FROM receipt_lines WHERE fee_item_id=?").get(mevcut.id).n;
        if (n > 0) throw new Error(`"${mevcut.ad}" ${n} makbuz satırında kullanılmış; silmek yerine pasife alın`);
        db.prepare("DELETE FROM fee_items WHERE id=?").run(mevcut.id);
        continue;
      }
      const ad = k.ad === undefined ? null : String(k.ad).trim();
      if (ad !== null && !ad) throw new Error("Kalem adı boş olamaz");
      const fiyat = k.varsayilan_fiyat === undefined ? null : Math.max(0, Number(k.varsayilan_fiyat) || 0);
      const aktif = k.aktif === undefined ? null : k.aktif ? 1 : 0;
      if (mevcut.kod === "aidat" && aktif === 0) throw new Error("Aidat kalemi pasife alınamaz");
      updateFeeItem(mevcut.id, { ad, varsayilan_fiyat: fiyat, aktif });
    }
    const tipListesi = [...ucretTipleri, ...Object.entries(indirimler).map(([kod, indirim]) => ({ kod, indirim }))];
    for (const t of tipListesi) {
      tipSayisi++;
      if (t.yeni) {
        const ad = String(t.ad || "").trim();
        if (!ad) throw new Error("Ücret tipi adı boş olamaz");
        const kod = kodUret(
          ad,
          listFeeTypes().map((x) => x.kod),
          "tip",
        );
        const sira = (db.prepare("SELECT MAX(sira) AS m FROM fee_types").get().m ?? 0) + 1;
        db.prepare("INSERT INTO fee_types (kod, ad, indirim, sira, aktif, sabit) VALUES (?,?,?,?,1,0)").run(
          kod,
          ad,
          yuzdeDogrula(t.indirim ?? 0),
          sira,
        );
        continue;
      }
      if (!KOD_GECERLI.test(String(t.kod || ""))) throw new Error("Geçersiz ücret tipi: " + t.kod);
      const mevcut = db.prepare("SELECT * FROM fee_types WHERE kod=?").get(t.kod);
      if (!mevcut) throw new Error("Ücret tipi bulunamadı: " + t.kod);
      if (t.sil) {
        if (mevcut.sabit) throw new Error(`"${mevcut.ad}" sabit ücret tipidir, silinemez`);
        const n = db.prepare("SELECT count(*) AS n FROM players WHERE ucret_tipi=?").get(mevcut.kod).n;
        if (n > 0) throw new Error(`"${mevcut.ad}" ${n} oyuncuda seçili; önce oyuncuları başka tipe alın ya da tipi pasife alın`);
        db.prepare("DELETE FROM fee_types WHERE kod=?").run(mevcut.kod);
        continue;
      }
      const ad = t.ad === undefined ? null : String(t.ad).trim();
      if (ad !== null && !ad) throw new Error("Ücret tipi adı boş olamaz");
      const indirim = t.indirim === undefined || mevcut.sabit ? null : yuzdeDogrula(t.indirim);
      const aktif = t.aktif === undefined || mevcut.sabit ? null : t.aktif ? 1 : 0;
      db.prepare("UPDATE fee_types SET ad=COALESCE(?,ad), indirim=COALESCE(?,indirim), aktif=COALESCE(?,aktif) WHERE kod=?").run(
        ad,
        indirim,
        aktif,
        mevcut.kod,
      );
    }
    return { ok: true, kalem: kalemSayisi, indirim: tipSayisi };
  });
  return tx();
}

// ── monthly dues ──
// Aidat ödemesi beklenen durumlar. Ücretsiz/burslu ücret tipi ve dondurma/pasif/ayrıldı durumu muaf.
const MUAF_UCRET = new Set(["ucretsiz"]); // burslu: indirim yüzdesiyle (varsayılan %100 → 0 ₺ → muaf)
const AIDAT_DURUM = new Set(["aktif", "deneme", "sakat"]);
// pid verilirse yalnız o oyuncu (yeni kayıt / durum değişimi); verilmezse herkes. INSERT OR IGNORE → tekrar güvenli.
function ensureMonthlyDues(yil, ay, pid = null) {
  const players = pid
    ? db.prepare("SELECT id, durum, ucret_tipi, aylik_aidat FROM players WHERE id=?").all(pid)
    : db.prepare("SELECT id, durum, ucret_tipi, aylik_aidat FROM players").all();
  const ins = db.prepare("INSERT OR IGNORE INTO monthly_dues (player_id,yil,ay,tutar,durum) VALUES (?,?,?,?,?)");
  let n = 0;
  const tx = db.transaction(() => {
    for (const p of players) {
      if (!AIDAT_DURUM.has(p.durum)) continue;
      const muaf = MUAF_UCRET.has(p.ucret_tipi) || !(p.aylik_aidat > 0);
      const r = ins.run(p.id, yil, ay, muaf ? 0 : p.aylik_aidat, muaf ? "muaf" : "odenmedi");
      n += r.changes;
    }
  });
  tx();
  return n;
}
// Bir aralıktaki TÜM ayları tek işlemde garanti eder (Tahsilat > Uzun Dönem Seç, plan §24): N ayrı
// ensureMonthlyDues çağrısı yerine tek transaction; sonuçta oluşan/var olan satırları döner (renderer
// her ay için ayrıca getDue çağırmasın). aylar: [{ yil, ay }, ...] — sırası önemli değil.
function ensureMonthlyDuesAraligi(pid, aylar) {
  const tx = db.transaction(() => {
    for (const { yil, ay } of aylar) ensureMonthlyDues(yil, ay, pid);
  });
  tx();
  return aylar.map(({ yil, ay }) => getDue(pid, yil, ay));
}
const getDue = (pid, yil, ay) => db.prepare("SELECT * FROM monthly_dues WHERE player_id=? AND yil=? AND ay=?").get(pid, yil, ay) || null;
// limit verilirse yalnız son N dönem (oyuncu kartı); verilmezse tümü.
// Satırlarda `vade_gecti` (plan §38); `bugun` yalnız test/rapor için, varsayılan bugün.
const listDues = (pid, limit = null, { bugun = null } = {}) => {
  const v = vadeSecimi(bugun);
  const sel = `SELECT d.*, ${v.sql} AS vade_gecti FROM monthly_dues d JOIN players p ON p.id=d.player_id WHERE d.player_id=? ORDER BY d.yil DESC, d.ay DESC`;
  return limit ? db.prepare(sel + " LIMIT ?").all(...v.args, pid, Number(limit)) : db.prepare(sel).all(...v.args, pid);
};
// sezon verilirse yalnız o sezonun oyuncuları (plan §19.3)
// grup verilirse yalnız o yaş grubu (Raporlar ortak filtre; plan §20)
// opts.yalnizVadesiGecen: vadesi gelmemiş aylar listelenmez (Pano, WhatsApp toplu; plan §38); satırlarda `vade_gecti`.
// Borçlu listelerinde oyuncu kümesi (13.09.2026): "sahada" (aktif/deneme/sakat; Pano, WhatsApp ve raporların varsayılanı),
// "ayrilan" (pasif/ayrıldı/dondurma — alacak unutulmasın diye Raporlar'da ayrıca seçilir), "tumu". Ayrılan oyuncunun açık borcu
// silinmez ama günlük ekranlarda sayılmaz.
const KUME_SQL = { sahada: "p.durum IN ('aktif','deneme','sakat')", ayrilan: "p.durum NOT IN ('aktif','deneme','sakat')", tumu: "1=1" };
const kumeSql = (kume) => KUME_SQL[kume] || KUME_SQL.sahada;
const listUnpaid = (yil, ay, sezon = null, grup = null, { bugun = null, yalnizVadesiGecen = false, kume = "sahada" } = {}) => {
  const v = vadeSecimi(bugun);
  return db
    .prepare(
      `SELECT d.*, MAX(0, d.tutar-d.odenen) AS kalan, ${v.sql} AS vade_gecti, p.ad_soyad, p.odeme_donemi, g.ad AS yas_grubu_ad, (SELECT COALESCE(NULLIF(gu.gsm,''), gu.whatsapp_no, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_tel, (SELECT gu.ad_soyad FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_ad, (SELECT gu.id FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_id, (SELECT COALESCE(NULLIF(gu.whatsapp_no,''), gu.gsm, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_wa, (SELECT gu.mesaj_onayi FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_onay, (SELECT count(*) FROM message_log m WHERE m.player_id=p.id AND m.tur='aidat' AND m.yil=d.yil AND m.ay=d.ay) AS hatirlatma, (SELECT MAX(m.tarih) FROM message_log m WHERE m.player_id=p.id AND m.tur='aidat' AND m.yil=d.yil AND m.ay=d.ay) AS son_hatirlatma, (SELECT m.id FROM message_log m WHERE m.player_id=p.id AND m.tur='aidat' AND m.yil=d.yil AND m.ay=d.ay ORDER BY m.id DESC LIMIT 1) AS son_mesaj_id FROM monthly_dues d JOIN players p ON p.id=d.player_id LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE d.yil=? AND d.ay=? AND d.durum IN ('odenmedi','kismi') AND (? IS NULL OR p.sezon=? OR EXISTS (SELECT 1 FROM player_seasons ps WHERE ps.player_id=p.id AND ps.sezon=?)) AND (? IS NULL OR p.yas_grubu_id=?) AND ${kumeSql(kume)}${yalnizVadesiGecen ? ` AND ${v.sql} = 1` : ""} ORDER BY p.ad_soyad`,
    )
    .all(...v.args, yil, ay, sezon, sezon, sezon, grup, grup, ...(yalnizVadesiGecen ? v.args : []));
};

// Sezon ayları aralığı (yil*100+ay): başlangıç ayından bir sonraki yılın önceki ayına
const sezonAyAraligi = (sezon, baslangicAyi = 9) => {
  const ilk = Number(String(sezon).slice(0, 4));
  return [ilk * 100 + baslangicAyi, (ilk + 1) * 100 + baslangicAyi - 1];
};
// Oyuncu başına ay aralığı aidat özeti (plan §19.2/§20): açılan/ödenen/kısmi/ödenmemiş/muaf ay sayısı ve toplam borç.
// bas/son: yil*100+ay (202609 … 202708). Anahtar: player_id. `sezonAidatOzeti` sezon için sarmalayıcı.
function aidatOzeti(bas, son) {
  const rows = db
    .prepare(
      `SELECT player_id, count(*) AS acilan,
        sum(CASE WHEN durum='odendi' THEN 1 ELSE 0 END) AS odenen,
        sum(CASE WHEN durum='kismi' THEN 1 ELSE 0 END) AS kismi,
        sum(CASE WHEN durum='odenmedi' THEN 1 ELSE 0 END) AS odenmedi,
        sum(CASE WHEN durum='muaf' THEN 1 ELSE 0 END) AS muaf,
        COALESCE(sum(CASE WHEN durum IN ('odenmedi','kismi') THEN MAX(0, tutar-odenen) ELSE 0 END), 0) AS borc
      FROM monthly_dues WHERE yil*100+ay BETWEEN ? AND ? GROUP BY player_id`,
    )
    .all(bas, son);
  return Object.fromEntries(rows.map((r) => [r.player_id, r]));
}
const sezonAidatOzeti = (sezon, baslangicAyi = 9) => aidatOzeti(...sezonAyAraligi(sezon, baslangicAyi));
// Ay aralığı borçluları (plan §19.3/§20): oyuncu başına borçlu aylar ("2026-9,2026-10"), toplam kalan, veli bilgisi.
// sezon verilirse yalnız o sezonun oyuncuları, grup verilirse yalnız o yaş grubu. `listUnpaidSezon` sezon için sarmalayıcı.
// opts.yalnizVadesiGecen: yalnız vadesi geçmiş aylar (plan §38); satırda vadesi_gecen_ay sayısı da döner.
const listUnpaidAralik = (bas, son, sezon = null, grup = null, { bugun = null, yalnizVadesiGecen = false, kume = "sahada" } = {}) => {
  const v = vadeSecimi(bugun);
  return db
    .prepare(
      `SELECT p.id AS player_id, p.ad_soyad, p.odeme_donemi, g.ad AS yas_grubu_ad,
        group_concat(d.yil || '-' || d.ay, ',') AS aylar, count(*) AS ay_sayisi, sum(MAX(0, d.tutar-d.odenen)) AS kalan,
        sum(d.vade_gecti) AS vadesi_gecen_ay,
        (SELECT gu.ad_soyad FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_ad,
        (SELECT COALESCE(NULLIF(gu.whatsapp_no,''), gu.gsm, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_tel
      FROM (SELECT d.*, ${v.sql} AS vade_gecti FROM monthly_dues d JOIN players p ON p.id=d.player_id WHERE d.yil*100+d.ay BETWEEN ? AND ? AND d.durum IN ('odenmedi','kismi')${yalnizVadesiGecen ? ` AND ${v.sql} = 1` : ""} ORDER BY d.yil, d.ay) d
      JOIN players p ON p.id=d.player_id LEFT JOIN age_groups g ON g.id=p.yas_grubu_id
      WHERE (? IS NULL OR p.sezon=? OR EXISTS (SELECT 1 FROM player_seasons ps WHERE ps.player_id=p.id AND ps.sezon=?)) AND (? IS NULL OR p.yas_grubu_id=?) AND ${kumeSql(kume)}
      GROUP BY p.id ORDER BY p.ad_soyad`,
    )
    .all(...v.args, bas, son, ...(yalnizVadesiGecen ? v.args : []), sezon, sezon, sezon, grup, grup);
};
const listUnpaidSezon = (sezon, baslangicAyi = 9, grup = null, opts = {}) =>
  listUnpaidAralik(...sezonAyAraligi(sezon, baslangicAyi), sezon, grup, opts);

module.exports = {
  aidatOzeti,
  sezonAidatOzeti,
  listUnpaidAralik,
  listUnpaidSezon,
  aidatAyarlari,
  listFeeTypes,
  listFeeItems,
  updateFeeItem,
  aidatAyarlariKaydet,
  ensureMonthlyDues,
  ensureMonthlyDuesAraligi,
  getDue,
  listDues,
  listUnpaid,
};
