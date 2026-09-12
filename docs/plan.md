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
ASLA olmaz (gitignore + gitleaks). Altyapı hazır (build.publish → `keremgenisel/futbolokulukayit`, release.yml GITHUB_TOKEN ile
yayınlar, publish-release.cjs depo özelse durur, Ayarlar > Hakkında > Uygulama güncellemesi akışı). Sıra:

Sıra bağımlılığa göredir (08.09.2026): her adım bir sonrakinin ön koşulu. 1–4 hesap ve depo işi (~yarım saat), 5–8 yayın
(~bir saat), 9 kulüp ziyareti, 10 bütçe kararı.

| # | İş | Nasıl | Neden bu sırada | Durum |
|---|----|-------|-----------------|-------|
| 1 | Lisans özel anahtarlarını yedekle | `scripts/keys/lisans-private.pem` ve `lisans-lease-private.pem` dosyalarını şifreli USB veya parola yöneticisine kopyala. | Sonraki her adım bu anahtarlara dayanır; kaybı geri alınamaz, dağıtılan tüm lisanslar geçersiz olur. | **Yapıldı** (Kerem, 10.09.2026) |
| 2 | GitHub hesabında 2FA aç (güvenlik #9) | github.com > Settings > Password and authentication. | Herkese açık depo ve otomatik güncelleme bu hesabın güvenliğine dayanır; önce hesap, sonra depo. | **Yapıldı** (Kerem, 10.09.2026) |
| 3 | Depoyu HERKESE AÇIK oluştur ve push et | `gh repo create keremgenisel/eyupspor --public --source . --remote origin --push` | Etiket kuralı ve sürüm yayını depo olmadan yapılamaz. | **Yapıldı 10.09.2026** — sonra `keremgenisel/futbolokulukayit`'e yeniden adlandırıldı (Kerem: "eyupspor olarak değil"); `gh repo rename`, yerel `origin` ve kod içi referanslar güncellendi. Push sırasında `GH_TOKEN`'ın `workflow` kapsamı yoktu, kayıtlı ikinci token (`workflow` dahil) kullanıldı. |
| 4 | Korumalı etiket kuralı ekle (güvenlik #9) | Depoda Settings > Tags > "Protected tags", desen `v*` (yalnız sen etiket atabilirsin). | İlk etiket atılmadan önce; yayın kanalı ilk günden korunur. | **Yapıldı 10.09.2026** — klasik "tag protection" API'si kaldırılmış (404); yerine Rulesets API ile `refs/tags/v*` için `creation`/`update`/`deletion` kısıtlı ruleset oluşturuldu, bypass rolü `admin` (`current_user_can_bypass: "always"` — yalnız sen etiket atabilirsin, doğrulandı). GitHub'da Settings > Rules > Rulesets'te görünür. |
| 5 | Wrangler'ı 4.x'e yükselt | `aktivasyon-sunucu` içinde `npm install --save-dev wrangler@4` (3.x uyarı veriyor). | Deploy'u temiz araçla yapmak için, deploy'dan hemen önce. | **Yapıldı 10.09.2026** — 4.130.0, `wrangler deploy --dry-run` ile yeni `wrangler.toml` adları (`futbol-okulu-lisans`) doğrulandı. |
| 6 | Aktivasyon sunucusunu deploy et | `cd aktivasyon-sunucu && npx wrangler login && ./deploy.sh`. Çıkan adresi `electron/aktivasyonIstemci.cjs` → `AKTIVASYON_URL` alanına yaz, commit et. | `--aktivasyon` bayraklı lisans bu sunucuya bağlanır; adres uygulamaya gömülü olduğu için ilk sürümden ÖNCE commit'te olmalı. | **Yapıldı 10.09.2026** — `https://futbol-okulu-aktivasyon.keremgenisel.workers.dev` deploy edildi (D1 `futbol-okulu-lisans`, 3 secret yüklendi); `/saglik` ve `lisans-yonet.cjs tumu` ile uçtan uca doğrulandı; `AKTIVASYON_URL` gömüldü. |
| 7 | Kulübe lisans anahtarı üret | `node scripts/lisans-uret.cjs --firma "Eyüpspor Kulübü" --bitis <sözleşme bitişi> --aktivasyon` ve `node scripts/lisans-yonet.cjs kaydet --anahtar "…" --kurulum 2`. Aktivasyon sunucusu yoksa `--aktivasyon` bayrağını KOYMA. | Sunucu ayakta olunca; kurulum sayısı sınırı burada tanımlanır. | **Yapıldı 10.09.2026** (Kerem: "süresiz 5 kullanıcı 1 kurulum") — `--firma "Eyüpspor Kulübü" --suresiz --kullanici 5 --aktivasyon`, sunucuya `--kurulum 1` ile kaydedildi, `liste`/`tumu` ile doğrulandı. Anahtarın kendisi güvenlik nedeniyle buraya yazılmadı, yalnız oturum geçmişinde. |
| 8 | İlk sürümü yayınla | `package.json` version `1.0.0`, commit, `git tag v1.0.0 && git push --follow-tags` → GitHub Actions ~10 dk → Release v1.0.0 (.exe + latest.yml). Kontrol: `gh release view v1.0.0 --repo keremgenisel/futbolokulukayit`. | Aktivasyon adresi gömülü ve etiketler korumalı olduktan sonra. | **Yapıldı 10.09.2026** — `release.yml`'in çağırdığı `npm run release` script'i package.json'da hiç tanımlı değildi (eklendi + regresyon testi); `v1.0.0` etiketi push edildi, CI 2m7s'de derleyip yayınladı, `latest.yml`/`.exe`/`.blockmap` doğrulandı. |
| 9 | Kulüp bilgisayarında kurulum ve Windows doğrulamaları | §8.2 kurulum adımları + gerçek yazıcı testi (makbuz, kağıt boyutu, kenar boşlukları) + güvenlik raporundaki doğrulanamayan 4 maddeden kalan 2'si (GitHub 2FA ✅ ve korumalı etiket ✅ 10.09.2026'da doğrulandı — bkz. `docs/guvenlik-inceleme.md`): WAL dosyası (`data.db-wal`) şifreli mi, yazdırma penceresinden `file://` erişimi engelli mi. | Kurulum dosyası hazır olunca tek ziyarette. | Bekliyor |
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

### 16.5 Karar bekleyen — KAPANDI 10.09.2026 (uygulanan gruplama: WhatsApp Mesajları KULÜP altında; SEZON VE VERİ adı kaldı)
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

## 20. Raporlar — tek filtre çubuğu, sekmeli rapor seçimi (PLANLANDI ve UYGULANDI, 09.09.2026)

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

### 20.5 Uygulama notu (09.09.2026)
Sekmeler yatay tek satır (`Sekmeler` bileşeni); sekme değişince önizleme kalır, Önizle düğmesi sarıya döner ve yanında
"Filtre değişti" notu çıkar (düğme metni sabit "Önizle": testler ve smoke buna bağlı). Filtre çubuğu `RaporFiltre.jsx`,
görünürlük tablosu saf `raporFiltreleri()`.

### 20.6 Değişiklik (Kerem, 09.09.2026 — "bütün filtreler Yoklama Özeti'ndeki gibi olsun")
Rapora göre gizlenen kutular kafa karıştırdı; artık **her sekmede aynı filtreler**: Dönem seçimi ("Sezon ve ay" | "Tarih
aralığı"), ona göre Sezon + Ay (Tümü) ya da Başlangıç + Bitiş, ve Yaş grubu. Hiçbir kutu gizlenmez; seçimler (mod dahil)
sekmeler arasında korunur. Her rapor iki modu da destekler:
- Oyuncu Listesi: tarih modunda oyuncu kümesi sezona bağlanmaz; aralıktaki ayların aidat özeti ("Dönem aidatı").
- Borçlu Listesi: tarih modunda aralıktaki ayların borçluları (`listUnpaidAralik`); yaş grubu süzer.
- Tahsilat: sezon modunda ay → o ay, Tümü → sezon aralığı; yaş grubu süzer (oyuncusunun grubu).
- Yoklama Özeti: eskisi gibi.
- Sağlık Raporu: tarih modunda bitiş tarihi itibarıyla.
DB: `aidatOzeti(bas, son)`, `listUnpaidAralik(bas, son, sezon, grup)`; `listUnpaid`, `listReceiptsByDate`, `listCancelledReceipts`
yaş grubu parametresi. Saf `raporFiltreleri` her rapor için aynı listeyi döner; `tarihAyAraligi`.

### 20.7 Düzen (Kerem, 09.09.2026 — "tasarımı eski hâline döndür, filtreler yukarıda kalsın")
Sekmeler kaldırıldı; rapor seçimi yine sol sütundaki büyük kartlarla (ad + açıklama). Tek filtre çubuğu en üstte, tam
genişlikte; altında sol kartlar + sağda tablo. Filtre davranışı §20.6 ile aynı.

### 20.8 Tarih aralığı modunda oyuncu kümesi (Kerem, 09.09.2026)
Tarih aralığı seçilince Yoklama Özeti ve Sağlık Raporu **tüm oyuncuları** kapsar (durum ve sezon süzgeci yok; pasif/ayrılmış
dahil): `attendanceReport(..., herkes=true)`, `saglikRaporuListesi(..., herkes=true)`. Oyuncu ve Borçlu listeleri tarih modunda
zaten sezonsuzdu. Sezon modunda davranış aynı (o sezonun oyuncuları). Ayrıca Yoklama Özeti'nde aralık dışı antrenmanların
yoklamasının sayılması hatası düzeltildi (t.id IS NOT NULL).


## 21. Yaş Grupları — sezon filtresi (PLANLANDI ve UYGULANDI, 09.09.2026)

**İstek:** Yaş Grupları ekranında sezon seçilince o sezonun grupları gelsin.

**Bugünkü durum:** Her grubun tek bir `sezon` alanı var; sezon geçişinde (`yeniSezonaGec`) aktif grupların hepsi yeni
sezona yazılıyor. Yani "geçen sezon hangi gruplar vardı" bilgisi tutulmuyor — oyuncularda §18.1 ile çözülen sorunun aynısı.
Ekranda sezon süzgeci yok; liste aktif grupları (isteğe bağlı pasifleri) gösteriyor.

### 21.1 Davranış
- Listenin üstünde **Sezon** kutusu (Oyuncular'daki gibi): aktif sezon seçili gelir ("… (aktif sezon)"), kayıtlardaki eski
  sezonlar seçilebilir. Seçilince yalnız **o sezonda var olan** gruplar listelenir. ~~"Tüm sezonlar"~~ seçeneği 09.09.2026'da
  kaldırıldı (Kerem: "tüm sezonlar seçeneğini kaldır").
- Her sezonda aynı davranış: aktif gruplar + "Pasif grupları da göster (n)" kutusu (09.09.2026: eski sezonda pasiflerin
  kendiliğinden görünmesi kaldırıldı; Kerem: "eski sezona alınca pasifler gözüküyor").
- "Grup Ekle" formu değişmez (sezon kutusu aktif/sonraki sezon); grup eklenince liste seçili sezona göre yenilenir.
- Sezon sütunu ve "(eski)/(gelecek)" notu kalır.

### 21.2 Veri: geçmiş sezon üyeliği
- Yeni tablo `group_seasons(group_id, sezon)` (şema 17), `player_seasons`'ın grup karşılığı. Satır eklenir: grup
  oluşturulunca (sezonuyla), grubun sezonu düzenlenince, sezon geçişinde aktif gruplar yeni sezona alınınca. Silinmez.
- Göç 17 mevcut veriden türetir: `age_groups.sezon` + grubun **antrenman tarihlerinin** düştüğü sezonlar (o sezonda
  antrenman yaptıysa vardı; `sezon_baslangic_ayi` ile) + `player_seasons` × o sezondaki oyuncuların grubu (yaklaşık; oyuncu
  grubu güncel olduğundan yalnız aktif sezon için güvenilir, göçte yalnız aktif sezon için kullanılır).
- Süzgeç: `listAgeGroups({ sezon })` → `sezon` verilirse `age_groups.sezon = ? OR EXISTS(group_seasons)`; verilmezse hepsi
  (mevcut çağrılar değişmez). `sezonListesi` gruplar tablosunu zaten kapsıyor.

### 21.3 Diğer ekranlar (isteğe bağlı, bu turda önerilir)
- Oyuncular ve Raporlar'daki "Yaş grubu" kutusu seçili sezonun gruplarını listeler (`listAgeGroups({ sezon })`); "Tüm
  sezonlar"da hepsi. Böylece eski sezonun grubu yeni sezon listesinde görünmez.
- Oyuncu formundaki grup seçimi aktif sezonun aktif grupları (bugünkü gibi).

### 21.4 Teknik ve test
- `electron/db/gruplar.cjs`: `grupSezonUyeligiEkle`, `listAgeGroups({ sezon, aktif })`; `sezon.cjs` geçişte üyelik; `sema.cjs`
  şema 17 + göç. `yetki.cjs`/`db.cjs` export listesi değişmez (aynı ad, isteğe bağlı parametre).
- `YasGruplari.jsx`: `SezonSecim` benzeri süzgeç (aktif/eski/tümü; `sezonSecenekleri` + `sezonListesi`), `pasifGoster`
  yalnız aktif sezonda.
- Testler: `db-roundtrip` (üyelik satırları, göç 17 antrenmanlardan türetme, süzgeç), `tests/ui/yas-gruplari.test.jsx`
  (sezon kutusu, eski sezon → pasif dahil, tüm sezonlar), `kalicilik` (üyelik kalıcı), isteğe bağlı §21.3 için
  `oyuncular-sezon`/`raporlar-sezon` testleri.
- Süre ~1 saat (+30 dk §21.3).

### 21.5 Kararlar (Kerem, 09.09.2026: "uygula")
1. §21.3 yapıldı: Oyuncular'da seçili sezonun grupları ("Tüm sezonlar"da hepsi); Raporlar'da sezon modunda seçili sezonun,
   tarih modunda tüm gruplar.
2. Göç 17 antrenman tarihlerinden türetir (grup sezonu + antrenman ayları). Antrenmanı olmayan eski grup için grubun sezon
   alanı düzenlenince üyelik eklenir.

## 22. Sayfalama envanteri ve dört düzeltme (UYGULANDI, 09.09.2026)

Envanter (Kerem: "uygulamada sayfalama gerektiren yerleri bul"): zaten sayfalı olanlar Oyuncular (DB'de 50/sayfa), Raporlar
önizleme (100 satır), oyuncu kartı (son 12/12/40 + Tümünü göster). Büyüyebilen ama sınırsız uzayan dört yer düzeltildi
(Kerem: "dördünü uygula"):
1. Excel aktarım önizlemesi (`OyuncuAktar.jsx`): `Sayfalama` ile 100 satır/sayfa; aktarım tam listeyi gönderir. Test:
   `tests/ui/oyuncu-aktar.test.jsx` (250 kayıt).
2. Yeni Sezon sihirbazı aday listesi (`SezonAyar.jsx`): sabit yükseklikli kaydırma (`calc(100vh - 420px)`, en az 240px),
   yapışık başlık, her zaman görünen "n oyuncu" / "x / y oyuncu gösteriliyor" sayacı.
3. WhatsApp toplu pencere (`WhatsAppHatirlat.jsx`): tablo kaydırma sınırı (`calc(100vh - 320px)`), üstte "n alıcı ·
   m numarasız/onaysız" sayacı.
4. Tahsilat > Bugün Kesilen Makbuzlar (`Tahsilat.jsx`): 460px sabit yükseklikli kaydırma, yapışık başlık.
Sayfalanmayan (bilinçli): Yoklama formu (grup büyüklüğü ~20), Yaş Grupları, ayar tabloları, pano listeleri (zaten sınırlı).

Testler (09.09.2026, "sayfalama olan her yeri test et"): `scripts/tests/sayfalama-e2e.cjs` gerçek main.cjs + DB ile 121 oyuncu → Oyuncular
50/sayfa (sonraki/önceki, arama → ilk sayfa, tek sayfada çubuk yok), oyuncu kartı 12 dönem / 12 makbuz / 40 yoklama + "Tümünü göster",
150 satırlık gerçek Excel dosyasıyla aktarım önizlemesi 100/sayfa ve 2. sayfadayken tam aktarım, Raporlar Oyuncu Listesi / Borçlu
Listesi 100/sayfa ve yeni Önizle'de ilk sayfa, Tahsilat 30 makbuz (460px kap, yapışık başlık), Yeni Sezon 271 aday (sayaç + kap),
WhatsApp 241 alıcı sayacı. `tests/ui/sayfalama-sinirlar.test.jsx` (jsdom): sayfa taşması (3. sayfadayken liste küçülür → sunucunun
döndürdüğü 2. sayfa), Önizle ilk sayfa, kart makbuz/yoklama "Tümünü göster", Tahsilat kabı + "30 makbuz", WhatsApp "60 alıcı · 2
numarasız/onaysız". Önceden var olan: `tests/ui/sayfalama.test.jsx` (bileşen, Oyuncular, Raporlar), `oyuncu-aktar.test.jsx`,
`db-roundtrip` (`playersPage` offset/taşma, `listDues`/`listReceipts` limit).

## 23. Kurulum kimliği ve uygulama adı (09.09.2026)

Kerem: uygulamanın adı "Futbol Okulu Kayıt Programı" olsun; kulüpten bağımsız kimlik. Uygulanan:
- `productName` / NSIS kısayol adı / pencere ve sayfa başlığı / Hakkında: **Futbol Okulu Kayıt Programı**; açıklama güncellendi.
- Kurulum dosyası adı ASCII: `build.artifactName = "Futbol-Okulu-Kayit-Programi-Setup-${version}.${ext}"` (Türkçe harf GitHub
  asset adında bozulur, electron-updater latest.yml url'i ile uyuşmazdı). `scripts/publish-release.cjs` `exeLocalName` ile aynı adı
  türetir; test `tests/publish-release.test.js` package.json'daki adın ASCII olduğunu denetler.
- `appId = com.keremgenisel.futbolokulu` (henüz kurulu kullanıcı yok; sonradan değişse ikinci kurulum oluşurdu).
- `package.json name = futbol-okulu-kayit-programi`; `extraMetadata.author = Kerem Genişel`.
- Veri klasörü productName'den türer: Windows'ta `%APPDATA%\Futbol Okulu Kayıt Programı`.
- Teknik kimlikler de yeniden adlandırıldı (Kerem: "uygulamayı zaten kullanan yok şu an" → geçiş kodu gerekmedi): lisans
  önekleri `FOKLISANS.` / `FOKLEASE.` (aktivasyon sunucusu dahil), kap imzaları `FOKTASI1.` / `FOKYEDK1.`, yedek
  `futbolokulu-yedek-<damga>.fokyedek` (eski düz `.zip` yine açılır), taşıma paketi `futbolokulu-tasima-<damga>.fokpaket`
  (`paket.json tur = futbolokulu-tasima`), geçici klasör önekleri `futbolokulu-tasima-`/`futbolokulu-geri-` (açılış temizliği),
  sunucu-istemci el sıkışma adı `/saglik ad = futbol-okulu-kayit-programi`, `package.json license = UNLICENSED`. Eski
  `EYUPSPOR.` anahtarları ve `.eyupyedek`/`.eyupspor` dosyaları artık tanınmaz (dağıtılmış yoktu).
  **Düzeltme 10.09.2026** (GenCRM ile lisans kodu karşılaştırmasında bulundu): `aktivasyon-sunucu/` klasörü bu geçişte
  atlanmıştı — Cloudflare Worker adı, D1 veritabanı adı, `package.json`/`README.md`/`deploy.sh`/`src/index.js`/`schema.sql`
  içindeki başlıklar hâlâ `eyupspor-*` idi (henüz deploy edilmediği için `wrangler.toml`'daki `database_id` yer tutucu
  kalmıştı, düzeltmek risksizdi). Hepsi `futbol-okulu-aktivasyon` / `futbol-okulu-lisans`'a çevrildi;
  `aktivasyon-sunucu/package-lock.json` `npm install --package-lock-only` ile yeniden üretildi.

### 23.0 Ad değişikliğinin yan etkisi (09.09.2026, Kerem: "uygulamaya giriş yapamıyorum")
productName değişince (1) Electron userData klasörü yeni ada taşındı → boş veritabanı açıldı; (2) macOS safeStorage keychain kaydı
uygulama adına bağlı olduğundan eski `db-key.enc` çözülemedi; (3) ESKİ kod çözemeyince anahtar dosyasının ÜZERİNE yeni anahtar
yazıyordu (veriyi kalıcı okunamaz kılar). Yapılan: eski klasördeki data.db/uploads/config/lisans yeni klasöre kopyalandı, anahtar
eski adla çözülüp yeni adla yeniden şifrelendi; `baglanti.getDbKey` artık mevcut dosyayı asla üzerine yazmaz ve açık hata verir,
`main.cjs` açılışta hata kutusu gösterip çıkar; kalıcı araç `scripts/anahtar-yeniden-sifrele.cjs`; test `scripts/tests/anahtar-koruma.cjs`
(+ vitest sarmalayıcı). Windows'ta DPAPI kullanıcı hesabına bağlıdır, ad değişikliği anahtarı etkilemez; yalnız `%APPDATA%` klasörü
taşınır (kurulu kullanıcı yok).

### 23.1 Sonraya bırakılanlar (Kerem, 09.09.2026: "planlara ekle")
1. **Giriş ekranı ve kenar menü markası:** "EYÜPSPOR / Futbol Okulu" yazısı sabit. Öneri: Ayarlar > Kulüp'teki `kulup_adi`
   (ve yüklenebilir kulüp logosu) gösterilsin; ayar boşsa "Futbol Okulu Kayıt Programı". — KAPANDI 10.09.2026 (§32: kısa ad,
   kuruluş yılı, kulüp logosu ve renkler Ayarlar > Kulüp'ten; oturumsuz `app:marka`).
2. ~~**Varsayılan kulüp adı sabitleri:** `src/lib/whatsapp.js VARSAYILAN_KULUP`, `makbuzHtml.js`/`yoklamaFormuHtml.js`/`yazdir.js`
   "EYÜPSPOR FUTBOL OKULU", `raporHtml.js` altbilgi "Eyüpspor Futbol Okulu", Kulüp ayarı ve İlk Kurulum yer tutucuları
   "EYÜPSPOR FUTBOL OKULU", Excel `wb.creator`, kurtarma kodları çıktısı başlığı, `serverTls.cjs` sertifika adı, `istemci.cjs`
   "Eyüpspor programı değil" hata metni.~~ — YAPILDI 10.09.2026: tek kaynak `src/lib/marka.js` (`UYGULAMA_ADI`,
   `VARSAYILAN_KULUP = "Futbol Okulu"`); `whatsapp.js`/`makbuzHtml.js`/`yoklamaFormuHtml.js`/`yazdir.js` oradan alır,
   `raporHtml.js` artık `kulup` parametresi kabul eder (`Raporlar.jsx`/`Oyuncular.jsx` çağrılarında `getSetting("kulup_adi")`
   geçilir), kurtarma kodları çıktısı (`KullaniciAyar.jsx`) ayarı okur, Excel `wb.creator` ana süreçte `db.getSetting`
   ile kulüp adına düşer, `serverTls.cjs` sertifika adı jenerik "Futbol Okulu Kayıt Programı Server" oldu (`istemci.cjs`
   hata metni zaten 09.09.2026'da değişmişti). Kulüp ayarı/İlk Kurulum placeholder'ı "Kulübünüzün adı"na döndü. Testler
   (`whatsapp.test.js`, `rapor-html.test.js`, kalıcılık placeholder seçici) birlikte güncellendi. Giriş ekranı/kenar
   menüdeki sabit "EYÜPSPOR" marka yazısı ve logo (§23.1 madde 1) bu turun dışında bırakıldı.
3. ~~Teknik önekler~~ — 09.09.2026'da yeniden adlandırıldı (yukarıda).
4. ~~**Belgeler:** `README.md` ve `docs/kurulum.md` başlıkları "Eyüpspor Futbol Okulu"; kurulum rehberindeki exe adı artık
   `Futbol-Okulu-Kayit-Programi-Setup-x.y.z.exe`.~~ — YAPILDI 10.09.2026: iki dosyanın başlığı "Futbol Okulu Kayıt
   Programı"na çevrildi, kurulum rehberindeki örnek exe adı `Futbol-Okulu-Kayit-Programi-Setup-x.y.z.exe` yapıldı.
6. ~~Kurulum lisans sözleşmesi sayfası~~ — 09.09.2026 yapıldı: `build/license.txt` (Türkçe son kullanıcı lisans sözleşmesi; UTF-8
   BOM + CRLF, `nsis.license`). Metin hukuki danışmanlık değildir; dağıtımdan önce bir hukukçuya gösterilmesi önerilir.
5. ~~**Sürüm ve yayın:** `version 0.1.0` → ilk dağıtımda `1.0.0` + `v1.0.0` etiketi (release.yml uyumu denetler).~~ — YAPILDI
   10.09.2026 (§8.1 madde 8). Kod imzalama sertifikası hâlâ yok: SmartScreen ilk açılışta uyarır; sertifika alınırsa
   `win.certificateFile`/`signtool` ayarı (§8.1 madde 10, bütçe kararı).

## 24. Tahsilat — Uzun Dönem Seç (çok aylık/sezonluk ödeme) ve makbuzda özet satırı (PLANLANDI ve UYGULANDI, 10.09.2026)

Kerem: bir oyuncu tüm sezonu ya da 6 ay gibi uzun bir dönemi tek makbuzda ödemek isterse Tahsilat ekranında ve makbuzda
nasıl gösterelim — 6 ay tek tek yazılırsa makbuz 2 sayfaya taşıyor, bunun önüne geçelim.

### 24.1 Sorun
Tahsilat'taki ay seçimi (`donemSecenekleri`) yalnız borçlu aylar + bugünden itibaren 3 gelecek ay öneriyordu; "sezonu
öde"/"6 ay öde" arayüzde mümkün değildi. Makbuzda (`makbuzHtml.js`) her seçili ay ayrı tam-genişlik satır açıyordu;
6-10 ay + diğer kalemler eklenince iki kopyayı (kulüp+veli) tek A4'e sığdıran şablon ikinci sayfaya taşıyordu.

### 24.2 Karar (Kerem, 10.09.2026)
- **Eşik: 3 ve altı ay tek tek satırda (bugünkü gibi); 4+ ay tek özet satırda** ("AİDAT · İLK AY–SON AY (N AY)" + toplam).
  Veritabanında her ay hâlâ ayrı `receipt_lines` satırı — yalnız kağıda basılan görünüm değişti.
- Tahsilat'a **"Uzun Dönem Seç"** bağlantısı (Modal, sayfa değil — uygulamada router yok, her yerde Modal kullanılıyor):
  hızlı seçim (3 Ay / 6 Ay / Sezon Sonuna Kadar) veya elle başlangıç-bitiş ayı; "Uygula" seçilen aralığı doldurur,
  kullanıcı geri kalan ekranda (ödeme yöntemi, diğer kalemler) tek tek ay/tutar düzenlemeye devam edebilir.
- **"Sezon Sonuna Kadar" ve modalın varsayılan başlangıcı, oyuncunun en eski ödenmemiş/kısmi ayından başlar** (borç
  varsa önce o kapanmalı), borç yoksa bugünden.
- Önce mockup (Claude Design canvas, 4 artboard: bağlantı eklenmiş ekran, modal, 6 ay seçili ekran, özet makbuz),
  sonra bu plan bölümü, sonra uygulama — Kerem'in istediği sıra.

### 24.3 Teknik
- `src/lib/aidat.js`: SAF `ayAraligi(yilBas, ayBas, yilBit, ayBit)` (kronolojik ay listesi, ters aralığı düzeltir) ve
  `ayEkle(yil, ay, n)` (N ay sonrası, yıl taşması dahil) — hızlı seçim ve elle aralık aynı yolu kullanır.
- `electron/db/aidat.cjs`: `ensureMonthlyDuesAraligi(pid, aylar)` — bir aralıktaki TÜM ayları tek transaction'da
  garanti eder (N ayrı `ensureMonthlyDues` çağrısı yerine), oluşan/var olan satırları döner; `db.cjs` dış API'sine ve
  `yetki.cjs` beyaz listesine eklendi (mevcut kullanıcı de çağırabilir, `ensureMonthlyDues` ile aynı sınıf).
- `src/components/UzunDonemModal.jsx` (yeni): hızlı seçim + elle aralık + önizleme ("N ay seçilecek: … · Toplam …"),
  `onUygula(aylar)` ile ay listesini parent'a döner (veritabanı yazma ve `aidatAylar` doldurma `Tahsilat.jsx`'te).
- `src/components/Tahsilat.jsx`: "Aidat dönemi" başlığının yanına bağlantı; `uzunDonemUygula` → `ensureMonthlyDuesAraligi`
  + `listDues` yenile + `aidatAylar`'ı tamamen yeni aralıkla değiştir (modal genelde boş seçimden açıldığı için birleştirme
  yerine değiştirme tercih edildi).
- `src/lib/makbuzHtml.js`: `AY_OZET_ESIGI = 3`; `aidatSatirlari.length > eşik` ise kalem tablosunda tek özet satır +
  toplam, "Dönem:" bilgi satırı da tam liste yerine aralık (`İlk Ay – Son Ay`) gösterir.

### 24.3a Düzeltme: ödenmiş aylar aralıktan atlanır (Kerem, 10.09.2026: "ödenmiş olanlar gösterilmesin")
İlk sürümde aralık ödenmiş ayları da kapsıyordu; `aidatKalan` bu aylar için doğru olarak 0 döndürdüğünden listede
"Eylül 2026 → 0" gibi satırlar görünüyor, toplam yanlış anlaşılıyordu ("3 ay seçilince ücret 0"). Şimdi: `Tahsilat.jsx`
ödenmiş/muaf ayların "yil-ay" kümesini (`odenmisAylar`) modala verir; modal aralığı bu kümeyle süzer, önizleme yalnız
tahsil edilecek ayları sayar ("N ay zaten ödenmiş, atlandı"), hiç ay kalmazsa Uygula kapalı. `uzunDonemUygula` da
(aralık açılınca yeni öğrenilen bir ay ödenmiş çıkarsa diye) kalanı 0 olan ayı listeye almaz. Test:
`tests/ui/tahsilat.test.jsx` "Uzun Dönem Seç: ödenmiş aylar aralıktan atlanır".

### 24.3b Düzeltme: peşin ödenmiş ay seçili gelmesin, piller ödenmişleri atlasın (10.09.2026, gerçek pencere testinde bulundu)
Oyuncunun borcu yoksa Tahsilat bu ayı seçili getiriyordu — bu ay peşin ödenmişse 5.000 ₺'lik ödenmiş ay seçili geliyor,
"gelecek ay" pilleri de yalnız 3 ay ileriye bakıp ödenmişleri sayınca boş kalabiliyordu. Şimdi `ilkOdenmemisAy` bugünden
ileriye (12 ay) ilk ödenmemiş/muaf olmayan ayı seçer; pil listesi de 12 ay içinde ödenmemiş 3 ay bulana kadar tarar.
Test: `tests/ui/tahsilat.test.jsx` "bu ay peşin ödenmişse…".

### 24.3c Düzeltme: gelecek aylar borç değil (Kerem, 10.09.2026: iptal sonrası ekran görüntüsü)
Uzun dönem makbuzu iptal edilince (ya da peşin ödeme için aralık açılınca) ileri tarihli aylar veritabanında "odenmedi"
kalıyor; Tahsilat bunların hepsini kırmızı "ödenmedi" pili olarak listeliyordu (Ağustos 2028'e kadar). Karar: borç =
vadesi gelmiş (bu ay ve öncesi) ödenmemiş/kısmi aylar; ileri tarihli açık aylar borç sayılmaz, "gelecek" kümesinde
(en fazla 3, ödenmişler atlanarak) sade seçenek olarak durur; kısmi ödenmiş ileri ay "kalan …" ile gösterilir. Veri
silinmez (ay gelince zaten oluşturulacaktı; raporlar etkilenmez). Kural tek saf yardımcıda: `aidat.js gelecekAcikAidatMi`;
oyuncu kartı Ödemeler sekmesi de bu ayları listelemez ve "N borç" rozeti saymaz (ödenmiş/kısmi ileri ay görünür; son 12
dönem penceresi süzmeden sonra uygulanır). Testler: `tests/ui/tahsilat.test.jsx` "iptalle geri açılan gelecek aylar borç
değil", `tests/ui/oyuncu-karti-sekmeler.test.jsx` "ileri tarihli açık aylar listelenmez", e2e "iptal sonrası: yalnız bu ay
'ödenmedi'".

### 24.4 Testler
- `tests/aidat.test.js`: `ayAraligi` (aynı yıl, yıl sınırı aşan, ters aralık, tek ay), `ayEkle` (yıl taşması).
- `tests/makbuz-html.test.js`: 3 ay ve altı hâlâ ayrı satır; 4+ ay tek özet satır + doğru toplam + aralık gösteren
  "Dönem:" satırı.
- `scripts/tests/db-roundtrip.cjs` (Electron altında gerçek SQLite, `tests/db-electron.test.js` sarmalar):
  `ensureMonthlyDuesAraligi` tek çağrıda tüm ayları açar, var olan ayı bozmaz.
- `scripts/tests/tahsilat-durumlar.cjs` (gerçek main.cjs + pencere, `tests/tahsilat-e2e.test.js` sarmalar; `npm run build`
  gerekir, test:saf dışında): 34 kontrol — borçsuz/borçlu/peşin ödenmiş/kısmi/ücretsiz oyuncu, elle 3 ay + makbuz (ayrı
  satırlar, PDF), Uzun Dönem 3 Ay / 6 Ay (makbuzda tek özet satır) / Sezon Sonuna Kadar / elle aralık (ödenmişler atlanır,
  tümü ödenmişse Uygula kapalı), makbuz iptali (aylar geri açılır), bugünkü tahsilat rozeti. `[ekranGoruntusuDizini]`
  verilirse her adımın ekran görüntüsünü yazar.

### 24.5 Mockup
Claude Design canvas'ı (dört artboard: bağlantı eklenmiş Tahsilat, Uzun Dönem Seç modalı, 6 ay seçili Tahsilat, özet
satırlı makbuz) — oturum içinde yayınlandı, uygulamadan önce Kerem'e onaylatıldı.

## 25. Oyuncular — "Eksik belge" pili (UYGULANDI, 10.09.2026)

Kerem: eksik belgesi olan oyuncularda "eksik belge" pili olsun; belge türlerinden "Diğer" bunun dışında kalsın.
- SAF: `src/lib/belge.js` `BELGE_TIPLERI` (oyuncu kartı > Belgeler ile tek liste; sekme artık buradan alır), `ZORUNLU_BELGELER`
  (`istege` olmayanlar: sağlık raporu, vesikalık, sporcu kimlik, veli kimlik, imzalı kayıt formu), `eksikBelgeler(tipler)`
  (dizi ya da virgüllü metin → eksik türler).
- DB: `playersPage`/`listPlayersWithDue` satırına `belge_tipleri` (`group_concat(DISTINCT tip)`).
- Arayüz: `Oyuncular.jsx` ad yanında sarı "Eksik belge (N)" rozeti; üzerine gelince ve erişilebilirlik adında eksik türlerin
  adları. Sağlık raporu kendi kırmızı pilini korur (eksikse iki pil de görünür). `Rozet` artık `title`/`aria-label` gibi
  ek nitelikleri geçirir.
- Testler: `tests/belge.test.js`, `tests/ui/oyuncular-eksik-belge.test.jsx`, `scripts/tests/db-roundtrip.cjs` (`belge_tipleri`).
- Filtre (Kerem, 10.09.2026): "Sağlık raporu olmayanlar"ın yanında "Eksik belgesi olanlar" düğmesi; `playersWhere` `eksikBelge`
  (zorunlu türlerden `count(DISTINCT tip) < 5`; liste `electron/belgeDogrula.cjs ZORUNLU_BELGELER`, ESM listesiyle eşitliği
  `tests/guvenlik-saf.test.js` denetler). Sayfalama DB'de olduğu için süzme de DB'de.

## 26. Yoklama — seçili düğmeye yeniden tıklayınca işaret kaldırılır (UYGULANDI, 10.09.2026)

Kerem: "Geldi" seçildikten sonra üstüne bir daha tıklanınca seçili olmasın; şu an hiçbir şekilde boş olmuyor.
- `Yoklama.jsx isaretle`: seçili durumla aynı düğmeye tıklama → işaret kaldırılır (işaretlenmedi); farklı düğme → durum değişir.
  Düğmelerde `aria-pressed` ve ipucu.
- `db.setAttendance(tid, pid, null)`: satırı siler (takvim/kart sayaçları ve raporlar buna göre düşer). Sunucu modu aynı
  beyaz liste üzerinden aynı davranır.
- Testler: `tests/ui/yoklama.test.jsx` (kaldır/yeniden işaretle/durum değiştir), `scripts/tests/db-roundtrip.cjs`.
- Gerçek pencere testi genişletildi (10.09.2026, `scripts/tests/oyuncular-e2e.cjs`, `tests/oyuncular-e2e.test.js` sarmalar,
  `[ekranGoruntusuDizini]` ile görüntü): satır rozetleri (grup/durum/ücret/aidat), sağlık pilleri (yok/tarihsiz/süresi doldu),
  "Eksik belge (N)" pili ve ipucu, tam belgeli oyuncuda pil yok, yalnız "Diğer" olanda 5, "Eksik belgesi olanlar" filtresi
  (arama ve sağlık filtresiyle birleşim), veli adı/telefonu, satıra tıklayınca oyuncu kartı, Yeni Oyuncu formuyla kayıt.

## 27. Yaş Grupları — gerçek pencere testi (10.09.2026)

`scripts/tests/yas-gruplari-e2e.cjs` (`tests/yas-gruplari-e2e.test.js` sarmalar; `npm run build` gerekir, test:saf dışında;
`[ekranGoruntusuDizini]` ile görüntü): varsayılan liste (aktif sezon + yalnız aktif gruplar, "(aktif sezon)" etiketi, "N grup ·
M gizli" özeti), aktif oyuncu sayısı (pasif oyuncu sayılmaz), program özeti, "Pasif grupları da göster" (kutu işaretliyken
pasife alınan grup listede kalır, kutu kapatılınca düşer, pasif kalmayınca kutu kaybolur), durum rozetiyle Aktif↔Pasif, Grup
Ekle (düğme / Enter / boş ad kapalı / sonraki sezona ekleyince süzgeç o sezona geçer ve "(gelecek)"), sezon süzgeci (eski sezon
"(eski)"), Düzenle (ad/sıra/program/sezon) + Vazgeç, Sil (oyuncusu olan grup silinemez; boş grup silinir). Not: sezonu
sonraki sezona taşınan grup, §21 üyelik geçmişi gereği eski sezon listesinde "(gelecek)" etiketiyle kalır.

## 28. Yoklama — gerçek pencere testi ve "Kalanları Geldi İşaretle" düzeltmesi (10.09.2026)

- **Hata (gerçek pencere testinde bulundu):** "Kalanları Geldi İşaretle" döngü içinde ilk işaretsiz oyuncuda `return` ediyordu —
  yalnız ilk oyuncu kaydediliyor, ekran/sayaç/takvim güncellenmiyordu. Şimdi işaretsiz herkes sırayla kaydedilir, toast "N oyuncu
  geldi olarak kaydedildi" (kimse yoksa "İşaretlenmemiş oyuncu yok"). Test: `tests/ui/yoklama.test.jsx`.
- `scripts/tests/yoklama-e2e.cjs` (`tests/yoklama-e2e.test.js` sarmalar; `npm run build` gerekir, test:saf dışında;
  `[ekranGoruntusuDizini]` ile görüntü): takvim şeridi (bugün seçili, gri/mor/yeşil/kırmızı noktalar, hafta okları, Bugün, Tarihe
  git), boş gün, Antrenman Ekle formu (grup seçilmeden uyarı), kart (grup · saat, saha, x/y işaretli, seçili), oyuncu listesi
  (pasif oyuncu yok, "Aidat" rozeti, "n aidat borcu"), Geldi/Gelmedi/İzinli + yeniden tıklayınca kaldırma, sayaçlar, Kalanları
  Geldi İşaretle, Düzenle (yoklama alınmışsa tarih kilitli; "Değişiklik yok"; saat/saha değişince bildirim sorusu, kartta
  "Velilere bildirilmedi", "Velilere Bildir" penceresi), Haftayı Programdan Doldur (ekleme / tekrar → atlanan / programsız grup),
  İptal Et (onay, Vazgeç, "İptal" rozeti, düğmeler kapalı, kırmızı nokta, veritabanı).

## 29. Raporlar — gerçek pencere testi genişletildi (10.09.2026)

`scripts/tests/raporlar-e2e.cjs` (`tests/raporlar-e2e.test.js` sarmalar; `[ekranGoruntusuDizini]` ile görüntü) eskiden yalnız
filtreleri sınıyordu; eklenenler: başlangıç boş durumu ("Filtreleri seçip Önizle'ye basın"), 5 rapor kartı + seçili vurgu +
açıklamalar, önizleme sonrası "Filtre değişti" / "Filtre ve rapor değişti" pili, **Excel dışa aktarımı** (kaydetme diyaloğu
test dosyasına yönlendirilir; exceljs ile sayfa adı, başlık satırı, satır sayısı, `creator` = kulüp adı doğrulanır), **PDF dışa
aktarımı** (dosya + `%PDF-` imzası), tahsilat raporunda iptal makbuzu (not + alt başlıkta iptal sayısı/tutarı), borçlu listesinde
kısmi ödeme (kalan), yoklama özetinde katılım yüzdesi, yaş grubu kutusu. Betik artık PDF'in gizli penceresini yok sayar
(`basladi` koruması).

## 30. Uygulama logosu (UYGULANDI, 10.09.2026)

Kerem: "logo renkleri kırmızı beyaz olsun, C logosunu seçiyorum ve futbol topuna vuran bir krampon olsun" → "beyaz zemin
sürümünü uygula". Tasarım tuvali: https://claude.ai/code/artifact/54f6240d-883c-4b69-a2a4-f7e6df1af619 (yön C "Kayıt Kartı":
beyaz pano + koyu kırmızı başlık/klips, sol altta topa vuran krampon + hız çizgileri, sağ altta top; palet #E0101F / #7A0A12 / beyaz).

- **Uygulama ikonu ≠ kulüp arması.** `build/icon.png` (1024×1024 RGBA, beyaz zemin sürümü) exe / kurulum sihirbazı / masaüstü
  kısayolu (electron-builder `win.icon`, .ico'yu üretir) ve pencere ikonu (`main.cjs`). Eski Eyüpspor arması `build/kulup-logo.png`
  oldu; makbuz / yoklama formu / rapor başlığındaki `app:logo` artık onu okur (`electron/kulupLogo.cjs kulupLogoYolu`).
- **Paketli sürüm hatası düzeltildi:** `build/` asar'a girmiyor (`files` yalnız dist+electron); eski kod `../build/icon.png`'yi
  okuyamayıp makbuzları logosuz basıyordu. Artık `extraResources` armayı `resources/kulup-logo.png`'ye kopyalar ve paketli
  uygulamada `process.resourcesPath` kullanılır.
- `public/logo.png` (512) giriş ekranı + kenar menü (`Giris.jsx`, `KenarMenu.jsx`; köşe yarıçapı ile).
- Kaynak SVG'ler `build/logo.svg` (beyaz zemin, kullanılan) ve `build/logo-kirmizi.svg` (kırmızı zemin, yedek). PNG üretimi
  Electron canvas ile (SVG → PNG; makinede rsvg/magick yok).
- Test `tests/logo-dosyalari.test.js` (boyut/alfa, package.json ve main.cjs bağlantıları, `kulupLogoYolu`).
- Açık: §23.1 madde 1'in yazı kısmı — giriş/kenar menüdeki "EYÜPSPOR" sabit metni hâlâ duruyor (kulüp adı ayarından gelmeli).

## 31. Makbuzlu oyuncu: silme yerine kişisel veri silme (UYGULANDI, 10.09.2026)

Kerem (yeni PC'de deneme): "oyuncuyu silmeye çalıştım, bağlı kayıtlar olduğu için oyuncu silinemedi hatası veriyor." →
"oyuncuyu silmek istersek?" → seçim: **kişisel veriyi sil, makbuzları koru** (KVKK silme; tahsilat raporu ve makbuz numarası
sırası bozulmaz). Sebep: `receipts.player_id` bilerek `ON DELETE RESTRICT`; onay mesajı ise "makbuzlarıyla silinecek" diyordu
ve hata ham FK hatasının çevirisiydi.

- **Makbuzsuz oyuncu** (yanlış kayıt, deneme): eskisi gibi `deletePlayer` — belge/aidat/yoklama/veli/mesaj CASCADE ile gider.
  Makbuz varsa `deletePlayer` açık mesajla reddeder.
- **Makbuzlu oyuncu**: kartta "Sil" → onay ("N makbuz kesilmiş; makbuzlar tutar ve numarasıyla korunur; kişisel veriler kalıcı
  silinir; kayıt 'Silinmiş Oyuncu #id' olarak kalır; geri alınamaz") → `files.oyuncuKisiselVeriSil(id)` (yalnız yönetici, salt
  okunurda red): `db.oyuncuKisiselVeriSil` tek işlemde ad → "Silinmiş Oyuncu #id", TC/pasaport/doğum tarihi-yeri/okul/GSM/adres/
  kan grubu/foto boş, grup bağı NULL, durum `ayrildi`, not "Kişisel verileri silindi: <tarih> (<kullanıcı>)"; `documents`,
  `guardians`, `emergency_contacts`, `monthly_dues`, `attendance`, `message_log`, `player_seasons` satırları silinir.
  **Makbuzlar olduğu gibi kalır** (Kerem: "oyuncunun adı makbuzda kalsın"): silme anında oyuncunun adı `receipts.oyuncu_adi`
  damgasına yazılır (şema 18; boşsa sorgular `players.ad_soyad` kullanır: `COALESCE(NULLIF(r.oyuncu_adi,''), p.ad_soyad)`),
  makbuz PDF'leri de silinmez. Ana süreç (`ipc/files.cjs kisiselVeriSilCekirdek`, sunucuda `/api/files/oyuncuKisiselVeriSil`)
  dönen dosya listesini (belge, foto) ve `uploads/oyuncu-<id>/` klasörünü siler. `db:call` beyaz listesinde değil.
- Makbuz ekranları ve tahsilat raporu o makbuzları eski adıyla gösterir; Oyuncular > Ayrıldı süzgecinde oyuncu
  "Silinmiş Oyuncu #id" adıyla listelenir.
- Testler: `scripts/tests/db-roundtrip.cjs` (makbuzlu → deletePlayer hatası; makbuzsuz → silinir; kişisel veri silme: alanlar,
  bağlı satırlar, makbuz kalır, dosya listesi, olmayan oyuncu), `scripts/tests/server-security.cjs` (yönetici olmayana 403;
  dosya+klasör silinir, ad anonim), `tests/ui/oyuncu-karti-sil.test.jsx` (4).

## 32. Kulüp kimliği: logo, renkler, giriş ekranı markası (UYGULANDI, 10.09.2026)

Kerem: "Ayarlardan kulüp kendi logosunu koyabilmeli ve bu logo tahsilat makbuzunda da olmalı (şu an Eyüpspor logosu var);
uygulama renklerini kendi istediği gibi seçebilmeli; giriş ekranındaki kulüp adını ve kuruluş tarihini değiştirebilmeli."
Amaç: program kulüpten tamamen bağımsız olsun (Eyüpspor sabitleri bitsin — §23.1 madde 1 buna dahil), her kurulum kendi
kimliğini Ayarlar > Kulüp'ten versin.

### 32.1 Bugünkü durum (neden gerekli)
- Logo: `app:logo` sabit `build/kulup-logo.png` (Eyüpspor arması) okur; makbuz, yoklama formu ve rapor başlığı onu basar.
  Giriş ekranı ve kenar menü artık uygulama logosunu (`public/logo.png`, §30) gösteriyor; kulüp logosuna yer yok.
- Marka yazısı: `Giris.jsx` "EYÜPSPOR" + "Kuruluş 1919", `KenarMenu.jsx` "EYÜPSPOR / Futbol Okulu" — sabit metin.
- Renkler: `src/ui.css` CSS değişkenleri (`--mor`, `--mor-koyu`, `--mor-acik`, `--sari`, `--sari-acik`, `--kirmizi`, `--yesil`,
  `--zemin`, `--metin`, `--soluk`, `--cizgi`); bileşenlerin çoğu `var(--…)` kullanıyor (~400 kullanım) ama ~21 yerde sabit hex
  (`#5B2D8E` ×6, `#3F1D66` ×9, `#EDE6F6` ×3, `#F5D000` ×2, `#E0101F` ×1) var; makbuz/rapor/yoklama HTML şablonları ve Excel
  başlık dolgusu (`cikti.cjs:120` `FFEDE6F6`) sabit hex.
- Giriş ekranı oturumsuzdur: `db:call getSetting` oturum ister (yetki.cjs). Marka bilgisi için oturumsuz bir kanal yok.

### 32.2 Ayar anahtarları (settings tablosu; hepsi yönetici, `setSetting` ADMIN setinde)
| Anahtar | Anlam | Varsayılan |
|---|---|---|
| `kulup_adi` | tam ad (makbuz, rapor altbilgi, Excel creator) — VAR | "" → "Futbol Okulu" |
| `kulup_kisa_ad` | giriş ekranı ve kenar menü büyük başlığı ("EYÜPSPOR") | boşsa `kulup_adi`, o da boşsa "Futbol Okulu" |
| `kulup_alt_yazi` | kenar menü alt satırı ("Futbol Okulu") | "Futbol Okulu" |
| `kurulus_yili` | giriş ekranı "Kuruluş 1919" | boş → satır gizlenir |
| `kulup_logo` | uploads'a göreli yol (`kulup/logo.png`) | boş → makbuz/formda logo yok (yalnız ad) |
| `tema_ana` | ana renk (`--mor`) | `#5b2d8e` |
| `tema_vurgu` | vurgu rengi (`--sari`, "Makbuz Kes", kenar menü alt yazısı) | `#f5d000` |
| `tema_preset` | seçilen hazır paletin adı (yalnız arayüz için) | "mor-sari" |
Türetilenler ayar değil, hesaplanır (32.4): `--mor-koyu`, `--mor-acik`, `--sari-acik`, ana renk üstü metin rengi.

### 32.3 Kulüp logosu
- Dosya: `uploads/kulup/logo.png` (yedek ve taşıma paketi `uploads/`'ı zaten kapsar → logo otomatik yedeklenir/taşınır).
- IPC `files:kulupLogoSec` (yönetici; diyalog PNG/JPEG; ≤ 5 MB; `resimBoyutu` ≤ 50 MP; `imageOptimize` ile ≤ 512 px'e küçült,
  PNG ise PNG kalır (şeffaflık), JPEG ise JPEG) → `uploads/kulup/logo.<png|jpg>` yazar, `kulup_logo` ayarını yazar, eski dosyayı
  siler. `files:kulupLogoSil` → dosya + ayar temizlenir. İstemci modunda sunucu uçları (`/api/files/kulupLogo*`).
- `app:logo` → önce `kulup_logo` (dosya varsa data URL), yoksa "" (logo yok). `guvenliLogo` yalnız png/jpeg data URL kabul
  eder — WebP/HEIC seçilirse JPEG'e dönüştürülür (imageOptimize ile), bu yüzden regex değişmez.
- **Eyüpspor geçişi (karar gerekiyor):** güncellemeden sonra Eyüpspor kurulumunda makbuz logosu kaybolmasın diye bir sürüm boyunca
  `build/kulup-logo.png` yedek kalır mı, yoksa Ayarlar'da tek seferlik "logo yükleyin" uyarısıyla (SifresizUyari benzeri şerit)
  hemen mi kalkar? Öneri: yedek KALKSIN, `build/kulup-logo.png` depodan silinsin (ürün kulüpten bağımsız), Eyüpspor PC'sinde
  güncellemeden sonra Ayarlar > Kulüp'ten arma yüklensin (docs/kurulum.md'ye adım). `extraResources` ve `kulupLogo.cjs` kalkar.
- Kullanıldığı yerler: makbuz (`makbuzHtml`), yoklama formu, rapor PDF başlığı, **giriş ekranı** (uygulama logosunun yanında
  ya da yerine — karar: kulüp logosu varsa onu, yoksa uygulama logosunu göster; öneri bu), kenar menü (aynı kural).
- Excel'e logo konmaz (exceljs görsel destekler ama gereksiz).

### 32.4 Renk teması
- Saf modül `src/lib/tema.js` (`// @ts-check`, vitest): `temaTuret({ ana, vurgu })` → `{ mor, morKoyu, morAcik, sari, sariAcik,
  anaUstuMetin }` (HSL ile koyu %25, açık %92 karışım; ana üstü metin: WCAG kontrast ≥ 4.5 ise beyaz, değilse `--metin`),
  `renkGecerliMi(s)` (`^#[0-9a-f]{6}$`), `PRESETLER` (Mor-Sarı [bugünkü], Kırmızı-Beyaz, Lacivert-Turuncu, Yeşil-Beyaz,
  Siyah-Sarı, Mavi-Beyaz; her biri `{ ad, ana, vurgu }`).
- Uygulama: `src/lib/temaUygula.js` → `document.documentElement.style.setProperty("--mor", …)` vb.; `App.jsx` oturum
  açılınca ayarlardan, giriş ekranı `app:marka` ile (32.5) oturumsuz uygular; Ayarlar'da seçim anında canlı önizleme, "Kaydet"
  ile kalıcı, "Vazgeç" eskiyi geri koyar.
- Sabit hex temizliği: 21 bileşen kullanımı `var(--…)`'a çevrilir (davranış değişmez; kontrol: `grep -rE "#(5B2D8E|3F1D66|EDE6F6|
  F5D000|E0101F)" src` → 0, test `tests/tema-sabit-renk.test.js` bunu sınar). Kenar menü/giriş ekranı zemini `--mor`.
- Şablonlar: `makbuzHtml`, `raporHtml`, `yoklamaFormuHtml` `tema` parametresi alır (varsayılan bugünkü palet); `yazdir.js`/
  `Raporlar.jsx`/`Oyuncular.jsx`/`Yoklama.jsx` ayardan geçirir. Excel başlık dolgusu `tema_ana` açık tonundan (`cikti.cjs`
  `getSetting`). Güncelleme şeridi sarısı `--sari` (zaten değişken).
- Ana süreç doğrulaması: `setSetting` `tema_*` için `renkGecerliMi` (CJS ikizi `electron/tema.cjs` ya da regex tek yerde;
  `tests/guvenlik-saf.test.js` ikiz eşitliği), `kurulus_yili` 4 hane ya da boş, `kulup_kisa_ad` ≤ 40 karakter. Renk değeri
  CSS'e `setProperty` ile girer (metin olarak; enjeksiyon yok) ve şablonlara regex'ten geçmiş değer girer.
- Kontrast koruması: ana renk çok açıksa (beyaz metin okunmuyorsa) Ayarlar uyarır ("Bu renkte yazılar okunmayabilir") ve
  `anaUstuMetin` koyu olur; kırmızı/yeşil/uyarı renkleri sabit kalır (anlam taşır).

### 32.5 Giriş ekranı (oturumsuz marka kanalı)
- Yeni IPC `app:marka` (oturum GEREKMEZ; yalnız marka verisi, kişisel veri yok): `{ kulupAdi, kisaAd, altYazi, kurulusYili,
  logo (data URL | ""), tema: { ana, vurgu } }`. Preload `app.marka()`. İstemci modunda sunucuda oturumsuz `GET /api/marka`
  (`/saglik` gibi; yalnız bu alanlar) — TOFU parmak izi onayından sonra çekilir; sunucuya bağlı değilken uygulama varsayılanı.
- `Giris.jsx`: logo (kulüp logosu varsa o, yoksa uygulama logosu) + `kisaAd` + "Kuruluş <yıl>" (yıl boşsa satır yok); tema
  renkleri uygulanır (sol panel `--mor`). `KenarMenu.jsx`: logo + `kisaAd` + `altYazi`.
- `App.jsx` oturum sonrası ayarlar değişince (Ayarlar Kaydet) `marka` yeniden yüklenir (basit: `onMarkaDegisti` geri çağrısı).

### 32.6 Ayarlar > Kulüp ve Makbuz (KulupAyar.jsx) — yeni yerleşim
1. **Kimlik:** Kulüp adı (makbuz/rapor) · Kısa ad (giriş ekranı ve menü) · Alt yazı · Kuruluş yılı.
2. **Logo:** önizleme (128 px, yoksa "Logo yok" kutusu) · "Logo Seç…" · "Kaldır" · not: "PNG önerilir (şeffaf zemin), makbuz ve
   formlarda 28 mm yükseklikte basılır".
3. **Renkler:** hazır palet kartları (6) + "Özel": iki `<input type="color">` (Ana, Vurgu) · canlı önizleme kutusu (kenar menü
   parçası + "Makbuz Kes" düğmesi + makbuz başlığı minyatürü) · kontrast uyarısı.
4. Tahsil eden (mevcut).
Tek "Kaydet" (kural: satır başına kaydet yok; `onKirli` uyarısı). Logo seçimi dosya yazdığı için anında uygulanır (Kaydet
beklemez; kullanıcıya "Logo kaydedildi" toast'ı) — diğer alanlar Kaydet ile.
- **İlk Kurulum sihirbazı** kulüp adımına aynı alanlar (logo seç, kısa ad, kuruluş yılı, palet) eklenir; "Bu adımı atla" korunur.
- `design/` tuvaline KulupAyar yeni yerleşimi ve giriş ekranı varyantı (logo var/yok, farklı palet) eklenir — önce tasarım onayı.

### 32.7 Uygulama sırası ve tahmin
1. **Marka metinleri + oturumsuz kanal** (32.2 metin anahtarları, 32.5 `app:marka`, Giris/KenarMenu, KulupAyar 1. bölüm,
   sihirbaz alanları) — küçük; §23.1 madde 1 kapanır. Test: `tests/ui/giris-marka.test.jsx`, `kulup-ayar.test.jsx`, Electron
   `app:marka` (db-electron ya da smoke-ui'de giriş görüntüsü), sunucu `/api/marka` (server-security: oturumsuz 200, yalnız marka
   alanları).
2. **Kulüp logosu** (32.3) — orta. Test: `files:kulupLogoSec` diyalog yaması (Electron; PNG şeffaflık korunur, JPEG'e dönüşüm,
   büyük dosya reddi), makbuz HTML'de logo, yedeğe girer (db-roundtrip yedek kontrolüne `uploads/kulup/logo.png`).
3. **Renk teması** (32.4) — orta/büyük (sabit hex temizliği + şablon parametreleri + Ayarlar paleti). Test: `tema.test.js`
   (türetme, kontrast, preset geçerliliği), sabit hex sıfır testi, makbuz/rapor HTML tema parametresi, smoke-ui'de farklı paletle
   ekran görüntüsü (`scripts/tests/smoke-ui.cjs` tema ayarını yazıp giriş + pano görüntüsü).
4. **Eyüpspor geçişi + belgeler:** `build/kulup-logo.png` kaldırma kararı (32.3), docs/kurulum.md "Kulüp kimliği" bölümü,
   CLAUDE.md, §23.1 madde 1 kapanış notu.

### 32.8 Kararlar (Kerem, 10.09.2026: "logo olmasın hiç yüklenmemişse, kalksın, ikisi de olsun hatta yüklenen logodan renkler
önersin, yerine geçsin. önce mockup'ları göster")
1. Logo yüklenmemişse makbuz/formlarda **hiç logo yok** (yalnız kulüp adı). ✔
2. Eyüpspor arması **hemen kalkar**: `build/kulup-logo.png`, `extraResources`, `kulupLogo.cjs` silinir; kurulum rehberine
   "güncellemeden sonra Ayarlar > Kulüp'ten logo yükleyin" adımı. ✔
3. Renk: hazır paletler + serbest seçici, **ayrıca yüklenen logodan baskın renkler çıkarılıp palet olarak önerilir**
   (renderer'da canvas ile: logo data URL → 64×64 örnekleme → HSL kümeleme, gri/beyaz/şeffaf pikseller atılır → en baskın 2–3
   doygun renk; `src/lib/tema.js logodanRenkler(pikseller)` SAF, canvas okuma `temaUygula.js`'te). ✔
4. Giriş ekranı ve kenar menüde kulüp logosu uygulama logosunun **yerine** geçer (yoksa uygulama logosu). ✔
5. Sıra: önce tasarım tuvalinde mockup'lar (KulupAyar yeni yerleşim, giriş ekranı logo var/yok + farklı palet, kenar menü,
   makbuz başlığı), onaydan sonra 32.7 adımları.

Mockup: https://claude.ai/code/artifact/7f2057c6-3959-409e-a25a-c2bfc6cd6370 (Ayarlar yerleşimi, giriş logolu/logosuz, makbuz başlığı).

### 32.9 Uygulama notları (10.09.2026)
- Saf: `src/lib/tema.js` (temaTuret/kontrast/PRESETLER/logodanRenkler/logodanPalet), CJS ikizi `electron/tema.cjs` (acikTon:
  Excel başlık dolgusu), `electron/ayarDogrula.cjs` (`db.setSetting` her yazımda çağırır: tema_* #rrggbb, kurulus_yili 4 hane,
  kulup_* uzunluk, kulup_logo yol), `electron/marka.cjs` (markaHesapla/markaOku). Renderer: `src/lib/temaUygula.js` (CSS
  değişkenleri `--mor …` + yeni `--ana-ustu`, `--vurgu-ustu`; logodan renk okuma canvas ile).
- Kanallar: `app:marka` (oturumsuz; istemci modunda sunucunun oturumsuz `GET /api/marka`'sı), `app:logo` artık kulüp logosu
  (yoksa ""), `files:kulupLogoSec` / `files:kulupLogoSil` (yönetici; `electron/kulupLogo.cjs` çekirdeği; sunucu
  `/api/files/kulupLogoSec|Sil`). Bileşenlerde sabit marka hex'i yoktu; şablonlar (`makbuzHtml`, `raporHtml`,
  `yoklamaFormuHtml`) `tema` parametresi alır, çağrılar `yazdir.js ciktiMarkasi()` üzerinden.
- Arayüz: `App.jsx` marka yükler/uygular (`markaYenile`), `Giris`/`KenarMenu` `marka` prop'u, `KulupAyar` yeni yerleşim
  (`TemaSecici` + `TemaOnizleme` bileşenleri; İlk Kurulum kulüp adımı da kullanır).
- Kaldırılanlar: `build/kulup-logo.png`, `extraResources`, eski `kulupLogo.cjs` yol yardımcısı (dosya adı aynı kaldı, içeriği
  artık logo kaydet/kaldır). §23.1 madde 1 kapandı.
- Testler: `tests/tema.test.js` (tema, CJS ikizi, ayarDogrula, markaHesapla), `tests/ui/giris-marka.test.jsx`,
  `tests/ui/kulup-ayar.test.jsx`, makbuz/rapor HTML tema testleri, `db-roundtrip` (setSetting doğrulama, logo kaydet/küçült/
  JPEG-PNG değişimi/kaldır, markaOku), `server-security` (/api/marka oturumsuz + yalnız marka alanları, logo yükleme 403/200/400).

- Düzeltme (Kerem, 10.09.2026: "logo yüklenince daha önce girdiğim bilgiler gitti"): `KulupAyar` logo seç/kaldır sonrası tüm
  alanları DB'den yeniden yüklüyordu; artık yalnız logoyu yeniler (`logoYenile`), kaydedilmemiş girdiler ve seçili palet korunur.
  Test `tests/ui/kulup-ayar.test.jsx` "logo seçmek ve kaldırmak kaydedilmemiş alanları SİLMEZ".

- Kalıcılık (Kerem, 10.09.2026: "kapatılıp açılınca kaybolan veri var mı kontrol et"): `scripts/tests/kalicilik.cjs` genişletildi —
  yaz adımında kulüp kimliği ayarları + logo dosyası, 4 aylık tek makbuz (§24), geçerlilik tarihli sağlık belgesi (§25), kişisel
  veri silme (§31) yazılır; yedek + iki geri yükleme + taşıma paketi bunları kapsar; oku adımında (düzgün kapanış VE SIGKILL sonrası)
  hepsi DB'de, logo dosyası diskte, giriş ekranı oturumsuz kimliği (kısa ad, kuruluş, logo, yeşil tema) gösteriyor. Kayıp yok.

- Çıktı doğrulaması (Kerem, 10.09.2026: "makbuz, raporlar, yoklama formu yazdırılabilir renkler ve logo değişiyor mu?"):
  `kulup-kimligi-e2e` gerçek pencerede `cikti:yazdir`/`cikti:pdfKaydet` HTML'ini yakalar — makbuz (Tahsilat > Yazdır), yoklama formu,
  oyuncu listesi PDF'i kulüp logosu + tema rengini içeriyor, eski mor yok; Excel başlık dolgusu tema ana renginin açık tonu. Kurtarma
  kodları çıktısı bilerek sade (yalnız kulüp adı). Daha önce üretilmiş makbuz PDF'leri (uploads/makbuz) eski görünümde kalır (yeniden
  yazdırınca yeni). Tarama sonucu düzeltilenler: kenar menü/modal/giriş paneli sabit `#fff`/`#D8CCE9` → `--ana-ustu`/`--ana-ustu-soluk`
  (koyu olmayan ana renkte okunur); **uyarı anlamı** taşıyan sarılar (deneme/salt okunur şeridi, kaydedilmemiş satır/çubuk, KVKK notu,
  sarı rozet, lisans "Deneme" rengi, aktarım/sezon uyarı kutuları) temadan ayrıldı → sabit `--uyari*`; marka vurgusu (`--sari`) yalnız
  Makbuz Kes, menü alt yazısı/aktif çizgi, kuruluş satırı, sekme çizgisi, takvim "bugün", güncelleme şeridi, WhatsApp sayacı.

- PDF doğrulaması (Kerem: "indirilen PDF'ler?"): `htmlToPdf` (`printBackground: true`) dışa verildi; e2e yakalanan HTML'den gerçek
  makbuz/yoklama formu/oyuncu listesi PDF'lerini üretir (görüntü dizinine yazar; QuickLook ile bakıldı: logo, kırmızı tema, zemin
  renkleri basılıyor). Bulunan kalıntı: yoklama formu dibindeki sabit Eyüpspor hashtag'leri → yeni ayar `kulup_slogan` ("Yoklama
  formu alt yazısı", ≤120; boşsa satır yok; marka kanalı `slogan`); Excel aktarım şablonu örneği "Eyüp İlkokulu" → "Atatürk İlkokulu".

Eski soru listesi:
1. Logo yüklenmemişse makbuz/formlarda **hiç logo mu**, **uygulama logosu mu** basılsın? (Öneri: hiç logo; uygulama logosu
   kulübün belgesine ait değil.)
2. Eyüpspor arması yedek olarak bir sürüm daha kalsın mı, hemen kalksın mı? (Öneri: kalksın; güncellemeden sonra Ayarlar'dan
   yüklenir, kurulum rehberine yazılır.)
3. Renk seçimi yalnız hazır paletler mi, serbest renk seçici de mi? (Öneri: ikisi de; kontrast uyarısıyla.)
4. Giriş ekranı ve kenar menüde kulüp logosu varsa uygulama logosunun yerine mi geçsin, yanında mı dursun? (Öneri: yerine.)

## 33. Aktivasyon "lisans kayıtlı değil" hatası — anahtar boşluk temizliği (UYGULANDI, 10.09.2026)

Kerem (deneme lisansını aktive ederken): "lisans kayıtlı değil, satıcıya başvurun diyor". Sunucuda lisans kayıtlıydı (0/1
kurulum). Sebep: sunucu lisansı anahtar METNİNİN SHA-256'sıyla arar; anahtar sohbet/e-postadan kopyalanırken araya satır
sonu/boşluk giriyor, base64 çözücü bunları yok saydığı için imza yine doğrulanıyor (uygulama "Anahtarı Kaydet"i geçiyor) ama
hash değişiyor → 403 "kayıtlı değil". Yerelde kanıtlandı (aynı anahtar satır sonlu: doğrulama true, sha farklı).
- Sunucu (`aktivasyon-sunucu/src/index.js` `anahtarTemizle`, `kripto.js`): /aktivasyon, /yenile, /admin/lisans, /admin/liste
  anahtarı tüm boşluklardan arındırıp öyle hash'ler; bozuk base64'lü anahtar 500 yerine 403 "anahtar geçersiz". Deploy edildi
  (canlıda boşluklu anahtarla /admin/liste doğrulandı). Uygulama tarafı (`lisansDurum.cjs lisansKaydet`, `lisans.cjs dogrula`)
  ve `lisans-yonet.cjs` de aynı temizliği yapar (bir sonraki sürümle gider; sunucu düzeltmesi tek başına yeterli).
- Testler: `tests/aktivasyon-sunucu.test.js` (boşluklu anahtarla aktivasyon + admin liste; bozuk base64 403),
  `tests/lisans.test.js` (boşluklu anahtar doğrulanır), `db-roundtrip` (kayıtta boşluk atılır).
- Yan olay: `npx wrangler deploy` kökte çalışınca wrangler 4.13x kökteki `vite.config.js`'i görüp ANA PROJEYİ Cloudflare'a
  kurmaya kalkıştı (wrangler.jsonc, `@cloudflare/vite-plugin`, package.json betikleri, .gitignore). Geri alındı; `deploy.sh`
  artık `--config ./wrangler.toml` ile ve aktivasyon-sunucu klasöründen çalışır (yorumda uyarı).


## 34. Uygulama logosu v2 — daha modern (KARAR: mevcut logo, kırmızı zemin — 10.09.2026)

Kerem: "uygulama logosunu daha modern bir hale getirmek için planlama ve sonra mockup yapalım." Mevcut (§30): kırmızı yuvarlak
kare, beyaz kayıt kartı (koyu başlık + klips + 4 gri satır), sol altta krampon + hız çizgileri, sağ altta top. Palet kırmızı/beyaz
korunur (Kerem'in seçimi).

### 34.1 Mevcut logonun "modern" ölçütlerine göre eksikleri
- **Öğe sayısı:** 6 ayrı nesne (kart, klips, satırlar, krampon, hız çizgileri, top) — modern uygulama ikonları 1–2 nesneyle
  tek fikir anlatır; 32/16 px'te leke kalabalığı.
- **Çizgi/detay:** 12 px konturlar, krampon çivileri, bağcık çizgileri — küçük boyutta gürültü; iOS/Windows 11 ikonları düz
  dolgu + büyük negatif alan kullanır.
- **Kompozisyon:** kart sağ üste, top sağ alta, krampon sol alta dağılmış; odak yok. Modern ikonlarda tek merkez, kararlı simetri
  ya da bilinçli tek diyagonal.
- **Yüzey:** düz kırmızı; hafif derinlik (çok ince dikey gradyan ya da tek ton üstü %8 açık "ışık") çağdaş görünümü verir,
  ama flat kalmak da kabul edilir.
- **Anlam:** "kayıt programı" (kart) + "futbol" (top/krampon). Modern yaklaşımda ikisi tek sembolde birleşir.

### 34.2 Tasarım ilkeleri (v2)
1. Tek fikir, en fazla 2 öğe; kontur yok, düz dolgu (beyaz üstüne kırmızı ya da tersi).
2. 1024 ızgara, squircle (Apple tarzı süperelips ~ %22 yarıçap), öğeler ikonun %60–70'ini kaplar, kenar payı eşit.
3. 16 px'te tanınır siluet (yalnız beyaz-kırmızı kontrastı), 32 px'te fikir okunur, 256 px'te detay (pentagon, tik).
4. Yüzey: kırmızı #E0101F → altta #C00D1A çok hafif dikey gradyan (isteğe bağlı; flat sürüm de üretilir).
5. Aynı sembol beyaz zeminli sürümde (giriş/kenar menü) kırmızı olarak kullanılır — tek SVG, iki renk seti.

### 34.3 Yönler (mockup'ta gösterilecek)
- **A · Top + Tik:** büyük top; pentagonların biri yerine kalın beyaz tik (onay/yoklama/kayıt). Tek nesne, çok güçlü siluet.
- **B · Kart + Top (sadeleşmiş):** kartın yalnızca dış hatları (yuvarlak dikdörtgen, üstte tek klips çentiği) ve içinde tek
  büyük top; satırlar/krampon yok. Mevcut fikrin düz versiyonu.
- **C · Krampon silueti:** tek beyaz krampon silueti (düz, çivisiz), burnunda küçük kırmızı top negatif alan olarak. Spor
  markası hissi, en "ikonik".
- **D · FO monogram:** kalın kondanse "FO", O harfi top; kırmızı zemin. Metin tabanlı, marka gibi.

### 34.4 Uygulama (onaydan sonra)
`build/logo.svg` + `build/logo-kirmizi.svg` yenilenir; `build/icon.png` (1024) ve `public/logo.png` (512) yeniden üretilir
(Electron canvas ile, §30 yöntemi); `tests/logo-dosyalari.test.js` boyut/alfa testi aynen; tuval `design/`e kopyalanır. Kulüp
logosu yüklüyse ekranlarda zaten o görünür (§32); uygulama logosu yalnız exe/kurulum/masaüstü ikonu ve logosuz kurulumda
giriş/kenar menü içindir.

### 34.5 Karar (Kerem, 10.09.2026: "mevcutun arka planını kırmızı yapalım")
Dört modern yön (tuval: https://claude.ai/code/artifact/54f6240d-883c-4b69-a2a4-f7e6df1af619) yerine mevcut kayıt kartı + krampon +
top logosu korunur, zemin beyazdan KIRMIZIYA (#E0101F) alınır: beyaz kart, koyu kırmızı klips/başlık, beyaz krampon, beyaz hız
çizgileri, top. `build/logo.svg` artık kırmızı sürüm (kaynağı `logo-kirmizi.svg`), eski beyaz sürüm `build/logo-beyaz.svg`;
`build/icon.png` (1024) ve `public/logo.png` (512) yeniden üretildi; test `tests/logo-dosyalari.test.js` kırmızı zemini doğrular.
Yeni ikon exe/kurulum/masaüstüne bir sonraki sürümle gider; giriş/kenar menüde hemen (logosuz kurulumda).

### 32.10 Yoklama formu alt yazısı (slogan) KALDIRILDI (Kerem, 11.09.2026: "uygulamadan tamamen kaldır")
`kulup_slogan` ayarı, Ayarlar > Kulüp'teki alan, marka kanalındaki `slogan`, `yoklamaFormuHtml` parametresi ve `.dip` satırı
silindi; form artık dipsiz. Eski kurulumda ayarlar tablosunda kalmış bir `kulup_slogan` değeri zararsızdır (okunmaz). Testler
ve kurulum rehberi buna göre güncellendi.


## 35. Ayarlar > Kullanıcılar — gerçek pencere testi (11.09.2026)

Kerem: "ayarlar, kullanıcılarda tüm durumları test et." `scripts/tests/kullanicilar-e2e.cjs` (`tests/kullanicilar-e2e.test.js`
sarmalar; `[ekranGoruntusuDizini]` ile görüntü), 33 kontrol: Hesabım (ad/rol, "Kurtarma kodu yok" rozeti, Kurtarma Kodları Üret →
onay metni, 8 kod XXXX-XXXX penceresi, Kopyala → pano, Yazdır → `cikti:yazdir` HTML'i, kapatınca "8 kurtarma kodu" ve "Yenile"
düğmesi, yenilemede "Eski kodlar geçersiz olur", Vazgeç), Parolamı Değiştir (yanlış mevcut parola reddi, doğru → DB'de yeni
parola), kullanıcı ekleme (boş/kısa parola reddi, kullanıcı ve yönetici ekleme, kopya ad reddi, form temizlenir,
`must_change_password=1`), kendi satırında düğme yok / diğerlerinde 4 düğme, satır işlemleri (kurtarma kodu, parola sıfırla →
"Geçici parola: ey-…" toast'ı ve DB'de geçerli, pasif yap → giriş reddedilir, aktif yap), silme (onay/Vazgeç/Evet, DB'de yok),
DB kuralı "son aktif yönetici silinemez", IPC "kendi hesabınızı silemezsiniz", kullanıcı rolüyle giriş (zorunlu parola penceresi,
Ayarlar sekmesi yok), yöneticinin yeni parolasıyla giriş. Bulunan/düzeltilen: geniş kenar menüdeki Çıkış düğmesinde `aria-label`
yoktu (dar menüde vardı) — eklendi.

## 36. Tasarım tutarlılığı analizi (11.09.2026) — bulgular; UYGULANDI (aynı gün, §36.3)

Kerem: "uygulamayı tasarım açısından analiz et ve tutarsızlık olan yerleri listele." Yöntem: kod ölçümleri (`grep`: başlık boyutları,
köşe yarıçapı, boşluk, Kart dolgusu, Btn türleri, Rozet dışı piller, ham input/select/label, boş durum metinleri, Kaydet çubukları)
+ duman testi ekran görüntüleri (Oyuncular, Oyuncu kartı Bilgiler/Ödemeler, Tahsilat, Yoklama, Raporlar, Yaş Grupları,
Ayarlar > Kullanıcılar/Lisans/WhatsApp/Yedekleme).

**Sağlam olan omurga:** tek renk sistemi (CSS değişkenleri + tema), sayfa başlığı h1 30 Barlow, bölüm başlığı h3 22, `Kart`/`Btn`/
`Rozet`/`Alan`/`Girdi`/`Onay`/`Modal` ilkelleri, tablo başlığı stili (CSS), toast (ok/err) her yerde aynı, `Onay` diyaloğu her yerde
(hiç `window.confirm`/`alert` yok), etiketler 12 px büyük harf soluk, giriş yüksekliği 42.

### 36.1 Tutarsızlıklar (öncelik sırasıyla)
1. **Tablo hücrelerinde satır kırılması:** Oyuncular'da ad ("Ela / Demir") piller yüzünden ikiye bölünüyor; Raporlar'da "3.500 ₺"
   ve "Kerem Yılmaz", Kullanıcılar'da "Ahmet Hoca" kırılıyor. Kural yok: ad/tutar/tarih hücreleri `whiteSpace: nowrap`, piller ada
   değil ayrı satıra/sütuna. (Oyuncular satırında ad + 2 pil aynı flex satırında.)
2. **Oyuncular satırında iki belge pili üst üste:** "Sağlık raporu yok" (kırmızı) + "Eksik belge (5)" (sarı) — sağlık raporu zaten
   eksik belge sayısına dahil; her satırda iki pil gürültü. Öneri: tek pil "Eksik belge (5)"; sağlık raporu süresi dolan/dolacak için
   ayrı kırmızı pil yalnız o durumda.
3. **Birincil eylem rengi iki türlü:** sarı (`tur="sari"`: Makbuz Kes, Kaydet ve Yazdır, güncelleme şeridi) ve mor (Yeni Oyuncu,
   Önizle, Antrenman Ekle, Grup Ekle, Kullanıcı Ekle, Şimdi Yedek Al, Kaydet). Yazılı kural yok. Öneri: sarı = yalnız "para/makbuz"
   eylemi (Makbuz Kes, Kaydet ve Yazdır); diğer her birincil eylem mor — CLAUDE.md'ye kural.
4. **Alt başlık stilleri:** çoğu bölüm h3 22 (Barlow); Oyuncu formu/Aile/Bilgi/Ödeme sekmeleri h3 20; Yedekleme alt başlıkları düz
   `div fontWeight 700 fontSize 16` (Source Sans) — üç farklı seviye. Öneri: sayfa h1 30 · bölüm h3 22 · alt bölüm h4 16 Barlow
   (yeni `AltBaslik` ilkeli), `fontSize: 20` kullanımları 22'ye.
5. **"Ekle" formunun yeri:** Yaş Grupları'nda listenin ÜSTÜNDE (kart içinde), Kullanıcılar'da listenin ALTINDA, Aidat Kalemleri'nde
   satır içi "+ satır". Öneri: tek kalıp — liste üstünde kısa form ya da "Ekle" düğmesiyle açılan satır; ikisinden biri seçilip
   uygulanmalı (öneri: Kullanıcılar'daki gibi listenin altında, çünkü liste öncelikli).
6. **Kaydet kalıbı üç türlü:** Kulüp: sağa yaslı "Vazgeç / Kaydet" çubuğu (kirli değilse kapalı); Aidat Kalemleri: yapışkan sarı
   "N değişiklik kaydedilmedi · Vazgeç / Kaydet"; WhatsApp: alttaki tek "Kaydet" (kirli sayacı yok). Öneri: tek `KaydetCubugu`
   ilkeli (yapışkan, kirli sayacı, Vazgeç/Kaydet), üç ekranda da aynı.
7. **"Sil" düğmesi ikonlu/ikonsuz:** Kullanıcılar'da × ikonlu, Yaş Grupları/Oyuncu kartı/Aidat Kalemleri'nde ikonsuz. Öneri: satır
   içi küçük Sil her yerde ikonsuz (Yaş Grupları gibi); büyük tehlikeli eylemler ikonlu (Geri Yükle gibi).
8. **Köşe yarıçapı dağınık:** 10 (34), 8 (22), 12 (8), 6 (5), 7/14/16/2/3 tekil. Btn/Girdi 8, Kart 12, kutular 10. Öneri: 8 (kontrol),
   12 (kart/modal), 999 (pil); 6/7/14/16 kaldırılır.
9. **Kart iç dolgusu:** 20 (7), 22 (2), 24, 18/20, 16/18, 14 (2), 10. Öneri: kart 20, ana ayar kartı 24, menü kartı 10 — üç değer.
10. **Boşluk (gap) 12 farklı değer** (3–24). Öneri: 4/8/12/16/24 ölçeği; 6→8, 10→12, 14→16, 18/20/22→16 ya da 24.
11. **Rozet dışı el yapımı piller:** IlkKurulum (2), WhatsAppHatirlat, YasGruplari, Hakkında, TemaSecici (4), WhatsAppAyar (yer
    tutucular). Öneri: hepsi `Rozet` (gerekirse `mono` prop'u yer tutucular için).
12. **Ham `<input>`/`<select>` kullanımı:** Giris (7, bilinçli: 46 px büyük giriş), YasGruplari (3), KalemAyar (2), Tahsilat (2),
    Aile/Tema/Sezon/HizliArama; ham `<select>` KullaniciAyar ve OyuncuKarti (durum). Öneri: `Girdi`/`Secim` ilkelleri; Giriş
    ekranı için `buyuk` prop'u (46) — 42/46 ikiliği tek yerden.
13. **Boş durum metinleri farklı biçimde:** `Bos` bileşeni (Ödemeler "Makbuz yok."), soluk div (Pano), padding'li div (Hızlı arama),
    12 px küçük yazı (Belgeler "Henüz yüklenmedi"), "—" (Yaş Grupları program, Oyuncular veli). Öneri: tek `Bos` ilkeli (ortalı, soluk,
    isteğe bağlı eylem düğmesi); hücre içi boşluk için "—".
14. **Sabit renkler kaldı:** `#D8CCE9` (TakvimSeridi, OyuncuKarti ×3, WhatsAppHatirlat ×2), `#1B1530` (OyuncuKarti select option) —
    tema açık renkte okunmaz. Öneri: `var(--ana-ustu-soluk)` / `var(--metin)`.
15. **Tahsilat "Bugünkü tahsilat" pili** sayfa başında tek başına sağda; diğer ekranlarda özet sayılar kartın başlığında (Yoklama
    "Toplam 3 Geldi 1…") ya da Pano kartlarında. Öneri: "Bugün Kesilen Makbuzlar" kartının başlığına taşınır.
16. **Modal genişlikleri:** 440/460/480/520/760/960/1120 — 7 değer. Öneri: 480 (onay/küçük form), 760 (orta), 1120 (oyuncu kartı).
17. **Çıkış düğmesi** geniş menüde yalnız ikon+metin, dar menüde ikon; etiket eklendi (11.09.2026) — tamam.

### 36.2 Öneri sırası (küçükten büyüğe, her adım testli)
a) 1+2 (tablo kırılması, belge pilleri) — görünür kazanç, küçük. b) 4+13 (`AltBaslik`, `Bos` ilkelleri). c) 3+7 (renk/ikon kuralı,
CLAUDE.md). d) 6 (`KaydetCubugu`), 5 (Ekle yeri). e) 8–12, 14, 16 (ölçek temizliği; refactor davranış değiştirmez, karakterizasyon
testleri + duman görüntüleri karşılaştırılır).

### 36.3 Uygulama (Kerem: "önerdiğin şekilde hepsini uygula", 11.09.2026)
- (a) `.tek-satir` sınıfı (ui.css); Oyuncular satırı: ad tek satır, piller kimlik satırında; Raporlar/Kullanıcılar hücreleri tek
  satır. Sağlık raporu hiç yokken ayrı pil yok — "Eksik belge (N)" kapsar; rapor varsa süresi dolmuş/dolacak/tarihsiz pili kalır
  (liste belge bilgisi taşımıyorsa eski pil). Oyuncular e2e beklentileri güncellendi.
- (b) `AltBaslik` (h4 16 Barlow) ve `Bos` (`kucuk`, `eylem`) ilkelleri; h3 20 → 22 (Tahsilat, OyuncuForm, Aile/Bilgi/Ödeme
  sekmeleri); Yedekleme alt başlıkları `AltBaslik`; Pano/Hızlı arama/Belgeler boş durumları `Bos`.
- (c) Sarı yalnız makbuz eylemi (Tema seçicideki "Bu renkleri kullan" mor oldu); Kullanıcılar'daki Sil ikonsuz; kural CLAUDE.md'de.
- (d) `KaydetCubugu` ilkeli — Aidat Kalemleri, WhatsApp ve Kulüp aynı çubuk (Kulüp'te yalnız değişiklik varken; test güncellendi);
  Yaş Grupları "Grup Ekle" formu listenin altına taşındı (Kullanıcılar gibi).
- (e) Yarıçap 6/7→8, 14/16→12 (ince çubuklar 2/3 kaldı); Kart dolgusu 10/16/20/24; gap 106 yerde ölçeğe çekildi (3→4, 6→8, 10→12,
  14→16, 18→20, 22→24); `#D8CCE9`/`#1B1530` → `--ana-ustu-soluk`/`--metin`; Modal 440/460/520→480, 960→1120; `Rozet mono`
  (WhatsApp yer tutucuları), Tema seçici "YENİ" etiketi `Rozet`; Kullanıcılar rol seçimi `Secim`. Etkileşimli çipler (sihirbaz adım/
  grup seçimi, "Pasif grupları da göster") ve WhatsApp sayacı bilinçli olarak el yapımı kaldı.


## 37. Sezon başlangıç/bitiş tarihi ve antrenman başlangıç/bitiş saati (UYGULANDI, 11.09.2026)

Kerem: "Yaş grupları düzenlede başlangıç ve bitiş girilsin, yoklamada antrenman eklede de girilsin. Yaz aylarında da aidat
alınıyor; kullanıcı sezon başlangıcı ve bitişini kendi seçsin. Önce planlama sonra mockup."

### 37.1 Bugün
- Sezon yalnız etiket ("2026-2027") + `sezon_baslangic_ayi` (varsayılan 9); `sezonAraligi` her sezonu 1 Eyl – 31 Ağu sayar; aidat 12 ay
  açılır (KALACAK: yaz aylarında da aidat var).
- Antrenman: `trainings.tarih/saat/saha`; haftalık program JSON `{gun, saat, saha}`; bitiş/süre yok.

### 37.2 Veri modeli (şema 19)
- Yeni tablo `seasons (sezon TEXT PK, baslangic TEXT, bitis TEXT)`. Göç: `aktif_sezon` + `player_seasons`/`group_seasons`/
  `receipts.sezon`'daki her sezon için satır; tarihler `sezonAraligi` ile (1 Eyl – 31 Ağu) doldurulur → davranış değişmez, kullanıcı
  sonra düzeltir. `db.sezonTarihleri(sezon)`, `db.sezonTarihKaydet(sezon, baslangic, bitis)` (ADMIN seti). Doğrulama (saf
  `sezon.js sezonTarihDogrula`): bitiş > başlangıç, başlangıç yılı etiketin ilk yılı, aralık ≤ 14 ay, sezonlar çakışmaz.
- `trainings.bitis_saat TEXT DEFAULT ''`; program JSON öğesine `bitis` ("18:30"). `programCoz` bitişi olmayan eski kayıtları kabul
  eder (bitiş ""). Göç mevcut antrenmanlara bitiş YAZMAZ (boş "—"); kullanıcı isterse Düzenle ile girer. Doğrulama (saf `program.js
  saatAraligiDogrula`): "HH:MM", bitiş > başlangıç, aynı gün. `saatEkle(saat, dk)`, `sureDk(bas, bit)`, `aralikKesisir(a, b)`.
- Aidat mantığına DOKUNULMAZ (12 ay). `sezonAraligi` yalnız etiket→varsayılan aralık üretir; gerçek aralık `seasons`'tan okunur.

### 37.3 Arayüz
1. **Yaş Grupları › Düzenle:** program editörü satırı Gün · Başlangıç · Bitiş · Saha (+ hesaplanan "90 dk"); bitiş < başlangıçta
   kırmızı kenar ve Kaydet kapalı; liste sütunu "Haftalık program" → "Pzt 17:00–18:30 · Çar 17:00–18:30".
2. **Yoklama › Antrenman Ekle / Düzenle:** Yaş grubu · Başlangıç · Bitiş · Saha; bitiş girilmezse boş kalır (zorunlu değil).
   Antrenman kartı "U12 · 17:00–18:30", yoklama başlığı "U12 Yoklama · 17:00–18:30", takvim şeridi değişmez. Aynı gün + aynı saha +
   kesişen aralıkta sarı uyarı satırı "Saha 1'de 17:00–18:30 U11 antrenmanı var" (engel değil). "Haftayı Programdan Doldur" bitişi
   programdan alır. Yoklama formu ve WhatsApp iptal/değişiklik şablonlarında saat "17:00–18:30" (yeni yer tutucu `{bitis}`;
   `{saat}` geriye uyumlu). Oyuncu kartı Yoklama sekmesi ve Raporlar yoklama özeti saat aralığını gösterir.
3. **Ayarlar › Yeni Sezon:** en üste "Sezon tarihleri" kartı — Aktif sezon (mevcut) · Başlangıç · Bitiş (tarih kutuları, varsayılan
   1 Eyl – 31 Ağu), not: "Aidat sezon boyunca 12 ay açılır; bu tarihler raporlar, uzun dönem seçimi ve sezon sonu hatırlatması
   içindir." Sezon sihirbazı yeni sezona geçerken yeni sezonun tarihlerini (bir yıl kaydırılmış) sorar.
4. **Kullanım yerleri:** Pano başlık satırında "Sezon 2026-2027 · 1 Eyl – 30 Haz · N gün kaldı"; bitişe 30 gün kala Pano'da sezon
   sonu hatırlatma şeridi (uyarı rengi); Raporlar sezon filtresi tarih aralığını `seasons`'tan alır; "Sezon Sonuna Kadar" uzun dönem
   seçimi bitiş ayına kadar; "Haftayı Programdan Doldur" sezon dışı haftada uyarır (engel değil); yoklama takviminde sezon dışı gün
   soluk.

### 37.4 Testler
Saf: `sezon.test.js` (tarih doğrulama, çakışma, varsayılan aralık), `program.test.js` (bitiş çözme, süre, kesişme, eski JSON uyumu),
`takvim`/`whatsapp` şablon `{bitis}`. UI: Yaş Grupları program editörü (bitiş < başlangıç kapalı), Yoklama ekleme formu ve kart
metni, SezonAyar tarih kartı, Pano sezon satırı. Electron: db-roundtrip (seasons göçü, sezonTarihKaydet doğrulama, trainings
bitis_saat), kalıcılık (sezon tarihleri + antrenman bitişi kalıcı), yas-gruplari/yoklama e2e genişletme (saha çakışma uyarısı).

### 37.5 Sıra ve süre
1. Şema 19 + saf yardımcılar + göç (küçük). 2. Yoklama: ekle/düzenle formu, kart/başlık, form/WhatsApp `{bitis}`, çakışma uyarısı
(orta). 3. Yaş Grupları program editörü + liste özeti + programdan doldurma (orta). 4. Sezon tarihleri: SezonAyar kartı, sihirbaz
adımı, Pano satırı + hatırlatma, Raporlar/Uzun Dönem/takvim etkileri (orta). Mockup onayından sonra 1→4.

### 37.6 Uygulama notları (11.09.2026)
- 1–4 uygulandı. Şema 19: `seasons` + `trainings.bitis_saat`; göç bilinen her sezonu varsayılan aralıkla (`electron/sezonTarih.cjs
  varsayilanSezonAraligi`, başlangıç ayından 12 ay) `seasons`'a yazar → `sezonTarihleri()` bunlarda `kayitli: true` döner; yalnız hiç
  görülmemiş etiketler varsayılan (`kayitli: false`) alır. (CJS ikizleri `electron/sezonTarih.cjs`, `saatAralik.cjs` 11.09.2026'da
  silindi; ana süreç `src/lib/sezon.js` / `program.js`'i doğrudan `require` eder — refactor 2. tur §8.6.)
- Yeni saf yardımcılar: `sezon.js` `sezonTarihDogrula`, `sezonKalanGun`, `kisaAralik` ("1 Eyl – 30 Haz"), `isoYilAy`; `program.js`
  `saatAraligi`, `saatDk`, `saatEkle`, `sureDk`, `saatAraligiDogrula`, `aralikKesisir` (bitişsiz antrenman 90 dk sayılır, uçtan uca
  değen kesişmez). `programCoz` `{gun, saat, bitis, saha}` verir (bitiş geçersizse "").
- Arayüz: Yoklama ekle/düzenle formu Başlangıç · Bitiş · Saha, kart "U11 · 17:00–18:30 · 90 dk", saha çakışma uyarısı (`role="alert"`,
  büyük/küçük harf duyarsız saha; engel değil); Yaş Grupları program satırı Başlangıç – Bitiş – Saha + "N dk"/neden, hatalıysa Kaydet
  kapalı; SezonAyar "Sezon tarihleri" kartı (Tarihleri Kaydet yalnız değişiklikte açık, rozet "N gün kaldı · 1 Eyl – 30 Haz") ve
  sihirbazda yeni sezonun Başlangıç/Bitiş'i (bir yıl kaydırılmış öneri; boş bırakılırsa tarih kaydedilmez, DB de aynı kuralı uygular);
  Pano başlık satırında "Sezon 2026-2027 · 1 Eyl – 30 Haz · N gün kaldı", bitişe ≤30 gün kala hatırlatma şeridi ("Sezon Ayarları"
  düğmesi; "sezon bitti" şeridi varsa bu çıkmaz); Raporlar "Tümü" aralığı `sezonListesiTarihli`'den (kayıt yoksa 12 ay); Uzun Dönem
  "Sezon Sonuna Kadar" `sezonDurumu.tarihler.bitis` ayına kadar (`UzunDonemModal sezonBitis` prop'u).
- Sezon dışı işaretleme (11.09.2026, Kerem onayı "tamamdır"): takvim şeridinde sezon tarihleri dışındaki gün soluk (opacity .5,
  `data-sezon-disi`, etiket "· sezon dışı", gösterge "Soluk gün: sezon dışı") ama TIKLANABİLİR ve antrenman eklenebilir; seçili gün
  sezon dışındaysa başlıkta gri "Sezon dışı" rozeti; "Haftayı Programdan Doldur" engellemez, haftanın TAMAMI sezon dışındaysa sonuç
  toast'ına "· bu hafta sezon dışında" eklenir (kısmen kesişen hafta sezon içi sayılır). Saf `takvim.js sezonDisiMi`,
  `haftaSezonDisiMi`; `TakvimSeridi` `sezon` prop'u; Yoklama `sezonDurumu().tarihler` okur (yoksa hiçbir gün soluk değil).
- Yaş Grupları e2e (Kerem: "tüm durumlar için test et"): kayıtlı bitişin Düzenle'de dolu gelmesi, bitişi temizleme (özet yalnız
  başlangıç, JSON `bitis: ""`), iki günlü özet "Pzt 17:30 · Çar 17:00–18:30" eklendi; toplam 48 kontrol.
- Yoklama e2e (Kerem: "yoklamayı tüm durumlar için test et"): Düzenle'de kayıtlı bitiş dolu gelir, bitiş < başlangıç reddedilir,
  kart/başlık "17:30–19:00 · 90 dk", değişiklik notu `eskiBitis`, bildirim penceresi alt başlığında aralık, programdan doldurmada
  bitiş (bitişsiz gün yalnız başlangıç), +40 gün sezon dışı (soluk hücre, "Sezon dışı" rozeti, gösterge), sezon dışı güne ekleme,
  sezon dışı haftada doldurma notu, bugün sezon içi; toplam 50 kontrol.
- Testler: saf 26 (program/sezon/whatsapp), UI (yoklama, yaş grupları, sezon, raporlar-sezon, tahsilat, pano), Electron
  db-roundtrip/kalıcılık şema 19, yoklama/yaş grupları e2e bitiş + saha çakışması. `tests/ui/tahsilat.test.jsx` "Tahsil eden"
  testindeki önceden var olan yakalanmamış hata (mock her çağrıya "" dönüyordu) düzeltildi.

## 38. Ödeme dönemi = vade: vadesi gelmeyen aidat borç sayılmasın (UYGULANDI, 12.09.2026)

Kerem: "Ödeme dönemim 11-20 ama ayın 2'sindeyiz, beni borçlu gösteriyor mu?" → Evet. Bugün `odeme_donemi` yalnız gecikme gününü
üretir (`gecikmeGunu`); borçlu sayılma (Pano listesi, tesise giriş, Oyuncular süzgeci, Yoklama rozeti, WhatsApp toplu hatırlatma)
ayın 1'inden itibaren kaydın `odenmedi/kismi` olmasına bakar. İstenen: dönemin son günü geçene kadar ay "vadesi gelmedi" sayılsın.

### 38.1 Kavram
- **Vade** = ödeme döneminin son günü: "1-10" → 10, "11-20" → 20, "21-31" → ayın son günü (mevcut `donemSonGunu`). Vade günü dahil
  ödeme yapılabilir; **vade geçti** = bugün > vade. Geçmiş aylar her zaman vadesi geçmiş; gelecek aylar hiçbir zaman (mevcut
  `gelecekAcikAidatMi` kuralı korunur).
- Türetilmiş görünüm durumu (şema DEĞİŞMEZ, `monthly_dues.durum` aynı kalır): `odenmedi/kismi` + vade geçmedi → **"bekliyor"**
  (etiket "Vadesi gelmedi · 20 Eyl", ton gri/mavi); vade geçti → bugünkü gibi "Ödenmedi"/"Kısmi" kırmızı/sarı + gecikme günü.
- Ayar (isteğe bağlı, önerilir): `aidat_vade_bekle` = "1" (varsayılan açık). Kapalıysa eski davranış (ayın 1'inden borç). Ayarlar >
  Kulüp ve Makbuz > "Aidat, ödeme döneminin son gününden sonra borç sayılsın" onay kutusu. `ayarDogrula` İZİNLİ listesine eklenir.

### 38.2 Saf mantık (`src/lib/aidat.js`, `// @ts-check`)
- `vadeTarihi(donem, yil, ay)` → ISO; `vadesiGectiMi(donem, yil, ay, bugunIso)`; `aidatGorunumu(kayit, donem, bugunIso, vadeBekle)` →
  `{ durum: "odendi"|"muaf"|"bekliyor"|"odenmedi"|"kismi", vade, gecikme }` — tek karar noktası; tüm bileşenler bunu kullanır.
- `tesiseGirebilir(oyuncu, buAyAidat, { donem, bugunIso, vadeBekle })` → "bekliyor" ise TRUE (giriş serbest).
- `aidatTonu/aidatEtiket` "bekliyor" tonu/etiketi.

### 38.3 Veritabanı (`electron/db/aidat.cjs`, `pano.cjs`, `oyuncular.cjs`; şema yok)
- SQL'de vade: `CASE p.odeme_donemi WHEN '1-10' THEN 10 WHEN '11-20' THEN 20 ELSE <ay son günü> END` ile `vade_gecti` sütunu
  (yıl-ay bugünden eskiyse 1; bu aysa bugünün günü > vade; ileri aysa 0). `bugun` ISO parametresi renderer'dan gelir (panoOzet gibi).
- `listUnpaid(yil, ay, sezon, grup, { bugun, yalnizVadesiGecen })` → satırlarda `vade_gecti`, `vade`; Pano/WhatsApp toplu çağrısı
  `yalnizVadesiGecen: true`. `panoOzet` → `borclu` (vadesi geçen) + `bekleyen` (vadesi gelmemiş) sayıları.
- `listPlayersWithDue` / `playersPage` → `vade_gecti`; `sadeceOdemeyen` süzgeci yalnız vadesi geçenler.
- `listUnpaidAralik/listUnpaidSezon` (raporlar) → `vade_gecti` sütunu; filtre rapor tarafında.
- Ayar kapalıysa (`aidat_vade_bekle` = "") SQL'de `vade_gecti` her zaman 1 → tek yerden geriye dönüş.

### 38.4 Arayüz
1. **Pano › Tesise Giriş Kontrolü:** bekleyen → "GİREBİLİR" yeşil + altında "Aidat vadesi 20 Eyl" notu. **Aidatı Ödemeyenler**
   kartı yalnız vadesi geçenler; başlık yanında "· N oyuncunun vadesi gelmedi" sayısı (tıklanınca Oyuncular "bekleyen" süzgeci).
   Üst özet "Aidat borcu olan" = vadesi geçen; not satırı "N bekliyor".
2. **Oyuncular:** aidat rozeti "Vadesi gelmedi"; "Ödemeyenler" süzgeci = vadesi geçen; yeni süzgeç seçeneği "Vadesi gelmeyenler".
   Dışa aktarım aynı etiket.
3. **Yoklama listesi / Tahsilat oyuncu arama / Hızlı arama:** "Aidat"/"Borç" rozeti yalnız vadesi geçende; bekleyende rozet yok
   (Hızlı arama: gri "Bekliyor").
4. **Oyuncu kartı:** başlıktaki "N borç" vadesi geçenleri sayar; Ödemeler sekmesinde bekleyen satır "Vadesi gelmedi · 20 Eyl".
5. **Tahsilat:** dönem pillerinde kırmızı/"ödenmedi" işareti yalnız vadesi geçen aylarda; bu ayın bekleyen aidatı sade pil olarak
   yine SEÇİLİ gelir (veli ödemeye gelmiştir). Uzun dönem seçimi değişmez.
6. **WhatsApp:** toplu "Borçlulara Hatırlat" yalnız vadesi geçenlere; satır düğmesi bekleyende kapalı ("Vadesi gelmedi"). Şablona
   `{vade}` yer tutucusu (dd.mm.yyyy) ve `{gecikme}` mevcut.
7. **Raporlar › Borçlu Listesi:** "Vade" sütunu; varsayılan yalnız vadesi geçenler, "Vadesi gelmeyenleri de göster" onay kutusu
   (muhasebe tam listeyi isteyebilir). Excel/PDF aynı.
8. **Ayarlar › Kulüp ve Makbuz:** onay kutusu (38.1) + açıklama.

### 38.5 Testler
Saf `tests/aidat.test.js` (vade tarihi ay sonu/şubat, vadesi geçti sınır günü, bekliyor görünümü, ayar kapalı, tesise giriş);
db-roundtrip (`vade_gecti` her üç dönemde ve geçmiş/gelecek ayda, panoOzet bekleyen, sadeceOdemeyen); UI (`pano.test` giriş
kontrolü bekleyen/vadesi geçen, borçlu listesi süzme; `oyuncular` rozet+süzgeç; `yoklama` rozet; `tahsilat` pil; `raporlar` onay
kutusu; `kulup-ayar` ayar); e2e: `oyuncular-e2e` ve pano duman görüntüsü tarihe bağlı olduğundan `bugun` parametresi sabitlenerek.

### 38.6 Sıra ve süre
1. Saf + DB + ayar (2 saat). 2. Pano/Oyuncular/Yoklama/HızlıArama/OyuncuKartı rozetleri (2 saat). 3. Tahsilat + WhatsApp (1 saat).
4. Raporlar + Ayarlar + rehber (1 saat). 5. Testler ve e2e (2 saat). Davranış değişikliği olduğu için sürüm notunda açıkça yazılır;
kulüp eski davranışı isterse ayarı kapatır. Onaylanırsa mockup gerekmez (mevcut ekranlara rozet/not/onay kutusu eklenir).

### 38.7 Uygulama notları (12.09.2026)
- Tek SQL parçası `electron/db/vade.cjs vadeSecimi(bugun)` (`d`/`p` takma adları; ayar `aidat_vade_bekle` = "0" → sabit 1). `listDues`,
  `listUnpaid` (+`{ bugun, yalnizVadesiGecen }`), `listUnpaidAralik/Sezon` (+`vadesi_gecen_ay`), `panoOzet` (+`bekleyen`),
  `listPlayersWithDue/playersPage` (`vade_gecti` sütunu; `sadeceOdemeyen` = vadesi geçen, yeni `bekleyen` süzgeci) — hepsi `bugun`
  ISO parametresi alır (varsayılan bugün; testler sabitler). Şema değişmedi.
- Saf `src/lib/aidat.js`: `gorunenAidatDurumu(durum, vade_gecti)` ("bekliyor"; vade bilgisi yoksa eski davranış), `vadeTarihi`,
  `vadesiGectiMi`, `tesiseGirebilir` bekliyor → girebilir, `aidatEtiket` "Vadesi gelmedi"; `ui.jsx aidatTonu` gri.
- Arayüz: Pano (giriş kontrolü vade notu, özet "N oyuncunun vadesi gelmedi", borçlu kartı bağlantısı → Oyuncular "bekleyen"),
  Oyuncular ("Vadesi gelmeyenler" süzgeci, rozet), Yoklama/Tahsilat arama/Hızlı arama rozetleri, Oyuncu kartı (borç sayacı, ödeme
  satırında "vade dd.mm.yyyy"), Tahsilat pilleri (`donemSecenekleri` vade_gecti=0 → borç değil, yine seçili), WhatsApp `{vade}`,
  Raporlar Borçlu Listesi "Vade" sütunu + "Vadesi gelmeyenleri de göster", Ayarlar > Kulüp ve Makbuz onay kutusu.
- Kararlar: vade günü ödeme günüdür (21'inde borç); kısmi ödenmiş ama vadesi gelmemiş ay da "bekliyor". Sürüm çıkarılmadı (Kerem'in
  kararı).
- Gerçek pencere paketi `scripts/tests/vade-e2e.cjs` (Kerem: "değişen yerleri tüm durumlar için test et", 12.09.2026): beklentiler
  bugünün gününe göre `src/lib/aidat.js vadesiGectiMi` ile hesaplanır (üç dönem, kısmi, ödenmiş, geçmiş ay borcu); Pano özet/giriş
  kontrolü/ödemeyenler kartı/bağlantı, Oyuncular süzgeçleri ve rozetleri, oyuncu kartı Ödemeler, hızlı arama, Tahsilat rozet + pil,
  Yoklama rozeti, Raporlar Borçlu Listesi (+kutu), WhatsApp toplu alıcı sayısı, ayar KAPALI → eski davranış; 27 kontrol. Paket bir
  hata yakaladı: `App.jsx git()` yalnız yeni/borclu/saglik parametrelerini iletiyordu → Pano'daki "vadesi gelmedi" bağlantısı
  Oyuncular'da süzgeci açmıyordu; "bekleyen" eklendi.

## 39. Güncelleme şeridi girişten sonra kaçan olayı alır (UYGULANDI, 12.09.2026)

Kulüp (1.1.0): "güncelleme olmasına rağmen açılışta banner gelmedi". Neden: `main.cjs` açılışta `checkForUpdates()` çağırır, olay
1–3 sn içinde gelir; `GuncellemeSeridi` ise yalnız giriş yapıldıktan sonra (`main` içinde) bağlanır → `updater:available` giriş
ekranındayken gönderilip kayboluyordu. Yalnız Ayarlar > Hakkında > "Güncellemeleri Denetle" çalışıyordu.
Düzeltme: `ipc/guncelleme.cjs` son olayı saklar (`sonDurumGuncelle` saf durum makinesi: var → indiriliyor(yüzde) → indirildi; hata
yalnız bir şey başladıysa), `updater:durum` IPC'si (oturum şart) bunu verir; `GuncellemeSeridi` bağlanınca `updater.durum()` okur ve
kaçan olayı devralır. Eski köprüde `durum` yoksa sessizce çizilmez. Testler: `tests/guncelleme-durum.test.js`,
`tests/ui/guncelleme-seridi.test.jsx` (+2). Kulübe geçici yol: Ayarlar > Hakkında > Güncellemeleri Denetle → İndir.


## 40. Oyuncu giriş kartı (UYGULANDI, 12.09.2026)

Kerem: 11 × 6 cm yatay kart; mockup'ta Yön C (koyu mor zemin, sarı vurgu) seçildi; QR kodu İSTEĞE BAĞLI (kulüpte okuyucu yok);
arka yüz 4 kural (4: "Lütfen kartınızı yanınızda bulundurunuz; kartı olmayan antrenmana katılamayacaktır."). Mockup:
https://claude.ai/code/artifact/3f151153-d241-4a14-8097-7337cd972856 (sayfa 1: Yön C + arka yüz; sayfa 2: A/B arşiv).

### 40.1 Kart içeriği
- **Ön yüz:** kulüp logosu (yoksa uygulama arması yer tutucu), kulüp adı + "Futbol Okulu · <kuruluş yılı>", sezon pili, "OYUNCU GİRİŞ
  KARTI", foto (yoksa siluet), ad soyad, yaş grubu, oyuncu no; QR yalnız ayar açıksa (sağda beyaz kutu). Renkler kulüp temasından
  (`temaTuret`: mor-koyu zemin, mor daire, sarı vurgu, `--ana-ustu`/`--vurgu-ustu` yazı) — tema değişince kart da değişir.
- **Arka yüz:** 4 kural (sabit metin, Ayarlar'dan değiştirilebilir — 40.3), veli adı + maskelenmiş telefon, kulüp adres/telefon/e-posta
  (yeni ayarlar), kart no barkodu (QR ile aynı anahtar; kapalıysa yalnız "2026 0123" metni), alt bant "Bulunması hâlinde kulübe teslim
  ediniz".
- **Oyuncu no** = `players.id` 4 haneli (0123); kart no = `<sezon ilk yılı> <oyuncu no>`. Yeni sütun YOK.
- Kartta aidat durumu / son kullanma tarihi YAZILMAZ (aylık değişir; giriş kontrolü canlı durumu gösterir).

### 40.2 Nerede / nasıl
1. **Oyuncu kartı modalı:** başlık satırına "Giriş Kartı" düğmesi (Makbuz Kes'in yanı; `saltOkunur`da da açık — yazdırma yazma
   değil). Tek A4'te ön + arka yüz yan yana, kesim çizgili; makbuzla aynı akış (`htmlYazdir` → yazıcı yoksa PDF aç; "PDF" düğmesi
   `cikti:pdfKaydet`). Yeni kayıt sonrası toast'ta "Giriş kartını yazdır" bağlantısı.
2. **Oyuncular › toplu:** filtre çubuğuna "Kartları Yazdır" (süzgeçteki oyuncular; en çok 200 uyarısı). A4 dikey: 2 sütun × 4 satır =
   8 ön yüz, sonraki sayfada aynı sırayla 8 arka yüz (çift taraflı baskıda arka arkaya gelir; tek taraflıda kesip yapıştırma). Kesim
   çizgileri 0,3 mm gri; kenar boşlukları 10 mm.
3. **Ayarlar › Kulüp ve Makbuz › "Giriş kartı" bölümü:** kulüp adresi, telefon, e-posta/web (yeni ayarlar `kulup_adres`,
   `kulup_telefon`, `kulup_web`, İZİNLİ listesine); kural metinleri (4 satır, varsayılan mockup metni, `kart_kural_1..4`, ≤120
   karakter); "Kartta giriş kodu (QR/barkod) bas" onay kutusu `kart_qr` = ""/"1" (varsayılan KAPALI); kart önizlemesi (örnek
   oyuncuyla) aynı bölümde.

### 40.3 Teknik
- Saf şablon `src/lib/kartHtml.js` (`girisKartiHtml({ oyuncu, veli, marka, sezon, kurallar, iletisim, qr })` → ön/arka yüz HTML,
  `esc` + `guvenliLogo`, `@page` 11cm × 6cm tek kart / A4 toplu düzen `kartSayfasiHtml(kartlar)`), test `tests/kart-html.test.js`.
  Foto `files:dataUrl` ile (`guvenliLogo` regex'iyle aynı doğrulama); yoksa siluet SVG.
- QR/barkod: saf, bağımlılıksız üretici `src/lib/qr.js` (QR sürüm 1–3, ECC M; Code 128 SVG) — ayar kapalıyken hiç çağrılmaz. Kod
  içeriği: `FOK:<kartNo>` (uygulama önekiyle; başka kulübün kartı ayırt edilir).
- Yazdırma ana süreçteki mevcut `cikti` bölümü (JS kapalı, ağ kapalı); yeni IPC yok.
- Veri: `getPlayer` + `listGuardians` (birincil veli) + `app:marka` + `sezonDurumu` — mevcut OKUMA çağrıları; şema değişikliği YOK.

### 40.4 İleride: kartla giriş sistemi (AYRI İŞ — kulüp okuyucu alırsa)
- Okuyucu tipi: klavye gibi çalışan USB barkod/QR okuyucu (ek sürücü yok). Okunan `FOK:<kartNo>` metni Pano › Tesise Giriş Kontrolü
  arama kutusuna düşer; kutu `FOK:` önekini tanıyıp kart no → oyuncu eşler, tek sonucu büyük kartla gösterir (GİREBİLİR / AİDAT
  BORCU / GİREMEZ) ve 5 sn sonra kutuyu temizler ("kiosk kipi").
- Giriş günlüğü (isteğe bağlı): `girisler(player_id, zaman, sonuc)` tablosu → Raporlar "Tesise giriş" (kim, ne zaman, kaç kez);
  yoklama ile karıştırılmaz.
- Kart iptali: kayıp kartta yeni kart no (sonek `-2`) → eski kod "iptal" sonucu verir; `players.kart_seri` sütunu (yalnız bu adımda
  şema değişir).
- Kiosk ekranı: ayrı pencere/tam ekran, yalnız arama kutusu + sonuç; kullanıcı oturumu gerekmeden yalnız giriş kontrolü (OKUMA).
- Ön koşul: 40.2/3 ile kartlarda kod basılmış olması (`kart_qr` açık); kod formatı bugünden sabitlenir ki sonradan basılan kartlar
  geçerli kalsın.

### 40.5 Sıra ve süre
1. Ayarlar bölümü + saf şablon + testler (2 saat). 2. Oyuncu kartı modalında "Giriş Kartı" + PDF (1,5 saat). 3. Toplu basım A4
   (1,5 saat). 4. QR/barkod üretici (isteğe bağlı, 1,5 saat; ayar kapalıyken görünmez). 5. Rehber + e2e (1 saat). §40.4 bu turda
   YAPILMAZ; kulüp okuyucu kararı verince planlanır.

### 40.6 Uygulama notları (12.09.2026)
- Saf şablon `src/lib/kartHtml.js` (`girisKartiHtml({ oyuncular, ayar, duzen: tek|toplu|onizleme })`, `oyuncuNo`, `kartNo`, `telMaskele`,
  `KART_KURAL_VARSAYILAN`); kodlar `src/lib/kartKod.js` (`qrSvg` = mevcut `qrcode` bağımlılığı, saf JS; `code128Svg` Code 128 B saf
  tablo, `kodMetni` = "FOK:" + kart no); veri toplama `src/lib/kartVeri.js` (`kartAyarlariOku`, `kartOyuncusu`, `fotoKucult` canvas ≤240 px
  — toplu basımda HTML şişmesin). Foto yalnız `guvenliResim` (png/jpeg/webp data URL).
- **Düzeltme:** 11 cm'lik kart A4 dikeye yan yana SIĞMAZ (22 > 21 cm) → tüm düzenler A4 YATAY; toplu 2 × 3 = 6 kart/sayfa (planda 8
  yazılmıştı). Arka yüz sayfaları her 6'lık öbeğin hemen ardından (çift taraflı "kısa kenar" için).
- Arayüz: OyuncuKarti başlığında "Giriş Kartı" (salt okunurda da açık), Oyuncular filtre çubuğunda "Kartları Yazdır" (≤200), Ayarlar >
  Kulüp ve Makbuz › `GirisKartiAyar` (adres/telefon/web, 4 kural, `kart_qr`, `<iframe sandbox srcdoc>` önizleme örnek oyuncuyla).
  Yeni ayar anahtarları `ayarDogrula` İZİNLİ listesinde (uzunluk sınırları; `kart_qr` ""/"1").
- Testler: `tests/kart-html.test.js`, `tests/kart-kod.test.js` (Code 128 tablosu yapısal doğrulama: her sembol 11 modül), `tests/ui/
  giris-karti.test.jsx` (ayar bölümü, oyuncu kartı tek/QR, toplu), kulüp kimliği e2e'de gerçek PDF (tek 1 sayfa, 7 oyuncu toplu 4 sayfa).
- §40.4 (kartla giriş sistemi) YAPILMADI; kod biçimi `FOK:<kartNo>` sabitlendi. Sürüm çıkarılmadı.
- 12.09.2026 (Kerem: "ayarlar, kulüp ve makbuzun altına giriş kartını koy"): `GirisKartiAyar` Kulüp ve Makbuz'dan çıkarılıp menüde
  hemen altında AYRI bölüm oldu (kod `kart`, kendi Kaydet çubuğu ve onKirli); kulüp adı/logo/tema orada salt okunur bağlam.
- 12.09.2026: kural kutuları ve alt yazı boşken varsayılanla DOLU gelir; ön yüz gövdesi (foto, bilgiler, QR) başlık ile alt yazı arasında
  dikeyde ortalı (`.govde flex:1; align-items:center`); yeni ayar `kart_alt_yazi` (≤40, boşsa "Futbol Okulu · <kuruluş yılı>").

