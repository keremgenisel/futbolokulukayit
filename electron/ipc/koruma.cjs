// SAF: IPC handler ön koşulları tek yerde (refactor §3.3). Handler'lar iki üslup kullanır: hatayı `{ error }` olarak
// döndürmek (arayüz r.error'a bakar) ya da fırlatmak (arayüz hataMetni ile toast). Her iki üslup korunur; mesajlar tek yerde.
const MESAJ = {
  oturum: "Oturum gerekli",
  yonetici: "Yönetici yetkisi gerekli",
  saltOkunur: "Lisans salt okunur modda",
};

/**
 * Ön koşulları sırayla dener; ilk ihlalin mesajını, yoksa null döner.
 * @param {{ username?: string, role?: string } | null | undefined} oturum
 * @param {{ yonetici?: boolean, istemciMi?: () => boolean, istemciMesaji?: string, saltOkunurMu?: () => boolean }} [sec]
 */
function kosulHatasi(oturum, { yonetici = false, istemciMi = null, istemciMesaji = "", saltOkunurMu = null } = {}) {
  if (!oturum) return MESAJ.oturum;
  if (yonetici && oturum.role !== "admin") return MESAJ.yonetici;
  if (istemciMi && istemciMi()) return istemciMesaji || MESAJ.oturum;
  if (saltOkunurMu && saltOkunurMu()) return MESAJ.saltOkunur;
  return null;
}

/** `{ error }` döndüren üslup: hata varsa nesne, yoksa null. */
const donerek = (getSession, sec) => () => {
  const m = kosulHatasi(getSession(), sec);
  return m ? { error: m } : null;
};
/** Fırlatan üslup: hata varsa Error fırlatır. */
const firlatarak = (getSession, sec) => () => {
  const m = kosulHatasi(getSession(), sec);
  if (m) throw new Error(m);
};

module.exports = { kosulHatasi, donerek, firlatarak, MESAJ };
