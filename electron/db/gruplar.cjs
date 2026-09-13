// ── age groups, haftalık program ──
const { db } = require("./baglanti.cjs");
const { saatAraligiDogrula, programDegisiklikleri } = require("../../src/lib/program.js");
const { haftaGunu } = require("../../src/lib/takvim.js");
const { createTraining, updateTraining } = require("./antrenman.cjs");
const bugunIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

// sezon verilirse yalnız o sezonda var olan gruplar (age_groups.sezon VEYA group_seasons; plan §21); verilmezse hepsi
const listAgeGroups = ({ sezon = null } = {}) =>
  sezon
    ? db
        .prepare(
          "SELECT * FROM age_groups WHERE sezon=? OR EXISTS (SELECT 1 FROM group_seasons gs WHERE gs.group_id=age_groups.id AND gs.sezon=?) ORDER BY sira, ad",
        )
        .all(String(sezon), String(sezon))
    : db.prepare("SELECT * FROM age_groups ORDER BY sira, ad").all();
// Grubun sezon üyeliği (plan §21): oluşturma, sezon düzenleme, sezon geçişi; silinmez (geçmiş kalır)
const grupSezonUyeligiEkle = (id, sezon) => {
  if (sezon) db.prepare("INSERT OR IGNORE INTO group_seasons (group_id, sezon) VALUES (?,?)").run(Number(id), String(sezon));
};
// Sezon "2026-2027" biçiminde ve ikinci yıl birinciden bir fazla olmalı (plan §15); boş kabul (API uyumu). undefined → null (COALESCE: dokunma).
function sezonDogrula(sezon) {
  if (sezon === undefined || sezon === null) return null;
  const s = String(sezon).trim();
  if (s === "") return "";
  const m = /^(\d{4})-(\d{4})$/.exec(s);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new Error("Sezon 2026-2027 biçiminde olmalı");
  return s;
}
function createAgeGroup({ ad, sezon = "", sira = 0 }) {
  sezon = sezonDogrula(sezon) ?? "";
  const r = db.prepare("INSERT INTO age_groups (ad,sezon,sira) VALUES (?,?,?)").run(ad, sezon, sira);
  grupSezonUyeligiEkle(Number(r.lastInsertRowid), sezon);
  return { id: Number(r.lastInsertRowid), ad, sezon, sira, aktif: 1 };
}
// Program değişince (13.09.2026): bugünden itibaren, programdan açılmış ve ELLE DEĞİŞTİRİLMEMİŞ (eski programın gün/saat/saha/bitişi
// ile birebir aynı) antrenmanlar yeni programa eşitlenir (`updateTraining`: değişiklik notu + veli bildirimi gereği düşer). Geçmiş,
// iptal ve elle düzenlenmiş antrenmanlara dokunulmaz; günü kaldırılan antrenman silinmez. Dönüş: { ok, antrenmanGuncellenen }.
const updateAgeGroup = (id, { ad, sezon, sira, aktif, program }, { bugun = bugunIso() } = {}) => {
  const s = sezonDogrula(sezon);
  if (s) grupSezonUyeligiEkle(id, s);
  const eskiProgram =
    program === undefined ? null : programDogrula(db.prepare("SELECT program FROM age_groups WHERE id=?").get(Number(id))?.program);
  const yeniProgram = program === undefined ? null : programDogrula(program);
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE age_groups SET ad=COALESCE(?,ad), sezon=COALESCE(?,sezon), sira=COALESCE(?,sira), aktif=COALESCE(?,aktif), program=COALESCE(?,program) WHERE id=?",
    ).run(ad, s, sira, aktif, yeniProgram === null ? null : JSON.stringify(yeniProgram), id);
    let antrenmanGuncellenen = 0;
    if (eskiProgram) {
      const degisenler = programDegisiklikleri(eskiProgram, yeniProgram);
      if (degisenler.length) {
        const gelecek = db.prepare("SELECT * FROM trainings WHERE age_group_id=? AND tarih>=? AND iptal=0").all(Number(id), bugun);
        for (const t of gelecek) {
          const gun = haftaGunu(t.tarih) + 1;
          const d = degisenler.find(
            (x) => x.gun === gun && x.eskiSaat === t.saat && x.eskiSaha === (t.saha || "") && x.eskiBitis === (t.bitis_saat || ""),
          );
          if (!d) continue;
          updateTraining(t.id, { saat: d.saat, bitis_saat: d.bitis, saha: d.saha });
          antrenmanGuncellenen++;
        }
      }
    }
    return { ok: true, antrenmanGuncellenen };
  });
  return tx();
};
// Program girdisini süz: [{gun 1..7, saat HH:MM, saha}]
function programDogrula(p) {
  const l =
    typeof p === "string"
      ? (() => {
          try {
            return JSON.parse(p || "[]");
          } catch {
            return [];
          }
        })()
      : p;
  if (!Array.isArray(l)) return [];
  return l
    .filter(
      (x) => x && Number.isInteger(Number(x.gun)) && Number(x.gun) >= 1 && Number(x.gun) <= 7 && /^\d{2}:\d{2}$/.test(String(x.saat || "")),
    )
    .map((x) => ({
      gun: Number(x.gun),
      saat: String(x.saat),
      bitis: saatAraligiDogrula(String(x.saat), String(x.bitis || "")).gecerli ? String(x.bitis || "") : "", // plan §37
      saha: String(x.saha || "").trim(),
    }));
}
// Haftayı programdan doldur: aktif grupların programındaki gün/saatler için o haftada antrenman yoksa açar (var olan atlanır).
function haftayiProgramdanDoldur(haftaBasiIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(haftaBasiIso || ""))) throw new Error("Hafta başlangıcı yyyy-aa-gg olmalı");
  const [y, m, d] = haftaBasiIso.split("-").map(Number);
  const gunIso = (ek) => {
    const t = new Date(y, m - 1, d + ek);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  const var_ = db.prepare("SELECT 1 FROM trainings WHERE age_group_id=? AND tarih=? AND saat=? AND iptal=0");
  let eklenen = 0,
    atlanan = 0,
    programsiz = 0;
  const tx = db.transaction(() => {
    for (const g of db.prepare("SELECT id, program FROM age_groups WHERE aktif=1").all()) {
      const prog = programDogrula(g.program);
      if (!prog.length) {
        programsiz++;
        continue;
      }
      for (const p of prog) {
        const tarih = gunIso(p.gun - 1);
        if (var_.get(g.id, tarih, p.saat)) {
          atlanan++;
          continue;
        }
        createTraining({ age_group_id: g.id, tarih, saat: p.saat, saha: p.saha, bitis_saat: p.bitis || "" });
        eklenen++;
      }
    }
  });
  tx();
  return { ok: true, eklenen, atlanan, programsiz, haftaBasi: haftaBasiIso, haftaSonu: gunIso(6) };
}

const deleteAgeGroup = (id) => {
  const n = db.prepare("SELECT count(*) AS n FROM players WHERE yas_grubu_id=?").get(id).n;
  if (n > 0) return { error: `Bu grupta ${n} oyuncu var, önce oyuncuları taşıyın` };
  db.prepare("DELETE FROM age_groups WHERE id=?").run(id);
  return { ok: true };
};

module.exports = {
  listAgeGroups,
  createAgeGroup,
  updateAgeGroup,
  programDogrula,
  sezonDogrula,
  grupSezonUyeligiEkle,
  haftayiProgramdanDoldur,
  deleteAgeGroup,
};
