// İstemci modu: başka PC'deki sunucuya HTTPS + sertifika sabitleme ile bağlanır. İlk bağlantıda
// sunucu parmak izi kullanıcıya gösterilip onaylanır (TOFU), sonra yalnız o sertifika kabul edilir.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { app } = require("electron");
const { pinliDispatcher, sertifikaParmakIziAl, pinliFetch } = require("./pinnedFetch.cjs");
const knownServers = require("./knownServers.cjs");
const config = require("./config.cjs");

let dispatcherCache = { pem: null, d: null };
function dispatcher() {
  const c = config.oku();
  if (!c.serverCertPem) return null;
  if (dispatcherCache.pem !== c.serverCertPem) dispatcherCache = { pem: c.serverCertPem, d: pinliDispatcher(c.serverCertPem) };
  return dispatcherCache.d;
}

class IstemciHata extends Error { constructor(m, kod) { super(m); this.kod = kod; } }

async function istek(yol, { method = "GET", body, auth = true, timeoutMs = 20000, raw = false, urlOverride = null } = {}) {
  const c = config.oku();
  const base = urlOverride || c.serverUrl;
  if (!base) throw new IstemciHata("Sunucu adresi ayarlı değil", 0);
  const d = dispatcher();
  if (!d) throw new IstemciHata("Sunucu sertifikası sabitlenmemiş, Ayarlar > Sunucu'dan yeniden bağlanın", 0);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = { "content-type": "application/json" };
  if (auth) { const tok = config.tokenOku(); if (tok) headers.authorization = "Bearer " + tok; }
  let r;
  try {
    r = await pinliFetch(base + yol, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal, dispatcher: d });
  } catch (e) {
    const m = String(e?.cause?.code || e?.message || e);
    if (/CERT|certificate|self signed|altname/i.test(m)) throw new IstemciHata("Sunucu kimliği doğrulanamadı (sertifika değişmiş olabilir). Ayarlar > Sunucu'dan yeniden bağlanın.", 0);
    throw new IstemciHata("Sunucuya ulaşılamadı: " + m, 0);
  } finally { clearTimeout(t); }
  if (raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new IstemciHata(j.error || `Sunucu hatası (${r.status})`, r.status);
  return j;
}

// Bağlanma akışı. trust: kullanıcı parmak izini bu turda onayladı. Dönüş:
// { needTrust: true, fp } | { mismatch: true, fp, eskiFp } | { ok: true, fp, sunucu }
async function baglan(url, { trust = false, force = false } = {}) {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new IstemciHata("Adres https:// ile başlamalı", 0);
  const host = u.host;
  const { fp, pem } = await sertifikaParmakIziAl(u.origin);
  const karar = knownServers.guvenKarari({ certFp: fp, hostFp: knownServers.hostFp(app, host), configFp: config.oku().serverCertFp, fpKnown: knownServers.fpBilinir(app, fp), trust, force });
  if (karar === "mismatch") return { mismatch: true, fp, eskiFp: knownServers.hostFp(app, host) };
  if (karar === "needTrust") return { needTrust: true, fp };
  // Güvenildi: pini yaz, sağlık kontrolü yap
  config.yaz({ serverUrl: u.origin, serverCertFp: fp, serverCertPem: pem });
  knownServers.kaydet(app, host, fp);
  const s = await istek("/saglik", { auth: false });
  if (s?.ad !== "eyupspor-futbol-okulu") throw new IstemciHata("Adresteki sunucu Eyüpspor programı değil", 0);
  return { ok: true, fp, sunucu: s };
}

async function login(username, password) {
  const r = await istek("/api/auth/login", { method: "POST", body: { username, password }, auth: false });
  config.tokenYaz(r.token);
  return r.user;
}
async function oturum() {
  if (!config.tokenOku()) return null;
  try { return (await istek("/api/auth/me")).user; } catch (e) { if (e.kod === 401) config.tokenYaz(null); return null; }
}
async function parolaDegistir(newPassword, oldPassword) {
  const r = await istek("/api/auth/changePassword", { method: "POST", body: { newPassword, oldPassword } });
  if (r.token) config.tokenYaz(r.token);
  return r;
}
const kurtarmaUret = (userId) => istek("/api/auth/kurtarmaUret", { method: "POST", body: { userId } });
const kurtarmaSifirla = (username, kod, yeniParola) => istek("/api/auth/kurtarmaSifirla", { method: "POST", body: { username, kod, yeniParola }, auth: false });
const dbCall = async (fn, args) => (await istek("/api/db", { method: "POST", body: { fn, args } })).sonuc;

async function dosyaIndir(yol) {
  const r = await istek("/api/files/indir?yol=" + encodeURIComponent(yol), { raw: true, timeoutMs: 120000 });
  if (!r.ok) throw new IstemciHata("Dosya indirilemedi", r.status);
  const dir = path.join(os.tmpdir(), "eyupspor-belge"); fs.mkdirSync(dir, { recursive: true });
  const hedef = path.join(dir, path.basename(yol));
  fs.writeFileSync(hedef, Buffer.from(await r.arrayBuffer()));
  return hedef;
}

function kopar() { config.tokenYaz(null); config.yaz({ mode: "yerel", serverUrl: "", serverCertFp: "", serverCertPem: "" }); }

module.exports = { istek, baglan, login, oturum, parolaDegistir, kurtarmaUret, kurtarmaSifirla, dbCall, dosyaIndir, kopar, IstemciHata };
