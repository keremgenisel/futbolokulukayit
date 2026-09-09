// SAF: makbuz numarası ve makbuz sezonu (plan §17.2). Numara "<önek>-NNNN": önek sezonun BAŞLANGIÇ yılıdır (2027-2028 → 2027),
// sezon bilinmiyorsa makbuz tarihinin yılı. Sayaç önek içinde artar; Ocak'ta yıl değişse de sezon numarası devam eder.
const SEZON_RE = /^(\d{4})-(\d{4})$/;
const sezonGecerliMi = (s) => {
  const m = SEZON_RE.exec(String(s || ""));
  return !!m && Number(m[2]) === Number(m[1]) + 1;
};
/** Tarihin içinde bulunduğu sezon ("2026-09-09", 9 → "2026-2027"). */
function tarihinSezonu(iso, baslangicAyi = 9) {
  const yil = Number(String(iso).slice(0, 4)),
    ay = Number(String(iso).slice(5, 7));
  if (!yil || !ay) return "";
  const bas = ay >= baslangicAyi ? yil : yil - 1;
  return `${bas}-${bas + 1}`;
}
/** Makbuzun sezonu: aktif sezon geçerliyse o, değilse tarihten. */
const makbuzSezonu = (aktifSezon, tarih, baslangicAyi = 9) =>
  sezonGecerliMi(aktifSezon) ? aktifSezon : tarihinSezonu(tarih, baslangicAyi);
/** Numara öneki: sezonun ilk yılı; sezon yoksa tarihin yılı. */
const makbuzOneki = (sezon, tarih) => (sezonGecerliMi(sezon) ? sezon.slice(0, 4) : String(tarih).slice(0, 4));
/** Sonraki numara: önek içindeki en büyük numara + 1 (son numara "2027-0012" → "2027-0013"; yoksa 0001). */
function sonrakiMakbuzNo(onek, sonNo) {
  const n = sonNo ? Number(String(sonNo).split("-").pop()) + 1 : 1;
  return `${onek}-${String(n).padStart(4, "0")}`;
}
module.exports = { sezonGecerliMi, tarihinSezonu, makbuzSezonu, makbuzOneki, sonrakiMakbuzNo };
