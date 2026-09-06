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
| TC Kimlik No | Zorunlu, benzersiz |
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
players            tc_no, ad_soyad, dogum_tarihi, dogum_yeri, okul, gsm, adres,
                   kan_grubu, foto, yas_grubu_id, durum, kayit_tarihi,
                   ucret_tipi (normal/burslu/indirimli/kardes/ucretsiz),
                   aylik_aidat_tutari, odeme_donemi (1-10 / 11-20 / 21-31)
guardians          player_id, tip (anne/baba/veli), ad_soyad, gsm, whatsapp_no, veli_mi
emergency_contacts player_id, ad_soyad, yakinlik, telefon
documents          player_id, tip (saglik/foto/sporcu_kimlik/veli_kimlik/kayit_formu/makbuz),
                   dosya_yolu, yuklenme_tarihi, gecerlilik_tarihi
fee_items          ad (Aidat, Forma, …), varsayilan_fiyat, aktif
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
7. **Yoklama** – antrenman seç, oyuncu listesi, geldi/gelmedi işaretle. Antrenman iptal düğmesi.
8. **Raporlar** – borçlu listesi, tahsilat raporu, yoklama özeti. Excel/PDF.
9. **Ayarlar** – kulüp bilgileri, aidat kalemleri ve fiyatları, kullanıcılar, yedekleme.

---

## 5. Aşamalar

### Faz 1 – Çekirdek (mutlaka olmalı)
- Giriş ve parola
- Yaş grupları
- Oyuncu kaydı, aile, acil kişiler, belgeler, durum
- Aylık aidat takibi, ücret tipleri
- Makbuz kesme, yazdırma, PDF olarak saklama
- Yoklama
- Ana ekranda "ödedi mi / geldi mi" görünümü
- Excel ve PDF çıktılar
- Günlük yedekleme

### Faz 2 – Çoklu PC ve roller
- Tailscale ile ikinci PC erişimi ve test
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
