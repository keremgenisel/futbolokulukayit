# Eyüpspor Futbol Okulu Aktivasyon Sunucusu (B2)

Uygulamanın kısa ömürlü, imzalı **lease** aldığı online aktivasyon servisi. Cloudflare Workers + D1.
Kazanç: **kurulum sayımı** (tek anahtarın filoya dağıtılmasını durdurur), **uzaktan iptal**, tam
**deneme-sıfırlama koruması** (makineId hatırlanır). Uygulama lease'i **offline** doğrular; sunucuya
yalnız aktivasyon + periyodik yenilemede dokunur (bkz. ana repo `HANDOFF`/lisans planı).

## İki-anahtar güvenlik modeli
- **pub1 (LISANS_PUBLIC_PEM):** kalıcı lisans AÇIK anahtarı — sunucu yalnız anahtarları *doğrular*.
- **priv2 (LEASE_PRIVATE_PEM):** lease ÖZEL anahtarı — sunucu lease *imzalar*.
- Kalıcı lisans ÖZEL anahtarı (priv1) burada **YOK** (çevrimdışı, üretici makinesinde). Sunucu sızsa
  bile yalnız kısa ömürlü, iptal edilebilir lease basılır; kalıcı lisans üretilemez.

## Kurulum (bir kez)
```bash
cd aktivasyon-sunucu
npm install

# 1) İki anahtar çiftini ana repoda üret (özel anahtarlar repoya girmez):
#    ../scripts/lisans-anahtar-cifti.cjs → lisans-private.pem + lisans-lease-private.pem üretir,
#    ve gömülecek iki AÇIK anahtarı yazdırır. AÇIK lease anahtarını ana uygulamaya (VARSAYILAN_LEASE_PUBLIC_PEM) göm.

# 2) D1 oluştur ve şemayı yükle:
wrangler d1 create eyupspor-lisans          # çıkan database_id'yi wrangler.toml'a yapıştır
npm run db:init

# 3) Secrets:
wrangler secret put LISANS_PUBLIC_PEM     # pub1 (lisans-private.pem'in AÇIK eşi, spki PEM)
wrangler secret put LEASE_PRIVATE_PEM     # priv2 (lisans-lease-private.pem içeriği, pkcs8 PEM)
wrangler secret put ADMIN_TOKEN           # /admin/* için rastgele uzun gizli

# 4) Deploy:
npm run deploy                            # https://eyupspor-aktivasyon.<hesap>.workers.dev
```

## Bir lisansı satışa hazırlama
```bash
# a) Anahtar üret (aktivasyon zorunlu + kurulum limiti ayrı):
node ../scripts/lisans-uret.cjs --firma "Örnek A.Ş." --bitis 2027-01-01 --kullanici 5 --aktivasyon
# b) Bu anahtarı sunucuya kaydet (maksKurulum = kaç makine):
curl -X POST https://.../admin/lisans -H "x-admin-token: $ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"anahtar":"FOKLISANS....","maksKurulum":3}'
# c) Anahtarı müşteriye ver. Uygulama Ayarlar > Lisans'tan Aktive Et → lease alır.
```

## Uçlar
| Uç | Yöntem | Gövde | Dönüş |
|---|---|---|---|
| `/saglik` | GET | — | `{ok:true}` |
| `/aktivasyon` | POST | `{anahtar, makineId, surum}` | `{ok:true, lease}` \| 403 `{error}` |
| `/yenile` | POST | `{anahtar, makineId}` | `{ok:true, lease}` \| 403 `{error}` |
| `/admin/lisans` | POST | `{anahtar, maksKurulum?, iptal?}` + `x-admin-token` | `{ok:true}` |
| `/admin/liste` | GET | `?anahtar=...` + `x-admin-token` | `{lisans, kurulumlar[]}` |

- **Uzaktan iptal:** `/admin/lisans` gövdesinde `"iptal":true` → yenileme kesilir; mevcut lease
  penceresi (`LEASE_GUN`) dolunca uygulama salt-okunura düşer.
- **Kurulum limiti:** yeni bir makineId, aktif kurulum sayısı `maksKurulum`'a ulaşmışsa 403.

## Kripto uyumu
Sunucu Web Crypto Ed25519, uygulama Node crypto Ed25519 kullanır; ikisi standart Ed25519 → birebir
uyumlu. Sözleşme ana repoda `tests/aktivasyon-kripto.test.js` ile kilitlidir (Node imzası sunucuda
doğrulanır; sunucu lease'i uygulamada doğrulanır).

## Yerel test
`wrangler dev` + `npm run db:init:local`; `.dev.vars` içine `LISANS_PUBLIC_PEM`/`LEASE_PRIVATE_PEM`/
`ADMIN_TOKEN` koy. Curl ile `/aktivasyon` dene.
