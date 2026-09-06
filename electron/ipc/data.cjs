// Renderer'dan gelen "db:call" isteklerini beyaz listedeki db.cjs fonksiyonlarına yönlendirir.
// Oturum açılmadan hiçbir veri çağrısı yapılamaz. Lisans salt-okunur modundayken YAZMA
// fonksiyonları reddedilir (okuma, arama ve dışa aktarma hep açık).
const { ipcMain, app } = require("electron");
const db = require("../db.cjs");

const OKUMA = new Set([
  "listAgeGroups", "getPlayer", "listPlayers", "listPlayersWithDue", "listGuardians", "listEmergency",
  "listDocuments", "listFeeItems", "getDue", "listDues", "listUnpaid", "getReceipt", "listReceipts",
  "listReceiptsByDate", "listTrainings", "listAttendance", "playerAttendance", "getSetting", "panoOzet",
  "attendanceSummary", "attendanceReport", "listUsers",
]);
const YAZMA = new Set([
  "createAgeGroup", "updateAgeGroup", "deleteAgeGroup",
  "createPlayer", "updatePlayer", "deletePlayer",
  "addGuardian", "deleteGuardian", "addEmergency", "deleteEmergency", "deleteDocument",
  "updateFeeItem", "ensureMonthlyDues", "createReceipt", "cancelReceipt",
  "createTraining", "cancelTraining", "setAttendance", "setSetting",
]);
const ADMIN = new Set(["setUserActive", "resetUserPassword", "createUser"]);

let session = null; // { username, ad_soyad, role, must_change_password }
const getSession = () => session;

function registerDataHandlers() {
  ipcMain.handle("auth:login", (_e, username, password) => {
    const u = db.verifyPassword(String(username || ""), String(password || ""));
    if (!u) return { ok: false, error: "Kullanıcı adı veya parola hatalı" };
    session = { username: u.username, ad_soyad: u.ad_soyad, role: u.role, must_change_password: !!u.must_change_password };
    return { ok: true, user: session };
  });
  ipcMain.handle("auth:logout", () => { session = null; return { ok: true }; });
  ipcMain.handle("auth:session", () => session);
  ipcMain.handle("auth:changePassword", (_e, username, newPassword) => {
    if (!session || session.username !== username) return { ok: false, error: "Oturum gerekli" };
    if (String(newPassword || "").length < 6) return { ok: false, error: "Parola en az 6 karakter olmalı" };
    db.changePassword(username, newPassword);
    session.must_change_password = false;
    return { ok: true };
  });

  ipcMain.handle("db:call", (_e, fn, args) => {
    if (!session) throw new Error("Oturum gerekli");
    const a = Array.isArray(args) ? args : [];
    if (OKUMA.has(fn)) return db[fn](...a);
    if (YAZMA.has(fn)) {
      if (db.lisansSaltOkunurMu()) throw new Error("Lisans salt okunur modda: değişiklik yapılamaz. Ayarlar > Lisans'tan anahtar girin.");
      return db[fn](...a);
    }
    if (ADMIN.has(fn)) {
      if (session.role !== "admin") throw new Error("Bu işlem için yönetici yetkisi gerekli");
      if (db.lisansSaltOkunurMu()) throw new Error("Lisans salt okunur modda");
      return db[fn](...a);
    }
    throw new Error(`İzin verilmeyen çağrı: ${fn}`);
  });

  // ── Lisans köprüsü ──
  ipcMain.handle("lisans:durum", () => ({ ok: true, durum: db.lisansDurumu() }));
  ipcMain.handle("lisans:kaydet", (_e, anahtar) => {
    if (!session || session.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    const r = db.lisansKaydet(anahtar);
    return r.error ? r : { ok: true, durum: r.durum };
  });
  ipcMain.handle("lisans:leaseYapistir", (_e, lease) => {
    if (!session || session.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    const r = db.leaseKaydet(lease);
    return r.error ? r : { ok: true, durum: r.durum };
  });
  ipcMain.handle("lisans:aktiflestir", async () => {
    if (!session || session.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    return db.lisansAktiflestir(app.getVersion());
  });
  ipcMain.handle("lisans:yenile", async () => db.lisansYenile());
}

module.exports = { registerDataHandlers, getSession, OKUMA, YAZMA };
