# Eyüpspor Futbol Okulu — Kurulum ve Kullanım Rehberi

## 1. Kurulum (tek bilgisayar)
1. `Eyüpspor Futbol Okulu Setup x.y.z.exe` dosyasını çalıştırın, "Kur" deyin.
2. Masaüstündeki simgeyle açın. İlk giriş: kullanıcı adı **admin**, parola **admin**.
3. Program sizden hemen yeni bir parola isteyecek. En az 6 karakter girin.
4. Ardından **İlk Kurulum** sihirbazı açılır: kulüp adı → aidat taban fiyatı ve indirimler → yaş grupları
   ve sezon → yedek klasörü → kurtarma kodları (8 kod, bir kez gösterilir; yazdırıp saklayın) → Excel'den
   oyuncu aktarımı. Her adım atlanabilir; hepsi sonradan Ayarlar'dan değiştirilebilir. "Şimdi değil"
   derseniz oyuncu eklenene kadar bir sonraki girişte yeniden çıkar.
5. İsterseniz kendi adınıza bir yönetici hesabı açıp (Ayarlar > Kullanıcılar) hazır gelen **admin**
   hesabını silebilirsiniz. Program en az bir aktif yönetici kalmasını şart koşar.
4. **Ayarlar > Lisans**: satıcıdan aldığınız `EYUPSPOR.` ile başlayan anahtarı yapıştırıp kaydedin.
   Anahtar girilmezse program 30 gün deneme olarak çalışır, sonra salt okunur olur.
5. **Ayarlar > Yedekleme**: bir klasör seçin (harici disk veya OneDrive/Google Drive klasörü önerilir).
   Program açılışta otomatik yedek alır; sıklığı aynı ekrandan seçersiniz: her açılışta, günde bir
   (varsayılan), haftada bir ya da kapalı (yalnız "Şimdi Yedek Al"). Her yedek tek bir zip dosyasıdır
   (`eyupspor-yedek-tarih.zip`): veritabanı, vesikalıklar, belgeler ve makbuz PDF'leri içindedir.
   Geri yüklemek için aynı ekrandan zip dosyasını seçin.
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

## 2b. Günlük kullanımı kolaylaştıranlar

- **Ctrl+K** (Mac'te Cmd+K): her ekrandan oyuncu arama; Enter kartı açar, "Makbuz" tahsilata götürür.
- **Tek makbuzda birden fazla ay:** Tahsilat'ta aidat dönemi kutucuklarından birden fazla ay seçin.
- **Kısmi ödeme:** velinin verdiği tutarı yazın; ay "Kısmi" olur, kalan borç listelerde görünür, sonraki makbuzla tamamlanır.
- **Haftalık program:** Yaş Grupları > Düzenle'de gün/saat/saha girin; Yoklama'da "Haftayı Programdan Doldur"
  o haftanın antrenmanlarını tek tıkla açar (var olanlar atlanır).
- **Sağlık raporu:** panoda süresi dolan/dolacak raporlar listelenir; oyuncu kartında belge rozeti gösterir.
- **Makbuz iptali** neden ister; iptal eden ve zaman kayda geçer, tahsilat raporunda ayrı görünür.

## 3b. Sezon sonu

Sezon bitince (varsayılan Eylül'de) panoda "sezon bitti" uyarısı çıkar. **Ayarlar > Yeni Sezon**'da
yenileyen oyuncuları işaretleyin, gerekiyorsa yeni yaş grubunu seçin (U11 → U12 önerilir) ve "Yeni Sezona
Geç" deyin. Yenilemeyenler silinmez, "Pasif" olur: aidat borcu açılmaz, listede görünmez; geri dönerse
kartından durumu Aktif yapmanız yeter. Oyuncular listesi varsayılan olarak yalnız aktif oyuncuları
gösterir; pasifleri görmek için durum filtresini değiştirin.

## 3c. Bir yaş grubunda çok oyuncu varsa (örnek: iki U11 grubu)

Bir yaş grubuna sığmayacak kadar oyuncu olduğunda o yaşı iki ayrı grup olarak açın. Programda ek bir
"alt grup" alanı yoktur, ayrı grup açmak yeterlidir.

1. Ayarlar > Yaş Grupları'ndan "U11 A" ve "U11 B" adında iki grup açın. Sıra numaralarını ardışık verin ki
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

## 4. Sorun giderme
- **"Lisans salt okunur modda"**: Ayarlar > Lisans'tan geçerli anahtar girin.
- **"Sunucuya ulaşılamadı"**: Sunucu bilgisayarda program açık mı, aynı ağda mısınız, Tailscale bağlı mı?
- **"Sunucu kimliği doğrulanamadı"**: Sunucu yeniden kurulduysa normaldir; Ayarlar > Sunucu'dan
  yeniden bağlanıp yeni parmak izini onaylayın. Değilse yöneticiye haber verin.
- **Parola unutuldu**: Giriş ekranında **Parolamı unuttum** → kullanıcı adı + kurtarma kodlarından biri +
  yeni parola. Kurtarma kodu yoksa bir yönetici Ayarlar > Kullanıcılar'dan "Parola sıfırla" ile geçici
  parola üretir. Hiçbir yöneticinin ne parolası ne kurtarma kodu varsa satıcıya başvurun.
  Yanlış kod denemeleri kullanıcı başına 15 dakikada 5 ile sınırlıdır.
