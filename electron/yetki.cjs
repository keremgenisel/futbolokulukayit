// db:call ve /api/db için ORTAK beyaz liste ve yetki kararı (saf, test edilebilir).
const { ayarYazmaIzni } = require("./ayarDogrula.cjs");
// Okuma her oturuma açık; yazma lisans salt-okunurken reddedilir; admin işlemleri yalnız yönetici.
const OKUMA = new Set([
  "listAgeGroups",
  "getPlayer",
  "listPlayers",
  "listPlayersWithDue",
  "playersPage",
  "listGuardians",
  "listEmergency",
  "listDocuments",
  "saglikRaporuDurumu",
  "saglikRaporuListesi",
  "listFeeItems",
  "getDue",
  "listDues",
  "listUnpaid",
  "listUnpaidSezon",
  "listUnpaidAralik",
  "sezonAidatOzeti",
  "aidatOzeti",
  "getReceipt",
  "listReceipts",
  "listReceiptsByDate",
  "listCancelledReceipts",
  "makbuzListesi",
  "listTrainings",
  "trainingCalendar",
  "listAttendance",
  "playerAttendance",
  "playerAttendanceSon",
  "getSetting",
  "aidatAyarlari",
  "panoOzet",
  "attendanceSummary",
  "attendanceReport",
  "isEncrypted",
  "sezonAdayListesi",
  "sezonDurumu",
  "sezonListesi",
  "sezonTarihleri",
  "sezonListesiTarihli",
  "listFeeTypes",
  "sonMesajlar",
  "antrenmanVelileri",
  "kartBasimListesi", // giriş kartı basım penceresi (plan §40.7)
  "kartBasimlari",
]);
const YAZMA = new Set([
  "createAgeGroup",
  "updateAgeGroup",
  "deleteAgeGroup",
  "createPlayer",
  "updatePlayer",
  "deletePlayer",
  "addGuardian",
  "updateGuardian",
  "deleteGuardian",
  "addEmergency",
  "deleteEmergency",
  "deleteDocument",
  "updateDocument",
  "mesajKaydet",
  "mesajSil",
  "updateTraining",
  "bildirimGerekliAyarla",
  "grupBildirimKaydet",
  "grupBildirimSil",
  "ensureMonthlyDues",
  "ensureMonthlyDuesAraligi",
  "createReceipt",
  "cancelReceipt",
  "createTraining",
  "cancelTraining",
  "setAttendance",
  "haftayiProgramdanDoldur",
  "kartBasimKaydet", // kullanıcı oturumdan enjekte (ipc/data.cjs, server.cjs)
  "aidatMuafYap", // plan §42; kullanıcı oturumdan enjekte
  "aidatMuafKaldir",
]);
// Ayarlar ekranı yalnız yönetici (07.09.2026): ayar yazma, aidat kalemleri/ücret tipleri, kullanıcılar, sezon geçişi.
const ADMIN = new Set([
  "setUserActive",
  "resetUserPassword",
  "createUser",
  "deleteUser",
  "listUsers",
  "yeniSezonaGec",
  "sezonTarihKaydet",
  "setSetting",
  "aidatAyarlariKaydet",
  "updateFeeItem",
  "kartBasimSil", // "Basılmadı say" (plan §40.7)
]);

// Dönüş: { ok: true } | { ok: false, kod: 401|403, mesaj }. `args`: setSetting anahtar izni için (güvenlik 2. inceleme #1).
function cagriYetkisi(fn, session, saltOkunur, args = []) {
  if (!session) return { ok: false, kod: 401, mesaj: "Oturum gerekli" };
  // İnceleme #13: zorunlu parola değişimi ana süreçte de uygulanır (arayüz atlanamaz)
  if (session.must_change_password) return { ok: false, kod: 403, mesaj: "Önce parolanızı değiştirin" };
  if (OKUMA.has(fn)) return { ok: true };
  if (YAZMA.has(fn)) {
    if (saltOkunur)
      return { ok: false, kod: 403, mesaj: "Lisans salt okunur modda: değişiklik yapılamaz. Ayarlar > Lisans'tan anahtar girin." };
    return { ok: true };
  }
  if (ADMIN.has(fn)) {
    if (session.role !== "admin") return { ok: false, kod: 403, mesaj: "Bu işlem için yönetici yetkisi gerekli" };
    if (saltOkunur) return { ok: false, kod: 403, mesaj: "Lisans salt okunur modda" };
    if (fn === "setSetting") {
      const i = ayarYazmaIzni(Array.isArray(args) ? args[0] : undefined);
      if (!i.ok) return { ok: false, kod: 403, mesaj: i.neden };
    }
    return { ok: true };
  }
  return { ok: false, kod: 403, mesaj: `İzin verilmeyen çağrı: ${fn}` };
}

module.exports = { OKUMA, YAZMA, ADMIN, cagriYetkisi };
