// ── age groups, haftalık program ──
const { db } = require("./baglanti.cjs");
const { createTraining } = require("./antrenman.cjs");

const listAgeGroups = () => db.prepare("SELECT * FROM age_groups ORDER BY sira, ad").all();
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
  return { id: Number(r.lastInsertRowid), ad, sezon, sira, aktif: 1 };
}
const updateAgeGroup = (id, { ad, sezon, sira, aktif, program }) =>
  db
    .prepare(
      "UPDATE age_groups SET ad=COALESCE(?,ad), sezon=COALESCE(?,sezon), sira=COALESCE(?,sira), aktif=COALESCE(?,aktif), program=COALESCE(?,program) WHERE id=?",
    )
    .run(ad, sezonDogrula(sezon), sira, aktif, program === undefined ? null : JSON.stringify(programDogrula(program)), id);
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
    .map((x) => ({ gun: Number(x.gun), saat: String(x.saat), saha: String(x.saha || "").trim() }));
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
        createTraining({ age_group_id: g.id, tarih, saat: p.saat, saha: p.saha });
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

module.exports = { listAgeGroups, createAgeGroup, updateAgeGroup, programDogrula, sezonDogrula, haftayiProgramdanDoldur, deleteAgeGroup };
