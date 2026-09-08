// ── meta / settings ──
const { db } = require("./baglanti.cjs");
const getMetaValue = (k) => db.prepare("SELECT value FROM meta WHERE key=?").get(k)?.value ?? null;
const setMetaValue = (k, v) =>
  db.prepare("INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);
const getSetting = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? null;
const setSetting = (k, v) =>
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);

module.exports = { getMetaValue, setMetaValue, getSetting, setSetting };
