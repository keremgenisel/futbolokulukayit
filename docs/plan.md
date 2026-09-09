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

### 8.1 Kerem'in yapacakları (bu makineden) — tek HERKESE AÇIK depo (08.09.2026)
Otomatik güncelleme GitHub Releases'ten kimliksiz indirir; depo özel olursa kurulu uygulama güncelleme alamaz (iki
depo düzeninden vazgeçildi, 08.09.2026). Depoda kod ve kurulum dosyaları olur; kulüp verisi ve lisans özel anahtarları
ASLA olmaz (gitignore + gitleaks). Altyapı hazır (build.publish → `keremgenisel/eyupspor`, release.yml GITHUB_TOKEN ile
yayınlar, publish-release.cjs depo özelse durur, Ayarlar > Hakkında > Uygulama güncellemesi akışı). Sıra:

Sıra bağımlılığa göredir (08.09.2026): her adım bir sonrakinin ön koşulu. 1–4 hesap ve depo işi (~yarım saat), 5–8 yayın
(~bir saat), 9 kulüp ziyareti, 10 bütçe kararı.

| # | İş | Nasıl | Neden bu sırada | Durum |
|---|----|-------|-----------------|-------|
| 1 | Lisans özel anahtarlarını yedekle | `scripts/keys/lisans-private.pem` ve `lisans-lease-private.pem` dosyalarını şifreli USB veya parola yöneticisine kopyala. | Sonraki her adım bu anahtarlara dayanır; kaybı geri alınamaz, dağıtılan tüm lisanslar geçersiz olur. | Bekliyor |
| 2 | GitHub hesabında 2FA aç (güvenlik #9) | github.com > Settings > Password and authentication. | Herkese açık depo ve otomatik güncelleme bu hesabın güvenliğine dayanır; önce hesap, sonra depo. | Bekliyor |
| 3 | Depoyu HERKESE AÇIK oluştur ve push et | `gh repo create keremgenisel/eyupspor --public --source . --remote origin --push` | Etiket kuralı ve sürüm yayını depo olmadan yapılamaz. | Bekliyor |
| 4 | Korumalı etiket kuralı ekle (güvenlik #9) | Depoda Settings > Tags > "Protected tags", desen `v*` (yalnız sen etiket atabilirsin). | İlk etiket atılmadan önce; yayın kanalı ilk günden korunur. | Bekliyor |
| 5 | Wrangler'ı 4.x'e yükselt | `aktivasyon-sunucu` içinde `npm install --save-dev wrangler@4` (3.x uyarı veriyor). | Deploy'u temiz araçla yapmak için, deploy'dan hemen önce. | Bekliyor |
| 6 | Aktivasyon sunucusunu deploy et | `cd aktivasyon-sunucu && npx wrangler login && ./deploy.sh`. Çıkan adresi `electron/aktivasyonIstemci.cjs` → `AKTIVASYON_URL` alanına yaz, commit et. | `--aktivasyon` bayraklı lisans bu sunucuya bağlanır; adres uygulamaya gömülü olduğu için ilk sürümden ÖNCE commit'te olmalı. | Bekliyor |
| 7 | Kulübe lisans anahtarı üret | `node scripts/lisans-uret.cjs --firma "Eyüpspor Kulübü" --bitis <sözleşme bitişi> --aktivasyon` ve `node scripts/lisans-yonet.cjs kaydet --anahtar "…" --kurulum 2`. Aktivasyon sunucusu yoksa `--aktivasyon` bayrağını KOYMA. | Sunucu ayakta olunca; kurulum sayısı sınırı burada tanımlanır. | Bekliyor |
| 8 | İlk sürümü yayınla | `package.json` version `1.0.0`, commit, `git tag v1.0.0 && git push --follow-tags` → GitHub Actions ~10 dk → Release v1.0.0 (.exe + latest.yml). Kontrol: `gh release view v1.0.0 --repo keremgenisel/eyupspor`. | Aktivasyon adresi gömülü ve etiketler korumalı olduktan sonra. | Bekliyor |
| 9 | Kulüp bilgisayarında kurulum ve Windows doğrulamaları | §8.2 kurulum adımları + gerçek yazıcı testi (makbuz, kağıt boyutu, kenar boşlukları) + güvenlik raporundaki doğrulanamayan 4 madde: WAL dosyası (`data.db-wal`) şifreli mi, `db-key.enc` yalnız o Windows kullanıcısına açık mı, GitHub 2FA/korumalı etiket gerçekten açık mı, yazdırma penceresinden `file://` erişimi engelli mi. | Kurulum dosyası hazır olunca tek ziyarette. | Bekliyor |
| 10 | Kod imzası sertifikası (güvenlik #9) | Windows kod imzası sertifikası (yıllık ücret) alınırsa `electron-builder` ayarında imza ve `verifyUpdateCodeSignature: true`; yeni sürüm yayınla. | Hiçbir şey buna bağlı değil; bütçe kararı, en sona. | Bekliyor |

**Her yeni sürümde (kurulumdan sonra):** version yükselt → commit → `git tag vX.Y.Z && git push --follow-tags`. Kulüpteki
uygulama sonraki açılışta üst şeritte "Yeni sürüm hazır" der; yönetici Ayarlar > Hakkında'dan İndir → Yeniden Başlat ve Kur.
Not: otomatik güncelleme yalnız Setup ile KURULMUŞ uygulamada çalışır; geliştirme modunda denetlenmez.

### 8.2 Kulüp bilgisayarında kurulum günü
1. Kurulum dosyasını çalıştır, `admin`/`admin` ile gir, parolayı değiştir (rehber: `docs/kurulum.md`).
2. Ayarlar > Lisans: anahtarı yapıştır. Online aktivasyon açıksa "Aktive Et".
3. Ayarlar > Yedekleme: klasör seç (harici disk veya bulut klasörü).
4. İlk kurulum sihirbazı ilk girişte açılır (kulüp adı, aidat/indirim, gruplar, yedek, kurtarma kodları); atlandıysa Ayarlar > Uygulama > İlk Kurulum Sihirbazı.
5. Mevcut oyuncu listesini Oyuncular > İçe Aktar ile Excel'den yükle (şablon indir → doldur → önizle → aktar).
6. Yazıcıda deneme makbuzu bas, düzeni kontrol et.
7. İkinci PC istenirse: `src/lib/ozellikler.js` COKLU_PC_ACIK bayrağını aç, sunucuyu başlat, diğer PC'den bağlan (şu an arayüzde kapalı).
8. Antrenöre 20 dakikalık kullanım eğitimi: oyuncu ekleme, makbuz, yoklama, tesise giriş kontrolü.
9. WhatsApp: kulübün WhatsApp masaüstü ya da WhatsApp Web'i bu PC'de açık olsun; Pano'dan bir borçluya deneme hatırlatması aç (§13).

### 8.3 Kulüpten cevabı beklenen sorular (bkz. §6) ve etkisi
- Aidat tutarı yaş grubuna göre değişiyorsa → her oyuncuda ayrı girilir, ek geliştirme gerekmez.
- ~~İndirim yüzde ise → şu an sabit tutar giriliyor~~ — YAPILDI 07.09.2026: Ayarlar > Aidat Kalemleri'nde aidat taban fiyatı ve ücret tipi başına indirim yüzdesi (burslu varsayılan %100, indirimli/kardeş 0); oyuncu formunda ücret tipi seçilince aidat otomatik hesaplanır, elle değiştirilebilir.
- ~~Mevcut Excel oyuncu listesi varsa → `scripts/excel-aktar.cjs` yazılır~~ — YAPILDI 07.09.2026 (Oyuncular > İçe Aktar).
- ~~Yazıcı fiş yazıcıysa → makbuz şablonuna 80 mm düzen~~ — KALDIRILDI 07.09.2026 (Kerem): fiş yazıcı senaryosu yok.
- Bir yaşta çok oyuncu (iki U11) → KARAR 07.09.2026: alt grup alanı YOK; "U11 A" / "U11 B" iki ayrı yaş grubu açılır
  (rehber §3c). Doğum yılı ipucu alt grupları aday gösterir; sezon sihirbazı "U12 A" yoksa "U12"ye düşer.

### 8.4 Faz 3 adayları (kulüp isterse)
- WhatsApp bildirimleri → KARAR 07.09.2026: API yok (ücret/hesap/yasak riski); bağlantıyla gönderme, bkz. §13.
- ~~Sporcu kimlik kartı basımı, aidat borcunda kart bloke~~ — KALDIRILDI 07.09.2026 (Kerem).
- ~~Sağlık raporu geçerlilik uyarısı~~ — YAPILDI 07.09.2026 (pano sayaç/liste, oyuncu kartı rozeti).
- ~~Kullanıcı rolleri ince ayarı~~ — YAPILDI 07.09.2026 (Kerem kararı): "kullanıcı" rolü Ayarlar'ı görmez (sekme yok; ana süreçte
  setSetting/aidatAyarlariKaydet/updateFeeItem/yedek klasör-al-sıklık yalnız yönetici), kalan her şeyi yapar (Excel aktarımı dahil).
- ~~Yedeklerden geri yükleme ekranı~~ — YAPILDI 06.09.2026 (Ayarlar > Yedekleme; aynı PC'de alınmış yedek, mevcut veri `.pre-restore` ile kenara alınır, uygulama yeniden başlar).
- ~~Yedeği başka PC'ye taşıma paketi (parola korumalı, şifreleme anahtarından bağımsız)~~ — YAPILDI 07.09.2026 (§14).

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
- Oyuncular listesi varsayılan filtre **Aktif, deneme ve sakat** (07.09.2026 akşam; önce yalnız Aktif idi, deneme oyuncular
  görünmüyordu); pasifler "Tüm durumlar"/"Pasif" ile görülür.
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
- ~~**Yeni rapor:** sağlık raporu durumu~~ — YAPILDI 07.09.2026 (Raporlar > Sağlık Raporu Durumu; `db.saglikRaporuListesi`). ~~Yönteme göre aylık tahsilat özeti; yoklama yüzdesi düşük oyuncular~~ — KALDIRILDI 07.09.2026 (Kerem).
- **Windows'ta gerçek yazıcı testi:** kulüp bilgisayarında makbuz basımı, kağıt boyutu ve kenar boşlukları.
- ~~Arayüz tercihlerini ana sürece taşıma (kenar menü, hatırlanan kullanıcı adı)~~ — KALDIRILDI 07.09.2026 (Kerem): görünüm
  tercihi; kaba kapanışta kaybolması kabul edildi.
## 12. Saha Yoklama Formu — yazdırılabilir (PLANLANDI ve UYGULANDI, 07.09.2026)

**İhtiyaç:** Antrenör sahada elinde kâğıtla yoklama alır, sonra programa işler. Yoklama > antrenman seçilince
"Yoklama Formu Yazdır" düğmesi o antrenmanın grubu için A4 form üretir.

### 12.1 Davranış
- Yoklama'da bir antrenman seçiliyken (iptal edilmemiş) yeni düğme: **Formu Yazdır** (yanında **PDF**).
  Ekrandaki "Kalanları Geldi İşaretle" ve "İptal Et" ile aynı satırda, en solda.
- Form o grubun aktif oyuncularını (aktif/deneme/sakat) ad soyad sırasıyla listeler; ekrandaki listeyle aynı.
- Programda zaten işaretli olanlar kâğıda dolu gelir: Geldi → ✓, Gelmedi → ✗, İzinli → İ. Henüz işaretlenmemiş
  oyuncularda üç kutu da boş kalır; antrenör sahada elle işaretler. (Kullanıcı isteği: "kalanlar boş".)
- Yazdırma veritabanına yazmaz; formda ne yazdığı sonradan ekranda elle işlenir. Otomatik okuma yok.
- Çoklu PC açılırsa istemcide de çalışır (HTML renderer'da üretilir, `cikti:yazdir` mevcut köprü).

### 12.2 Form düzeni (A4 dikey, tek sayfa hedefi; 30+ oyuncuda ikinci sayfaya taşar)
```
 [logo] EYÜPSPOR FUTBOL OKULU — YOKLAMA FORMU
        U11 · 07.09.2026 Pazartesi · 17:00 · Saha 2          Antrenör: ____________
 ┌────┬──────────────────────────┬────────┬─────────┬────────┬───────────────────┐
 │ #  │ Ad Soyad                 │ Geldi  │ Gelmedi │ İzinli │ Not               │
 ├────┼──────────────────────────┼────────┼─────────┼────────┼───────────────────┤
 │ 1  │ Ada Kaya                 │   ✓    │   □     │   □    │                   │  ← programda geldi
 │ 2  │ Barış Güneş              │   □    │   □     │   □    │                   │  ← henüz işaretsiz
 │ …  │                          │        │         │        │                   │
 ├────┴──────────────────────────┴────────┴─────────┴────────┴───────────────────┤
 │ Toplam: 18 oyuncu · Geldi: ___  Gelmedi: ___  İzinli: ___     İmza: __________ │
 └───────────────────────────────────────────────────────────────────────────────┘
 Altta 3 boş satır (sonradan katılan / deneme oyuncu elle yazılır).
```
- Kutu 6×6 mm, satır yüksekliği ≥ 8 mm (kalemle işaretlenebilir). Ad sütunu geniş, Not sütunu serbest.
- Aidat durumu forma GİRMEZ (sahada veliye görünür kâğıt; borç bilgisi mahremiyet).
- Sakat durumundaki oyuncu adının yanında küçük "(sakat)" etiketi; deneme için "(deneme)".

### 12.3 Teknik
- `src/lib/yoklamaFormuHtml.js` — SAF şablon (`raporHtml` gibi; `@page A4 portrait`, `.kutu` sınıfı, işaret
  karakterleri CSS ile). Girdi: `{ grup, tarih, saat, saha, oyuncular: [{ad_soyad, durum, isaret}], logo }`.
  Tarih Türkçe gün adıyla (`tarihTR` + gün adı yardımcısı `src/lib/takvim.js`'te var).
- `Yoklama.jsx`: düğme → `oyuncular` + `yoklama` state'inden satırlar kurulur → `cikti().yazdir(html)` / `pdfKaydet(html, "yoklama-U11-2026-09-07.pdf")`.
  Ek IPC gerekmez; veri zaten ekranda.
- Testler: saf şablon testi (`tests/yoklama-formu-html.test.js`: işaretli ✓/✗/İ, işaretsiz üç boş kutu, sakat etiketi,
  aidat bilgisi yok, boş ek satırlar); jsdom `tests/ui/yoklama.test.jsx`'e "Formu Yazdır → yazdir çağrılır, HTML'de
  grup+tarih+oyuncu adları" senaryosu; duman testine ekran görüntüsü gerekmez (yazdırma penceresi).
- Tahmini iş: yarım gün.

### 12.4 Karar
- Haftalık ızgara İSTENMİYOR (Kerem, 07.09.2026); yalnız tek antrenman formu. Mockup `design/YoklamaFormu.dc.html`.

## 13. WhatsApp ile Hatırlatma — bağlantıyla gönderme (PLANLANDI ve UYGULANDI, 07.09.2026)

**Karar (07.09.2026):** Kulüp WhatsApp'a ödeme yapmak istemiyor. Resmi Cloud API mesaj başı ücretli ve Meta işletme
hesabı + kart + özel numara ister; gayri resmi kütüphaneler kulübün numarasını yasaklatır. Yol: WhatsApp'ın herkese
açık "tıkla ve yaz" bağlantısı (`https://wa.me/90XXXXXXXXXX?text=…`). Program mesajı hazırlar, kulübün mevcut
WhatsApp masaüstü/Web'i açılır, kullanıcı Gönder'e basar. Ücret yok, hesap yok, yasak riski yok. Otomasyon değil:
veli başına bir tık. İleride "tek tuşla herkese" istenirse tek dürüst yol resmi API + mesaj başı ücrettir; şablon ve
onay altyapısı ortak kullanılır.

### 13.1 Nerede görünür
- **Pano > Aidat borcu olanlar:** her satırda yeşil WhatsApp düğmesi (aidat hatırlatma şablonuyla). Tablo başlığında
  **"Borçlulara Hatırlat"** → toplu pencere: borçlu veliler listesi, sağda mesaj önizlemesi, her satırda "WhatsApp'ta Aç";
  açılan satır "Hatırlatıldı" olur (geri alınabilir), üstte "3 / 14 hatırlatıldı" sayacı. Onaysız/numarasız satır gri,
  nedeni yazılı ("Mesaj onayı yok", "Numara yok").
- **Oyuncu kartı > Aile ve Acil Kişiler:** veli satırında WhatsApp düğmesi (serbest mesaj: şablon "genel", metin
  pencerede düzenlenir). **Ödemeler** sekmesinde borç varsa "Aidat hatırlat".
- **Oyuncu kartı > Bilgiler:** "Son hatırlatma: 05.09.2026 · Şerif Çelik" satırı.
- **Antrenman iptali ve saat değişikliği bildirimi (kulüp isteği, 07.09.2026):**
  - Yoklama'da antrenman kartına **Düzenle** gelir (bugün yalnız İptal var): tarih, saat, saha değiştirilir
    (`db.updateTraining`; yoklaması alınmış antrenmanda yalnız saat/saha, tarih kilitli). Değişiklik kaydedilince
    "Velilere bildir" sorusu; **İptal Et** sonrasında da aynı soru.
  - "Evet" → aynı toplu pencere, bu kez o grubun **tüm aktif oyuncularının velileri** (borç bilgisi yok). Şablon
    "iptal" ya da "degisiklik"; önizlemede eski ve yeni saat. Satır satır "WhatsApp'ta Aç", "Bildirildi" kaydı
    `message_log` (tur iptal|degisiklik, training_id).
  - Bildirim yapılmamış iptal/değişiklik kartta "Velilere bildirilmedi" rozeti taşır; karttan "Velilere bildir"
    ile sonradan açılır. Bildirilen oyuncu sayısı kartta "12/18 veli bildirildi".
  - Antrenmanı programdan otomatik dolduranlar (Haftayı Programdan Doldur) bildirim tetiklemez; yalnız elle
    yapılan iptal ve değişiklik sorar.

### 13.2 Mesaj şablonları (Ayarlar > Kulüp ve Makbuz > WhatsApp Mesajları)
- `wa_sablon_aidat`, `wa_sablon_genel`, `wa_sablon_iptal`, `wa_sablon_degisiklik` ayar anahtarları; çok satırlı
  metin, yer tutucular: `{veli}`, `{oyuncu}`, `{ay}` (Eylül 2026), `{tutar}` (3.500 ₺), `{kalan}`, `{donem}` (1-10),
  `{grup}`, `{kulup}`, `{tarih}` (7 Eylül 2026 Pazartesi), `{saat}`, `{saha}`, `{eskiTarih}`, `{eskiSaat}`,
  `{yeniTarih}`, `{yeniSaat}`, `{neden}`. Yanında canlı önizleme (örnek oyuncuyla) ve "Varsayılana dön".
- Varsayılan iptal metni: "Sayın {veli}, {grup} grubunun {tarih} {saat} antrenmanı iptal edilmiştir. {neden} {kulup}"
- Varsayılan değişiklik metni: "Sayın {veli}, {grup} grubunun {eskiTarih} {eskiSaat} antrenmanı {yeniTarih} {yeniSaat}
  saatine alınmıştır ({saha}). {kulup}"
- Varsayılan aidat metni: "Sayın {veli}, {oyuncu} için {ay} aidatı ({kalan}) henüz ödenmemiştir. Ödeme dönemi her ayın
  {donem} günleridir. Bilgilerinize sunarız. {kulup}"
- Mesaj tek satırlı değil; wa.me bağlantısı satır sonlarını korur (URL kodlaması).

### 13.3 Veri ve kurallar
- **Onay (KVKK):** `guardians.mesaj_onayi INTEGER NOT NULL DEFAULT 0` (şema 9). Oyuncu formu > veli satırında
  "WhatsApp ile bilgilendirme onayı" kutusu; Excel aktarımında "Mesaj onayı" sütunu (evet/hayır). Onaysız veliye düğme
  kapalı, nedeni ipucunda. Kâğıt kayıt formuna (docs/formlar/02) bir satır önerilir: "Aidat ve antrenman bilgilendirmelerinin
  WhatsApp ile yapılmasını kabul ediyorum ☐". **KARAR (Kerem, 07.09.2026):** mevcut veliler onaylı sayılır → şema 9
  göçü `mesaj_onayi=1` ile açar (sütun DEFAULT 1); yeni kayıtta kutu işaretli gelir, veli istemezse kaldırılır.
  Excel aktarımında "Mesaj onayı" sütunu boşsa evet.
- **Numara:** `whatsapp_no` doluysa o, yoksa `gsm`; `gsmNormalize` → `05XXXXXXXXX` → `90XXXXXXXXX`. Geçersizse düğme kapalı.
- **Kayıt:** `message_log(id, player_id, guardian_id, tur aidat|genel|iptal|degisiklik, yil, ay, training_id, metin,
  tarih, kullanici)` (şema 9). `trainings` tablosuna `bildirim_gerekli INTEGER DEFAULT 0` (elle iptal/değişiklikte 1,
  tüm velilere açıldığında 0) ve `degisiklik_notu TEXT` (eski tarih/saat JSON, şablon için).
  "WhatsApp'ta Aç" tıklanınca yazılır (program gönderildiğini bilemez; pencere "Hatırlatıldı" der, "Geri al" siler).
  Aynı ay aynı veliye ikinci hatırlatmada satırda "bu ay 2. kez" uyarısı. Oyuncu kartında son 12 kayıt.
- **Güvenlik:** renderer dış adres açamaz (mevcut kural); yeni IPC `app:whatsappAc(numara, metin)` yalnız
  `https://wa.me/` bağlantısı üretip `shell.openExternal` ile açar; başka adres asla. Yetki: OKUMA seti (yazma değil),
  `message_log` yazımı YAZMA seti (salt okunur lisansta hatırlatma kaydı tutulmaz ama bağlantı açılır).
- **Çoklu PC:** istemcide de çalışır; log sunucuya `/api/db` ile.

### 13.4 Teknik
- `src/lib/whatsapp.js` — SAF: `waNumara(gsm)`, `sablonDoldur(sablon, degerler)`, `waBaglanti(numara, metin)`,
  `VARSAYILAN_SABLONLAR`, `hatirlatmaUygunMu(veli)` → { ok, neden }. Vitest.
- `electron/db.cjs`: `mesajKaydet`, `sonMesajlar(pid)`, `listUnpaid` sonucuna `veli_onay`, `son_hatirlatma` alanları;
  `updateGuardian` (mesaj_onayi); `updateTraining(id, {tarih, saat, saha})` (eski değeri `degisiklik_notu`na yazar,
  yoklaması olan antrenmanda tarih değişimini reddeder); `antrenmanVelileri(training_id)` (grup aktif oyuncuları +
  birincil veli + onay + numara); `trainingCalendar` sonucuna `bildirim_gerekli`, `bildirilen`. Şema 9 göçü PRAGMA ile.
- `src/components/WhatsAppHatirlat.jsx` — toplu pencere (Modal); `Pano.jsx`, `OyuncuKarti.jsx`, `OyuncuForm.jsx`,
  `Ayarlar.jsx` (KulupAyar altına "WhatsApp Mesajları" bölümü), `OyuncuAktar` sütunu.
- `Yoklama.jsx`: kartta Düzenle (satır içi form: tarih, saat, saha) → kaydet → Onay "Velilere bildirilsin mi?";
  İptal Et sonrası aynı soru; kartta "Velilere bildirilmedi" rozeti + "Velilere bildir".
- Testler: saf whatsapp.js (şablon doldurma, eski/yeni saat); roundtrip (onay, log, updateTraining kuralları, şema 9);
  jsdom (pano düğmesi kapalı/açık, toplu pencere akışı, şablon önizleme, antrenman düzenle → bildir sorusu → pencere
  grubun velileriyle); yetki testi (`app:whatsappAc` yalnız wa.me).
- Tahmini iş: 1,5 gün (aidat hatırlatma + şablonlar + onay 1 gün; antrenman düzenle + iptal/değişiklik bildirimi
  yarım gün).

### 13.6 Uygulama notları (07.09.2026)
- Şablonlar ayrı bölüm: Ayarlar > **WhatsApp Mesajları** (Kulüp ve Makbuz altına değil; kendi tek Kaydet'i ve kaydedilmemiş
  değişiklik uyarısı var). Oyuncu kartı > Bilgiler'de "Son WhatsApp" satırı. Excel şablonuna "Mesaj Onayı" sütunu eklendi.
- Pencere kapanırken uygun velilerin hepsine açıldıysa `bildirim_gerekli` iner. ("Bildirim gerekmiyor" düğmesi kaldırıldı: geri alınamıyordu; rozet ancak bildirimle iner.)
- Gerçek uygulamada uçtan uca doğrulandı (Mac): Pano > Borçlulara Hatırlat > WhatsApp'ta Aç → `https://wa.me/905…?text=…`
  açıldı, message_log'a oturum kullanıcısıyla yazıldı.

### 13.7 Veli grubuna tek mesaj (kulüp isteği, 07.09.2026 akşam — UYGULANDI)
- İptal/değişiklik bildiriminde tek tek yerine **toplu**: bildirim penceresinin üstünde "Toplu: U11 veli WhatsApp grubuna
  tek mesaj" bloğu, **Veli Grubuna Gönder** → numarasız bağlantı (`https://wa.me/?text=…`) WhatsApp'ta "sohbet seç" ekranını
  metin hazır açar; kullanıcı kulübün veli grubunu seçip Gönder'e basar. Hitap "Sayın Veliler" (aynı şablon, {veli}=Veliler).
- Kayıt: `trainings.grup_bildirim` JSON {zaman, kullanici} (şema 10), `bildirim_gerekli` iner; kartta "Veli grubuna bildirildi".
  Gruba üye olmayan veliler için tek tek liste pencerede kalır. **Her iptal/değişiklik ayrı olaydır** (şema 11 `bildirim_olay`):
  saati değişip bildirilen antrenman sonra iptal edilirse tek tek ve toplu bildirim sıfırdan başlar. Her iki yolda da **Geri al** (tek satır: kayıt silinir; toplu:
  `grupBildirimSil` → kayıt boşalır, bildirim gereği yeniden açılır).
- Aidat hatırlatması toplu DEĞİL (kişiye özel borç bilgisi; gruba yazılmaz).
- Ön koşul (kulüp): her yaş grubunun WhatsApp'ta bir veli grubu olması.

### 13.5 Kararlar (Kerem, 07.09.2026)
- Mevcut veliler onaylı (13.3). Bildirim **yalnız birincil veliye**; oyuncunun kendi GSM'ine gönderim YOK.
- Şablon metinleri 13.2'deki varsayılanlarla başlar; kulüp Ayarlar'dan kendisi düzeltir.
- Açık kalan tek nokta: kulübün WhatsApp'ı hangi PC'de — program o PC'de kurulu olmalı ya da WhatsApp Web tarayıcıda
  açık olmalı (bağlantı tarayıcıya düşer, oradan WhatsApp'a geçer). Kurulum günü kontrol edilir (§8.2).

## 14. Yeni Bilgisayara Taşıma Paketi (UYGULANDI, 07.09.2026)

**Sorun:** data.db bu bilgisayarın safeStorage anahtarıyla şifreli; normal yedek zip'i başka PC'de açılmaz. Bilgisayar
değişince ya da bozulunca veri kurtarılamazdı.

**Çözüm:** Ayarlar > Yedekleme > "Yeni bilgisayara taşıma paketi". Kullanıcı parola girer (≥ 8 karakter, iki kez);
`eyupspor-tasima-<damga>.eyupspor` dosyası: içinde ŞİFRESİZ data.db kopyası + uploads/ + paket.json; tamamı
`electron/tasimaKripto.cjs` ile şifreli (scrypt N=2^15 → AES-256-GCM; MAGIC `EYUPTASI1` + salt + iv + tag). Parola
program dışında saklanır; unutulursa paket açılamaz (tasarım gereği).
- Düz kopya: `VACUUM INTO` (makine anahtarıyla şifreli kopya) → aynı anahtarla açıp `PRAGMA rekey=''` → düz. Kopya geçici
  klasörde, paket yazılınca silinir. (`backup()` sqlite3mc'de asılı kaldı; kullanılmadı.)
- Geri yükleme (yeni PC): paket seç → parola → özet (oyuncu/makbuz) → onay → düz data.db yeni makinenin anahtarıyla
  `PRAGMA rekey='<anahtar>'` ile şifrelenir → mevcut geri yükleme çekirdeği (`.pre-restore` kenara alma) → relaunch.
- Yalnız yönetici; istemci modunda kapalı. Roundtrip testi: oluştur/aç/yanlış parola/geri yükle/yeniden şifreli.


## 15. Yaş Grupları — Sezon alanı otomatik ve denetimli (PLANLANDI ve UYGULANDI, 09.09.2026)

**Sorun:** Yaş Grupları > Grup Ekle ve satır düzenlemedeki "Sezon" kutusu serbest metin; kullanıcı "2026", "26/27", "Eylül"
yazabiliyor. Oysa programın tek bir aktif sezon kavramı var (`settings.aktif_sezon`: ilk kurulum sihirbazı `guncelSezon` ile
doldurur, Yeni Sezon sihirbazı `yeniSezonaGec` ile ilerletir ve TÜM aktif grupların sezonunu tek seferde yazar). Grup
sezonunun elle girilmesi hem gereksiz hem hataya açık: oyuncu formundaki grup önerisi (`yasGrubuOner`) ve sezon sonu
uyarısı bu değerlere bakıyor.

### 15.1 Davranış
- **Grup Ekle:** Sezon kutusu serbest metin olmaktan çıkar; **seçim kutusu** olur ve **aktif sezonla dolu gelir**.
  Seçenekler yalnız iki tane: aktif sezon (varsayılan) ve sonraki sezon (`sonrakiSezon`). İkincisi sezon sonuna yakın,
  yeni sezonun gruplarını önceden açmak için. Aktif sezon ayarı boşsa (sihirbaz atlanmışsa) bugünün sezonu
  (`guncelSezon(bugün, sezon_baslangic_ayi)`) kullanılır.
- **Satır düzenleme:** Aynı seçim kutusu; mevcut değer iki seçenekten biri değilse (eski elle girilmiş "2026" gibi) üçüncü
  seçenek olarak gösterilir ki kayıt bozulmasın, ama yeni giriş yalnız geçerli sezonlardan yapılır.
- **Liste:** Sezon sütunu olduğu gibi; aktif sezondan farklı olan satırda soluk "(eski)" ya da "(gelecek)" notu.
- **Ana süreç (asıl koruma):** `createAgeGroup` ve `updateAgeGroup` sezonu doğrular: boş ya da `2026-2027` biçimi ve ikinci
  yıl = ilk yıl + 1 (`sezonGecerliMi` kuralı, `electron/db/gruplar.cjs` içinde saf `sezonDogrula`). Biçim bozuksa
  "Sezon 2026-2027 biçiminde olmalı" hatası. Boş değer API uyumluluğu için kabul edilir (mevcut test ve aktarım yolları).
- **Tek seferlik göç (şema 12):** `aktif_sezon` doluysa, sezonu boş olan AKTİF gruplara aktif sezon yazılır
  (`UPDATE age_groups SET sezon=? WHERE aktif=1 AND sezon=''`). Pasif gruplara ve dolu değerlere dokunulmaz.
- **İlk kurulum sihirbazı:** "Aktif sezon" kutusu zaten `guncelSezon` ile dolu ve doğrulanıyor; aynı seçim kutusuna
  çevrilir (aktif / sonraki), böylece iki ekranda aynı bileşen kullanılır.

### 15.2 Teknik
- `src/lib/sezon.js` (SAF): `sezonSecenekleri(aktifSezon, bugunIso, baslangicAyi)` → `[{ kod, ad }]` (aktif, sonraki;
  aktif boşsa bugünün sezonu). Mevcut `guncelSezon`, `sonrakiSezon`, `sezonGecerliMi` kullanılır.
- `src/components/SezonSecim.jsx` (yeni, küçük): `Secim` üzerine sarmalayıcı; `value` seçeneklerde yoksa onu üçüncü
  seçenek olarak ekler. Yaş Grupları (ekle + düzenle) ve İlk Kurulum kullanır.
- `YasGruplari.jsx`: `yeni.sezon` başlangıç değeri `aidatAyarlari().sezon` (zaten `db("aidatAyarlari")` dönüyor; ekranda
  `sezon_baslangic_ayi` için `sezonDurumu` çağrısı) → ekle sonrası kutu yine aktif sezona döner (boşa değil).
- `electron/db/gruplar.cjs`: `sezonDogrula(sezon)`; `createAgeGroup`/`updateAgeGroup` içinde. `electron/db/sema.cjs`:
  `SCHEMA_VERSION = 12`, `migrate()` içinde `cur < 12` göçü.
- Yetki/beyaz liste değişmez (yeni IPC yok).

### 15.3 Testler
- `tests/sezon.test.js`: `sezonSecenekleri` (aktif dolu / boş, sonraki sezon, başlangıç ayı).
- `tests/ui/yas-gruplari.test.jsx`: Grup Ekle sezon kutusu aktif sezonla dolu gelir; ekle sonrası yine dolu; düzenlemede
  eski "2026" değeri üçüncü seçenek olarak görünür; `createAgeGroup` çağrısı seçilen sezonla gider.
- `tests/ui/ilk-kurulum.test.jsx`: sezon seçim kutusu (mevcut test uyarlanır).
- `scripts/tests/db-roundtrip.cjs`: `createAgeGroup({ sezon: "2026" })` → hata; `"2026-2027"` → ok; boş → ok; şema 12 göçü
  boş sezonlu aktif gruba aktif sezonu yazar, pasif gruba dokunmaz; şema sürümü 12.

### 15.4 Süre ve sıra
Saf mantık + test (15 dk) → ana süreç doğrulama + göç + roundtrip (20 dk) → `SezonSecim` + Yaş Grupları + İlk Kurulum + UI
testleri (40 dk) → smoke ekran görüntüsü. Toplam ~1,5 saat. Davranış değişikliği: elle sezon yazılamaz; bu kulüp isteği.

### 15.5 Karar (Kerem, 09.09.2026)
İki seçenek (aktif + sonraki sezon) ve eski kayıt değeri üçüncü seçenek olarak: üçü de uygulandı. Henüz kullanıcı olmadığı
için geriye uyumluluk kaygısı yok; göç 12 yine de boş sezonlu aktif grupları doldurur.

## 16. Ayarlar menüsü — başlıklar altında gruplama (PLANLANDI ve UYGULANDI, 09.09.2026)

**Sorun:** Sol menüde 9 (çoklu PC açıkken 10) bölüm düz liste hâlinde; ilgisiz maddeler yan yana (Yeni Sezon → Yedekleme →
Optimizasyon → WhatsApp → Lisans). İlk Kurulum Sihirbazı ise menüde yok; Kulüp ve Makbuz bölümünün altında bir düğme.

### 16.1 Yeni düzen (menü, üstten alta)

```
KULÜP
  ▪ Kulüp ve Makbuz
  ▪ Aidat Kalemleri
  ▪ WhatsApp Mesajları
SEZON VE VERİ
  ▪ Yeni Sezon
  ▪ Yedekleme
  ▪ Resim ve Belge Optimizasyonu
KULLANICILAR VE ERİŞİM
  ▪ Kullanıcılar
  ▪ Sunucu / Çoklu PC        (yalnız COKLU_PC_ACIK)
UYGULAMA
  ▪ İlk Kurulum Sihirbazı    (yeni: menü öğesi, bölüm açmaz, sihirbaz penceresini açar)
  ▪ Lisans
  ▪ Hakkında
```

- Grup başlıkları tıklanmaz; küçük, büyük harfli, soluk etiket (ekrandaki "ÖNİZLEME", "OTOMATİK YEDEKLEME SIKLIĞI" etiketleriyle
  aynı stil). Gruplar arasında 10 px boşluk; ilk grubun üstünde etiket yok kabul edilmez, hepsi etiketli.
- **İlk Kurulum Sihirbazı** menüde öğe olur: tıklanınca `onKurulumAc()` çağrılır, seçili bölüm değişmez (sihirbaz kapanınca
  kullanıcı kaldığı bölümde). Kulüp ve Makbuz'daki "Kurulum Sihirbazını Aç" düğmesi kaldırılır (tek giriş noktası). Yalnız
  yönetici görür (zaten Ayarlar'ı yalnız yönetici görüyor; `admin` şartı yine de kalır).
- Bölüm kodları (`kulup`, `kalem`, `whatsapp`, `sezon`, `yedek`, `optimize`, `kullanici`, `sunucu`, `lisans`, `hakkinda`) ve
  `baslangicBolum` prop'u değişmez; App.jsx'teki "Lisans'a git" gibi yönlendirmeler çalışmaya devam eder. Varsayılan bölüm
  yine Kulüp ve Makbuz.
- Kaydedilmemiş değişiklik uyarısı (`onKirli`) sihirbaz öğesi için de geçerli: kirli bölümden sihirbaza geçerken önce onay.

### 16.2 Teknik
- `Ayarlar.jsx`: `BOLUMLER` düz dizi yerine `GRUPLAR = [{ baslik, bolumler: [...] }]`; render iki seviyeli. Öğe tipi:
  `{ kod, ad, ikon }` bölüm ya da `{ kod: "sihirbaz", ad, ikon, eylem: "kurulum" }`. `bolumeGit` eylemli öğede bölüm
  değiştirmez, kirli kontrolünden sonra `onKurulumAc()` çağırır.
- `KulupAyar.jsx`: sihirbaz düğmesi ve `onKurulumAc` prop'u kalkar.
- İkon: sihirbaz için mevcut set içinden `takvim` yerine daha uygun olanı (`yildiz` yoksa `dosya`); yeni ikon çizilmez.
- `docs/kurulum.md`: "Ayarlar > Kulüp ve Makbuz > Kurulum Sihirbazını Aç" → "Ayarlar > Uygulama > İlk Kurulum Sihirbazı".

### 16.3 Testler
- `tests/ui/ayarlar-menu.test.jsx` (yeni): dört grup başlığı görünür; öğeler doğru grupta ve sırada; "İlk Kurulum Sihirbazı"
  tıklanınca `onKurulumAc` çağrılır ve seçili bölüm değişmez; kirli bölümdeyken sihirbaz tıklanınca onay çıkar;
  `baslangicBolum="lisans"` ile Lisans açılır.
- Mevcut Ayarlar testleri (aidat-ayar, sezon, yedek-siklik, whatsapp, guncelleme, kurtarma, ozellikler) bölüm adlarını
  aradığı için değişmez; `ozellikler.test.jsx` Sunucu öğesinin bayrakla görünürlüğünü zaten kontrol ediyor.
- Smoke ekran görüntüsü: menüde grup başlıkları.

### 16.4 Süre
~45 dk (menü + sihirbaz öğesi 20, test 15, belge/smoke 10). Davranış değişikliği yalnız sihirbazın giriş yeri.

### 16.5 Karar bekleyen
- Grup adları ve dağılım yukarıdaki gibi mi? Alternatif: WhatsApp Mesajları "SEZON VE VERİ" yerine "KULÜP" altında (öneri:
  KULÜP, çünkü şablon metinleri kulübün dili). "Yedekleme" ve "Optimizasyon" için "VERİ" yeterli olabilir; "SEZON VE VERİ"
  tek kelimeye inebilir ("VERİ").

## 17. Sezon sonrası düzeltmeler — 09.09.2026 istekleri (PLANLANDI ve UYGULANDI)

Kerem'in yeni sezona geçiş denemesinden sonra bildirdiği beş madde. 1 ve 3 net, hemen uygulandı; 2, 4, 5 için karar §17.6.

### 17.1 Yaş Grupları: durum ve varsayılan liste (UYGULANDI)
- Liste varsayılan olarak yalnız **aktif** grupları gösterir; pasif grup varsa üstte "Pasif grupları da göster (n)" onay
  kutusu (kapalı gelir). Grupta hiç oyuncu olmasa da aktifse görünür (oyuncu sayısı listeye etki etmez).
- Durum sütunundaki rozet tıklanabilir: Aktif ↔ Pasif tek tıkla (`updateAgeGroup { aktif }`), Düzenle'ye girmeden. Salt
  okunurda tıklanmaz. Düzenle satırındaki "Aktif" kutusu da kalır.
- Pasif grup: yeni oyuncu kaydında seçilemez (mevcut davranış), yoklama takviminde antrenman açılmaz (mevcut).

### 17.2 Tahsilat ve makbuz numarası sezona bağlı (UYGULANDI — şema 14, `electron/makbuzNo.cjs`)
Bugünkü durum: makbuz numarası takvim yılına göre (`2026-0001`); "Bugün Kesilen Makbuzlar" tarihe göre. Sezon geçişi
makbuzu etkilemiyor; aynı gün eski sezonda kesilen makbuzlar listede kalıyor, yeni sezonda kesilen makbuz 2026 önekini alıyor.
Öneri:
- `receipts.sezon` sütunu (şema 14): makbuz kesilirken `aktif_sezon` damgalanır; göç mevcut makbuzlara tarihlerinden
  sezon yazar (`sezon_baslangic_ayi` ile).
- Makbuz numarası **sezon başlangıç yılı** ile başlar: sezon 2027-2028'de ilk makbuz `2027-0001`. Sayaç sezon içinde artar.
  Not: sezon ortasında Ocak'ta yıl değişince numara yine 2027 ile devam eder (sezon numarası, takvim yılı değil).
- "Bugün Kesilen Makbuzlar" yalnız aktif sezonun makbuzlarını gösterir; tahsilat raporu tarih aralığı + sezon süzer.
- Makbuz şablonunda "Sezon: 2027-2028" satırı (küçük, tarih yanında).

### 17.3 Yoklama formu: sonda boş satır yok (UYGULANDI)
`EK_BOS_SATIR` 3 → 0. Elle eklenecek oyuncu için kâğıtta yer istenirse ileride ayar yapılır.

### 17.4 Yeni sezona geçince yenileyenlerin ilk ay borcu (UYGULANDI — `yeniSezonaGec` sonucu `ilkAyBorcu`, `ilkAy`)
Bugünkü durum: aidat kayıtları yalnız içinde bulunulan takvim ayı için açılıyor. Eylül 2026'da 2027-2028'e geçilince
2027 Eylül borcu açılmıyor; o ay gelince açılacak. Öneri: `yeniSezonaGec` yenileyen oyuncular için yeni sezonun **ilk
ayının** (başlangıç ayı, sezonun ilk yılı) aidat kaydını hemen açar (`ensureMonthlyDues(yil, ay, pid)`; muaf kuralları
aynı). Böylece sezon bazlı raporda (§17.5) yeni sezon borçluları hemen görünür; makbuzda o dönem seçilebilir. Sonraki
aylar yine kendi ayında açılır.

### 17.5 Raporlar: yıl yerine sezon, ay kalır (UYGULANDI — `db.sezonListesi`, `playersWhere.sezon`, `sezonAyYili`)
- Aylık raporlarda (Oyuncu Listesi, Borçlu Listesi) "Yıl" kutusu yerine **Sezon** kutusu (SezonSecim + geçmiş sezonlar:
  oyuncu/grup kayıtlarındaki ayrık sezonlar); ay seçimi kalır. Yıl sezondan türetilir: başlangıç ayı ve sonrası → ilk yıl,
  öncesi → ikinci yıl (Eylül 2027-2028 → 2027, Ocak → 2028).
- Oyuncu Listesi sezonun oyuncularını süzer (`players.sezon = seçilen`); "Yaş grubu: Tümü" artık eski sezon oyuncularını
  getirmez. `listPlayersWithDue`/`playersWhere` `sezon` parametresi.
- Borçlu Listesi: türetilen yıl+ay ile `listUnpaid` (aynı). Tahsilat/Yoklama tarih aralığıyla kalır; Sağlık bugün.
- Excel/PDF alt başlığında "Eylül · 2027-2028 sezonu".

### 17.6 Kararlar (Kerem, 09.09.2026: "sırayla uygula")
1. Makbuz numarası sezon başlangıç yılıyla (2027-0001). Tahsilat raporu tarih aralığıyla kaldı (sezon süzgeci yok; makbuz
   satırında sezon damgası var).
2. Sezon geçişinde ilk ay borcu hemen açılır (muaf kuralları aynı; yenilemeyene açılmaz).
3. Aylık raporlarda sezon + ay; sezon listesi oyuncu/grup/makbuz kayıtlarından.

## 18. Oyuncular — sezon filtresi (UYGULANDI, 09.09.2026)
- Filtre kartında ilk kutu **Sezon**: aktif sezon seçili gelir ("… (aktif sezon)"), kayıtlardaki eski sezonlar ve "Tüm sezonlar"
  seçilebilir; sonra yaş grubu, durum ve düğmeler. Sezon seçilince yalnız o sezonun oyuncuları (`players.sezon`) listelenir;
  Excel/PDF aynı filtreyle, PDF alt başlığında sezon.
- Arama kutusu üst satıra, sola alındı; İçe Aktar / Excel / PDF / Yeni Oyuncu aynı satırda sağda.
- Ana süreç: `createPlayer` sezon verilmezse `aktif_sezon` damgalar (form ve Excel aktarımı); göç 15 sezonu boş olan
  aktif/deneme/sakat oyunculara aktif sezonu yazar (pasif/ayrılmışlar boş kalır, "Tüm sezonlar"da görünür).
- Test: `tests/ui/oyuncular-sezon.test.jsx`, `db-roundtrip` (varsayılan sezon, göç 15).

### 18.1 Geçmiş sezon üyeliği (UYGULANDI, 09.09.2026)
Sorun: sezon geçişinde yenileyenlerin `players.sezon`'u yeni sezona yazılınca geçmiş sezon seçildiğinde kimse gelmiyordu
(yenileyenler yeni sezonda, yenilemeyenler pasif ve durum süzgecinde gizli). Çözüm: `player_seasons(player_id, sezon)` tablosu
(şema 16): kayıt, sezon değişikliği ve sezon geçişinde satır eklenir, silinmez. Sezon süzgeci `players.sezon` VEYA bu tabloya
bakar. Göç 16 mevcut veriden türetir: `players.sezon` + aidat kayıtlarının ait olduğu sezonlar (o ayda sahadaydı) + makbuz
sezonları. Arayüz: aktif sezon dışında bir seçimde (geçmiş sezon ya da "Tüm sezonlar") durum süzgeci kendiliğinden
"Tüm durumlar", aktif sezona dönünce "Aktif, deneme ve sakat".


## 19. Raporlar — sezon + ay (Tümü) süzgeci, dört raporda (PLANLANDI ve UYGULANDI, 09.09.2026)

**İstek:** Oyuncu Listesi ve Borçlu Listesi'nde "Ay: Tümü" seçeneği; eski sezon oyuncuları gelsin. Yoklama Özeti ve Sağlık
Raporu Durumu'nda da sezon + ay seçimi.

**Not — "eski sezon oyuncuları gelmiyor":** Oyuncu Listesi, Oyuncular ekranıyla aynı süzgeci (`playersWhere.sezon`) kullanır;
§18.1 (e783cae) ile bu süzgeç `player_seasons` tablosuna bakmaya başladı, dolayısıyla geçmiş sezon artık geliyor. Borçlu
Listesi ise `listUnpaid(yil, ay)` ile yalnız aya bakıyor, sezon süzgeci yok → aşağıda düzeltilir.

### 19.1 Ortak süzgeç: Sezon + Ay
- Dört raporda aynı iki kutu: **Sezon** (aktif sezon seçili; kayıtlardaki eski sezonlar) ve **Ay** (sezon ayları başlangıç
  ayından itibaren sıralı: Eylül … Ağustos; en üstte **Tümü**). Tahsilat Raporu tarih aralığıyla kalır.
- Saf yardımcılar (`src/lib/sezon.js`): `sezonAylari(sezon, baslangicAyi)` → `[{ yil, ay, ad }]` sıralı;
  `sezonAraligi(sezon, baslangicAyi)` → `{ from, to }` (1 Eylül – 31 Ağustos); mevcut `sezonAyYili` ay → yıl için.
- Bileşen `src/components/SezonAySecim.jsx`: iki kutu + değer `{ sezon, ay }` (ay `null` = Tümü). Raporlar'da tek yerden.
- Oyuncu kümesi her raporda **o sezonun oyuncuları** (`player_seasons` VEYA `players.sezon`); durum süzgeci yok (geçmiş
  sezonun oyuncusu bugün pasif olabilir). Yaş grubu süzgeci aynen kalır.

### 19.2 Oyuncu Listesi
- Ay seçiliyse bugünkü gibi: "Eylül aidatı" sütunu (ödendi/ödenmedi/kısmi/muaf/kayıt yok).
- **Ay: Tümü** → sütun "Sezon aidatı": `ödenen/açılan ay` + borç tutarı (örn. "3/4 ay · 3.500 ₺ borç"; muaf oyuncuda "Muaf").
  Veri: `db.sezonAidatOzeti(sezon, baslangicAyi)` → oyuncu başına `{ acilan, odenen, kismi, odenmedi, muaf, borc }`
  (sezon aylarındaki `monthly_dues` toplanır). Excel'de üç ayrı sütun: Açılan ay, Ödenen ay, Borç.

### 19.3 Borçlu Listesi
- Ay seçiliyse `listUnpaid(yil, ay, sezon)`: sezon süzgeci eklenir (oyuncu o sezonda mı).
- **Ay: Tümü** → `db.listUnpaidSezon(sezon, baslangicAyi)`: oyuncu başına tek satır — borçlu aylar ("Eyl, Eki, Kas"), toplam
  kalan, veli, telefon. Alt başlık: "2026-2027 sezonu · 12 oyuncu · toplam 41.500 ₺". WhatsApp hatırlatma bu rapora bağlı
  değil (Pano'daki borçlular aylık kalır).

### 19.4 Yoklama Özeti
- Tarih aralığı kutuları yerine Sezon + Ay; aralık türetilir: ay seçiliyse o ay, Tümü ise sezon aralığı.
  `attendanceReport(from, to, age_group_id, sezon)`: oyuncu kümesi `player_seasons` ile (bugünkü `p.durum IN (aktif…)`
  şartı kalkar; sezon verilmezse eski davranış). Katılım yüzdesi aynı.
- İleride istenirse "Tarih aralığı" ek seçenek olarak geri konabilir; bu turda kaldırılıyor (istek: sezon + ay).

### 19.5 Sağlık Raporu Durumu
- Sezon: oyuncu kümesi (o sezonun oyuncuları). Ay: **Tümü** = bugün itibarıyla (mevcut davranış); belirli ay = **o ayın son
  günü itibarıyla** geçerlilik (süresi dolacak/dolmuş hesabı o tarihe göre; "30 gün içinde dolacak" eşiği aynı). Böylece
  "Ekim sonunda kimin raporu dolmuş olacak" görülür. `saglikRaporuListesi(tarih, age_group_id, esik, sezon)`.

### 19.6 Teknik ve test
- DB: `sezonAidatOzeti`, `listUnpaidSezon` (aidat.cjs); `attendanceReport` ve `saglikSatirlari` sezon parametresi; `listUnpaid`
  sezon parametresi. Hepsi OKUMA kümesinde (`yetki.cjs`), db.cjs export. Yeni tablo yok.
- Saf: `src/lib/raporlar.js` üreticileri "Tümü" biçimini alır (`oyuncuListesiRaporu({ ay: null, ozet })`,
  `borcluListesiRaporu({ ay: null })`, yoklama/sağlık alt başlıkları sezon + ay).
- Testler: `tests/sezon.test.js` (sezonAylari, sezonAraligi), `tests/raporlar.test.js` (Tümü biçimleri), `tests/ui/raporlar-sezon.test.jsx`
  (dört raporda Sezon + Ay kutuları, Tümü çağrıları), `db-roundtrip` (sezonAidatOzeti, listUnpaidSezon, attendanceReport sezon
  kümesi, sağlık raporu tarih referansı).
- Süre ~2 saat: saf + DB (45 dk), bileşen + Raporlar (45 dk), testler (30 dk).

### 19.7 Kararlar (Kerem, 09.09.2026)
1. Oyuncu Listesi "Tümü": ekranda tek sütun ("3/4 ay · 3.500 ₺ borç"), Excel/PDF'de üç sütun (`disaSutunlar`).
2. Sağlık raporunda ay = o ayın son günü itibarıyla; rapora geçince Ay "Tümü" (bugün) gelir.
3. Yoklama Özeti: "Dönem seçimi" kutusu — "Sezon ve ay" (varsayılan) ya da "Tarih aralığı" (eski davranış, sahadaki oyuncular).

## 20. Raporlar — tek filtre çubuğu, sekmeli rapor seçimi (PLANLANDI, 09.09.2026)

**Sorun:** Sol sütunda beş büyük rapor kartı + altında filtreler; filtreler kartların altında kaldığı için ekranda görünmüyor,
kaydırmak gerekiyor. Her raporda farklı bir filtre bloğu çıkıyor; tablo dar alana sıkışıyor (320 px sol sütun).

### 20.1 Yeni düzen
- Sol sütun kalkar. Üstte **rapor sekmeleri** (tek satır, yatay): Oyuncu Listesi · Borçlu Listesi · Tahsilat · Yoklama Özeti ·
  Sağlık Raporu. Seçili sekme mor; açıklama metni sekmenin altında tek satır, soluk.
- Altında **tek filtre çubuğu** (bir kart, tek satır, sarmalanır). Kutular sabit sırada; seçili raporda anlamsız olanlar
  **gizlenir** (boş yer bırakmaz): `Sezon · Ay · Yaş grubu · Dönem seçimi · Başlangıç · Bitiş` + sağda `Önizle · Excel · PDF`.
  Seçimler raporlar arasında **korunur** (Sezon/Ay/Yaş grubu bir kez seçilir, sekme değişince aynı kalır).
- Tablo tam genişlikte, altında sayfalama. Alt başlık (dönem, sayılar) tablonun üstünde kalır.
- Sekme değişince önizleme temizlenmez; filtre değişince "Önizle" düğmesi vurgulanır ("Değişti, yeniden önizle").

### 20.2 Mock-up (1440 px)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Raporlar                                                                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Oyuncu Listesi ] [ Borçlu Listesi ] [ Tahsilat Raporu ] [ Yoklama Özeti ] [ Sağlık Raporu Durumu ] │
│   Tüm oyuncular, grup, durum, ücret tipi ve seçilen ayın aidat durumu                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SEZON              AY               YAŞ GRUBU                              [ Önizle ] [Excel] [PDF]  │
│ [2026-2027 (aktif)▾] [Eylül 2026  ▾] [Tümü        ▾]                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Oyuncu Listesi                                                                                       │
│ Eylül 2026 · 2026-2027 sezonu · 5 oyuncu                                                             │
│ AD SOYAD        TC / PASAPORT   DOĞUM       GRUP  DURUM   ÜCRET TİPİ      AİDAT     AİDAT DURUMU  GSM│
│ Ela Demir       10000000003     21.06.2017  U11   Deneme  Kardeş İndirimi 3.000 ₺   Ödenmedi         │
│ …                                                                                                    │
│                                                        ‹ 1 / 1 ›  5 satır                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

Sekme: Tahsilat Raporu → filtre çubuğu:
│ BAŞLANGIÇ      BİTİŞ                                                          [ Önizle ] [Excel] [PDF]│
│ [01.09.2026]   [30.09.2026]                                                                          │

Sekme: Yoklama Özeti → filtre çubuğu:
│ DÖNEM SEÇİMİ     SEZON              AY            YAŞ GRUBU                   [ Önizle ] [Excel] [PDF]│
│ [Sezon ve ay ▾]  [2026-2027 (aktif)▾] [Tümü     ▾] [Tümü      ▾]                                     │
│  (Tarih aralığı seçilince Sezon/Ay yerine Başlangıç/Bitiş)                                           │

Sekme: Sağlık Raporu Durumu → filtre çubuğu:
│ SEZON              AY            YAŞ GRUBU        ⓘ Bugüne göre; ay seçilince ayın son günü          │
│ [2026-2027 (aktif)▾] [Tümü     ▾] [Tümü      ▾]                               [ Önizle ] [Excel] [PDF]│
```

### 20.3 Rapor → görünen filtreler
| Rapor | Sezon | Ay | Yaş grubu | Dönem seçimi | Başlangıç/Bitiş |
|-------|:-----:|:--:|:---------:|:------------:|:---------------:|
| Oyuncu Listesi | ✓ | ✓ (Tümü) | ✓ | – | – |
| Borçlu Listesi | ✓ | ✓ (Tümü) | – | – | – |
| Tahsilat Raporu | – | – | – | – | ✓ |
| Yoklama Özeti | ✓* | ✓* | ✓ | ✓ | ✓* (*seçime göre) |
| Sağlık Raporu | ✓ | ✓ (Tümü, varsayılan) | ✓ | – | – |

### 20.4 Teknik
- `Raporlar.jsx`: sol `Kart` kalkar; üstte `Sekmeler` (ui.jsx'teki mevcut bileşen, oyuncu kartında kullanılan) ile rapor
  seçimi; `RAPOR_FILTRELERI[kod]` = görünen kutu listesi (saf, `src/lib/raporlar.js`'e taşınır, test edilir). Filtre
  durumu tek nesnede (`{ sezon, ay, grup, mod, from, to }`), sekme değişince korunur; yalnız Sağlık'a geçişte `ay` Tümü.
- Filtre çubuğu ayrı bileşen `src/components/RaporFiltre.jsx` (SezonAySecim'i içine alır). Rapor üreticileri ve DB sorguları
  değişmez.
- "Değişti, yeniden önizle" için `kirli` bayrağı: filtre değişince `true`, Önizle'de `false`; Excel/PDF her zaman güncel
  filtreyle üretir (bugünkü gibi).
- Testler: `tests/raporlar.test.js` (RAPOR_FILTRELERI), `tests/ui/raporlar-sezon.test.jsx` ve `sayfalama.test.jsx` sekmeye
  uyarlanır (rapor seçimi `getByRole("tab")`), yeni: filtrelerin sekmeye göre gizlenmesi ve seçimlerin korunması; smoke
  ekran görüntüsü.
- Süre ~1,5 saat.

### 20.5 Karar bekleyen
1. Sekmeler yatay tek satır (5 sekme, geniş ekranda sığar; dar pencerede ikinci satıra sarar) — uygun mu?
2. Sekme değişince önizleme kalsın mı (öneri: kalsın, "yeniden önizle" uyarısıyla), yoksa temizlensin mi?
