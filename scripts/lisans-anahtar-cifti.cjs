// Lisans anahtar çifti üretimi — BİR KEZ çalıştırılır (üretici makinesinde).
// Özel anahtar scripts/keys/lisans-private.pem'e yazılır (repo dışı, .gitignore'da);
// yazdırılan AÇIK anahtar electron/lisans.cjs'teki VARSAYILAN_PUBLIC_PEM'e gömülür.
// DİKKAT: mevcut özel anahtarın üzerine yazmaz — yenilemek tüm dağıtılmış lisansları
// geçersiz kılar; bilinçli yenileme için önce eski dosyayı elle taşıyın.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dizin = path.join(__dirname, "keys");
fs.mkdirSync(dizin, { recursive: true });

// İki AYRI çift üret (Faz B1): kalıcı LİSANS anahtarı (özel eşi hep çevrimdışı, senin makinende)
// ve LEASE anahtarı (özel eşi B2'de aktivasyon sunucusunda). Ayrı olması, sunucu sızsa bile
// yalnız kısa ömürlü lease basılmasını sağlar; kalıcı lisans üretilemez.
function ciftUret(dosya, gomulecek) {
  const yol = path.join(dizin, dosya);
  if (fs.existsSync(yol)) { console.error(`Zaten var: ${yol} — üzerine yazılmadı (yenileme tüm eski anahtarları geçersiz kılar).`); return null; }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(yol, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  console.log(`\nÖzel anahtar yazıldı: ${yol} (güvenli bir yere YEDEKLEYİN)`);
  console.log(`Aşağıdaki açık anahtarı electron/lisans.cjs → ${gomulecek}'e gömün:\n`);
  console.log(publicKey.export({ type: "spki", format: "pem" }));
  return yol;
}

ciftUret("lisans-private.pem", "VARSAYILAN_PUBLIC_PEM");
ciftUret("lisans-lease-private.pem", "VARSAYILAN_LEASE_PUBLIC_PEM");
