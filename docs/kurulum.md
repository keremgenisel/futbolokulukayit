# Eyüpspor Futbol Okulu — Kurulum ve Kullanım Rehberi

## 1. Kurulum (tek bilgisayar)
1. `Eyüpspor Futbol Okulu Setup x.y.z.exe` dosyasını çalıştırın, "Kur" deyin.
2. Masaüstündeki simgeyle açın. İlk giriş: kullanıcı adı **admin**, parola **admin**.
3. Program sizden hemen yeni bir parola isteyecek. En az 6 karakter girin.
4. **Ayarlar > Lisans**: satıcıdan aldığınız `EYUPSPOR.` ile başlayan anahtarı yapıştırıp kaydedin.
   Anahtar girilmezse program 30 gün deneme olarak çalışır, sonra salt okunur olur.
5. **Ayarlar > Yedekleme**: bir klasör seçin (harici disk veya OneDrive/Google Drive klasörü önerilir).
   Program her açılışta günde bir kez otomatik yedek alır.
6. **Ayarlar > Aidat Kalemleri**: forma, eşofman gibi kalemlerin fiyatlarını girin.
7. **Yaş Grupları**: U9, U10, U11 … gruplarını oluşturun.

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

## 4. Sorun giderme
- **"Lisans salt okunur modda"**: Ayarlar > Lisans'tan geçerli anahtar girin.
- **"Sunucuya ulaşılamadı"**: Sunucu bilgisayarda program açık mı, aynı ağda mısınız, Tailscale bağlı mı?
- **"Sunucu kimliği doğrulanamadı"**: Sunucu yeniden kurulduysa normaldir; Ayarlar > Sunucu'dan
  yeniden bağlanıp yeni parmak izini onaylayın. Değilse yöneticiye haber verin.
- **Parola unutuldu**: Yönetici Ayarlar > Kullanıcılar'dan "Parola sıfırla" ile geçici parola üretir.
  Yönetici parolası unutulduysa satıcıya başvurun.
