#!/bin/sh
# Futbol Okulu Kayıt Programı aktivasyon sunucusunu Cloudflare'a ilk kez kurar. Bir kez `npx wrangler login` gerekir.
# Adımlar: D1 oluştur → database_id'yi wrangler.toml'a yaz → şema → secrets → deploy → AKTIVASYON_URL'i uygulamaya göm.
set -e
cd "$(dirname "$0")"
if ! npx wrangler whoami >/dev/null 2>&1; then echo "Önce: npx wrangler login"; exit 1; fi

if grep -q "DEPLOY-SONRASI-DOLDUR" wrangler.toml; then
  echo "D1 veritabanı oluşturuluyor..."
  ID=$(npx wrangler d1 create futbol-okulu-lisans 2>&1 | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
  [ -n "$ID" ] || { echo "database_id alınamadı"; exit 1; }
  sed -i '' "s/DEPLOY-SONRASI-DOLDUR/$ID/" wrangler.toml
  echo "database_id yazıldı: $ID"
fi

npm run db:init

echo "Secrets: lisans AÇIK anahtarı, lease ÖZEL anahtarı, admin token"
node -e "const c=require('crypto');const pem=require('fs').readFileSync('../scripts/keys/lisans-private.pem','utf8');console.log(c.createPublicKey(pem).export({type:'spki',format:'pem'}))" | npx wrangler secret put LISANS_PUBLIC_PEM
cat ../scripts/keys/lisans-lease-private.pem | npx wrangler secret put LEASE_PRIVATE_PEM
[ -f ../scripts/keys/admin-token.txt ] || node -e "console.log(require('crypto').randomBytes(24).toString('hex'))" > ../scripts/keys/admin-token.txt
cat ../scripts/keys/admin-token.txt | npx wrangler secret put ADMIN_TOKEN

npx wrangler deploy
echo
echo "Deploy tamam. Çıktıdaki https://futbol-okulu-aktivasyon.<hesap>.workers.dev adresini"
echo "electron/aktivasyonIstemci.cjs içindeki AKTIVASYON_URL'e yazıp uygulamayı yeniden derleyin."
