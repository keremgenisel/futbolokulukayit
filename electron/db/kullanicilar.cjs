// ── users, parola, kurtarma kodları ──
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("./baglanti.cjs");

const getUserByUsername = (u) => db.prepare("SELECT * FROM users WHERE username=?").get(u) || null;
function createUser({ username, password, ad_soyad = "", role = "admin", must_change_password = 0 }) {
  const hash = bcrypt.hashSync(password, 10);
  const r = db
    .prepare("INSERT INTO users (username,password_hash,ad_soyad,role,must_change_password) VALUES (?,?,?,?,?)")
    .run(username, hash, ad_soyad, role, must_change_password);
  return { id: Number(r.lastInsertRowid), username, ad_soyad, role };
}
function verifyPassword(username, password) {
  const u = getUserByUsername(username);
  if (!u || !u.is_active) return null;
  if (!bcrypt.compareSync(password, u.password_hash)) return null;
  const { password_hash: _h, ...safe } = u;
  return safe;
}
function changePassword(username, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE username=?").run(
    hash,
    username,
  );
}

const listUsers = () =>
  db
    .prepare(
      `SELECT id, username, ad_soyad, role, is_active, must_change_password,
    (SELECT count(*) FROM recovery_codes r WHERE r.user_id=u.id AND r.used_at IS NULL) AS kurtarma_kodu
  FROM users u ORDER BY username`,
    )
    .all();
const setUserActive = (id, aktif) => db.prepare("UPDATE users SET is_active=? WHERE id=?").run(aktif ? 1 : 0, id);
// Parola sıfırlama: yeni parola verilmezse ana süreçte kriptografik rastgele üretilir (inceleme #18) ve döndürülür;
// kullanıcı ilk girişte değiştirir (must_change_password=1).
function resetUserPassword(id, yeni) {
  const parola = yeni
    ? String(yeni)
    : "ey-" +
      crypto
        .randomBytes(6)
        .toString("base64url")
        .replace(/[^A-Za-z0-9]/g, "x")
        .slice(0, 8);
  if (parola.length < 8) throw new Error("Parola en az 8 karakter olmalı");
  const r = db
    .prepare("UPDATE users SET password_hash=?, must_change_password=1, token_version=token_version+1 WHERE id=?")
    .run(bcrypt.hashSync(parola, 10), id);
  if (r.changes === 0) throw new Error("Kullanıcı bulunamadı");
  return { ok: true, parola };
}
// Kullanıcı silme: en az bir aktif yönetici kalmalı (ilk admin dahil herkes silinebilir).
function deleteUser(id) {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!u) return { error: "Kullanıcı bulunamadı" };
  if (u.role === "admin" && u.is_active) {
    const digerAdmin = db.prepare("SELECT count(*) AS n FROM users WHERE role='admin' AND is_active=1 AND id<>?").get(id).n;
    if (digerAdmin === 0) return { error: "Son aktif yönetici silinemez. Önce başka bir yönetici ekleyin." };
  }
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  return { ok: true };
}

// ── Parola kurtarma kodları ──
// 8 adet XXXX-XXXX kod (karışan harfler yok), yalnız üretim anında düz metin döner; DB'de bcrypt.
const KOD_ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KURTARMA_KOD_ADET = 8;
function kurtarmaKoduNormalize(kod) {
  return String(kod || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function kurtarmaKodlariUret(userId) {
  const u = db.prepare("SELECT id FROM users WHERE id=?").get(userId);
  if (!u) return { error: "Kullanıcı bulunamadı" };
  const kodlar = [];
  for (let i = 0; i < KURTARMA_KOD_ADET; i++) {
    const b = crypto.randomBytes(8);
    let k = "";
    for (let j = 0; j < 8; j++) k += KOD_ALFABE[b[j] % KOD_ALFABE.length];
    kodlar.push(k.slice(0, 4) + "-" + k.slice(4));
  }
  db.transaction(() => {
    db.prepare("DELETE FROM recovery_codes WHERE user_id=?").run(userId);
    const ins = db.prepare("INSERT INTO recovery_codes (user_id, code_hash) VALUES (?,?)");
    for (const k of kodlar) ins.run(userId, bcrypt.hashSync(kurtarmaKoduNormalize(k), 8));
  })();
  return { ok: true, kodlar };
}
const kurtarmaKoduSayisi = (userId) =>
  db.prepare("SELECT count(*) AS n FROM recovery_codes WHERE user_id=? AND used_at IS NULL").get(userId).n;
// Kod doğruysa parolayı değiştirir, kodu kullanılmış işaretler, eski oturum jetonlarını düşürür.
function kurtarmaIleSifirla(username, kod, yeniParola) {
  const u = getUserByUsername(String(username || ""));
  const n = kurtarmaKoduNormalize(kod);
  if (!u || !u.is_active || n.length !== 8) return { error: "Kullanıcı adı veya kurtarma kodu hatalı" };
  const adaylar = db.prepare("SELECT id, code_hash FROM recovery_codes WHERE user_id=? AND used_at IS NULL").all(u.id);
  const eslesen = adaylar.find((r) => bcrypt.compareSync(n, r.code_hash));
  if (!eslesen) return { error: "Kullanıcı adı veya kurtarma kodu hatalı" };
  db.transaction(() => {
    db.prepare("UPDATE recovery_codes SET used_at=datetime('now') WHERE id=?").run(eslesen.id);
    db.prepare("UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE id=?").run(
      bcrypt.hashSync(yeniParola, 10),
      u.id,
    );
  })();
  return { ok: true, kalan: kurtarmaKoduSayisi(u.id) };
}

module.exports = {
  getUserByUsername,
  createUser,
  verifyPassword,
  changePassword,
  listUsers,
  setUserActive,
  resetUserPassword,
  deleteUser,
  kurtarmaKodlariUret,
  kurtarmaKoduSayisi,
  kurtarmaIleSifirla,
  kurtarmaKoduNormalize,
};
