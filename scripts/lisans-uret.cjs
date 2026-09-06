// Lisans anahtarı üretimi (ÜRETİCİ makinesinde çalışır — müşteriye dağıtılmaz).
// Özel anahtar: scripts/keys/lisans-private.pem (repoya girmez; güvenli yerde yedekleyin,
// kaybolursa yeni anahtar çifti = tüm eski lisanslar geçersiz demektir).
//
// Kullanım:
//   node scripts/lisans-uret.cjs --firma "Örnek Gıda A.Ş." --bitis 2027-01-01 --kullanici 5
//   node scripts/lisans-uret.cjs --firma "X" --suresiz                 (bitiş yok)
//   node scripts/lisans-uret.cjs --firma "X" --bitis 2027-01-01        (kullanıcı sınırsız)
//   ... --private /baska/yol/private.pem                                (özel anahtar yolu)
const fs = require("fs");
const path = require("path");
const { imzala, dogrula } = require("../electron/lisans.cjs");

const arg = (ad) => { const i = process.argv.indexOf("--" + ad); return i > -1 ? process.argv[i + 1] : null; };
const bayrak = (ad) => process.argv.includes("--" + ad);

const firma = arg("firma");
const bitis = bayrak("suresiz") ? null : arg("bitis");
const kullanici = arg("kullanici");
const makine = arg("makine"); // opsiyonel: anahtarı bu makine kimliğine kilitle (offline anti-paylaşım)
const privateYol = arg("private") || path.join(__dirname, "keys", "lisans-private.pem");

if (!firma || (bitis === null && !bayrak("suresiz")) === true) {
  console.error('Kullanım: node scripts/lisans-uret.cjs --firma "Ad" (--bitis YYYY-AA-GG | --suresiz) [--kullanici N] [--private yol]');
  process.exit(1);
}
if (bitis && !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) { console.error("Bitiş tarihi YYYY-AA-GG biçiminde olmalı"); process.exit(1); }
if (!fs.existsSync(privateYol)) { console.error(`Özel anahtar bulunamadı: ${privateYol}\nİlk kez üretmek için: node scripts/lisans-anahtar-cifti.cjs`); process.exit(1); }

const payload = {
  firma,
  bitis: bitis || null,
  maksKullanici: kullanici ? Number(kullanici) : null,
  uretimTarihi: new Date().toISOString().slice(0, 10),
  ...(makine ? { makineId: makine } : {}), // varsa: yalnız bu makinede geçerli
  ...(bayrak("aktivasyon") ? { aktivasyonGerekli: true } : {}), // varsa: online/lease aktivasyonu şart
};
const anahtar = imzala(payload, fs.readFileSync(privateYol, "utf8"));

// Kendi kendini doğrula (gömülü açık anahtarla) — yanlış çiftle üretimi anında yakalar
const kontrol = dogrula(anahtar);
if (!kontrol.gecerli) { console.error("HATA: üretilen anahtar gömülü açık anahtarla doğrulanamadı (özel anahtar uygulamadakiyle eşleşmiyor)."); process.exit(1); }

console.log("Lisans payload'ı:", JSON.stringify(payload));
console.log("\nMüşteriye verilecek anahtar:\n");
console.log(anahtar);
