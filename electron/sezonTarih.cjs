// SAF (CJS ikiz): sezon tarihleri (plan §37). `src/lib/sezon.js sezonTarihDogrula` ile aynı kurallar — tests/sezon.test.js eşitliği sınar.
const sezonGecerliMi = (sezon) => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(sezon || ""));
  return !!m && Number(m[2]) === Number(m[1]) + 1;
};
function sezonTarihDogrula(sezon, baslangic, bitis) {
  if (!sezonGecerliMi(sezon)) return { gecerli: false, neden: "Sezon 2026-2027 biçiminde olmalı" };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(String(baslangic || "")) || !iso.test(String(bitis || ""))) return { gecerli: false, neden: "Tarihler yyyy-aa-gg olmalı" };
  if (bitis <= baslangic) return { gecerli: false, neden: "Bitiş başlangıçtan sonra olmalı" };
  if (Number(baslangic.slice(0, 4)) !== Number(sezon.slice(0, 4)))
    return { gecerli: false, neden: `Başlangıç ${sezon.slice(0, 4)} yılında olmalı` };
  const ayFarki =
    (Number(bitis.slice(0, 4)) - Number(baslangic.slice(0, 4))) * 12 + (Number(bitis.slice(5, 7)) - Number(baslangic.slice(5, 7)));
  if (ayFarki > 14) return { gecerli: false, neden: "Sezon en çok 14 ay olabilir" };
  return { gecerli: true };
}
/** Etiketten varsayılan aralık: başlangıç ayının 1'i – 12 ay sonrasının son günü (eski davranış: 1 Eyl – 31 Ağu). */
function varsayilanSezonAraligi(sezon, baslangicAyi = 9) {
  if (!sezonGecerliMi(sezon)) return null;
  const y = Number(sezon.slice(0, 4));
  const ay = Number(baslangicAyi) || 9;
  const bas = `${y}-${String(ay).padStart(2, "0")}-01`;
  const bitisAy = ay === 1 ? 12 : ay - 1;
  const bitisYil = ay === 1 ? y : y + 1;
  const son = new Date(bitisYil, bitisAy, 0).getDate();
  return { baslangic: bas, bitis: `${bitisYil}-${String(bitisAy).padStart(2, "0")}-${String(son).padStart(2, "0")}` };
}
module.exports = { sezonGecerliMi, sezonTarihDogrula, varsayilanSezonAraligi };
