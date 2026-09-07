// Renderer'dan gelen istekleri moda göre yönlendirir: yerel/sunucu modunda doğrudan db.cjs,
// istemci modunda HTTPS ile sunucuya (electron/istemci.cjs). Yetki kararı electron/yetki.cjs'te,
// sunucu tarafıyla ortak. Oturum açılmadan hiçbir veri çağrısı yapılamaz.
const { ipcMain, app } = require("electron");
const db = require("../db.cjs");
const config = require("../config.cjs");
const istemci = require("../istemci.cjs");
const server = require("../server.cjs");
const { cagriYetkisi } = require("../yetki.cjs");
const { rateAllow, rateHit, rateReset } = require("../rateLimit.cjs");

// Kurtarma kodu denemeleri: kullanıcı adı başına 5 / 15 dk (kod 32^8 uzayında; brute-force'u yavaşlatır).
const kurtarmaDenemeleri = new Map();
const KURTARMA_MAX = 5, KURTARMA_PENCERE = 15 * 60 * 1000;

let session = null; // { username, ad_soyad, role, must_change_password }
const getSession = () => session;

function registerDataHandlers() {
  ipcMain.handle("auth:login", async (_e, username, password) => {
    if (config.istemciMi()) {
      try { session = await istemci.login(String(username || ""), String(password || "")); return { ok: true, user: session }; }
      catch (e) { return { ok: false, error: e.message }; }
    }
    const u = db.verifyPassword(String(username || ""), String(password || ""));
    if (!u) return { ok: false, error: "Kullanıcı adı veya parola hatalı" };
    session = { username: u.username, ad_soyad: u.ad_soyad, role: u.role, must_change_password: !!u.must_change_password };
    return { ok: true, user: session };
  });
  ipcMain.handle("auth:logout", () => { session = null; if (config.istemciMi()) config.tokenYaz(null); return { ok: true }; });
  ipcMain.handle("auth:session", async () => {
    if (config.istemciMi() && !session) { try { session = await istemci.oturum(); } catch { session = null; } }
    return session;
  });
  ipcMain.handle("auth:changePassword", async (_e, username, newPassword) => {
    if (!session || session.username !== username) return { ok: false, error: "Oturum gerekli" };
    if (String(newPassword || "").length < 6) return { ok: false, error: "Parola en az 6 karakter olmalı" };
    if (config.istemciMi()) { try { await istemci.parolaDegistir(newPassword); } catch (e) { return { ok: false, error: e.message }; } }
    else db.changePassword(username, newPassword);
    session.must_change_password = false;
    return { ok: true };
  });

  // Kurtarma kodları: yönetici herkes için, kullanıcı yalnız kendisi için üretir.
  ipcMain.handle("auth:kurtarmaUret", async (_e, userId) => {
    if (!session) return { ok: false, error: "Oturum gerekli" };
    if (config.istemciMi()) { try { return await istemci.kurtarmaUret(userId); } catch (e) { return { ok: false, error: e.message }; } }
    if (db.lisansSaltOkunurMu()) return { ok: false, error: "Lisans salt okunur modda" };
    const hedef = db.listUsers().find((u) => u.id === Number(userId));
    if (!hedef) return { ok: false, error: "Kullanıcı bulunamadı" };
    if (session.role !== "admin" && hedef.username !== session.username) return { ok: false, error: "Yalnız kendi hesabınız için kod üretebilirsiniz" };
    const r = db.kurtarmaKodlariUret(hedef.id);
    return r.error ? { ok: false, error: r.error } : { ok: true, kodlar: r.kodlar };
  });
  // Parola unutuldu: oturumsuz; kullanıcı adı + tek kullanımlık kod + yeni parola.
  ipcMain.handle("auth:kurtarmaSifirla", async (_e, username, kod, yeniParola) => {
    const ad = String(username || "").trim();
    if (String(yeniParola || "").length < 6) return { ok: false, error: "Parola en az 6 karakter olmalı" };
    if (config.istemciMi()) { try { return await istemci.kurtarmaSifirla(ad, String(kod || ""), String(yeniParola)); } catch (e) { return { ok: false, error: e.message }; } }
    const now = Date.now();
    if (!rateAllow(kurtarmaDenemeleri, ad, now, KURTARMA_MAX, KURTARMA_PENCERE)) return { ok: false, error: "Çok fazla deneme, 15 dakika sonra tekrar deneyin" };
    const r = db.kurtarmaIleSifirla(ad, String(kod || ""), String(yeniParola));
    if (r.error) { rateHit(kurtarmaDenemeleri, ad, now, KURTARMA_PENCERE); return { ok: false, error: r.error }; }
    rateReset(kurtarmaDenemeleri, ad);
    return { ok: true, kalan: r.kalan };
  });

  ipcMain.handle("db:call", async (_e, fn, args) => {
    const a = Array.isArray(args) ? args : [];
    if (config.istemciMi()) { if (!session) throw new Error("Oturum gerekli"); return istemci.dbCall(fn, a); }
    const y = cagriYetkisi(fn, session, db.lisansSaltOkunurMu());
    if (!y.ok) throw new Error(y.mesaj);
    if (fn === "deleteUser" && db.listUsers().find((u) => u.id === Number(a[0]))?.username === session.username) throw new Error("Kendi hesabınızı silemezsiniz");
    if (fn === "cancelReceipt") return db.cancelReceipt(a[0], a[1], session.ad_soyad || session.username); // iptal eden = oturum
    return db[fn](...a);
  });

  // ── Lisans köprüsü (istemci modunda lisans sahibi sunucu PC'dir) ──
  const admin = () => session && session.role === "admin";
  ipcMain.handle("lisans:durum", async () => {
    if (config.istemciMi()) { try { return await istemci.istek("/api/lisans/durum"); } catch (e) { return { error: e.message }; } }
    return { ok: true, durum: db.lisansDurumu() };
  });
  ipcMain.handle("lisans:kaydet", async (_e, anahtar) => {
    if (!admin()) return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) { try { return await istemci.istek("/api/lisans/kaydet", { method: "POST", body: { anahtar } }); } catch (e) { return { error: e.message }; } }
    const r = db.lisansKaydet(anahtar); return r.error ? r : { ok: true, durum: r.durum };
  });
  ipcMain.handle("lisans:leaseYapistir", async (_e, lease) => {
    if (!admin()) return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) { try { return await istemci.istek("/api/lisans/lease", { method: "POST", body: { lease } }); } catch (e) { return { error: e.message }; } }
    const r = db.leaseKaydet(lease); return r.error ? r : { ok: true, durum: r.durum };
  });
  ipcMain.handle("lisans:aktiflestir", async () => {
    if (!admin()) return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) { try { return await istemci.istek("/api/lisans/aktiflestir", { method: "POST" }); } catch (e) { return { error: e.message }; } }
    return db.lisansAktiflestir(app.getVersion());
  });
  ipcMain.handle("lisans:yenile", async () => {
    if (config.istemciMi()) { try { return await istemci.istek("/api/lisans/yenile", { method: "POST" }); } catch (e) { return { error: e.message }; } }
    return db.lisansYenile();
  });

  // ── Çalışma modu: sunucu / istemci ──
  ipcMain.handle("mod:oku", () => { const c = config.oku(); return { mode: c.mode, port: c.port, serverUrl: c.serverUrl, serverCertFp: c.serverCertFp, sunucu: server.durum(), bagli: !!session }; });
  ipcMain.handle("sunucu:baslat", async (_e, port) => {
    if (!admin()) return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) return { error: "İstemci modundayken sunucu başlatılamaz" };
    try { const p = Number(port) || config.oku().port || 3535; config.yaz({ mode: "sunucu", port: p }); return { ok: true, ...(await server.baslat({ port: p, surum: app.getVersion() })) }; }
    catch (e) { return { error: e.code === "EADDRINUSE" ? `Port ${port} kullanımda, başka port seçin` : e.message }; }
  });
  ipcMain.handle("sunucu:durdur", async () => {
    if (!admin()) return { error: "Yönetici yetkisi gerekli" };
    await server.durdur(); config.yaz({ mode: "yerel" }); return { ok: true };
  });
  // İstemci bağlanma: adres → parmak izi onayı → kaydet. Oturum açmadan da yapılabilir (giriş ekranı).
  ipcMain.handle("istemci:baglan", async (_e, url, secenek) => {
    try {
      const r = await istemci.baglan(String(url || "").trim(), secenek || {});
      if (r.ok) { await server.durdur(); config.yaz({ mode: "istemci" }); session = null; }
      return r;
    } catch (e) { return { error: e.message }; }
  });
  ipcMain.handle("istemci:kopar", () => { istemci.kopar(); session = null; return { ok: true }; });
}

module.exports = { registerDataHandlers, getSession };
