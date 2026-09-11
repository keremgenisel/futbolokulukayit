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
    kaynak sabit `build/kulup-logo.png` (10.09.2026'ya kadar `build/icon.png`; plan §30). Öneri: `^data:image/(png|jpeg);base64,` doğrulaması (ileride logo yükleme gelirse).
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
~~GitHub hesabında 2FA~~; ~~korumalı etiket~~; `data:` kaynağından `file://` alt kaynak engeli.

**Doğrulananlar (10.09.2026):**
- **Korumalı etiket kuralı çalışıyor:** `v1.0.0` etiketi push edilirken GitHub "Bypassed rule violations... Cannot
  create ref due to creations being restricted" uyarısı verdi — kural aktif, yalnız admin rolü (Kerem) bypass edebiliyor;
  gerçek bir push denemesiyle doğrulandı (plan §8.1 madde 4).
- **GitHub hesabında 2FA açık** (Kerem, 10.09.2026 doğruladı — github.com/settings/security'de gözle kontrol edildi;
  API/CLI bu bilgiyi dışarıya vermiyor, gözle teyit tek yol).

**Hâlâ Windows'ta canlı test gerektiren iki madde kaldı:** sqlite3mc WAL şifrelemesi, yazdırma penceresinin `file://`
alt kaynak engeli (bkz. plan §8.1 madde 9, kurulum günü kontrol listesi).

## Önerilen düzeltme sırası
1. Taşıma paketinden lisans/makine kimliğini çıkar (Yüksek, yarım saat).
2. Yerel girişe deneme sınırı + parola min 8 (Orta, bir saat).
3. `istemci:baglan` bayrak kapalıyken kayıtsız, açıkken admin (Orta, yarım saat).
4. `makbuzPdf` salt okunur/iptal/sahiplik denetimi (Orta, yarım saat).
5. Yazdırma penceresine ağ engeli + `logo` doğrulaması (Orta, bir saat).
6. Yedek zip'ini şifrele; şifresiz DB uyarısı; geçici artık temizliği (Orta, iki saat).
7. DevTools/menü/`will-navigate`/`must_change_password`/`addDocument` doğrulama/geçici parola (Düşük, toplam iki saat).
8. Yayın: GitHub 2FA + korumalı etiketler (Kerem); kod imzası (bütçeye bağlı).

---

# 2. Güvenlik İncelemesi (11.09.2026, sürüm 1.1.0 + 32 commit, HEAD 4ea2ef6)

Kerem: "güvenlik açısından uygulamayı analiz et". Kapsam: 08.09 incelemesinden sonra eklenen özellikler (WhatsApp §13, taşıma/yedek
şifreleme §14, sezon/geçmiş §15–§22, uzun dönem §24, sağlık §25, KVKK silme §31, kulüp kimliği/logo/tema §32, aktivasyon boşluk
düzeltmesi §33, sezon/antrenman saatleri §37, refactor 2. tur: ESM tek kaynak, `useSezonDurumu`, `UyariSeridi`, bölünmeler) ve çekirdek
yolların yeniden okunması. Yöntem: kaynak okuma (`electron/`, `src/lib`, `aktivasyon-sunucu/`), `npm audit`, gitleaks (183 commit,
sızıntı yok), tehlikeli kalıp taraması. Kod DEĞİŞTİRİLMEDİ; bu belge yalnız bulgu ve öneri.

## 08.09 bulgularının bugünkü durumu
Tamamı uygulanmış ve kodda doğrulandı: #1 `duzKopyaOlustur` paketten `makineId`/`lisansLease` siler (`db/yedek.cjs:24-28`) · #2 yerel
login 8/15 dk + parola min 8 (`ipc/data.cjs:17-21,39-47`) · #3 `istemci:baglan` yönetici/ilk kurulum + bekleyen parmak izi
(`data.cjs:222-247`) · #4 `makbuzPdfIzni` (`cikti.cjs:70`) · #5 yazdırma penceresi ayrı `cikti` bölümü, `data:/about:/blob:` dışı istek
iptal, JS kapalı (`cikti.cjs:17-31`) · #6 yedek `.fokyedek` şifreli · #7 `SifresizUyari` · #8 `geciciArtiklariTemizle` +
`tasimaPaketiOzet` bellek içi · #11 devTools/menü/izinler (`main.cjs:43,87-92`) · #12 gezinme yalnız `dist/index.html` (`main.cjs:52-63`)
· #13 `must_change_password` `cagriYetkisi`'nde · #14 mevcut parola · #15 `belgeGirdiDogrula` · #16 yedek/paket yolu yalnız diyalogdan
(`bekleyenYedek/bekleyenPaket`) · #18 geçici parola `randomBytes` · #20 `guvenliLogo` (yalnız base64 PNG/JPEG) · #21 `esc` tek tırnak dahil ·
#22 `MAX_PIKSEL` 50 MP · #23 `db-key.enc` 0o600 · #24 taşıma parolası min 10, scrypt N=2^16 · #25 sabit zamanlı token + IP hız sınırı.
Kalanlar (bilinçli): #9 kod imzası yok (`verifyUpdateCodeSignature: false`), #10 makine kimliği donanıma bağlı değil, #17 sunucu `0.0.0.0`
(arayüzde çoklu PC kapalı), #19 ham hata metinleri.

## Sağlam bulunanlar (yeni özellikler)
- **Kulüp logosu:** yalnız `.png/.jpg/.jpeg` uzantı + 5 MB + 50 MP başlık kontrolü, `nativeImage` ile YENİDEN KODLANIR (meta veri, polyglot,
  SVG/script olasılığı sıfır), ≤512 px (`kulupLogo.cjs:17-34`); ayar değeri `^kulup/logo\.(png|jpg)$` (`ayarDogrula.cjs:26`); şablonlara
  yalnız `guvenliLogo` regex'inden geçen data URL girer; `<img>` içinde `alt=""`.
- **Tema renkleri:** `setSetting` her yazımda `ayarDogrula` (`#rrggbb` regex), `markaHesapla`/`temaTuret` ikinci kez doğrular, CSS'e
  `style.setProperty` ile gider (`temaUygula.js`), HTML şablonlarına türetilmiş hex girer — CSS enjeksiyonu yolu yok.
- **Kulüp adı / kısa ad / kuruluş yılı:** uzunluk sınırı + satır sonu temizliği (`ayarDogrula.cjs:5,20-31`); React metin olarak basar,
  şablonlarda `esc`. `app:marka` oturumsuz ama yalnız bu alanlar (kişisel veri yok).
- **HTML şablonları:** `makbuzHtml`/`raporHtml`/`yoklamaFormuHtml` tüm kullanıcı alanlarında `esc`; `dangerouslySetInnerHTML` yalnız
  `Ikon.jsx` sabit SVG yolları; `innerHTML/eval/javascript:` yok.
- **WhatsApp:** ana süreç `^90\d{10}$` + `https://wa.me/` + `encodeURIComponent` (`main.cjs:126-137`); şablon yer tutucuları düz metin.
- **KVKK silme (§31):** yalnız yönetici (`files.cjs:119-125`); tek işlemde belgeler/veliler/acil/aidat/yoklama/mesaj/sezon kayıtları
  silinir, `players` kişisel sütunları boşaltılır, ad "Silinmiş Oyuncu #id" (`oyuncular.cjs:109-131`); dosyalar ve klasör
  `uploadsIci` ile siliniyor. Makbuz adı damgası kulübün bilinçli kararı (mali belge).
- **IPC:** `preload.cjs` yalnız sabit kanallar, `ipcRenderer` sızmıyor; `db:call` üç kümeli beyaz liste (`yetki.cjs`), prototype adları
  kümelerde yok; yeni fonksiyonlar (`sezonTarihKaydet` ADMIN, `sezonTarihleri`/`sezonListesiTarihli` OKUMA) doğru kümede; `cancelReceipt`/
  `mesajKaydet`/`grupBildirimKaydet` kullanıcıyı oturumdan enjekte eder (`data.cjs:126-131`).
- **ESM tek kaynak (refactor §8.6):** ana süreç `src/lib/{sezon,program,tema}.js`'i `require(esm)` ile yükler; bu modüller saf, üst düzey
  `await`/tarayıcı API'si yok; asar içinden yükleme doğrulandı. Saldırı yüzeyi değişmedi (aynı paket, aynı imza).
- **SQL:** tüm kullanıcı verisi parametreli; dinamik parçalar yalnız iç sabitler (`PLAYER_FIELDS`, `DELETE FROM ${t}` sabit liste,
  `kolonEkle` iç çağrı, `VACUUM INTO` tırnak kaçışlı iç yol).
- **Aktivasyon sunucusu:** anahtar sha256 hash'iyle saklanır, imza ham bayt üzerinde, lease lisans bitişini aşmaz, admin token sabit zamanlı,
  kalıcı lisans ÖZEL anahtarı sunucuda yok. Deploy gizlileri `wrangler secret`; repo/gitleaks temiz.
- **Kimlik:** bcrypt cost 10, kurtarma kodları `randomBytes` + bcrypt + 5/15 dk, son aktif yönetici silinemez, kendi hesabı silinemez.
- **Bağımlılıklar:** yüksek/kritik yok; 5 orta: `express/body-parser/qs` (yalnız sunucu modu, arayüzde kapalı) ve `exceljs → uuid` (v3/v5
  buffer sınırı; uygulama uuid üretmez). Electron 42.11.2 / Node 24.19.

## Yeni bulgular

### Orta
1. **`yedek_klasoru` ve `sunucu_adres` dahil HER ayar anahtarı `setSetting` ile yazılabilir.** `yetki.cjs` `setSetting`'i ADMIN kümesine
   koyar ama anahtar beyaz listesi yok; `ayarDogrula` yalnız kulüp kimliği anahtarlarını süzer, "bilinmeyen anahtarlar olduğu gibi geçer"
   (`ayarDogrula.cjs:33`). Yönetici oturumundan (DevTools kapalı olsa da renderer'daki bir hata/eklenti üzerinden) `yedek_klasoru`
   diyalog dışı bir yola, `sunucu_adres` dış arabirime, `aktif_sezon`/`sezon_baslangic_ayi` bozuk değere yazılabilir. Etki sınırlı
   (yönetici zaten yetkili), ama diyalogla korunan `yedek:klasorSec` (inceleme #16) bu yoldan atlanır. Öneri: `ayarDogrula`'ya
   İZİNLİ_ANAHTARLAR kümesi (bilinmeyen anahtar reddi) + `yedek_klasoru` ve `sunucu_adres` yalnız kendi IPC'lerinden (setSetting'te reddet),
   `aktif_sezon` `sezonGecerliMi`, `sezon_baslangic_ayi` 1–12.
2. **Geçici PDF'ler temp klasöründe kalıyor.** `cikti:pdfAc` (yazıcı yokken yedek yol) makbuz/yoklama formunu
   `temp/futbolokulu-<zaman>-<ad>.pdf` olarak yazar ve sistem görüntüleyicisinde açar (`cikti.cjs:84-94`); silinmez, `geciciArtiklariTemizle`
   yalnız `futbolokulu-(tasima|geri)-` klasörlerini siler (`yedekCekirdek.cjs:77`). Kişisel veri (ad, aidat, sağlık formu) paylaşılan
   PC'nin temp'inde birikir. Öneri: açılışta `futbolokulu-*.pdf` artıklarını (24 saatten eski) sil; ya da `app.getPath("temp")` altında
   uygulama alt klasörü kullanıp açılışta boşalt.

### Düşük
3. **Üretim CSP'sinde dev sunucusu adresleri.** `dist/index.html` `connect-src 'self' http://localhost:5173 ws://localhost:5173` taşıyor;
   paketli sürümde bir XSS (bugün yok) yerel 5173 portuna veri gönderebilir. Öneri: Vite build'de CSP'yi `connect-src 'self'` olarak yaz
   (`vite.config` transformIndexHtml ya da iki ayrı meta).
4. **Aktivasyonda kurulum limiti yarışı.** `aktivasyon()` önce `aktifKurulumSay` sonra `kurulumEkle` (`index.js:52-58`); eşzamanlı iki
   ilk aktivasyon limiti aşabilir (D1'de işlem yok). Etki: 1 kurulumluk lisansla 2 kurulum. Öneri: `INSERT ... WHERE (SELECT COUNT(*)…) <
   maksKurulum` tek ifade ya da `kurulumlar(lisansId, makineId)` UNIQUE + sayımı `batch` içinde.
5. **Silinen kişisel veri yedeklerde ve `.pre-restore` kopyalarında yaşar.** KVKK silme DB'den siler ama 30 gün saklanan `.fokyedek`
   dosyaları (`yedekCekirdek.cjs:135`), taşıma paketleri ve geri yüklemede kenara alınan `.pre-restore-*` kopyaları eski veriyi tutar. Bu
   teknik olarak beklenen ama kullanıcı rehberinde yazmalı (veri sahibi talebinde yedek saklama süresi). Öneri: `docs/kurulum.md`'ye
   "silme yedeklere işlemez, 30 gün" notu; `.pre-restore` için otomatik temizlik (30 gün).
6. **`createUser` rolü doğrulanmıyor.** `kullanicilar.cjs:7` `role` her dize olabilir ("root" gibi); yetki kararı `role !== "admin"` olduğu
   için etkisi "kullanıcı" gibi davranmasıdır; arayüz iki değer gönderir. Öneri: `role ∈ {admin, kullanici}` doğrulaması.
7. **Hız sınırı haritaları sınırsız büyür.** `loginDenemeleri`/`kurtarmaDenemeleri` anahtarı renderer'dan gelen kullanıcı adı
   (`data.cjs:38-46,111-119`); farklı adlarla spam bellek büyütür (yalnız yerel DoS). Sunucudaki `hizSayac` de isolate belleğinde. Öneri:
   pencere dolan kayıtları periyodik temizle ya da en çok N anahtar.
8. **`files:open` Office belgelerini sistem uygulamasıyla açar.** `IZINLI_UZANTI` `.doc/.docx` içeriyor (`files.cjs:14`); kulübün kendi
   yüklediği bir dosya makro taşıyorsa açılışta çalışır. Öneri: `.doc/.docx` yüklemeyi kaldır ya da kurulum rehberine uyarı; PDF/görsel yeterli.
9. **`must_change_password` oturumunda parola değişiminde mevcut parola istenmiyor** — tasarım gereği (ilk giriş). Ancak yönetici
   `resetUserPassword` ile bayrağı açıp geçici parola verince aynı yol; kabul edilebilir. Bilgi olarak not.

### Bilgi
- `listUsers` OKUMA kümesinde: kullanıcı rolü tüm kullanıcı adlarını ve aktiflik durumunu görür (08.09'dan kalan).
- `express.json({ limit: "40mb" })` ve `helmet` yok — sunucu modu arayüzde kapalı; açılırsa `helmet` + `Content-Type` sıkılaştırması.
- `cikti:excelKaydet` satırları renderer'dan nesne olarak alır; ExcelJS `{ formula }` nesnesi verilirse formül hücresi yazılır. Renderer
  güvenilir sınır içinde; yine de ana süreçte hücreleri `String/Number/Date` dışına indirgemek ucuz bir savunma.
- Program JSON'unda öğe sayısı sınırı yok (`gruplar.cjs:44-66`); yalnız yönetici, etki DoS.
- `.pre-restore` kopyaları ve `futbolokulu-yedek-*` 30 gün — disk dolabilir (08.09 Bilgi, hâlâ geçerli).
- Ana süreç `src/lib`'i yüklediği için `src/lib` altına tarayıcı-yalnız kod eklenmemeli (CLAUDE.md kuralı yazıldı).

## Önerilen sıra
1. Ayar anahtarı beyaz listesi + `yedek_klasoru`/`sunucu_adres` kilidi (Orta, 1 saat, testli).
2. Geçici PDF temizliği (Orta, yarım saat).
3. Üretim CSP `connect-src 'self'` (Düşük, 15 dk).
4. Aktivasyon kurulum limiti tek ifade (Düşük, yarım saat + deploy).
5. `createUser` rol doğrulaması, hız sınırı temizliği, `.doc/.docx` kararı (Düşük, 1 saat).
6. Kurulum rehberine KVKK/yedek notu (Düşük, 15 dk).
