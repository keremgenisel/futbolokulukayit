# Güvenlik İncelemesi — 08.09.2026

Kapsam: Electron kabuğu ve IPC, veri katmanı/şifreleme/yedek/lisans, renderer ve HTML şablonları, bağımlılıklar, gizli
bilgi hijyeni. Yalnız okuma; kod değiştirilmedi. Her bulguda kanıt `dosya:satır` biçiminde.

Tehdit modeli: tek kulüp PC'si; klavye başındaki kişi (personel) DevTools açabilir → `window.okul.*` yüzeyini doğrudan
çağırabilir. Bu yüzden arayüzdeki gizlemeler koruma sayılmaz, yalnız ana süreç kontrolleri sayılır. Sunucu modu arayüzde
kapalı ama IPC'leri canlı.

## Düzeltme durumu (08.09.2026, aynı gün)

Bulguların tamamı uygulandı; ikisi dışında (9: Kerem'in GitHub tarafı işi, 10: bilinçli kabul edilen risk). Her düzeltme
testle geldi (`tests/guvenlik-saf.test.js`, `tests/ui/parola-degistir.test.jsx`, `tests/ui/sifresiz-uyari.test.jsx`,
`tests/yetki.test.js`, `tests/metin.test.js`, `tests/tasima-kripto.test.js`, `tests/aktivasyon-sunucu.test.js`,
`scripts/tests/db-roundtrip.cjs`, `server-security.cjs`, `kalicilik.cjs`).

| # | Durum | Ne yapıldı |
|---|-------|-----------|
| 1 | DÜZELTİLDİ | `duzKopyaOlustur` paket kopyasından `makineId`/`lisansLease` siler; canlı DB'de kalır. |
| 2 | DÜZELTİLDİ | IPC login'de kullanıcı adı başına 8 deneme/15 dk (`data.cjs loginDenemeleri`), parola min 8 (IPC + sunucu + arayüz). |
| 3 | DÜZELTİLDİ | `istemci:baglan`/`kopar` admin oturumu (ya da ilk kurulum: oyuncu yok, ≤1 kullanıcı) ister; `trust/force` yalnız ana süreçte bekleyen parmak izi varsa. |
| 4 | DÜZELTİLDİ | `electron/makbuzIzin.cjs` (saf): salt okunur / iptal / PDF'i olan makbuz (admin değilse) reddedilir. |
| 5 | DÜZELTİLDİ | Yazdırma penceresi `session.fromPartition("cikti")`: `data:`/`about:`/`blob:` dışı her istek `onBeforeRequest` ile iptal, izin istekleri red, gezinme/açılır pencere kapalı. |
| 6 | DÜZELTİLDİ | Yedek zip'i makine anahtarıyla şifreli kapta yazılır (`eyupspor-yedek-<damga>.eyupyedek`, `tasimaKripto` YEDEK_MAGIC); eski düz `.zip` yedekler açılmaya devam eder; anahtar yoksa düz zip. |
| 7 | DÜZELTİLDİ | Yöneticiye kırmızı şerit `SifresizUyari` (`isEncrypted` OKUMA kümesine alındı). |
| 8 | DÜZELTİLDİ | Açılışta `geciciArtiklariTemizle()` (`eyupspor-tasima-*`/`eyupspor-geri-*`); `tasimaBilgi` bellek içi özet (`db.yedekBilgisiBuffer`), diske düz kopya yazmaz. |
| 9 | KEREM | Kod imzası bütçeye bağlı. Şimdilik: GitHub hesabında 2FA + `v*` etiketleri için korumalı etiket kuralı (plan §8.1 madde 7). |
| 10 | KABUL EDİLEN RİSK | Makine kimliği donanıma bağlanmadı: dağıtılmış lisansları bozar; 1 numaralı düzeltme pratik istismarı kapatıyor. DB + `lisans-meta.enc` birlikte silinirse deneme yeniden başlar (bilinçli). |
| 11 | DÜZELTİLDİ | `devTools: !app.isPackaged`, paketli Windows'ta uygulama menüsü yok, izin istekleri red. Tek istisna (09.09.2026): `clipboard-sanitized-write` — telefon numarasına tıklayınca kopyalama bunu gerektiriyor; pano okuma kapalı. |
| 12 | DÜZELTİLDİ | `will-navigate`/`will-redirect` yalnız `dist/index.html` (ya da dev URL). |
| 13 | DÜZELTİLDİ | `cagriYetkisi`: `must_change_password` olan oturumda her veri çağrısı 403 (IPC ve sunucu ortak). |
| 14 | DÜZELTİLDİ | Zorunlu ilk değişim dışında mevcut parola istenir ve doğrulanır (IPC, sunucu, `ParolaDegistir`). |
| 15 | DÜZELTİLDİ | `electron/belgeDogrula.cjs` (saf): tip beyaz listesi, pozitif tamsayı id, ISO tarih; oyuncu var mı kontrolü (IPC + sunucu). |
| 16 | DÜZELTİLDİ | Geri yükleme/taşıma yolu yalnız diyalogda seçilen (ana süreçte bekletilen) yol; 2 GB üst sınır. |
| 17 | DÜZELTİLDİ | Sunucu `sunucu_adres` ayarı varsa o adresi dinler (varsayılan 0.0.0.0); kurtarma sınırı `ip|kullanıcı` anahtarıyla. |
| 18 | DÜZELTİLDİ | Geçici parola ana süreçte `crypto.randomBytes` ile üretilir (`resetUserPassword`), renderer yalnız gösterir. |
| 19 | DÜZELTİLDİ | `hataMetni` SQLite/Chromium eşleme tablosu; ham metin yalnız `hataHam` ile (UNIQUE ayrımı için). |
| 20 | DÜZELTİLDİ | `guvenliLogo`: yalnız `data:image/(png|jpeg);base64,…`; üç şablon bunu kullanır. |
| 21 | DÜZELTİLDİ | Tek `esc` (`src/lib/metin.js`), tek tırnak dahil. |
| 22 | DÜZELTİLDİ | `resimBoyutu` başlıktan okur; 50 MP üstü resim çözülmeden atlanır. |
| 23 | DÜZELTİLDİ | `db-key.enc`/`lisans-meta.enc` `mode: 0o600`. |
| 24 | DÜZELTİLDİ | Taşıma parolası min 10, scrypt N=2^16 (maxmem 128 MB). |
| 25 | DÜZELTİLDİ | Admin token sabit zamanlı (`tokenEsit`), `/aktivasyon` ve `/yenile` IP başına 30/dk → 429. |
| Bilgi | DÜZELTİLDİ | LIKE `%`/`_` kaçışı; `listUsers` ADMIN kümesine; `.pre-restore` kopyaları son 3. Dev CSP notu olduğu gibi. |

## Sağlam bulunanlar
- Electron: `contextIsolation`, `sandbox`, `nodeIntegration=false`, `setWindowOpenHandler` deny, CSP `default-src 'self'`
  (`main.cjs:34-48`, `index.html:6`). Preload'da `ipcRenderer` sızmıyor; kanal adları sabit.
- `db:call` beyaz listesi: `constructor`/`__proto__` gibi adlar hiçbir kümede olmadığı için `db[fn]`'e ulaşmaz
  (`yetki.cjs:20-33`). Kullanıcı rolü IPC'den ayar yazamaz (ADMIN kümesi), salt okunur lisans ana süreçte.
- SQL: tüm kullanıcı verisi parametreli; dinamik sütunlar `PLAYER_FIELDS` beyaz listesi. `PRAGMA key`/`VACUUM INTO`
  yalnız iç değer alır.
- Dosya yolları: `uploadsIci` (`files.cjs:22-27`) `../` ve mutlak yolu reddeder; zip açmada yol geçişi korunur
  (`yedek.cjs:55-59`).
- Kripto: DB anahtarı `randomBytes(32)` + safeStorage; taşıma paketi scrypt + AES-256-GCM, IV/salt her pakette rastgele.
- Parola/oturum: bcrypt cost 10, kurtarma kodları bcrypt + tek kullanımlık + 5/15 dk; ilk admin zorunlu değişim.
- Lisans: Ed25519, özel anahtarlar depoda değil (gitignore + gitleaks 93 commit temiz). Aktivasyon sunucusu D1 sorguları
  parametreli.
- HTML şablonları: tüm kullanıcı alanları `esc()` ile kaçırılıyor; yazdırma penceresinde JavaScript kapalı.
- Excel: dışa aktarımda hücreler düz metin (formül enjeksiyonu yok); içe aktarımda değerler parametreli SQL'e gider.
- WhatsApp: ana süreç yalnız `https://wa.me/` + `^90\d{10}$` numara + `encodeURIComponent` metin.
- Bağımlılıklar: yüksek/kritik zafiyet yok; 5 orta (Express/qs yalnız sunucu modunda; exceljs alt bağımlılığı uuid).

## Bulgular

### Yüksek
1. **Taşıma paketi lisansı ve makine kimliğini de taşıyor.** `meta` tablosundaki `makineId`, `lisansLease`
   `data.db` ile pakete giriyor (`db.cjs:969-1005`); yeni PC'de `lisans-meta.enc` yok → `birlestir` DB'deki makineId'yi
   benimsiyor (`lisansKalici.cjs:15`). Etki: makineye kilitli anahtar her PC'de geçerli, kurulum sayısı sınırı çevrimdışı
   atlatılır. Öneri: `duzKopyaOlustur` sonrası paketteki kopyadan `makineId`/`lisansLease`/`kurulumTarihi` sil; yeni
   PC'de lease yeniden alınır.

### Orta
2. **Yerel girişte deneme sınırı yok.** `data.cjs:20-29` doğrudan `verifyPassword`; sınır yalnız kurtarma ve HTTP
   login'de. DevTools'tan saniyede ~10 deneme. Öneri: sunucudaki `rateAllow` mantığını IPC login'e taşı (8/15 dk,
   kullanıcı adı başına), parola min 8.
3. **`istemci:baglan` oturumsuz ve `trust/force` renderer'dan.** `data.cjs:119-126`. Sunucu PC'de giriş ekranından
   çağrılırsa sunucu durur, uygulama saldırgan sunucuya istemci olur, sonraki girişte kullanıcı adı/parola oraya gider.
   Öneri: `COKLU_PC_ACIK` kapalıyken handler'ı kaydetme; açıkken admin oturumu şart, `force` yalnız ana süreçte bekleyen
   parmak izi varsa kabul.
4. **`cikti:makbuzPdf` herhangi bir oturumla, salt okunurda da, herhangi makbuzun PDF'ini üzerine yazar.**
   `cikti.cjs:37-51`. Öneri: salt okunur reddi, yalnız iptal edilmemiş ve PDF'i olmayan makbuz; ideal olarak HTML'i ana
   süreçte makbuz kaydından üret.
5. **Yazdırma penceresi ağa açık.** `cikti.cjs:12-16` CSP/`webRequest` engeli yok; JS kapalı olsa da `<img src=http>`
   dış istek atar. Bugün tüm alanlar kaçırıldığı için istismar gelecekteki bir şablon hatasını gerektirir. Öneri: ayrı
   `session.fromPartition("cikti")` + `webRequest.onBeforeRequest` ile `data:` dışı her isteği reddet; şablona
   `default-src 'none'` CSP.
6. **Otomatik yedek zip'inde `uploads/` düz.** `yedek.cjs:39-42`: data.db şifreli, sağlık raporu/kimlik fotokopisi/makbuz
   PDF'leri düz. Yedek klasörü OneDrive/USB olabilir. Öneri: yedek zip'ini makine anahtarıyla (ya da taşıma paketindeki
   `tasimaKripto` ile) şifrele.
7. **safeStorage yoksa DB sessizce düz kalıyor.** `db.cjs:34-44` yalnız `console.error`; arayüz `isEncrypted()` okumuyor.
   Öneri: Pano/Ayarlar'da "Veritabanı şifreli değil" uyarısı.
8. **Düz DB geçici klasörde artık kalabilir.** `yedek.cjs:137-148`, `:53`: kaba kapanışta `eyupspor-tasima-*`,
   `eyupspor-geri-*` klasörleri silinmez; `tasimaBilgi` yalnız özet için düz DB'yi diske açıyor. Öneri: açılışta artık
   temizliği; özet için bellek içi açma.
9. **Kod imzası yok.** `verifyUpdateCodeSignature: false`; bütünlük HTTPS + latest.yml sha512'ye (yani GitHub hesabına)
   dayanıyor. Öneri: GitHub hesabında 2FA ve korumalı etiketler (şimdi), Windows kod imzası (bütçe olursa).
10. **Makine kimliği donanıma bağlı değil** (`db.cjs:970` `randomUUID`). 1 numaralı bulgunun kökü; deneme sıfırlama
    için DB + `lisans-meta.enc` birlikte silinirse deneme yeniden başlar (bilinçli kabul). Öneri: sunucu tarafında lease
    sayımını sıkılaştır.

### Düşük
11. DevTools paketli sürümde açık, uygulama menüsü kısayolları aktif (`main.cjs:34-39`). Öneri: `devTools: !app.isPackaged`,
    `Menu.setApplicationMenu(null)`, `setPermissionRequestHandler` reddi.
12. `will-navigate` her `file://` adresine izin veriyor (`main.cjs:43-47`). Öneri: yalnız `dist/index.html` URL'i.
13. `must_change_password=1` ana süreçte zorlanmıyor (`data.cjs:68-78`). Öneri: `cagriYetkisi`'nde kontrol,
    yalnız `changePassword` serbest.
14. Parola değişiminde eski parola istenmiyor (`data.cjs:35-42`).
15. `files:addDocument` `tip` ve `playerId` doğrulanmıyor (`files.cjs:50`). Öneri: tip beyaz listesi, tamsayı id, tarih biçimi.
16. `yedek:geriYukle`/`tasimaBilgi` renderer'dan mutlak yol kabul eder (yalnız admin); zip tamamen belleğe açılır.
    Öneri: diyalogdan dönen yolu ana süreçte beklet; açılmış toplam boyut sınırı.
17. Sunucu `0.0.0.0` dinliyor (`server.cjs:194`); kurtarma sınırı yalnız kullanıcı adına göre (kilitleme saldırısı).
18. Geçici parola renderer'da `Math.random` ile 9.000 olasılık (`Ayarlar.jsx:315`); `must_change_password` telafi eder.
    Öneri: ana süreçte `randomBytes`, ≥10 karakter.
19. Ham SQLite/Chromium hata metinleri kullanıcıya geçiyor (`api.js:42-45`). Öneri: eşleme tablosu.
20. `logo` şablonlara kaçırılmadan giriyor (`makbuzHtml.js:35`, `raporHtml.js:27`, `yoklamaFormuHtml.js:70`); bugün
    kaynak sabit `build/icon.png`. Öneri: `^data:image/(png|jpeg);base64,` doğrulaması (ileride logo yükleme gelirse).
21. `esc` tek tırnağı kaçırmıyor; tek yere toplanmalı (`src/lib/metin.js`).
22. Resim optimizasyonu piksel sınırı yok (`imageOptimize.cjs:19`); 25 MB PNG çözümü ~1.6 GB RAM (yalnız DoS).
23. `db-key.enc`/`lisans-meta.enc` `mode: 0o600` ile yazılmıyor (içerik zaten DPAPI/Keychain şifreli).
24. Taşıma paketi parolası min 8; scrypt N=2^15. Öneri: min 12 ya da N=2^17.
25. Aktivasyon sunucusu: admin token `!==` (sabit zamanlı değil), `/aktivasyon` hız sınırı yok.

### Bilgi
- `LIKE` aramasında `%`/`_` joker (yalnız sonucu genişletir).
- `listUsers` OKUMA kümesinde: kullanıcı rolü kullanıcı adlarını görür (hash yok).
- Dev CSP ile Vite React preamble çelişkisi doğrulanmadı; üretimi etkilemez.
- `.pre-restore` kopyaları birikir, temizlenmiyor.

## Doğrulanamayanlar
sqlite3mc WAL şifrelemesinin çalışma zamanında etkinliği (kaynak yorumlarına dayanıyor); Windows'ta `db-key.enc` ACL'si;
GitHub hesabında 2FA/korumalı etiket; `data:` kaynağından `file://` alt kaynak engeli.

## Önerilen düzeltme sırası
1. Taşıma paketinden lisans/makine kimliğini çıkar (Yüksek, yarım saat).
2. Yerel girişe deneme sınırı + parola min 8 (Orta, bir saat).
3. `istemci:baglan` bayrak kapalıyken kayıtsız, açıkken admin (Orta, yarım saat).
4. `makbuzPdf` salt okunur/iptal/sahiplik denetimi (Orta, yarım saat).
5. Yazdırma penceresine ağ engeli + `logo` doğrulaması (Orta, bir saat).
6. Yedek zip'ini şifrele; şifresiz DB uyarısı; geçici artık temizliği (Orta, iki saat).
7. DevTools/menü/`will-navigate`/`must_change_password`/`addDocument` doğrulama/geçici parola (Düşük, toplam iki saat).
8. Yayın: GitHub 2FA + korumalı etiketler (Kerem); kod imzası (bütçeye bağlı).
