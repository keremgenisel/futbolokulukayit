// SAF (CJS ikiz): antrenman saat aralığı doğrulaması (plan §37) — `src/lib/program.js saatAraligiDogrula` ile aynı kurallar.
function saatDk(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const h = Number(m[1]),
    d = Number(m[2]);
  return h > 23 || d > 59 ? null : h * 60 + d;
}
function saatAraligiDogrula(bas, bit) {
  if (!bit) return { gecerli: true };
  if (saatDk(bit) === null) return { gecerli: false, neden: "Bitiş saati SS:DD biçiminde olmalı" };
  if (saatDk(bas) === null) return { gecerli: false, neden: "Önce başlangıç saatini girin" };
  if (saatDk(bit) <= saatDk(bas)) return { gecerli: false, neden: "Bitiş başlangıçtan sonra olmalı" };
  return { gecerli: true };
}
module.exports = { saatDk, saatAraligiDogrula };
