// Vade (plan §38, 12.09.2026): ödeme döneminin son günü geçmeden aidat borç sayılmaz. Tek SQL parçası; tüm sorgular buradan alır.
// `vade_gecti`: 1 = vadesi geçti (borç), 0 = vadesi gelmedi ("bekliyor"). Geçmiş ay her zaman 1, ileri ay 0, bu ay bugünün günü >
// dönem son günü ise 1. Ayar `aidat_vade_bekle` = "0" ise eski davranış (her ödenmemiş ay borç): parça sabit 1.
// Parça `d` (monthly_dues) ve `p` (players) takma adlarını bekler; `args` parçadaki ? sırasıyla.
const { getSetting } = require("./meta.cjs");

/** Yerel bugün (ISO). Renderer `bugun().iso` ile aynı kural (UTC kayması yok). */
function bugunIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
const vadeBekleAcikMi = () => getSetting("aidat_vade_bekle") !== "0";

const VADE_SQL = `(CASE
  WHEN (d.yil*100 + d.ay) < ? THEN 1
  WHEN (d.yil*100 + d.ay) > ? THEN 0
  WHEN ? > (CASE p.odeme_donemi WHEN '1-10' THEN 10 WHEN '11-20' THEN 20
            ELSE CAST(strftime('%d', date(printf('%04d-%02d-01', d.yil, d.ay), '+1 month', '-1 day')) AS INTEGER) END) THEN 1
  ELSE 0 END)`;

/** @param {string} [bugun] ISO; verilmezse bugün. @returns {{ sql: string, args: any[] }} */
function vadeSecimi(bugun) {
  if (!vadeBekleAcikMi()) return { sql: "1", args: [] };
  const iso = String(bugun || bugunIso());
  const yilAy = Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
  return { sql: VADE_SQL, args: [yilAy, yilAy, Number(iso.slice(8, 10))] };
}

module.exports = { vadeSecimi, vadeBekleAcikMi, bugunIso };
