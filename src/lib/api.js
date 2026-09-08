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
export function hataMetni(e) {
  const m = String(/** @type {any} */ (e)?.message || e || "Beklenmeyen hata");
  return m.replace(/^Error invoking remote method '[^']+': /, "").replace(/^Error: /, "");
}
