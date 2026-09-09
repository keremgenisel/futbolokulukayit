# Eyüpspor Futbol Okulu — Kurulum ve Kullanım Rehberi

## 1. Kurulum (tek bilgisayar)
1. `Eyüpspor Futbol Okulu Setup x.y.z.exe` dosyasını çalıştırın, "Kur" deyin.
2. Masaüstündeki simgeyle açın. İlk giriş: kullanıcı adı **admin**, parola **admin**.
3. Program sizden hemen yeni bir parola isteyecek. En az 8 karakter girin. (Sonraki parola değişimlerinde
   mevcut parolanız da sorulur. Üst üste 8 yanlış girişte kullanıcı 15 dakika kilitlenir.)
4. Ardından **İlk Kurulum** sihirbazı açılır: kulüp adı → aidat taban fiyatı ve indirimler → yaş grupları
   ve sezon → yedek klasörü → kurtarma kodları (8 kod, bir kez gösterilir; yazdırıp saklayın) → Excel'den
   oyuncu aktarımı. Her adım atlanabilir; hepsi sonradan Ayarlar'dan değiştirilebilir (sihirbazı yeniden açmak için
   Ayarlar > Uygulama > İlk Kurulum Sihirbazı). "Şimdi değil"
   derseniz oyuncu eklenene kadar bir sonraki girişte yeniden çıkar.
5. İsterseniz kendi adınıza bir yönetici hesabı açıp (Ayarlar > Kullanıcılar) hazır gelen **admin**
   hesabını silebilirsiniz. Program en az bir aktif yönetici kalmasını şart koşar.
4. **Ayarlar > Lisans**: satıcıdan aldığınız `EYUPSPOR.` ile başlayan anahtarı yapıştırıp kaydedin.
   Anahtar girilmezse program 30 gün deneme olarak çalışır, sonra salt okunur olur.
5. **Ayarlar > Yedekleme**: bir klasör seçin (harici disk veya OneDrive/Google Drive klasörü önerilir).
   Program açılışta otomatik yedek alır; sıklığı aynı ekrandan seçersiniz: her açılışta, günde bir
   (varsayılan), haftada bir ya da kapalı (yalnız "Şimdi Yedek Al"). Her yedek tek bir şifreli dosyadır
   (`eyupspor-yedek-tarih.eyupyedek`): veritabanı, vesikalıklar, belgeler ve makbuz PDF'leri içindedir; bulut
   klasöründe bile içerik okunamaz. Geri yüklemek için aynı ekrandan dosyayı seçin (eski `.zip` yedekler de açılır).
6. **Ayarlar > Resim ve Belge Optimizasyonu**: eski yüklenmiş büyük fotoğrafları küçültür (yedekler küçülür).
   Yeni yüklenen JPG/PNG dosyaları zaten yükleme anında optimize edilir; PDF'lere dokunulmaz.
6. **Ayarlar > Aidat Kalemleri**: forma, eşofman gibi kalemlerin fiyatlarını girin.
7. **Yaş Grupları**: U9, U10, U11 … gruplarını oluşturun.

## 1b. Mevcut oyuncu listesini Excel'den aktarma

Kulübün elinde bir liste varsa tek tek girmeyin: **Oyuncular > İçe Aktar > Şablon İndir** ile şablonu
alın, sütunları doldurun (Ad Soyad ve Doğum Tarihi zorunlu; TC, Yaş Grubu, Aidat, Veli vb. isteğe
bağlı), sonra **Excel Dosyası Seç**. Önizlemede hatalı satırlar ve uyarılar görünür; "… Oyuncuyu Aktar"
ile geçerli satırlar tek seferde eklenir. Tanınmayan yaş grubu adları otomatik açılır, kayıtlı TC'ler atlanır.

## 2. Günlük kullanım
- **Yeni oyuncu**: Oyuncular > Yeni Oyuncu. Kayıt formundaki bilgileri girin, sonra oyuncu kartından
  aile bilgileri, acil kişiler ve belgeleri (sağlık raporu, fotoğraf, kimlik fotokopileri) ekleyin.
- **Aidat ve makbuz**: Tahsilat ekranında oyuncuyu arayın, dönemi ve kalemleri seçin, "Kaydet ve Yazdır".
  Makbuz A4'e iki kopya basılır (biri kulüpte kalır). PDF'i oyuncu kartında saklanır.
- **Tesise giriş kontrolü**: Pano'daki arama kutusuna oyuncunun adını yazın. Yeşil = girebilir,
  kırmızı = aidat borcu var.
- **Yoklama**: Yoklama ekranında tarihi ve antrenmanı seçin, her oyuncu için Geldi / Gelmedi / İzinli.
- **Raporlar**: Oyuncu listesi, borçlu listesi, tahsilat ve yoklama özeti; Excel veya PDF.

## 3. Birden fazla bilgisayar

> **Not (07.09.2026):** Bu özellik şu an programda kapalıdır (kulübün talebi yok). İstenirse
> tek ayarla açılır; aşağıdaki adımlar o zaman geçerli olur.
Veriler tek bir bilgisayarda (sunucu) durur, diğerleri ona bağlanır. Sunucu bilgisayarda program açık olmalıdır.

**Sunucu bilgisayarda:** Ayarlar > Sunucu / Çoklu PC > "Sunucuyu Başlat". Ekranda görünen adresi
(`https://192.168.x.x:3535` veya Tailscale için `https://100.x.x.x:3535`) ve parmak izini not edin.

**Diğer bilgisayarlarda:** Programı kurun, giriş ekranında "Başka bilgisayardaki sunucuya bağlan"
seçin, adresi yazın. Program sunucunun parmak izini gösterir; sunucu ekranındakiyle aynıysa onaylayın.
Sonra sunucudaki kullanıcı adı ve parolayla giriş yapın. (Kullanıcıları sunucu bilgisayarında
Ayarlar > Kullanıcılar'dan ekleyin.)

**Farklı yerlerden bağlanmak için (Tailscale):** Her iki bilgisayara https://tailscale.com'dan
Tailscale kurun ve aynı hesapla giriş yapın. Sunucu adresinde 100.x.x.x ile başlayan Tailscale
adresini kullanın. Windows güvenlik duvarı sorarsa programa izin verin.

**Yedek** yalnızca sunucu bilgisayarında alınır.

Sunucu varsayılan olarak tüm ağ arayüzlerini dinler. Yalnız Tailscale üzerinden erişilsin isteniyorsa `sunucu_adres`
ayarına Tailscale adresi (100.x.x.x) yazılır (satıcı ayarı; arayüzde alanı yok), sunucu yeniden başlatılır.

## 2b. Günlük kullanımı kolaylaştıranlar

- **Ctrl+K** (Mac'te Cmd+K): her ekrandan oyuncu arama; Enter kartı açar, "Makbuz" tahsilata götürür.
- **Tek makbuzda birden fazla ay:** Tahsilat'ta aidat dönemi kutucuklarından birden fazla ay seçin.
- **Kısmi ödeme:** velinin verdiği tutarı yazın; ay "Kısmi" olur, kalan borç listelerde görünür, sonraki makbuzla tamamlanır.
- **Haftalık program:** Yaş Grupları > Düzenle'de gün/saat/saha girin; Yoklama'da "Haftayı Programdan Doldur"
  o haftanın antrenmanlarını tek tıkla açar (var olanlar atlanır).
- **Sağlık raporu:** panoda süresi dolan/dolacak raporlar listelenir; oyuncu kartında belge rozeti gösterir.
- **Makbuz iptali** neden ister; iptal eden ve zaman kayda geçer, tahsilat raporunda ayrı görünür.
- **WhatsApp ile hatırlatma (API yok, ücretsiz):** Pano'da borçlu satırındaki yeşil WhatsApp düğmesi ya da "Borçlulara Hatırlat";
  oyuncu kartında veli satırında WhatsApp ve Ödemeler'de "Aidat Hatırlat". Program mesajı hazırlayıp bu bilgisayardaki
  WhatsApp'ı (masaüstü ya da tarayıcıda WhatsApp Web) açar, Gönder'e siz basarsınız; satır "Hatırlatıldı" olur. Onayı olmayan
  ya da numarası olmayan veliye düğme kapalıdır (Oyuncu kartı > Aile > Mesaj onayı). Şablonlar Ayarlar > WhatsApp Mesajları'nda.
- **Antrenman iptali / saat değişikliği:** Yoklama'da antrenmanı seçip "Düzenle" (tarih, saat, saha; yoklama alındıysa tarih
  kilitli) ya da "İptal Et"; ardından "Velilere bildirilsin mi?" sorusuna Evet deyin, grubun velileri için WhatsApp sırayla açılır.
  Sonra bildirmek isterseniz kartta "Velilere bildirilmedi" rozeti ve "Velilere Bildir" düğmesi kalır. Grubun WhatsApp veli
  grubu varsa penceredeki "Veli Grubuna Gönder" ile tek mesaj: WhatsApp sohbet seçme ekranı metin hazır açılır, grubu seçin.
- **Kullanıcı rolleri:** "Yönetici" her şeyi görür. "Kullanıcı" (antrenör/sekreter) Ayarlar'ı görmez; oyuncu, makbuz, yoklama,
  yaş grupları, raporlar, WhatsApp ve Excel aktarımı dahil geri kalan her şeyi yapar. Kullanıcı eklemek: Ayarlar > Kullanıcılar.
- **Sağlık raporu tarihi:** Rapor yüklerken geçerlilik tarihi zorunludur, kutu bir yıl sonrasıyla dolu gelir. Tarihsiz yüklenmiş
  eski raporlara Belgeler sekmesinde "Tarih gir" ile tarih girilir; tarih girilene kadar rapor "tarihsiz" sayılır.
- **Sağlık raporu olmayanlar:** Oyuncular listesinde "Bu ay ödemeyenler" yanındaki düğme; raporu hiç yüklenmemiş, tarihsiz ya da
  süresi dolmuş oyuncuları süzer, satırda kırmızı rozet gösterir.
- **Sağlık raporu durumu raporu:** Raporlar > Sağlık Raporu Durumu; bugüne göre süresi dolan, 30 gün içinde dolacak, yüklenmemiş ve
  geçerli raporlar en acil önce; yaş grubu filtresi; Excel/PDF.
- **Saha yoklama formu:** Yoklama'da antrenmanı seçip "Formu Yazdır" (ya da "PDF") deyin; A4 formda programda işaretli
  oyuncular dolu, kalanlar boş kutuyla gelir, antrenör sahada elle işaretler. Kâğıttakileri sonra ekranda işleyin.
- **Kalem ve ücret tipi ekleme:** Ayarlar > Aidat Kalemleri'nde alt satıra ad (ve fiyat / indirim) yazıp "Kalem Ekle" ya da
  "Ücret Tipi Ekle" deyin; adlar düzenlenebilir, "Sil" ile işaretlenir, hepsi tek Kaydet ile yazılır. Makbuzda kullanılmış
  kalem ve oyuncusu olan ücret tipi silinmez, pasife alınır. Normal ve Ücretsiz sabittir.

## 3b. Sezon sonu

Sezon bitince (varsayılan Eylül'de) panoda "sezon bitti" uyarısı çıkar. **Ayarlar > Yeni Sezon**'da
yenileyen oyuncuları işaretleyin, gerekiyorsa yeni yaş grubunu seçin (U11 → U12 önerilir) ve "Yeni Sezona
Geç" deyin. Yenilemeyenler silinmez, "Pasif" olur: aidat borcu açılmaz, listede görünmez; geri dönerse
kartından durumu Aktif yapmanız yeter. Oyuncular listesi varsayılan olarak "Aktif, deneme ve sakat" oyuncuları
gösterir; pasifleri görmek için durum filtresini değiştirin.

## 3c. Bir yaş grubunda çok oyuncu varsa (örnek: iki U11 grubu)

Bir yaş grubuna sığmayacak kadar oyuncu olduğunda o yaşı iki ayrı grup olarak açın. Programda ek bir
"alt grup" alanı yoktur, ayrı grup açmak yeterlidir.

1. Yaş Grupları sekmesinden "U11 A" ve "U11 B" adında iki grup açın. Sıra numaralarını ardışık verin ki
   listelerde yan yana dursunlar.
2. Her grubun haftalık programını kendi gün, saat ve sahasıyla girin. İki grup aynı saatte çalışıyorsa sahayı
   farklı yazın.
3. Oyuncuları Oyuncular sayfasından açıp yaş grubunu A ya da B olarak seçin; doğum yılı ipucu "U11 A seç /
   U11 B seç" bağlantılarını gösterir. Sezon ortasında bölüyorsanız B'ye geçecek oyuncuları tek tek düzenleyin.
4. Yoklama, raporlar ve pano iki grubu ayrı gösterir. U11 toplamı gerekiyorsa Excel çıktısında iki satırı
   toplayın.
5. Yeni sezona geçerken sihirbaz "U11 A" için "U12 A" önerir; "U12 A" yoksa "U12"yi önerir. Geçişten önce
   Yaş Grupları'nda gelecek sezonun gruplarını açın.

Kalabalık yıl geçince "U11 B"yi pasife alın, silmeyin. Silinen grubun antrenman ve yoklama kayıtları da silinir.

## 3d. Yeni bilgisayara taşıma

Normal yedek yalnız alındığı bilgisayarda açılır (şifreleme anahtarı o bilgisayara bağlıdır). Bilgisayar değişecekse
ya da bozulma ihtimaline karşı düzenli olarak:

1. Ayarlar > Yedekleme > **Yeni bilgisayara taşıma paketi**: bir parola belirleyin (en az 10 karakter), "Taşıma Paketi
   Oluştur" deyip dosyayı harici diske ya da bulut klasörüne kaydedin. Parolayı programın dışında bir yere yazın; parola
   olmadan paket açılamaz.
2. Yeni bilgisayarda programı kurun, `admin`/`admin` ile girip parolayı değiştirin.
3. Ayarlar > Yedekleme > **Taşıma paketinden geri yükle**: paket dosyasını seçin, parolayı girin, özeti onaylayın. Program
   yeniden başlar; tüm oyuncular, makbuzlar, belgeler ve ayarlar yerine gelir. Lisans anahtarını yeniden girmeniz
   gerekebilir (lisans makineye bağlıdır).

## 3e. Program güncellemesi

Yeni sürümler internetten kendiliğinden bulunur. Program açılınca yeni sürüm varsa üstte "Yeni sürüm hazır" şeridi
görünür (yalnız yöneticiye). Ayarlar > Hakkında > **Uygulama güncellemesi**: "Güncelleme Denetle" → "İndir" → "Yeniden
Başlat ve Kur". Program kapanıp yeni sürümle açılır; oyuncular, makbuzlar, belgeler ve ayarlar yerinde kalır. İnternet
yoksa güncelleme denetlenemez, program normal çalışmaya devam eder.

## 4. Sorun giderme
- **"Lisans salt okunur modda"**: Ayarlar > Lisans'tan geçerli anahtar girin.
- **"Sunucuya ulaşılamadı"**: Sunucu bilgisayarda program açık mı, aynı ağda mısınız, Tailscale bağlı mı?
- **"Sunucu kimliği doğrulanamadı"**: Sunucu yeniden kurulduysa normaldir; Ayarlar > Sunucu'dan
  yeniden bağlanıp yeni parmak izini onaylayın. Değilse yöneticiye haber verin.
- **Parola unutuldu**: Giriş ekranında **Parolamı unuttum** → kullanıcı adı + kurtarma kodlarından biri +
  yeni parola. Kurtarma kodu yoksa bir yönetici Ayarlar > Kullanıcılar'dan "Parola sıfırla" ile geçici
  parola üretir. Hiçbir yöneticinin ne parolası ne kurtarma kodu varsa satıcıya başvurun.
  Yanlış kod denemeleri kullanıcı başına 15 dakikada 5 ile sınırlıdır.

- **Makbuzdaki "Tahsil eden":** Ayarlar > Kulüp ve Makbuz > "Varsayılan tahsil eden" doluysa makbuza o isim yazılır; boşsa
  giriş yapan kullanıcının adı. Tahsilat ekranındaki kutu makbuz kesmeden önce her zaman elle değiştirilebilir.
