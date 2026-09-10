# CLAUDE.md

Bu dosya Claude Code'a bu depoda çalışırken rehberlik eder.

## Bu nedir

"Futbol Okulu Kayıt Programı" (productName; ilk müşteri Eyüpspor; program kulüpten bağımsız: uygulama logosu `build/icon.png` kırmızı zeminli kayıt kartı+krampon+top (plan §30/§34.5; kaynak `build/logo.svg`), kulüp kimliği — ad, kısa ad, kuruluş yılı, logo `uploads/kulup/logo.*`, tema renkleri — Ayarlar > Kulüp ve Makbuz'dan, oturumsuz `app:marka` kanalı, saf `src/lib/tema.js` + `electron/tema.cjs`/`ayarDogrula.cjs`/`marka.cjs`/`kulupLogo.cjs`; plan §32) — futbol okulu için Windows masaüstü kayıt programı. React (Vite)
arayüz, Electron kabuk, SQLite (`better-sqlite3-multiple-ciphers`, at-rest şifreli) veritabanı.
Oyuncu kaydı, aile ve acil kişiler, belgeler, aylık aidat takibi, tahsilat makbuzu (yazdırma + PDF),
antrenman yoklaması, Excel/PDF raporlar. Şimdilik tek PC; Faz 2'de gömülü Express sunucu ile
LAN/Tailscale üzerinden çoklu PC (bkz. `docs/plan.md`).

## Komutlar

```bash
npm install          # bağımlılıklar + native rebuild (postinstall) + git hook (prepare)
npm run dev          # vite + electron, hot reload
npm run build        # vite build → dist/
npm run build:win    # vite build + electron-builder --win → release/*.exe
npm test             # vitest: saf mantık + jsdom + Electron altında SQLite, sunucu güvenliği, kalıcılık, sezon/taşıma paketi/raporlar/oyuncular/sayfalama e2e, arayüz duman testi (dist/ gerekir)
npm run test:saf     # yalnız süreç içi testler (~19 sn) — refactor döngüsü için
npm run test:coverage # test:saf + kapsama raporu (coverage/); Electron alt süreç kodu (db.cjs, ipc/*) ölçülmez
npx electron scripts/tests/smoke-ui.cjs <dizin>   # ekran görüntüleriyle duman testi (önce npm run build)
npx electron scripts/tests/guncelleme-serit-onizle.cjs <dizin>   # güncelleme şeridini gerçek pencerede göster (updater olayları elle; 4 görüntü)
npm run lint         # ESLint 9 (hata sayısı 0 tutulur)
npm run format       # Prettier (140 sütun, .prettierrc); format:check CI için. Biçimlendirme commit'i .git-blame-ignore-revs'te
npm run typecheck    # tsc --noEmit (// @ts-check işaretli dosyalar)
npm run scan:secrets # gitleaks
npm run audit        # npm audit --audit-level=high
```

## Durum (10.09.2026 — sürüm 1.1.0)

Faz 2 uygulama tarafı tamam: gömülü HTTPS sunucu + istemci modu (Ayarlar > Sunucu / Çoklu PC),
aktivasyon sunucusu kodu hazır (deploy bekliyor: `aktivasyon-sunucu/deploy.sh`). Kullanıcı rehberi
`docs/kurulum.md`. Yazı tipleri @fontsource ile gömülü. TEK HERKESE AÇIK depo `keremgenisel/futbolokulukayit` (kod + GitHub Releases; electron-updater
kimliksiz indirir, özel depo olmaz; publish-release.cjs özelse durur). Güncelleme arayüzü Ayarlar > Hakkında (`Guncelleme`,
IPC `updater:*`, `electron/ipc/guncelleme.cjs`) + `GuncellemeSeridi` (App'te `main`in EN ÜSTÜNDE, başlığın üzerinde, kenar menüyü
etkilemez, içerikle kaydırılmaz; `updater:available` gelince yöneticiye: İndir → ilerleme → Yeniden Başlat ve Kur; sarı zemin ("Makbuz Kes" sarısı), hata kırmızı, Kapat oturumluk). Windows yayını `.github/workflows/release.yml`
(tag push; kurulum dosyası `Futbol-Okulu-Kayit-Programi-Setup-<v>.exe`, `build.artifactName` ASCII, appId `com.keremgenisel.futbolokulu`, kurulumda lisans sözleşmesi sayfası `build/license.txt` (UTF-8 BOM + CRLF, `nsis.license`; test `tests/lisans-sozlesmesi.test.js`), plan §23) veya `npm run build:win` (macOS'ta da çalışır; ardından `node scripts/ensure-native.cjs`
ile mac native modüllerini geri derle, yoksa Electron testleri düşer).

Faz 1 tamam: giriş + zorunlu parola değişimi, yaş grupları, oyuncu kaydı (aile, acil kişiler, belgeler),
aylık aidat, makbuz kesme/yazdırma/PDF, yoklama, pano (tesise giriş kontrolü), raporlar (Excel/PDF),
ayarlar (kalemler, kullanıcılar, yedekleme), offline lisans çekirdeği. Faz 2: Tailscale/çoklu PC,
online aktivasyon sunucusu. Bkz. `docs/plan.md`.

## Refactor

Yapısal iyileştirme planı, taban çizgisi, sonuç ölçüleri `docs/refactor-plan.md` (08.09.2026; 7 adım uygulandı). Refactor commit'i
davranış değiştirmez; `db.cjs` dış API'si ve `yetki.cjs` beyaz listesi sabit kalır. Kalıplar: IPC handler ön koşulu
`electron/ipc/koruma.cjs` (`donerek`/`firlatarak`); renderer'da hata yakalama `useDene()` (`ui.jsx`): `dene(async () => …)`
hatayı toast'a yazar; yeni işleyicilerde try/catch + `toast("err", hataMetni(e))` yerine bu kullanılır. Rapor üreticileri
`src/lib/raporlar.js` (saf).

## Mimari

- `electron/main.cjs` — ana süreç: pencere, güvenlik sertleştirme (contextIsolation, sandbox,
  dış gezinme engeli), tek örnek kilidi, yazdırma, otomatik güncelleme (yalnız paketli).
- `electron/preload.cjs` — renderer'a tek köprü: `window.okul` (`auth.*`, `db(fn, ...args)`, `app.*`).
- `electron/ipc/data.cjs` — `db:call` beyaz listesi; oturum yoksa hiçbir veri çağrısı geçmez.
- `electron/db.cjs` — dış API (102 işlev, tek `require`); gövde `electron/db/` modüllerinde (refactor 08.09.2026): `baglanti`
  (bağlantı Proxy `db`, anahtar, yollar, `islem`), `sema` (şema/göç/tohum, `init`), `meta`, `kullanicilar`, `gruplar`, `oyuncular`,
  `mesaj`, `belgeler`, `aidat`, `makbuz`, `antrenman`, `sezon`, `pano`, `lisansDurum`, `yedek`. Yeni sorgu ilgili modüle yazılır,
  db.cjs export listesine ve `yetki.cjs` beyaz listesine eklenir. Şema `docs/plan.md §3`.
  Anahtar `safeStorage` ile OS anahtarlığında. macOS'ta keychain kaydı UYGULAMA ADINA bağlıdır ("<ad> Safe Storage"): productName
  değişince eski `db-key.enc` çözülmez → `getDbKey` dosyayı ASLA üzerine yazmaz, açık hata verir, `main.cjs` hata kutusu gösterip çıkar;
  kurtarma `npx electron scripts/anahtar-yeniden-sifrele.cjs "<eski ad>" "<yeni ad>" "<db-key.enc>"` (test `scripts/tests/anahtar-koruma.cjs`).
  Geliştirme verisi `~/Library/Application Support/<productName>/` (09.09.2026'da "Futbol Okulu Kayıt Programı"na taşındı).
  Şema sürümü 18: 2 recovery_codes · 3 uyruk/pasaport · 4 players.sezon · 5 monthly_dues.odenen (kısmi) ·
  6 age_groups.program · 7 receipts.iptal_nedeni/eden/zamani · 8 fee_types (ücret tipleri
  tabloda; `players.ucret_tipi` = kod; normal/ucretsiz sabit; kod `electron/kodUret.cjs` ile addan üretilir) · 9 WhatsApp
  (`guardians.mesaj_onayi` varsayılan 1, `message_log`, `trainings.bildirim_gerekli/degisiklik_notu`) · 10 `trainings.grup_bildirim` · 11 bildirim olayı (`trainings.bildirim_olay`, `message_log.olay`: her iptal/değişiklik ayrı olay, eski bildirim yeni olayda sayılmaz) · 12 sezonu boş aktif gruplara `aktif_sezon` (plan §15; grup sezonu ana süreçte `sezonDogrula` ile 2026-2027 biçimine zorlanır, arayüzde `SezonSecim`: aktif/sonraki sezon) · 13 varsayılan ücret tipi sırası (normal, ücretsiz, burslu, indirimli, kardeş) · 14 `receipts.sezon` (makbuz aktif sezona damgalı; numara öneki sezonun ilk yılı, saf `electron/makbuzNo.cjs`; "Bugün Kesilen Makbuzlar" aktif sezon) · 15 sezonu boş aktif oyunculara `aktif_sezon` (`createPlayer` sezon verilmezse aktif sezonu damgalar; Oyuncular ekranı sezon filtresi, plan §18) · 16 `player_seasons` (geçmiş sezon üyeliği; sezon süzgeci `players.sezon` VEYA bu tablo; göç aidat/makbuz kayıtlarından türetir, plan §18.1) · 17 `group_seasons` (grupların geçmiş sezon üyeliği; `listAgeGroups({ sezon })`, Yaş Grupları/Oyuncular/Raporlar yaş grubu kutuları sezona göre; göç antrenman tarihlerinden, plan §21) · 18 `receipts.oyuncu_adi` (kişisel verisi silinen oyuncunun makbuzdaki adı; makbuz sorguları boş değilse bunu kullanır, plan §31). Göç `migrate()` PRAGMA
  table_info ile idempotent; varsayılan kalem/tip tohumu meta bayrağıyla TEK SEFER (silinen geri gelmez).
- **WhatsApp (plan §13, API YOK):** `src/lib/whatsapp.js` SAF (wa numarası, şablon doldurma, uygunluk), `src/components/WhatsAppHatirlat.jsx`
  toplu pencere; ana süreç `app:whatsappAc` yalnız `https://wa.me/90…` açar (`shell.openExternal`). Kayıt `db.mesajKaydet`
  (kullanıcı oturumdan enjekte edilir, `cancelReceipt` gibi). Şablonlar `settings wa_sablon_*` (Ayarlar > WhatsApp Mesajları).
  Gayri resmi WhatsApp kütüphanesi (whatsapp-web.js/Baileys) ASLA: numara yasaklanır.
- `electron/ipc/files.cjs` — belge/foto yükleme (`uploads/oyuncu-<id>/`), yol geçişi koruması; `files:oyuncuKisiselVeriSil`
  (yalnız yönetici): makbuzlu oyuncu silinmez (`receipts` RESTRICT), kişisel verileri + dosyaları silinir, makbuzlar
  adı (`receipts.oyuncu_adi` damgası), PDF'i ve tutarıyla olduğu gibi kalır; oyuncu kaydı "Silinmiş Oyuncu #id" olur (`db.oyuncuKisiselVeriSil`, plan §31; makbuzsuz oyuncu `deletePlayer` ile gerçekten silinir). JPG/PNG
  yükleme anında `electron/imageOptimize.cjs` ile nazikçe küçültülür (≤2000px, JPEG %82; yalnız küçülürse).
  `electron/ipc/optimize.cjs` — Ayarlar > Resim ve Belge Optimizasyonu (analiz/uygula, eski dosyalar için).
- `electron/ipc/aktar.cjs` + `electron/oyuncuAktar.cjs` (saf satır çözümleme) — Excel'den oyuncu aktarımı
  (şablon / önizleme / tek işlemde aktar; `src/components/OyuncuAktar.jsx`).
- `electron/ipc/cikti.cjs` — yazdırma, makbuz PDF (`uploads/makbuz/<no>.pdf`), rapor PDF, Excel (exceljs).
- `electron/tasimaKripto.cjs` (SAF: parola → scrypt → AES-256-GCM) + `yedek.cjs` taşıma paketi: `.fokpaket` dosyası, içinde
  ŞİFRESİZ data.db (`db.duzKopyaOlustur`: VACUUM INTO + rekey '') + uploads; geri yüklemede `db.duzVeritabaniniSifrele`
  (rekey makine anahtarı). Başka PC'de açılır; normal yedek açılmaz. Plan §14. Uçtan uca test `scripts/tests/tasima-e2e.cjs`
  (gerçek main.cjs, iki userData, diyaloglar dosyaya yönlendirilir; test klasör adları `futbolokulu-tasima-`/`futbolokulu-geri-` ile
  BAŞLAYAMAZ: açılış temizliği siler).
- `electron/ipc/yedek.cjs` — elle ve otomatik yedek (sıklık `yedek_sikligi`: acilis|gunluk|haftalik|kapali, saf karar `electron/yedekSiklik.cjs`) (data.db + uploads → TEK zip, makine anahtarıyla `tasimaKripto` YEDEK_MAGIC kabında şifreli `futbolokulu-yedek-<damga>.fokyedek`; anahtar yoksa düz `.zip`; eski düz zip'ler açılmaya devam eder,
  fflate, 30 gün saklama) ve
  geri yükleme (`geriYukleCekirdek`: zip'i geçici klasöre güvenle aç (yol geçişi reddi) ya da eski biçim klasör → doğrula → mevcut veriyi `.pre-restore-<damga>` ile kenara al → kopyala → relaunch).
  Yedek aynı PC'nin safeStorage anahtarıyla şifreli; başka PC'de açılmaz (`db.yedekBilgisi` bunu raporlar).
- **Güvenlik (inceleme `docs/guvenlik-inceleme.md`, 08.09.2026, tamamı uygulandı):** IPC login sınırı kullanıcı başına 8/15 dk
  (`ipc/data.cjs`), parola min 8, zorunlu değişim dışında mevcut parola doğrulanır; `yetki.cjs` `must_change_password`
  oturumunda her çağrı 403; saf modüller `electron/makbuzIzin.cjs` (makbuz PDF izni), `electron/belgeDogrula.cjs` (belge
  girdi doğrulama), `imageOptimize.resimBoyutu` (50 MP üstü atlanır); `src/lib/metin.js` `esc` + `guvenliLogo` tüm
  şablonlarda; yazdırma penceresi ayrı `cikti` oturumunda ağa kapalı; `main.cjs` devTools yalnız dev, menü yok, izin
  istekleri red (yalnız panoya yazma izinli: `Telefon` bileşeni), gezinme yalnız `dist/index.html`; `SifresizUyari` yöneticiye şifresiz DB şeridi; geri yükleme yolları
  yalnız diyalogdan (ana süreçte bekletilir). Testler `tests/guvenlik-saf.test.js` ve ilgili dosyalar.
- `src/components/Ikon.jsx` — tasarım tuvalindeki çizgi ikon seti (stroke, currentColor). Emoji/işaret karakteri kullanma.
- `electron/lisans.cjs`, `lisansKalici.cjs`, `aktivasyonIstemci.cjs` — GenCRM'den taşınan lisans çekirdeği;
  önek `FOKLISANS.`/`FOKLEASE.`, açık anahtarlar gömülü, özel anahtarlar `scripts/keys/` (gitignore).
  Üretici betikleri: `scripts/lisans-uret.cjs`, `lease-uret.cjs`, `lisans-yonet.cjs`.
- `src/lib/makbuzHtml.js`, `raporHtml.js` — yazdırma/PDF şablonları (renderer üretir, main render eder).
- **Çoklu PC (arayüzde KAPALI, bayrak: `src/lib/ozellikler.js` COKLU_PC_ACIK; ana süreç kodu yerinde):** `electron/config.cjs` (mod: yerel|sunucu|istemci, `config.json` + şifreli jeton),
  `electron/server.cjs` (Express + HTTPS self-signed, JWT 30 gün, login hız sınırı, `/api/db` aynı
  beyaz liste), `electron/istemci.cjs` (undici pinli fetch, TOFU parmak izi onayı, `knownServers`),
  `electron/yetki.cjs` (IPC ve sunucu için ORTAK yetki kararı). `ipc/data.cjs` her çağrıda
  `config.istemciMi()` ile yönlendirir; istemcide belge yükleme base64 ile sunucuya gider, makbuz PDF
  istemcide üretilip sunucuya yüklenir, yedek yalnız sunucuda.
- `aktivasyon-sunucu/` — Cloudflare Worker + D1 (GenCRM kopyası, FOKLISANS önekleri). `deploy.sh`
  ilk kurulumu yapar; sonra `electron/aktivasyonIstemci.cjs` AKTIVASYON_URL doldurulur.
- `src/components/IlkKurulum.jsx` — ilk kurulum sihirbazı (ilk parola değişiminden sonra, `kurulum_tamam` boş ve oyuncu
  yokken; kulüp adı → aidat/indirim → gruplar+sezon → yedek → kurtarma kodları → Excel aktarımı; son adım hariç her adımda
  "Bu adımı atla": hiçbir şey yazmadan ilerler, girilenler Geri ile korunur).
- `src/components/Ayarlar.jsx` — yalnız kabuk (gruplu bölüm menüsü: Kulüp / Sezon ve Veri / Kullanıcılar ve Erişim / Uygulama;
  "İlk Kurulum Sihirbazı" menü öğesi bölüm değil eylem, `onKurulumAc`; `onKirli` uyarısı); bölümler `src/components/ayarlar/` (KulupAyar,
  KalemAyar, KullaniciAyar+KurtarmaKodlari, SezonAyar, YedekAyar, OptimizeAyar, WhatsAppAyar, Hakkinda+Guncelleme). Dış API
  (`Ayarlar`, `KurtarmaKodlari`, `Guncelleme`) Ayarlar.jsx'ten yeniden dışa verilir.
- `src/App.jsx` — üst durum ve sekme kabuğu. Router yok; `tab` string + `TABS` dizisi.
- `src/lib/sezon.js` — SAF sezon mantığı (güncel/sonraki sezon, sezon sonu, üst grup önerisi, `sezonAyYili`); Ayarlar > Yeni Sezon
  sihirbazı `db.yeniSezonaGec` (tek işlem: yenileyen → yeni sezon+grup + yeni sezonun ilk ay aidatı açılır, diğerleri pasif+not).
  Raporlar: en üstte tek filtre çubuğu `RaporFiltre.jsx`, altında solda rapor kartları + sağda tablo (plan §20.7) — HER raporda aynı kutular: Dönem seçimi (sezon+ay | tarih aralığı),
  Sezon + Ay (Tümü) ya da Başlangıç/Bitiş, Yaş grubu (plan §20.6; saf `raporFiltreleri`, `tarihAyAraligi`); sorgular ay aralığı
  alır (`aidatOzeti`, `listUnpaidAralik`; `SezonAySecim`; `db.sezonListesi`, `sezonAidatOzeti`, `listUnpaidSezon`,
  `attendanceReport`/`saglikRaporuListesi`/`listUnpaid` sezon parametresi; oyuncu kümesi `player_seasons`); Yoklama Özeti'nde
  tarih aralığı seçeneği de var. Bkz. `docs/plan.md §10, §17, §19`.
- `src/lib/belge.js` (sağlık raporu geçerliliği), `src/lib/program.js` (haftalık program), `src/lib/takvim.js` (takvim
  şeridi), `electron/oyuncuAktar.cjs` (Excel satır çözümleme) — hepsi SAF, vitest ile test edilir.
- `src/lib/aidat.js` — SAF aidat mantığı (`// @ts-check`): açılış durumu, tesise giriş, dönem, gecikme.
- `src/components/ui.jsx` — ilkeller (`Btn`, `Rozet`, `Kart`, `Alan`, `Sayfalama`, `useToast`, `useDene`). Sayfalama: Oyuncular DB'de
  (`db.playersPage`, 50/sayfa; dışa aktarım tam liste), Raporlar önizleme 100 satır (Excel/PDF tam), oyuncu kartı son
  12 dönem / 12 makbuz / 40 yoklama + "Tümünü göster", Excel aktarım önizlemesi 100/sayfa (aktarım tam liste); sabit
  yükseklikli kaydırma + yapışık başlık + sayaç: sezon sihirbazı aday listesi, WhatsApp toplu pencere, Tahsilat "Bugün
  Kesilen Makbuzlar" (plan §22; uçtan uca `scripts/tests/sayfalama-e2e.cjs`, sınır durumları `tests/ui/sayfalama-sinirlar.test.jsx`). Tüm stil inline; renkler
  `src/ui.css` CSS değişkenlerinden (varsayılan mor `#5B2D8E`, sarı `#F5D000`, kırmızı `#E0101F`; `--mor/--sari` ailesi ve
  `--ana-ustu`/`--vurgu-ustu`/`--ana-ustu-soluk` çalışma anında kulüp temasıyla değişir — `temaUygula.js`; kırmızı/yeşil ve
  `--uyari`/`--uyari-acik`/`--uyari-metin` (deneme/salt okunur şeridi, kaydedilmemiş satır, sarı rozet) anlam renkleri SABİT; marka
  vurgusu (`--sari`: Makbuz Kes, menü alt yazısı, sekme çizgisi, güncelleme şeridi) temayla değişir. Ana renk üstündeki yazıya `#fff`
  değil `var(--ana-ustu)` yaz; bileşene sabit marka hex'i yazma, şablonlara `tema` parametresi geçir).
- `design/*.dc.html` — ekran tasarımları (Claude Design tuvali). Yeni ekran yaparken buna uy.

## Kurallar

- Her hata düzeltmesi, onu yakalayacak bir testle birlikte gelir.
- Aidat ve makbuz mantığı önce `src/lib/aidat.js` / `electron/db.cjs`'de saf fonksiyon, sonra arayüz.
- Ayar tablolarında satır başına Kaydet YOK: değişiklikler ekranda birikir, tek Kaydet tek işlemde yazar
  (`db.aidatAyarlariKaydet`); bölüm değişiminde kaydedilmemiş değişiklik uyarısı (`Ayarlar` kabuğu, `onKirli`).
- Renderer doğrudan `fs`/`sqlite` görmez; her şey `window.okul.db` üzerinden beyaz listeli.
- İlk admin `admin`/`admin`, `must_change_password=1` — ilk girişte parola değişimi zorunlu. Tohum yalnız
  hiç kullanıcı yokken çalışır (yeni yönetici ilk admin'i silebilir; son aktif yönetici silinemez).
  Parola kurtarma: `recovery_codes` (bcrypt, tek kullanımlık), `auth:kurtarmaUret` / `auth:kurtarmaSifirla`
  IPC'si ve `/api/auth/kurtarma*` uçları; yanlış deneme kullanıcı başına 5/15 dk.
- Türkçe arayüz, Türkçe yorum. Tarih `dd.mm.yyyy`, para `3.500 ₺` (`src/lib/aidat.js`). Büyük harf
  için `toLocaleUpperCase("tr-TR")` (i → İ).
- Roller: `admin` her şey; `kullanici` Ayarlar sekmesini görmez (App.jsx süzer) ve ana süreçte ADMIN seti (`setSetting`,
  `aidatAyarlariKaydet`, `updateFeeItem`, kullanıcılar, `yeniSezonaGec`) + yedek klasör/al/sıklık, optimize, lisans yazma reddedilir.
- Salt okunur lisans modu `electron/ipc/data.cjs` beyaz listesinde uygulanır (YAZMA seti reddedilir);
  arayüz `saltOkunur` prop'uyla düğmeleri gizler ama asıl koruma main süreçtedir.
- `scripts/keys/*.pem` ASLA commit edilmez; kaybolursa tüm dağıtılmış lisanslar geçersiz olur — yedekle.
