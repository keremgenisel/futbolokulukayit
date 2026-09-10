// Kulüp logosu (plan §32.3): Ayarlar > Kulüp'ten yüklenir, `uploads/kulup/logo.png|jpg` olarak saklanır (yedek ve taşıma
// paketi uploads'ı kapsadığı için otomatik yedeklenir), yolu `kulup_logo` ayarında. Yalnız PNG/JPEG (guvenliLogo başka mime
// kabul etmez; nativeImage de yalnız bunları çözer). En uzun kenar 512 px'e küçültülür, PNG şeffaflığı korunur.
// IPC (ipc/files.cjs) ve sunucu (server.cjs) aynı çekirdeği kullanır.
const fs = require("fs");
const path = require("path");
const { nativeImage } = require("electron");
const db = require("./db.cjs");
const { resimBoyutu, MAX_PIKSEL } = require("./imageOptimize.cjs");
const { KULUP_LOGO_KLASORU } = require("./marka.cjs");

const LOGO_MAX_PX = 512;
const LOGO_MAX_BAYT = 5 * 1024 * 1024;
const LOGO_UZANTI = new Set([".png", ".jpg", ".jpeg"]);

/** Ham dosya → { buffer, uzanti } (küçültülmüş, doğrulanmış). Hatalar Türkçe. */
function kulupLogoHazirla(buffer, uzanti) {
  const e = String(uzanti || "").toLowerCase();
  if (!LOGO_UZANTI.has(e)) throw new Error("Logo PNG ya da JPEG olmalı");
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Dosya boş");
  if (buffer.length > LOGO_MAX_BAYT) throw new Error("Logo 5 MB'tan büyük");
  const boyut = resimBoyutu(buffer);
  if (boyut && boyut.width * boyut.height > MAX_PIKSEL) throw new Error("Görsel çok büyük");
  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) throw new Error("Görsel okunamadı");
  const { width, height } = img.getSize();
  const uzun = Math.max(width, height, 1);
  const out =
    uzun > LOGO_MAX_PX
      ? img.resize({ width: Math.round((width * LOGO_MAX_PX) / uzun), height: Math.round((height * LOGO_MAX_PX) / uzun), quality: "best" })
      : img;
  const png = e === ".png";
  return { buffer: png ? out.toPNG() : out.toJPEG(90), uzanti: png ? ".png" : ".jpg" };
}

/** Logoyu uploads/kulup/ altına yazar, eski dosyayı siler, ayarı günceller. Dönüş: { ok, yol }. */
function kulupLogoKaydet(hamBuffer, uzanti) {
  const { buffer, uzanti: uz } = kulupLogoHazirla(hamBuffer, uzanti);
  const klasor = path.join(db.getUploadsDir(), KULUP_LOGO_KLASORU);
  fs.mkdirSync(klasor, { recursive: true });
  const yol = `${KULUP_LOGO_KLASORU}/logo${uz}`;
  for (const eski of ["logo.png", "logo.jpg"]) if (eski !== `logo${uz}`) fs.rmSync(path.join(klasor, eski), { force: true });
  fs.writeFileSync(path.join(klasor, `logo${uz}`), buffer);
  db.setSetting("kulup_logo", yol);
  return { ok: true, yol };
}

function kulupLogoKaldir() {
  const klasor = path.join(db.getUploadsDir(), KULUP_LOGO_KLASORU);
  for (const eski of ["logo.png", "logo.jpg"]) fs.rmSync(path.join(klasor, eski), { force: true });
  db.setSetting("kulup_logo", "");
  return { ok: true };
}

module.exports = { kulupLogoHazirla, kulupLogoKaydet, kulupLogoKaldir, LOGO_MAX_PX, LOGO_MAX_BAYT, LOGO_UZANTI };
