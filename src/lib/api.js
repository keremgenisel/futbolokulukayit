// @ts-check
// Renderer → ana süreç köprüsü (window.okul) etrafında ince sarmalayıcı. Testlerde window.okul
// mock'lanır. Tüm veri çağrıları buradan geçer; hata mesajları Türkçe olarak fırlatılır.

/** @returns {typeof window.okul} */
const okul = () => {
  if (!window.okul) throw new Error("Uygulama köprüsü yok (tarayıcı önizlemesi)");
  return window.okul;
};

/** @param {string} fn @param {...unknown} args */
export const db = (fn, ...args) => okul().db(fn, ...args);

export const files = () => okul().files;
export const cikti = () => okul().cikti;
export const yedek = () => okul().yedek;
export const optimize = () => okul().optimize;
export const aktar = () => okul().aktar;
export const lisans = () => okul().lisans;
export const uygulama = () => okul().app;
/** Otomatik güncelleme köprüsü (yalnız paketli sürümde iş yapar; tarayıcı/test ortamında olmayabilir). */
export const guncelleme = () => okul().updater || null;

/** Bugünün yıl/ay/ISO tarihi. */
export function bugun() {
  const t = new Date();
  const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return { yil: t.getFullYear(), ay: t.getMonth() + 1, iso };
}

/** @param {number} yil @param {number} ay */
export const ayAraligi = (yil, ay) => {
  const son = new Date(yil, ay, 0).getDate();
  const m = String(ay).padStart(2, "0");
  return { from: `${yil}-${m}-01`, to: `${yil}-${m}-${String(son).padStart(2, "0")}` };
};

/**
 * IPC hata metnini temizler ("Error invoking remote method 'db:call': Error: X" → "X").
 * @param {unknown} e
 */
/**
 * Ham IPC hata metni ("Error invoking remote method 'db:call': Error: X" → "X"); UNIQUE gibi teknik eşleme için.
 * @param {unknown} e
 */
export function hataHam(e) {
  const m = String(/** @type {any} */ (e)?.message || e || "Beklenmeyen hata");
  return m.replace(/^Error invoking remote method '[^']+': /, "").replace(/^Error: /, "");
}
/** Kullanıcıya gösterilecek metin: ham SQLite/Chromium hataları Türkçe karşılığına çevrilir (inceleme #19); ham metin konsola. @param {unknown} e */
export function hataMetni(e) {
  const m = hataHam(e);
  /** @type {[RegExp, string][]} */
  const ESLEME = [
    [/UNIQUE constraint failed/i, "Bu kayıt zaten var (aynı değer kullanılıyor)"],
    [/FOREIGN KEY constraint failed/i, "Bağlı kayıtlar olduğu için bu işlem yapılamadı"],
    [/NOT NULL constraint failed/i, "Zorunlu bir alan boş bırakıldı"],
    [/CHECK constraint failed/i, "Girilen değer izin verilen aralıkta değil"],
    [/SQLITE_BUSY|database is locked/i, "Veritabanı meşgul, birkaç saniye sonra tekrar deneyin"],
    [/SQLITE_(FULL|IOERR)/i, "Diske yazılamadı (disk dolu ya da erişilemiyor)"],
    [/no such table|no such column|SQLITE_ERROR/i, "Veritabanı hatası; programı yeniden başlatın"],
  ];
  for (const [re, tr] of ESLEME) if (re.test(m)) { try { console.error("[hata]", m); } catch { /* yoksay */ } return tr; }
  return m;
}
