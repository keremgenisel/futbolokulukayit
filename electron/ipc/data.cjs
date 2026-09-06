// Renderer'dan gelen "db:call" isteklerini beyaz listedeki db.cjs fonksiyonlarına yönlendirir.
// Oturum açılmadan hiçbir veri çağrısı yapılamaz.
const { ipcMain } = require("electron");
const db = require("../db.cjs");

const ALLOWED = new Set([
  "listAgeGroups", "createAgeGroup", "updateAgeGroup",
  "createPlayer", "updatePlayer", "getPlayer", "listPlayers", "deletePlayer",
  "listGuardians", "addGuardian", "deleteGuardian", "listEmergency", "addEmergency", "deleteEmergency",
  "listDocuments", "addDocument", "deleteDocument",
  "listFeeItems", "updateFeeItem",
  "ensureMonthlyDues", "getDue", "listDues", "listUnpaid",
  "createReceipt", "getReceipt", "listReceipts", "listReceiptsByDate",
  "createTraining", "listTrainings", "cancelTraining", "setAttendance", "listAttendance", "playerAttendance",
  "getSetting", "setSetting",
]);

let session = null; // { username, ad_soyad, role, must_change_password }

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
    if (!ALLOWED.has(fn)) throw new Error(`İzin verilmeyen çağrı: ${fn}`);
    return db[fn](...(Array.isArray(args) ? args : []));
  });
}

module.exports = { registerDataHandlers };
