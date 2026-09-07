# Eyüpspor Futbol Okulu – Kayıt ve Takip Programı
## Gereksinim Özeti ve Planlama

Toplantı tarihi: 06.09.2026
Kaynak belgeler: `docs/formlar/` (kayıt formu, prensipler sayfası, tahsilat makbuzu)

---

## 1. Kesinleşen Gereksinimler

### 1.1 Çalışma ortamı
- Şimdilik **tek PC** üzerinde çalışacak.
- İleride **birden fazla PC** aynı veriye erişecek. Bağlantı yerel ağ veya **Tailscale** üzerinden olacak.
- Uygulama **şifreli** olacak (kullanıcı adı + parola ile giriş).

### 1.2 Yaş grupları
- Birden fazla yaş grubu olacak (U9, U10, U11 … gibi).
- Yaş grubu programdan **oluşturulabilecek** ve oyuncular gruplanabilecek.
- Oyuncunun yaş grubu **manuel** seçilecek, otomatik hesaplama yok.

### 1.3 Oyuncu kaydı (kayıt formundan alınan alanlar)

**Öğrenci**
| Alan | Not |
|------|-----|
| TC Kimlik No | Benzersiz; yabancı uyruklu oyuncuda TC yerine pasaport no (07.09.2026) |
| Adı Soyadı | Zorunlu |
| Doğum Tarihi | Zorunlu |
| Doğum Yeri | |
| Okulu | |
| GSM | Oyuncunun telefonu |
| Ev Adresi | |
| Kan Grubu | |
| Fotoğraf | Vesikalık, yükleme |
| Yaş Grubu | Manuel seçim |
| Durum | Aktif / Deneme / Pasif / Ayrıldı / Sakat / Dondurma |
| Kayıt Tarihi | |

**Aile bilgileri**
| Alan |
|------|
| Baba Adı Soyadı |
| Baba GSM |
| Anne Adı Soyadı |
| Anne GSM |
| Velisi (anne / baba / diğer) |
| Veli WhatsApp numarası (bildirimlerin gideceği numara) |

**Acil durumda ulaşılacak kişiler** (birden fazla olabilir)
| Alan |
|------|
| Adı Soyadı |
| Yakınlık Durumu |
| Telefon |

**Belgeler** (oyuncu sayfasından yüklenecek)
- Sağlık raporu
- Vesikalık fotoğraf
- Sporcu kimlik fotokopisi
- Veli kimlik fotokopisi
- İmzalı kayıt formu (muvafakat ve taahhütname)
- Tahsilat makbuzları

**Ödeme tercihi** (prensipler sayfasından)
- Ödeme dönemi: her ayın 1-10 / 11-20 / 21-31 arası. Hatırlatma bu döneme göre gidecek.

### 1.4 Ücret ve tahsilat
- Aidat **aylık** alınır.
- Aidat dışı kalemler (makbuzdan): Forma, Yağmurluk, Eşofman Takımı, Mont, Ayakkabı, Çanta, Top, Çorap, Eldiven & Bere. Kalem listesi programdan düzenlenebilecek.
- Ücret tipleri: **Normal, Burslu, İndirimli, Kardeş İndirimi, Ücretsiz.**
- Ödeme yöntemleri: **Nakit, Havale/EFT, Kredi Kartı, Online Ödeme.**
- Aidat ödenmeyen oyuncu **tesise giremez.** Program bu durumu anında göstermeli.
- Tahsilat makbuzu programdan **yazdırılacak** ve oyuncu sayfasına kaydedilecek. Makbuz düzeni mevcut formla aynı olacak: logo, tarih, ad soyad, doğum tarihi, kalem listesi, toplam, tahsil eden adı.

### 1.5 Yoklama
- Her antrenman için yoklama alınacak.
- Devamsızlık kaydı tutulacak, veliye bildirim sonraki aşamada.

### 1.6 WhatsApp bildirimleri – ŞİMDİLİK KAPSAM DIŞI
Karar (06.09.2026): WhatsApp bildirimleri ilk sürümde yapılmayacak. İleride eklenmek üzere not edildi:
ödeme hatırlatması, devamsızlık bildirimi, antrenman iptali, toplu mesaj.
Program veli WhatsApp numarasını şimdiden kaydeder ki ileride ek geliştirme kolay olsun.

### 1.7 Raporlar ve çıktılar
- Excel ve PDF çıktı: oyuncu listesi, borçlu listesi, yoklama özeti, tahsilat raporu.

### 1.8 Mutlaka olmalı (ilk sürüm önceliği)
1. Aidat ödendi mi, ödenmedi mi? Anında görülebilmeli.
2. Oyuncu antrenmana geldi mi, gelmedi mi?
3. Makbuz yazdırma.

---

## 2. Teknik Mimari Önerisi

### 2.1 Neden web tabanlı yerel uygulama
Tek PC ile başlayıp sonra birden fazla PC'ye açılma isteği, masaüstü uygulaması yerine **yerel sunucu + tarayıcı** modelini gerektiriyor:

- Kulüp PC'sinde küçük bir sunucu çalışır (Windows servisi olarak, açılışta otomatik başlar).
- Kullanıcı tarayıcıdan `http://localhost:PORT` adresine girer.
- İkinci PC eklendiğinde kurulum yok. Tailscale ile aynı adrese `http://100.x.x.x:PORT` şeklinde ulaşılır.
- Veri tek yerde durur, çakışma olmaz.

### 2.2 Önerilen teknoloji
| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Sunucu | Node.js + Express (veya Fastify) | Tek dosya dağıtım, Windows'ta kolay servis |
| Veritabanı | SQLite | Kurulum gerektirmez, tek dosya, yedeklemesi kopyala-yapıştır |
| Arayüz | React + Vite | Hızlı form ve tablo ekranları |
| PDF / Makbuz | Sunucu tarafında HTML → PDF (Puppeteer veya pdfkit) | Makbuz düzenini HTML ile birebir çizeriz |
| Excel | exceljs | |
| Dosya depolama | `data/uploads/` klasörü | Belgeler ve makbuz PDF'leri |
| Kimlik doğrulama | Oturum + bcrypt parola | Tek kullanıcı ile başlar, rol sistemi sonradan eklenebilir |
| Yedekleme | Günlük otomatik SQLite + uploads kopyası | Ayrı klasöre veya USB'ye |

### 2.3 WhatsApp
Karar: ilk sürümde yok. Mesaj kayıt tablosu ve veli WhatsApp numarası alanı veri modelinde hazır tutulur, gönderim özelliği sonraki aşamada eklenir. Eklenirken seçenekler: tek tıkla gönder (ücretsiz, risksiz), WhatsApp Web otomasyonu (ücretsiz, yasak riski), Meta Business API (resmi, ücretli).

### 2.4 Online ödeme
Karar: "Online ödeme" yalnızca **ödemenin nasıl yapıldığını** gösteren bir seçenektir (Nakit, Havale/EFT, Kredi Kartı, Online Ödeme). Sanal POS entegrasyonu yapılmayacak.

---

## 3. Veri Modeli (taslak)

```
users              kullanıcı adı, parola hash, ad
age_groups         ad (U11), sezon, sıra, aktif mi
players            tc_no, uyruk (tc|yabanci), pasaport_no, ad_soyad, dogum_tarihi, dogum_yeri, okul, gsm, adres,
                   kan_grubu, foto, yas_grubu_id, durum, kayit_tarihi,
                   ucret_tipi (fee_types.kod; tohum normal/burslu/indirimli/kardes/ucretsiz),
                   aylik_aidat_tutari, odeme_donemi (1-10 / 11-20 / 21-31)
guardians          player_id, tip (anne/baba/veli), ad_soyad, gsm, whatsapp_no, veli_mi
emergency_contacts player_id, ad_soyad, yakinlik, telefon
documents          player_id, tip (saglik/foto/sporcu_kimlik/veli_kimlik/kayit_formu/makbuz),
                   dosya_yolu, yuklenme_tarihi, gecerlilik_tarihi
fee_items          kod, ad (Aidat, Forma, …), varsayilan_fiyat, aktif — Ayarlar'dan eklenir/silinir (makbuzda geçen silinemez)
fee_types          kod, ad, indirim %, sira, aktif, sabit — ücret tipleri; Ayarlar'dan eklenir/silinir (oyuncusu olan silinemez)
monthly_dues       player_id, yil, ay, tutar, durum (odendi/odenmedi/muaf)
receipts           player_id, tarih, toplam, odeme_yontemi, tahsil_eden, pdf_yolu, makbuz_no
receipt_lines      receipt_id, fee_item_id, tutar, aciklama (aidat ise hangi ay)
trainings          age_group_id, tarih, saat, iptal_mi, iptal_nedeni
attendance         training_id, player_id, durum (geldi/gelmedi/izinli)
message_log        player_id, kanal, tip (hatirlatma/devamsizlik/iptal/toplu), metin, tarih, durum
settings           kulup adı, logo, makbuz alt yazısı, tahsil eden varsayılan adı, port
```

**Aylık aidat mantığı:** Her ay başında aktif ve deneme durumundaki oyuncular için o ayın aidat kaydı otomatik açılır. Makbuzda "Aidat" kalemi kesildiğinde ilgili ay "ödendi" olur. Ücretsiz ve burslu oyuncular "muaf" olarak açılır.

**Tesise giriş kontrolü:** Ana ekranda arama kutusu. Ad veya TC yazınca oyuncunun fotoğrafı, yaş grubu ve bu ayın aidat durumu yeşil/kırmızı görünür.

---

## 4. Ekranlar

1. **Giriş** – kullanıcı adı, parola.
2. **Ana ekran (Pano)** – bugünkü antrenmanlar, bu ay ödemeyen oyuncu sayısı, hızlı oyuncu arama ve aidat durumu.
3. **Oyuncular** – liste, filtre (yaş grubu, durum, ödeme durumu), Excel/PDF çıktı.
4. **Oyuncu kartı (modal / sayfa)** – sekmeler:
   - Bilgiler (form alanları)
   - Aile ve acil kişiler
   - Belgeler (yükle, görüntüle)
   - Ödemeler (aylık aidat tablosu, makbuz kes, makbuz yazdır, geçmiş makbuzlar)
   - Yoklama geçmişi
5. **Yaş grupları** – oluştur, düzenle, oyuncu ata.
6. **Tahsilat** – makbuz kesme ekranı: oyuncu seç, kalemler, tutarlar, ödeme yöntemi, tahsil eden. Kaydet + yazdır.
7. **Yoklama** – üstte 14 günlük takvim şeridi (§9), seçili günün antrenman kartları, oyuncu listesi, geldi/gelmedi işaretle. Antrenman iptal düğmesi.
8. **Raporlar** – borçlu listesi, tahsilat raporu, yoklama özeti. Excel/PDF.
9. **Ayarlar** – kulüp bilgileri, aidat kalemleri ve fiyatları, kullanıcılar, yedekleme.

---

## 5. Aşamalar

### Faz 1 – Çekirdek (mutlaka olmalı) — TAMAMLANDI 06.09.2026
- Giriş ve parola
- Yaş grupları
- Oyuncu kaydı, aile, acil kişiler, belgeler, durum
- Aylık aidat takibi, ücret tipleri
- Makbuz kesme, yazdırma, PDF olarak saklama
- Yoklama
- Ana ekranda "ödedi mi / geldi mi" görünümü
- Excel ve PDF çıktılar
- Günlük yedekleme
- **Lisans çekirdeği (offline):** anahtar üretimi ve doğrulama, 30 gün deneme, salt okunur mod,
  Ayarlar > Lisans ekranı, kalıcı meta ve saat sertleştirmesi (bkz. §7.1–7.3, 7.5–7.6)

### Faz 2 – Çoklu PC, roller ve online aktivasyon — UYGULAMA TARAFI TAMAM 06.09.2026 (aktivasyon sunucusu deploy bekliyor)
- Tailscale ile ikinci PC erişimi ve test — gömülü HTTPS sunucu (`electron/server.cjs`), sertifika
  sabitlemeli istemci (`electron/istemci.cjs`), Ayarlar > Sunucu / Çoklu PC ekranı, giriş ekranından bağlanma
- **Online aktivasyon sunucusu:** kod `aktivasyon-sunucu/` altında, testleri geçiyor; deploy için
  `npx wrangler login` + `aktivasyon-sunucu/deploy.sh`, sonra `AKTIVASYON_URL` gömülür. ayrı Cloudflare Worker + D1, lease, 12 saatlik yenileme,
  uzaktan iptal, kurulum limiti, `lisans-yonet.cjs` (bkz. §7.4). İstemci PC'ler lisansı sunucu PC'den okur.
- Kullanıcı rolleri (antrenör sadece yoklama görsün gibi)
- Sağlık raporu geçerlilik uyarısı

### Faz 3 – İleride (kulüp isterse)
- WhatsApp bildirimleri (ödeme hatırlatma, devamsızlık, iptal, toplu mesaj)
- Sporcu kimlik kartı basımı (kart bloke / aktif durumu ile)

---

## 6. Kulübe Sorulacak Açık Noktalar

1. Aidat tutarı yaş grubuna göre değişiyor mu, tek tutar mı?
2. İndirimli ve kardeş indirimi yüzde mi, sabit tutar mı?
3. Dondurma durumundaki oyuncu aidat öder mi? Deneme durumundaki?
4. Makbuz numarası seri şeklinde mi olsun (2026-0001 gibi)?
5. "Tahsil eden" sabit bir kişi mi, giriş yapan kullanıcı mı?
6. Antrenman programı sabit mi (her hafta aynı gün ve saat)? Öyleyse takvim otomatik oluşturulur.
7. Program hangi PC'de çalışacak? Windows sürümü? Yazıcı türü (A4 mü, fiş yazıcı mı)?
8. Mevcut oyuncu listesi Excel'de var mı? Varsa toplu aktarım yaparız.
9. Kulüp logosunun yüksek çözünürlüklü hali alınmalı (makbuz ve form çıktıları için).

## 7. Lisanslama (GenCRM modeli)

Eyüpspor programı GenCRM ile aynı lisans altyapısını kullanacak. Kaynak: `~/Projeler/gen-crm`
(`electron/lisans.cjs`, `electron/lisansKalici.cjs`, `electron/aktivasyonIstemci.cjs`,
`scripts/lisans-*.cjs`, `aktivasyon-sunucu/`). Kod GenCRM'den kopyalanıp uyarlanır, sıfırdan yazılmaz.

### 7.1 Anahtar biçimi ve kripto
- Lisans anahtarı: `EYUPSPOR.<b64url(payload JSON)>.<b64url(Ed25519 imza)>`
  (GenCRM'de önek `GENCRM.`; ürünler karışmasın diye önek ve anahtar çiftleri AYRI olacak).
- Payload: `{ firma, bitis: "YYYY-MM-DD" | null, maksKullanici: n | null, uretimTarihi, makineId?, aktivasyonGerekli? }`
- **İki ayrı Ed25519 çifti:**
  - Lisans çifti: özel anahtar yalnız üreticinin makinesinde, çevrimdışı (`scripts/keys/lisans-private.pem`, gitignore).
    Açık eşi uygulamaya gömülür (`VARSAYILAN_PUBLIC_PEM`).
  - Lease çifti: özel anahtar aktivasyon sunucusunda. Açık eşi uygulamaya gömülür (`VARSAYILAN_LEASE_PUBLIC_PEM`).
    Sunucu sızsa bile yalnız kısa ömürlü lease basılabilir, kalıcı lisans üretilemez.
- Lease biçimi: `EYUPLEASE.<payload>.<imza>`, payload `{ firma, makineId, leaseBitis, iptal, uretimTarihi }`.

### 7.2 Durum makinesi (`durumHesapla`)
| Durum | Koşul | Davranış |
|-------|-------|----------|
| `lisansli` | Geçerli imza, bitiş geçmemiş, makineId uyumlu, aktivasyon gerekliyse geçerli lease var | Tam özellik |
| `deneme` | Anahtar yok veya geçersiz, kurulumdan itibaren ≤ 30 gün | Tam özellik, üstte geri sayım şeridi |
| `saltOkunur` | Diğer her şey (deneme bitti, lisans bitti, imza geçersiz, makine uyumsuz, aktivasyon gerekli ama lease yok) | Yazma kapalı, okuma ve dışa aktarma açık, Ayarlar > Lisans her zaman erişilebilir |

Salt okunur modda arayüz salt-okunur izinlere düşer; oyuncu ekleme, makbuz kesme, yoklama yazma kapanır.
Veri asla silinmez, kilit yeni anahtar girilince anında kalkar.

### 7.3 Sertleştirme (GenCRM Faz B1)
- Kurulum bilgisi (`makineId`, `kurulumTarihi`, `sonGorulen`, `lease`) hem DB meta'da hem
  `safeStorage` ile şifreli ayrı dosyada (`userData/lisans-meta.enc`) tutulur. `data.db` silinse bile
  dosya kalır, deneme sıfırlanamaz. Birleştirme kuralı: en erken kurulum tarihi, en ileri görülen tarih.
- `sonGorulen` monotonik saat işareti: sistem saati geri alınırsa efektif tarih gerilemez.
- `makineId` ilk açılışta üretilir, anahtar isteğe bağlı bu kimliğe kilitlenebilir (offline anti-paylaşım).

### 7.4 Online aktivasyon sunucusu (GenCRM Faz B2)
- Cloudflare Worker + D1. GenCRM'deki `aktivasyon-sunucu/` klasörü kopyalanır, **ayrı worker** olarak
  deploy edilir (örn. `eyupspor-aktivasyon`) ve **kendi anahtar çiftleri + kendi D1** ile çalışır.
  Ortak sunucu kullanılmaz; GenCRM anahtarı Eyüpspor'u açmamalı.
- Uçlar: `POST /aktivasyon`, `POST /yenile`, `GET /saglik`, `POST /admin/lisans`, `GET /admin/liste`, `GET /admin/hepsi`.
- D1'de ham anahtar tutulmaz, yalnız SHA-256 özeti (KVKK). Tablolar: `lisanslar`, `kurulumlar`.
- Lease penceresi 14 gün (`LEASE_GUN`). Uygulama açılışta ve her 12 saatte bir `/yenile` çağırır.
- Uzaktan iptal: `/admin/lisans` ile `iptal=true`, lease dolunca uygulama salt okunura düşer.
- Kurulum limiti: `maksKurulum` kadar farklı makineId aktive olabilir. Çoklu PC senaryosunda (Faz 2)
  lisans sahibi SUNUCU PC'dir, istemci PC'ler lisansı ondan okur.
- İnternetsiz kurulum için elle yol: uygulama makineId gösterir, üretici `lease-uret.cjs` ile lease
  imzalar, müşteri Ayarlar > Lisans'a yapıştırır.

### 7.5 Üretici araçları (`scripts/`)
| Betik | Ne yapar |
|-------|----------|
| `lisans-anahtar-cifti.cjs` | Bir kez: iki Ed25519 çifti üretir, özel anahtarları `scripts/keys/`'e yazar, açık anahtarları basar |
| `lisans-uret.cjs` | `--firma --bitis|--suresiz --kullanici --makine --aktivasyon` ile anahtar üretir, gömülü açık anahtarla kendini doğrular |
| `lease-uret.cjs` | Air-gapped müşteri için elle lease imzalar |
| `lisans-yonet.cjs` | Sunucu admin uçları: `kaydet`, `iptal`, `ac`, `liste`, `tumu` |

`scripts/keys/` gitignore'da. Admin token `scripts/keys/admin-token.txt` veya ortam değişkeni.

### 7.6 Uygulama tarafı dosyalar
- `electron/lisans.cjs` — saf çekirdek: `imzala`, `dogrula`, `leaseImzala`, `leaseDogrula`, `leaseGecerliMi`, `durumHesapla`.
- `electron/lisansKalici.cjs` — saf birleştirme: `birlestir`, `enErken`, `enIleri`.
- `electron/aktivasyonIstemci.cjs` — `aktive`, `yenile`, `ayarli`; `AKTIVASYON_URL` deploy sonrası doldurulur.
- `electron/db.cjs` — `lisansDurumu`, `lisansKaydet`, `leaseKaydet`, `lisansAktiflestir`, `lisansYenile`; meta anahtarları
  `lisansAnahtari`, `makineId`, `kurulumTarihi`, `sonGorulenTarih`, `lisansLease`.
- `electron/ipc/data.cjs` — `lisans:durum`, `lisans:kaydet`, `lisans:leaseYapistir`, `lisans:aktiflestir`, `lisans:yenile`.
  `db:call` beyaz listesi salt okunur modda yazma fonksiyonlarını reddeder.
- `electron/preload.cjs` — `window.okul.lisans.{durum, kaydet, leaseYapistir, aktiflestir, yenile}`.
- `src/components/settings/SettingsLisans.jsx` — durum kartı (lisanslı / deneme / salt okunur), anahtar
  yapıştırma, "Aktive Et (online)", lease yapıştırma, makine kimliği gösterimi.
- `src/App.jsx` — yüklemede lisans durumu, 12 saatlik yenileme kalbi, üst şeritler
  (salt okunur kırmızı, deneme geri sayımı, bitişe ≤ 30 gün uyarısı).
- Testler: `tests/lisans.test.js` (imza turu, tahrifat, durum makinesi), `tests/lisans-kalici.test.js`,
  `tests/aktivasyon-istemci.test.js`, `tests/aktivasyon-kripto.test.js` (Node ↔ Web Crypto uyumu),
  `tests/aktivasyon-sunucu.test.js`. Testler kendi çiftlerini `EYUPSPOR_LISANS_PUBKEY` /
  `EYUPSPOR_LEASE_PUBKEY` ortam değişkenleriyle verir.

### 7.7 Eyüpspor için kararlar
- Tek müşteri var ama altyapı aynı kalır: ileride başka kulüplere aynı programı satmak mümkün olur.
- Kulübe verilecek ilk anahtar: `--firma "Eyüpspor Kulübü" --bitis <sözleşme bitişi> --aktivasyon`,
  sunucuda `maksKurulum` Faz 2'deki PC sayısı kadar.
- Deneme süresi 30 gün korunur; kurulum gününde anahtar girilir, deneme fiilen kullanılmaz.


## 8. Bekleyen İşler ve Teslim Öncesi Kontrol Listesi (06.09.2026 itibarıyla)

### 8.1 Kerem'in yapacakları (bu makineden)
| # | İş | Nasıl | Durum |
|---|----|-------|-------|
| 1 | Lisans özel anahtarlarını yedekle | `scripts/keys/lisans-private.pem` ve `lisans-lease-private.pem` dosyalarını şifreli USB veya parola yöneticisine kopyala. Kaybolursa dağıtılan tüm lisanslar geçersiz olur. | Bekliyor |
| 2 | GitHub deposu oluştur ve push et | `gh repo create keremgenisel/eyupspor --private`, `git remote add origin …`, `git push -u origin main`. `package.json build.publish` bu adı bekliyor. | Bekliyor |
| 3 | Aktivasyon sunucusunu deploy et | `cd aktivasyon-sunucu && npx wrangler login && ./deploy.sh`. Çıkan adresi `electron/aktivasyonIstemci.cjs` → `AKTIVASYON_URL` alanına yaz, commit et. | Bekliyor |
| 4 | Kulübe lisans anahtarı üret | `node scripts/lisans-uret.cjs --firma "Eyüpspor Kulübü" --bitis <sözleşme bitişi> --aktivasyon` ve `node scripts/lisans-yonet.cjs kaydet --anahtar "…" --kurulum 2`. Aktivasyon sunucusu yoksa `--aktivasyon` bayrağını KOYMA. | Bekliyor |
| 5 | İlk sürümü yayınla | `package.json` version `1.0.0`, `git tag v1.0.0 && git push --follow-tags` → GitHub Release + otomatik güncelleme. Alternatif: `npm run build:win` ile `release/*.exe`, ardından `node scripts/ensure-native.cjs`. | Bekliyor |
| 6 | Wrangler'ı 4.x'e yükselt | `aktivasyon-sunucu` içinde `npm install --save-dev wrangler@4` (3.x uyarı veriyor). | Bekliyor |

### 8.2 Kulüp bilgisayarında kurulum günü
1. Kurulum dosyasını çalıştır, `admin`/`admin` ile gir, parolayı değiştir (rehber: `docs/kurulum.md`).
2. Ayarlar > Lisans: anahtarı yapıştır. Online aktivasyon açıksa "Aktive Et".
3. Ayarlar > Yedekleme: klasör seç (harici disk veya bulut klasörü).
4. İlk kurulum sihirbazı ilk girişte açılır (kulüp adı, aidat/indirim, gruplar, yedek, kurtarma kodları); atlandıysa Ayarlar > Kulüp ve Makbuz > Kurulum Sihirbazını Aç.
5. Mevcut oyuncu listesini Oyuncular > İçe Aktar ile Excel'den yükle (şablon indir → doldur → önizle → aktar).
6. Yazıcıda deneme makbuzu bas, düzeni kontrol et.
7. İkinci PC istenirse: `src/lib/ozellikler.js` COKLU_PC_ACIK bayrağını aç, sunucuyu başlat, diğer PC'den bağlan (şu an arayüzde kapalı).
8. Antrenöre 20 dakikalık kullanım eğitimi: oyuncu ekleme, makbuz, yoklama, tesise giriş kontrolü.

### 8.3 Kulüpten cevabı beklenen sorular (bkz. §6) ve etkisi
- Aidat tutarı yaş grubuna göre değişiyorsa → her oyuncuda ayrı girilir, ek geliştirme gerekmez.
- ~~İndirim yüzde ise → şu an sabit tutar giriliyor~~ — YAPILDI 07.09.2026: Ayarlar > Aidat Kalemleri'nde aidat taban fiyatı ve ücret tipi başına indirim yüzdesi (burslu varsayılan %100, indirimli/kardeş 0); oyuncu formunda ücret tipi seçilince aidat otomatik hesaplanır, elle değiştirilebilir.
- ~~Mevcut Excel oyuncu listesi varsa → `scripts/excel-aktar.cjs` yazılır~~ — YAPILDI 07.09.2026 (Oyuncular > İçe Aktar).
- Yazıcı fiş yazıcıysa → makbuz şablonuna 80 mm düzen eklenir (yarım gün).
- Bir yaşta çok oyuncu (iki U11) → KARAR 07.09.2026: alt grup alanı YOK; "U11 A" / "U11 B" iki ayrı yaş grubu açılır
  (rehber §3c). Doğum yılı ipucu alt grupları aday gösterir; sezon sihirbazı "U12 A" yoksa "U12"ye düşer.

### 8.4 Faz 3 adayları (kulüp isterse)
- WhatsApp bildirimleri (tek tıkla gönder → otomasyon), bkz. §1.6.
- Sporcu kimlik kartı basımı, aidat borcunda kart bloke.
- ~~Sağlık raporu geçerlilik uyarısı~~ — YAPILDI 07.09.2026 (pano sayaç/liste, oyuncu kartı rozeti).
- Kullanıcı rolleri ince ayarı (antrenör yalnız yoklama görsün).
- ~~Yedeklerden geri yükleme ekranı~~ — YAPILDI 06.09.2026 (Ayarlar > Yedekleme; aynı PC'de alınmış yedek, mevcut veri `.pre-restore` ile kenara alınır, uygulama yeniden başlar).
- Yedeği başka PC'ye taşıma paketi (parola korumalı, şifreleme anahtarından bağımsız) — kulüp PC değiştirirse gerekir.

## 9. Yoklama Takvim Şeridi (planlandı ve UYGULANDI, 07.09.2026)

**İstek:** Yoklama ekranının üstünde havayolu sitelerindeki tarih seçici gibi yatay bir gün şeridi
olsun. Günler arasında gezildikçe o günün antrenmanları görünsün; yoksa eklenebilsin.

### 9.1 Ekran düzeni (üstten alta)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹  PZT   SAL   ÇAR   PER   CUM   CMT   PAZ   PZT   SAL   ÇAR   PER  …   ›   │
│    1     2     3     4     5     6     7     8     9    10    11            │
│   EYL   ●●    ●     ●●●         ●                 ●●                        │
│              [BUGÜN]                                       [📅 tarihe git] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2 Eylül 2026 Salı · 2 antrenman                        [+ Antrenman Ekle]    │
│ ┌───────────────┐ ┌───────────────┐                                          │
│ │ U11 · 17:00   │ │ U13 · 18:30   │   ← seçili gün kartları (chip)           │
│ │ Saha 1        │ │ Saha 2  İPTAL │                                          │
│ │ 12/15 işaretli│ │               │                                          │
│ └───────────────┘ └───────────────┘                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ U11 Yoklama · 17:00      Toplam 15 · Geldi 10 · Gelmedi 1 · İzinli 1         │
│ (mevcut oyuncu listesi: Geldi / Gelmedi / İzinli düğmeleri)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Gün şeridi:** 14 gün görünür (bugün ortada başlar), her hücrede kısa gün adı (Pzt…Paz), gün
  numarası, ay değişiminde ay kısaltması. Hücre altında antrenman noktaları: gri = yoklama alınmamış,
  mor = kısmen alınmış, yeşil = tamamlanmış, kırmızı = iptal. Seçili gün mor dolgu, bugün sarı alt çizgi.
- **Gezinme:** ‹ › oklar 7 gün kaydırır; "Bugün" düğmesi şeridi bugüne getirir; tarih girdisi ile
  uzak tarihe atlanır; klavye ← → gün, Home bugün. Şerit kaydırıldıkça görünür pencere ±4 hafta
  önbellekle tek sorguda yüklenir (`listTrainings(from, to)` zaten aralık alıyor).
- **Gün paneli:** seçili günün antrenmanları kart olarak; kartta grup · saat · saha, iptal rozeti,
  "işaretli/toplam" ilerlemesi. Kart tıklanınca alttaki yoklama listesi açılır. "+ Antrenman Ekle"
  aynı satırda; mevcut form (grup, saat, saha) satır içi açılır. Boş günde "Bu tarihte antrenman yok"
  ve yine ekle düğmesi.
- **Yoklama listesi:** bugünkü sağ kart olduğu gibi kalır (Kalanları Geldi İşaretle, iptal, özet).
  Sol 300px sütun kalkar; özet sayıları liste başlığına taşınır.
- **Pano bağlantısı:** Pano'daki "Yoklama" bağlantısı bugünü açar (değişmez); ileride antrenman
  kartından o antrenmanı doğrudan seçili açma `git("yoklama", { tarih, trainingId })` ile.

### 9.2 Veri ve mantık

- Şema değişmez. `trainings`/`attendance` yeterli.
- Yeni okuma sorgusu `trainingCalendar(from, to)`: gün başına `{ tarih, toplam, iptal, tamam, kismi }`
  (panoOzet'teki `isaretli`/`geldi` alt sorgusunun aralık sürümü). `yetki.cjs` OKUMA setine eklenir;
  sunucu/istemci aynı beyaz listeden geçtiği için çoklu PC'de ek iş yok.
- Saf yardımcılar `src/lib/takvim.js` (`// @ts-check`): `gunSeridi(merkezIso, adet)` → hücre
  dizisi (iso, gün adı TR, gün no, ay kısaltması, ayBasiMi, bugunMu, haftaSonuMu), `gunKaydir(iso, n)`,
  `haftaBasi(iso)`. Tarih işlemleri UTC'siz string tabanlı (saat dilimi kayması olmasın).
- Bileşen `src/components/TakvimSeridi.jsx`: prop'lar `secili`, `onSec`, `gunOzetleri` (tarih → özet),
  `onPencereDegisti(from, to)`. Yoklama.jsx bunu üstte kullanır.

### 9.3 Adımlar ve süre

| # | Adım | Süre |
|---|------|------|
| 1 | `design/Yoklama.dc.html` tuvalini yeni düzene göre güncelle (şerit + gün kartları), onay | 1 s |
| 2 | `src/lib/takvim.js` + saf testler (ay sınırı, yıl sınırı, bugün, Türkçe gün adları) | 1 s |
| 3 | `db.trainingCalendar` + Electron roundtrip testi + yetki beyaz listesi | 1 s |
| 4 | `TakvimSeridi.jsx` + jsdom testi (ok tuşları, Bugün, gün seçimi, nokta renkleri) | 2 s |
| 5 | Yoklama.jsx yeni düzen; antrenman kartları; satır içi ekleme; mevcut akış korunur | 2 s |
| 6 | Duman testi ekran görüntüsü, kalıcılık testinde yoklama adımını yeni düzene uyarlama | 1 s |

Tüm adımlar 07.09.2026'da tamamlandı (`src/lib/takvim.js`, `src/components/TakvimSeridi.jsx`, `db.trainingCalendar`; tuvalde "Yoklama — takvim şeridi" artboard'u). Mevcut yoklama davranışı (işaretleme, iptal, aidat rozeti) değişmez; yalnız
antrenman seçme yolu değişir.

### 9.4 Sonraki aday (bu işe dahil değil)
- ~~**Haftalık program şablonu**~~ — YAPILDI 07.09.2026 (Yaş Grupları > Düzenle; Yoklama > Haftayı Programdan Doldur).

## 10. Yeni Sezon Geçişi (UYGULANDI, 07.09.2026)

**Sorun:** Sezon bitince yenilemeyen oyuncular "aktif" kalır; her ay sahte aidat borcu açılır, borçlu
listesi ve tesise giriş kontrolü kirlenir.

**Çözüm — Ayarlar > Yeni Sezon sihirbazı (yalnız yönetici, yılda bir):**
- Aktif/deneme/sakat oyuncular listelenir; antrenör yenileyenleri işaretler ("Tümünü yeniledi işaretle" /
  "Tümünü kaldır"). Her yenileyene yeni sezon grubu seçilir; öneri bir üst grup (U11 → U12, ad uymuyorsa
  mevcut grup). Ödenmemiş eski aidat sayısı/tutarı satırda görünür.
- Geçiş tek işlemde (`db.yeniSezonaGec`): yenileyenler `players.sezon` = yeni sezon (+ grup), diğerleri
  **silinmez**, `durum='pasif'` ve notlarına "<eski sezon> sezonu sonunda yenilemedi (tarih)" eklenir.
  Pasife yeni aidat açılmaz; makbuz/yoklama/belge geçmişi kalır; kartından yeniden Aktif yapılabilir.
- Yenilemeyenlerin ödenmemiş eski aidatı isteğe bağlı silinir (kayıt `muaf` olur); işaretlenmezse borç
  kayıtta kalır ve raporlarda görünür.
- Aktif yaş gruplarının `sezon` alanı ve `aktif_sezon` ayarı yeni sezona çekilir; `son_sezon_gecisi` yazılır.
- Ayarlar: aktif sezon (2026-2027) ve sezon başlangıç ayı (varsayılan Eylül). Pano: aktif sezon bugünün
  sezonundan eskiyse "sezon bitti" uyarısı + "Yeni Sezona Geç" düğmesi (Ayarlar > Yeni Sezon'a götürür).
- Oyuncular listesi varsayılan filtre **Aktif** oldu; pasifler "Tüm durumlar"/"Pasif" ile görülür.
- Saf mantık `src/lib/sezon.js` (güncel sezon, sonraki sezon, sezon sonu, üst grup önerisi); şema 4.

## 11. 07.09.2026 öğleden sonra eklenenler ve Faz 3'e kalanlar

Uygulandı (12 madde, 07.09.2026):
1. Aidat kayıtları uygulama açıkken de üretilir (saatte bir + pencere öne gelince; yeni kayıt ve pasif→aktif'te hemen).
2. Excel'den oyuncu aktarımı (Oyuncular > İçe Aktar: şablon, önizleme, tek işlemde aktar).
3. İlk kurulum sihirbazı (ilk parola sonrası, oyuncu yokken).
5. Tek makbuzda birden fazla aidat ayı (ay bazlı tutar, makbuzda ayrı satırlar).
6. Kısmi ödeme (`monthly_dues.odenen`, durum `kismi`, kalan borç; şema 5).
7. Her yerden oyuncu arama (Ctrl/Cmd+K; kart aç / makbuz kes).
8. Haftalık antrenman programı (yaş grubu başına gün/saat/saha; Yoklama > Haftayı Programdan Doldur; şema 6).
9. Sağlık raporu geçerlilik uyarıları (panoda sayaç + liste; oyuncu kartında rozet).
10. Makbuz iptalinde zorunlu neden + iptal eden + zaman (şema 7); tahsilat raporunda iptaller ayrı.
11. Veli telefonu pano borçlu listesi ve oyuncu listesinde (tıkla-kopyala).
12. TC sağlama algoritması ve GSM biçim doğrulama.
13. Doğum yılından yaş grubu ipucu (yalnız öneri; grup elle seçilir).

### 11.1 Faz 3'e kalanlar (öneri listesinden)
- **Otomatik güncelleme + lisans sunucusu yayını** (Kerem): GitHub deposu push, `aktivasyon-sunucu/deploy.sh`,
  `AKTIVASYON_URL`, tag `v1.0.0` (bkz. §8.1).
- **İki yeni rapor:** yönteme göre aylık tahsilat özeti (nakit/havale ayrımı); yoklama yüzdesi düşük oyuncular.
- **Windows'ta gerçek yazıcı testi:** kulüp bilgisayarında makbuz basımı, kağıt boyutu ve kenar boşlukları.
- **Arayüz tercihlerini ana sürece taşıma:** kenar menü ve hatırlanan kullanıcı adı localStorage'da; ani kapanışta
  kaybolabiliyor (config.json'a taşınırsa kalıcı olur). Düşük öncelik.
