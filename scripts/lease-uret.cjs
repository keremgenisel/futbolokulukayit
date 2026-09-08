// Lease (kiralama) üretimi — ÜRETİCİ makinesinde çalışır (B2'de bunu aktivasyon sunucusu yapar).
// Air-gapped müşteri için manuel yol: uygulama makineId'yi gösterir, sen bu makineId'ye lease
// imzalarsın, çıkan dizeyi USB'yle taşıyıp Ayarlar > Lisans > "Lease yapıştır"a girer.
// Lease özel anahtarı: scripts/keys/lisans-lease-private.pem (repoya GİRMEZ; anahtar-cifti üretir).
//
// Kullanım:
//   node scripts/lease-uret.cjs --firma "X" --makine <makineId> --gun 14
//   node scripts/lease-uret.cjs --firma "X" --makine <makineId> --bitis 2027-01-01
const fs = require("fs");
const path = require("path");
const { leaseImzala, leaseDogrula } = require("../electron/lisans.cjs");

const arg = (ad) => {
  const i = process.argv.indexOf("--" + ad);
  return i > -1 ? process.argv[i + 1] : null;
};

const firma = arg("firma");
const makine = arg("makine");
const gun = arg("gun");
const bitisArg = arg("bitis");
const privateYol = arg("private") || path.join(__dirname, "keys", "lisans-lease-private.pem");

if (!firma || !makine || (!gun && !bitisArg)) {
  console.error('Kullanım: node scripts/lease-uret.cjs --firma "Ad" --makine <makineId> (--gun N | --bitis YYYY-AA-GG) [--private yol]');
  process.exit(1);
}
if (!fs.existsSync(privateYol)) {
  console.error(`Lease özel anahtarı bulunamadı: ${privateYol}\nÜretmek için: node scripts/lisans-anahtar-cifti.cjs`);
  process.exit(1);
}

const leaseBitis =
  bitisArg ||
  (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + Number(gun));
    return d.toISOString().slice(0, 10);
  })();
if (!/^\d{4}-\d{2}-\d{2}$/.test(leaseBitis)) {
  console.error("Bitiş tarihi YYYY-AA-GG biçiminde olmalı");
  process.exit(1);
}

const payload = { firma, makineId: makine, leaseBitis, iptal: false, uretimTarihi: new Date().toISOString().slice(0, 10) };
const lease = leaseImzala(payload, fs.readFileSync(privateYol, "utf8"));

// Kendi kendini doğrula (gömülü lease açık anahtarıyla) — yanlış çiftle üretimi anında yakalar
const kontrol = leaseDogrula(lease);
if (!kontrol.gecerli) {
  console.error("HATA: üretilen lease gömülü lease açık anahtarıyla doğrulanamadı (özel anahtar uygulamadakiyle eşleşmiyor).");
  process.exit(1);
}

console.log("Lease payload'ı:", JSON.stringify(payload));
console.log("\nMüşteriye verilecek lease:\n");
console.log(lease);
