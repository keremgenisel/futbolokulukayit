// ── players, guardians, emergency contacts, liste/sayfa sorguları ──
const { db } = require("./baglanti.cjs");
const { ensureMonthlyDues } = require("./aidat.cjs");
const { getSetting } = require("./meta.cjs");
const { tarihinSezonu } = require("../makbuzNo.cjs");
const varsayilanSezon = () =>
  getSetting("aktif_sezon") || tarihinSezonu(new Date().toISOString().slice(0, 10), Number(getSetting("sezon_baslangic_ayi")) || 9);
const { araNormalize } = require("../metin.cjs");
// LIKE içinde kullanıcı girdisinin % _ \ karakterleri joker olmasın (ESCAPE '\\')
const likeKacir = (s) => String(s).replace(/[\\%_]/g, (c) => "\\" + c);

const PLAYER_FIELDS = [
  "tc_no",
  "uyruk",
  "pasaport_no",
  "sezon",
  "ad_soyad",
  "dogum_tarihi",
  "dogum_yeri",
  "okul",
  "gsm",
  "adres",
  "kan_grubu",
  "foto_yolu",
  "yas_grubu_id",
  "durum",
  "ucret_tipi",
  "aylik_aidat",
  "odeme_donemi",
  "kayit_tarihi",
  "notlar",
];
function ucretTipiDogrula(kod) {
  if (kod === undefined) return;
  if (!db.prepare("SELECT 1 FROM fee_types WHERE kod=?").get(String(kod))) throw new Error("Tanımsız ücret tipi: " + kod);
}
function createPlayer(p) {
  ucretTipiDogrula(p.ucret_tipi);
  // Sezon verilmediyse (form, Excel aktarımı) aktif sezon damgalanır; ayar boşsa (sihirbaz atlanmış) bugünün sezonu —
  // Oyuncular ekranının varsayılan sezon filtresi de aynı kuralla seçer (plan §18)
  if (p.sezon === undefined || p.sezon === null || p.sezon === "") p = { ...p, sezon: varsayilanSezon() };
  const cols = PLAYER_FIELDS.filter((f) => p[f] !== undefined);
  const r = db.prepare(`INSERT INTO players (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => p[c]));
  sezonUyeligiEkle(Number(r.lastInsertRowid), p.sezon);
  buAyAidatAc(Number(r.lastInsertRowid)); // ay ortasında kaydolan oyuncunun bu ayki aidatı hemen açılsın
  return getPlayer(Number(r.lastInsertRowid));
}
// Bu ayın aidat kaydını tek oyuncu için aç (kayıt/durum değişimi sonrası; yeniden başlatma beklenmez).
function buAyAidatAc(pid) {
  const t = new Date();
  return ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1, pid);
}
// Oyuncunun sezon üyeliği (plan §18.1): kayıt, sezon değişikliği ve sezon geçişinde eklenir; silinmez (geçmiş kalır).
const sezonUyeligiEkle = (pid, sezon) => {
  if (sezon) db.prepare("INSERT OR IGNORE INTO player_seasons (player_id, sezon) VALUES (?,?)").run(Number(pid), String(sezon));
};
function updatePlayer(id, p) {
  ucretTipiDogrula(p.ucret_tipi);
  if (p.sezon) sezonUyeligiEkle(id, p.sezon);
  const cols = PLAYER_FIELDS.filter((f) => p[f] !== undefined);
  if (!cols.length) return getPlayer(id);
  db.prepare(`UPDATE players SET ${cols.map((c) => `${c}=?`).join(",")}, updated_at=datetime('now') WHERE id=?`).run(
    ...cols.map((c) => p[c]),
    id,
  );
  if (p.durum !== undefined || p.ucret_tipi !== undefined || p.aylik_aidat !== undefined) buAyAidatAc(id); // pasif→aktif vb.
  return getPlayer(id);
}
const getPlayer = (id) =>
  db.prepare("SELECT p.*, g.ad AS yas_grubu_ad FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id WHERE p.id=?").get(id) || null;
function listPlayers({ q = "", yas_grubu_id = null, durum = null } = {}) {
  const where = [];
  const args = [];
  if (q) {
    const a = `%${likeKacir(araNormalize(q))}%`;
    where.push("(tr_ara(p.ad_soyad) LIKE ? ESCAPE '\\' OR p.tc_no LIKE ? ESCAPE '\\' OR tr_ara(p.pasaport_no) LIKE ? ESCAPE '\\')");
    args.push(a, `%${likeKacir(q)}%`, a);
  }
  if (yas_grubu_id) {
    where.push("p.yas_grubu_id=?");
    args.push(yas_grubu_id);
  }
  if (durum === "aktifler")
    where.push("p.durum IN ('aktif','deneme','sakat')"); // Oyuncular listesi varsayılanı: sahadaki herkes (pasif/ayrıldı/dondurma gizli)
  else if (durum) {
    where.push("p.durum=?");
    args.push(durum);
  }
  const sql = `SELECT p.*, g.ad AS yas_grubu_ad FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.ad_soyad`;
  return db.prepare(sql).all(...args);
}
const deletePlayer = (id) => db.prepare("DELETE FROM players WHERE id=?").run(id);

// ── guardians / emergency ──
const listGuardians = (pid) => db.prepare("SELECT * FROM guardians WHERE player_id=? ORDER BY veli_mi DESC, id").all(pid);
function addGuardian(pid, g) {
  const r = db
    .prepare("INSERT INTO guardians (player_id,tip,ad_soyad,gsm,whatsapp_no,veli_mi,mesaj_onayi) VALUES (?,?,?,?,?,?,?)")
    .run(
      pid,
      g.tip || "veli",
      g.ad_soyad,
      g.gsm || "",
      g.whatsapp_no || "",
      g.veli_mi ? 1 : 0,
      g.mesaj_onayi === undefined ? 1 : g.mesaj_onayi ? 1 : 0,
    );
  return Number(r.lastInsertRowid);
}
const deleteGuardian = (id) => db.prepare("DELETE FROM guardians WHERE id=?").run(id);
// Veli: WhatsApp bilgilendirme onayı ve numaralar (oyuncu kartı > Aile)
const updateGuardian = (id, { mesaj_onayi, gsm, whatsapp_no }) =>
  db
    .prepare(
      "UPDATE guardians SET mesaj_onayi=COALESCE(?,mesaj_onayi), gsm=COALESCE(?,gsm), whatsapp_no=COALESCE(?,whatsapp_no) WHERE id=?",
    )
    .run(
      mesaj_onayi === undefined ? null : mesaj_onayi ? 1 : 0,
      gsm === undefined ? null : String(gsm),
      whatsapp_no === undefined ? null : String(whatsapp_no),
      id,
    );
const listEmergency = (pid) => db.prepare("SELECT * FROM emergency_contacts WHERE player_id=? ORDER BY id").all(pid);
function addEmergency(pid, e) {
  const r = db
    .prepare("INSERT INTO emergency_contacts (player_id,ad_soyad,yakinlik,telefon) VALUES (?,?,?,?)")
    .run(pid, e.ad_soyad, e.yakinlik || "", e.telefon || "");
  return Number(r.lastInsertRowid);
}
const deleteEmergency = (id) => db.prepare("DELETE FROM emergency_contacts WHERE id=?").run(id);

// Oyuncu listesi + verilen ayın aidat durumu (liste ekranı ve tesise giriş kontrolü).
// Oyuncu listesi + seçilen ayın aidat durumu: ortak WHERE (liste, sayfa ve sayım aynı filtreyi kullanır).
function playersWhere({
  q = "",
  yas_grubu_id = null,
  durum = null,
  yil,
  ay,
  sadeceOdemeyen = false,
  saglikSorunlu = false,
  bugun = null,
  sezon = null, // raporlar: yalnız o sezonun oyuncuları (players.sezon; plan §17.5)
} = {}) {
  const where = [];
  const args = [yil, ay];
  if (sezon) {
    // O sezonda sahada olan herkes (player_seasons); players.sezon yalnız güncel sezondur — geçmiş sezon seçilince yenileyenler de gelir
    where.push("(p.sezon=? OR EXISTS (SELECT 1 FROM player_seasons ps WHERE ps.player_id=p.id AND ps.sezon=?))");
    args.push(String(sezon), String(sezon));
  }
  if (q) {
    const a = `%${likeKacir(araNormalize(q))}%`;
    where.push("(tr_ara(p.ad_soyad) LIKE ? ESCAPE '\\' OR p.tc_no LIKE ? ESCAPE '\\' OR tr_ara(p.pasaport_no) LIKE ? ESCAPE '\\')");
    args.push(a, `%${likeKacir(q)}%`, a);
  }
  if (yas_grubu_id) {
    where.push("p.yas_grubu_id=?");
    args.push(yas_grubu_id);
  }
  if (durum === "aktifler")
    where.push("p.durum IN ('aktif','deneme','sakat')"); // Oyuncular listesi varsayılanı: sahadaki herkes (pasif/ayrıldı/dondurma gizli)
  else if (durum) {
    where.push("p.durum=?");
    args.push(durum);
  }
  if (sadeceOdemeyen) where.push("d.durum IN ('odenmedi','kismi')");
  // Sağlık raporu olmayanlar: hiç rapor yok, tarihsiz rapor ya da son raporun süresi dolmuş (panodaki "yok/doldu" ile aynı kural)
  if (saglikSorunlu) {
    where.push(
      `((SELECT count(*) FROM documents dd WHERE dd.player_id=p.id AND dd.tip='saglik') = 0 OR COALESCE((SELECT dd.gecerlilik_tarihi FROM documents dd WHERE dd.player_id=p.id AND dd.tip='saglik' ORDER BY COALESCE(dd.gecerlilik_tarihi,'') DESC, dd.id DESC LIMIT 1), '') < ?)`,
    );
    args.push(String(bugun || new Date().toISOString().slice(0, 10)));
  }
  const govde = `FROM players p LEFT JOIN age_groups g ON g.id=p.yas_grubu_id
    LEFT JOIN monthly_dues d ON d.player_id=p.id AND d.yil=? AND d.ay=?
    ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
  return { govde, args };
}
const PLAYER_SELECT =
  "SELECT p.*, g.ad AS yas_grubu_ad, d.durum AS aidat_durum, d.tutar AS aidat_tutar, d.odenen AS aidat_odenen, (SELECT dd.gecerlilik_tarihi FROM documents dd WHERE dd.player_id=p.id AND dd.tip='saglik' ORDER BY COALESCE(dd.gecerlilik_tarihi,'') DESC, dd.id DESC LIMIT 1) AS saglik_gecerlilik, (SELECT count(*) FROM documents dd WHERE dd.player_id=p.id AND dd.tip='saglik') AS saglik_adet, (SELECT COALESCE(NULLIF(gu.gsm,''), gu.whatsapp_no, '') FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_tel, (SELECT gu.ad_soyad FROM guardians gu WHERE gu.player_id=p.id ORDER BY gu.veli_mi DESC, gu.id LIMIT 1) AS veli_ad";
function listPlayersWithDue(opts = {}) {
  const { govde, args } = playersWhere(opts);
  return db.prepare(`${PLAYER_SELECT} ${govde} ORDER BY p.ad_soyad`).all(...args);
}
// Sayfalı liste: { liste, toplam, sayfa, sayfaBoyu } — Oyuncular ekranı (sayfa 1'den başlar).
function playersPage({ sayfa = 1, sayfaBoyu = 50, ...opts } = {}) {
  const boy = Math.min(500, Math.max(1, Number(sayfaBoyu) || 50));
  const { govde, args } = playersWhere(opts);
  const toplam = db.prepare(`SELECT count(*) AS n ${govde}`).get(...args).n;
  const sonSayfa = Math.max(1, Math.ceil(toplam / boy));
  const sf = Math.min(sonSayfa, Math.max(1, Number(sayfa) || 1));
  const liste = db.prepare(`${PLAYER_SELECT} ${govde} ORDER BY p.ad_soyad LIMIT ? OFFSET ?`).all(...args, boy, (sf - 1) * boy);
  return { liste, toplam, sayfa: sf, sayfaBoyu: boy };
}

module.exports = {
  PLAYER_FIELDS,
  sezonUyeligiEkle,
  createPlayer,
  updatePlayer,
  getPlayer,
  listPlayers,
  deletePlayer,
  listGuardians,
  addGuardian,
  updateGuardian,
  deleteGuardian,
  listEmergency,
  addEmergency,
  deleteEmergency,
  listPlayersWithDue,
  playersPage,
};
