// db:call ve /api/db için ORTAK beyaz liste ve yetki kararı (saf, test edilebilir).
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
  "getReceipt",
  "listReceipts",
  "listReceiptsByDate",
  "listCancelledReceipts",
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
  "listFeeTypes",
  "sonMesajlar",
  "antrenmanVelileri",
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
  "createReceipt",
  "cancelReceipt",
  "createTraining",
  "cancelTraining",
  "setAttendance",
  "haftayiProgramdanDoldur",
]);
// Ayarlar ekranı yalnız yönetici (07.09.2026): ayar yazma, aidat kalemleri/ücret tipleri, kullanıcılar, sezon geçişi.
const ADMIN = new Set([
  "setUserActive",
  "resetUserPassword",
  "createUser",
  "deleteUser",
  "listUsers",
  "yeniSezonaGec",
  "setSetting",
  "aidatAyarlariKaydet",
  "updateFeeItem",
]);

// Dönüş: { ok: true } | { ok: false, kod: 401|403, mesaj }
function cagriYetkisi(fn, session, saltOkunur) {
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
    return { ok: true };
  }
  return { ok: false, kod: 403, mesaj: `İzin verilmeyen çağrı: ${fn}` };
}

module.exports = { OKUMA, YAZMA, ADMIN, cagriYetkisi };
