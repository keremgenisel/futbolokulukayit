// Çalışma modu yapılandırması: userData/config.json (gizli değil) + userData/istemci-token.enc
// (safeStorage ile şifreli oturum jetonu). Modlar: "yerel" (tek PC), "sunucu" (bu PC sunucu,
// diğerleri bağlanır), "istemci" (başka PC'deki sunucuya bağlan).
const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const VARSAYILAN = { mode: "yerel", port: 3535, serverUrl: "", serverCertFp: "", serverCertPem: "" };
const yol = () => path.join(app.getPath("userData"), "config.json");
const tokenYolu = () => path.join(app.getPath("userData"), "istemci-token.enc");
let cache = null;

function oku() {
  if (cache) return cache;
  try { cache = { ...VARSAYILAN, ...JSON.parse(fs.readFileSync(yol(), "utf8")) }; } catch { cache = { ...VARSAYILAN }; }
  return cache;
}
function yaz(parca) {
  cache = { ...oku(), ...parca };
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(yol(), JSON.stringify(cache, null, 2));
  return cache;
}
const ss = () => { try { return safeStorage?.isEncryptionAvailable?.() ? safeStorage : null; } catch { return null; } };
function tokenYaz(token) {
  if (!token) { try { fs.rmSync(tokenYolu(), { force: true }); } catch {} return; }
  const s = ss();
  fs.writeFileSync(tokenYolu(), s ? s.encryptString(token) : Buffer.from(token, "utf8"), { mode: 0o600 });
}
function tokenOku() {
  try {
    if (!fs.existsSync(tokenYolu())) return null;
    const buf = fs.readFileSync(tokenYolu());
    const s = ss();
    return s ? s.decryptString(buf) : buf.toString("utf8");
  } catch { return null; }
}
const istemciMi = () => { const c = oku(); return c.mode === "istemci" && !!c.serverUrl; };
const sunucuMu = () => oku().mode === "sunucu";

module.exports = { oku, yaz, tokenYaz, tokenOku, istemciMi, sunucuMu, VARSAYILAN };
