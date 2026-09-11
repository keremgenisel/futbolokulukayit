// Taşıma paketi (plan §14; refactor 2. tur §8.7 — ipc/yedek.cjs'ten ayrıldı): başka bilgisayarda açılabilen, PAROLA korumalı yedek.
// İçerik: data.db (ŞİFRESİZ kopya) + uploads/ + paket.json; tamamı tasimaKripto ile şifrelenir. Uzantı .fokpaket.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { zipSync, unzipSync } = require("fflate");
const tasima = require("../tasimaKripto.cjs");
const db = require("../db.cjs");
const { zipGirdileriTopla, zipAcBuffer, geriYukleCekirdek, YEDEK_MAX_BAYT } = require("./yedekCekirdek.cjs");

function tasimaPaketiOlustur(hedefYol, parola) {
  if (!tasima.parolaGecerliMi(parola)) return { error: `Parola en az ${tasima.PAROLA_MIN} karakter olmalı` };
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "futbolokulu-tasima-"));
  try {
    const duzDb = path.join(gecici, "data.db");
    db.duzKopyaOlustur(duzDb);
    const girdiler = {
      "data.db": [new Uint8Array(fs.readFileSync(duzDb)), { level: 0 }],
      "paket.json": [
        new TextEncoder().encode(
          JSON.stringify({ tur: "futbolokulu-tasima", surum: 1, olusturma: new Date().toISOString(), sifreliKaynak: db.isEncrypted() }),
        ),
        { level: 6 },
      ],
    };
    zipGirdileriTopla(db.getUploadsDir(), "uploads/", girdiler);
    const zip = Buffer.from(zipSync(girdiler));
    const paket = tasima.sifrele(zip, parola);
    fs.writeFileSync(hedefYol + ".tmp", paket);
    fs.renameSync(hedefYol + ".tmp", hedefYol);
    return { ok: true, yol: hedefYol, boyut: paket.length };
  } catch (e) {
    return { error: "Taşıma paketi oluşturulamadı: " + e.message };
  } finally {
    try {
      fs.rmSync(gecici, { recursive: true, force: true });
    } catch {}
  } // düz kopya diskte kalmaz
}
// Yalnız özet (inceleme #8): paket bellekte açılır, düz data.db DİSKE YAZILMAZ.
function tasimaPaketiOzet(paketYol, parola) {
  let zip;
  try {
    if (fs.statSync(paketYol).size > YEDEK_MAX_BAYT) throw new Error("Paket 2 GB'tan büyük");
    zip = tasima.coz(fs.readFileSync(paketYol), parola);
  } catch (e) {
    return { error: e.message };
  }
  let arsiv;
  try {
    arsiv = unzipSync(new Uint8Array(zip));
  } catch (e) {
    return { error: "Paket açılamadı: " + e.message };
  }
  if (!arsiv["data.db"]) return { error: "Paket içinde data.db yok" };
  return db.yedekBilgisiBuffer(arsiv["data.db"]);
}
// Paketi parolayla açar: geçici klasör (data.db düz, uploads/) + özet. Çağıran klasörü siler.
function tasimaPaketiAc(paketYol, parola) {
  let zip;
  try {
    if (fs.statSync(paketYol).size > YEDEK_MAX_BAYT) throw new Error("Paket 2 GB'tan büyük");
    zip = tasima.coz(fs.readFileSync(paketYol), parola);
  } catch (e) {
    return { error: e.message };
  }
  let klasor;
  try {
    klasor = zipAcBuffer(new Uint8Array(zip));
  } catch (e) {
    return { error: "Paket açılamadı: " + e.message };
  }
  const bilgi = db.yedekBilgisi(path.join(klasor, "data.db"), { duz: true });
  if (bilgi.error) {
    try {
      fs.rmSync(klasor, { recursive: true, force: true });
    } catch {}
    return bilgi;
  }
  return { ok: true, klasor, ...bilgi };
}
// Paketten geri yükle: aç → düz data.db'yi BU makinenin anahtarıyla şifrele → mevcut çekirdekle yerine koy.
function tasimaGeriYukleCekirdek(paketYol, parola) {
  const h = tasimaPaketiAc(paketYol, parola);
  if (h.error) return h;
  try {
    db.duzVeritabaniniSifrele(path.join(h.klasor, "data.db"));
  } catch (e) {
    try {
      fs.rmSync(h.klasor, { recursive: true, force: true });
    } catch {}
    return { error: "Veritabanı bu bilgisayar için şifrelenemedi: " + e.message };
  }
  const r = geriYukleCekirdek(h.klasor); // klasör biçimi; çekirdek geçici klasörü silmez (gecici bayrağı yok), burada silinir
  try {
    fs.rmSync(h.klasor, { recursive: true, force: true });
  } catch {}
  return r;
}

module.exports = { tasimaPaketiOlustur, tasimaPaketiOzet, tasimaPaketiAc, tasimaGeriYukleCekirdek };
