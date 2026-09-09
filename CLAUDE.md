# CLAUDE.md

Bu dosya Claude Code'a bu depoda çalışırken rehberlik eder.

## Bu nedir

"Eyüpspor Futbol Okulu" — kulübün futbol okulu için Windows masaüstü kayıt programı. React (Vite)
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
npm test             # vitest: saf mantık + jsdom + Electron altında SQLite, sunucu güvenliği ve arayüz duman testi (dist/ gerekir)
npm run test:saf     # yalnız süreç içi testler (~19 sn) — refactor döngüsü için
npm run test:coverage # test:saf + kapsama raporu (coverage/); Electron alt süreç kodu (db.cjs, ipc/*) ölçülmez
npx electron scripts/tests/smoke-ui.cjs <dizin>   # ekran görüntüleriyle duman testi (önce npm run build)
npm run lint         # ESLint 9 (hata sayısı 0 tutulur)
npm run format       # Prettier (140 sütun, .prettierrc); format:check CI için. Biçimlendirme commit'i .git-blame-ignore-revs'te
npm run typecheck    # tsc --noEmit (// @ts-check işaretli dosyalar)
npm run scan:secrets # gitleaks
npm run audit        # npm audit --audit-level=high
```

## Durum (06.09.2026)

Faz 2 uygulama tarafı tamam: gömülü HTTPS sunucu + istemci modu (Ayarlar > Sunucu / Çoklu PC),
aktivasyon sunucusu kodu hazır (deploy bekliyor: `aktivasyon-sunucu/deploy.sh`). Kullanıcı rehberi
`docs/kurulum.md`. Yazı tipleri @fontsource ile gömülü. TEK HERKESE AÇIK depo `keremgenisel/eyupspor` (kod + GitHub Releases; electron-updater
kimliksiz indirir, özel depo olmaz; publish-release.cjs özelse durur). Güncelleme arayüzü Ayarlar > Hakkında (`Guncelleme`,
IPC `updater:*`, `electron/ipc/guncelleme.cjs`). Windows yayını `.github/workflows/release.yml`
(tag push) veya `npm run build:win` (macOS'ta da çalışır; ardından `node scripts/ensure-native.cjs`
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
  Anahtar `safeStorage` ile OS anahtarlığında.
  Şema sürümü 13: 2 recovery_codes · 3 uyruk/pasaport · 4 players.sezon · 5 monthly_dues.odenen (kısmi) ·
  6 age_groups.program · 7 receipts.iptal_nedeni/eden/zamani · 8 fee_types (ücret tipleri
  tabloda; `players.ucret_tipi` = kod; normal/ucretsiz sabit; kod `electron/kodUret.cjs` ile addan üretilir) · 9 WhatsApp
  (`guardians.mesaj_onayi` varsayılan 1, `message_log`, `trainings.bildirim_gerekli/degisiklik_notu`) · 10 `trainings.grup_bildirim` · 11 bildirim olayı (`trainings.bildirim_olay`, `message_log.olay`: her iptal/değişiklik ayrı olay, eski bildirim yeni olayda sayılmaz) · 12 sezonu boş aktif gruplara `aktif_sezon` (plan §15; grup sezonu ana süreçte `sezonDogrula` ile 2026-2027 biçimine zorlanır, arayüzde `SezonSecim`: aktif/sonraki sezon) · 13 varsayılan ücret tipi sırası (normal, ücretsiz, burslu, indirimli, kardeş). Göç `migrate()` PRAGMA
  table_info ile idempotent; varsayılan kalem/tip tohumu meta bayrağıyla TEK SEFER (silinen geri gelmez).
- **WhatsApp (plan §13, API YOK):** `src/lib/whatsapp.js` SAF (wa numarası, şablon doldurma, uygunluk), `src/components/WhatsAppHatirlat.jsx`
  toplu pencere; ana süreç `app:whatsappAc` yalnız `https://wa.me/90…` açar (`shell.openExternal`). Kayıt `db.mesajKaydet`
  (kullanıcı oturumdan enjekte edilir, `cancelReceipt` gibi). Şablonlar `settings wa_sablon_*` (Ayarlar > WhatsApp Mesajları).
  Gayri resmi WhatsApp kütüphanesi (whatsapp-web.js/Baileys) ASLA: numara yasaklanır.
- `electron/ipc/files.cjs` — belge/foto yükleme (`uploads/oyuncu-<id>/`), yol geçişi koruması. JPG/PNG
  yükleme anında `electron/imageOptimize.cjs` ile nazikçe küçültülür (≤2000px, JPEG %82; yalnız küçülürse).
  `electron/ipc/optimize.cjs` — Ayarlar > Resim ve Belge Optimizasyonu (analiz/uygula, eski dosyalar için).
- `electron/ipc/aktar.cjs` + `electron/oyuncuAktar.cjs` (saf satır çözümleme) — Excel'den oyuncu aktarımı
  (şablon / önizleme / tek işlemde aktar; `src/components/OyuncuAktar.jsx`).
- `electron/ipc/cikti.cjs` — yazdırma, makbuz PDF (`uploads/makbuz/<no>.pdf`), rapor PDF, Excel (exceljs).
- `electron/tasimaKripto.cjs` (SAF: parola → scrypt → AES-256-GCM) + `yedek.cjs` taşıma paketi: `.eyupspor` dosyası, içinde
  ŞİFRESİZ data.db (`db.duzKopyaOlustur`: VACUUM INTO + rekey '') + uploads; geri yüklemede `db.duzVeritabaniniSifrele`
  (rekey makine anahtarı). Başka PC'de açılır; normal yedek açılmaz. Plan §14.
- `electron/ipc/yedek.cjs` — elle ve otomatik yedek (sıklık `yedek_sikligi`: acilis|gunluk|haftalik|kapali, saf karar `electron/yedekSiklik.cjs`) (data.db + uploads → TEK zip, makine anahtarıyla `tasimaKripto` YEDEK_MAGIC kabında şifreli `eyupspor-yedek-<damga>.eyupyedek`; anahtar yoksa düz `.zip`; eski düz zip'ler açılmaya devam eder,
  fflate, 30 gün saklama) ve
  geri yükleme (`geriYukleCekirdek`: zip'i geçici klasöre güvenle aç (yol geçişi reddi) ya da eski biçim klasör → doğrula → mevcut veriyi `.pre-restore-<damga>` ile kenara al → kopyala → relaunch).
  Yedek aynı PC'nin safeStorage anahtarıyla şifreli; başka PC'de açılmaz (`db.yedekBilgisi` bunu raporlar).
- **Güvenlik (inceleme `docs/guvenlik-inceleme.md`, 08.09.2026, tamamı uygulandı):** IPC login sınırı kullanıcı başına 8/15 dk
  (`ipc/data.cjs`), parola min 8, zorunlu değişim dışında mevcut parola doğrulanır; `yetki.cjs` `must_change_password`
  oturumunda her çağrı 403; saf modüller `electron/makbuzIzin.cjs` (makbuz PDF izni), `electron/belgeDogrula.cjs` (belge
  girdi doğrulama), `imageOptimize.resimBoyutu` (50 MP üstü atlanır); `src/lib/metin.js` `esc` + `guvenliLogo` tüm
  şablonlarda; yazdırma penceresi ayrı `cikti` oturumunda ağa kapalı; `main.cjs` devTools yalnız dev, menü yok, izin
  istekleri red, gezinme yalnız `dist/index.html`; `SifresizUyari` yöneticiye şifresiz DB şeridi; geri yükleme yolları
  yalnız diyalogdan (ana süreçte bekletilir). Testler `tests/guvenlik-saf.test.js` ve ilgili dosyalar.
- `src/components/Ikon.jsx` — tasarım tuvalindeki çizgi ikon seti (stroke, currentColor). Emoji/işaret karakteri kullanma.
- `electron/lisans.cjs`, `lisansKalici.cjs`, `aktivasyonIstemci.cjs` — GenCRM'den taşınan lisans çekirdeği;
  önek `EYUPSPOR.`/`EYUPLEASE.`, açık anahtarlar gömülü, özel anahtarlar `scripts/keys/` (gitignore).
  Üretici betikleri: `scripts/lisans-uret.cjs`, `lease-uret.cjs`, `lisans-yonet.cjs`.
- `src/lib/makbuzHtml.js`, `raporHtml.js` — yazdırma/PDF şablonları (renderer üretir, main render eder).
- **Çoklu PC (arayüzde KAPALI, bayrak: `src/lib/ozellikler.js` COKLU_PC_ACIK; ana süreç kodu yerinde):** `electron/config.cjs` (mod: yerel|sunucu|istemci, `config.json` + şifreli jeton),
  `electron/server.cjs` (Express + HTTPS self-signed, JWT 30 gün, login hız sınırı, `/api/db` aynı
  beyaz liste), `electron/istemci.cjs` (undici pinli fetch, TOFU parmak izi onayı, `knownServers`),
  `electron/yetki.cjs` (IPC ve sunucu için ORTAK yetki kararı). `ipc/data.cjs` her çağrıda
  `config.istemciMi()` ile yönlendirir; istemcide belge yükleme base64 ile sunucuya gider, makbuz PDF
  istemcide üretilip sunucuya yüklenir, yedek yalnız sunucuda.
- `aktivasyon-sunucu/` — Cloudflare Worker + D1 (GenCRM kopyası, EYUPSPOR önekleri). `deploy.sh`
  ilk kurulumu yapar; sonra `electron/aktivasyonIstemci.cjs` AKTIVASYON_URL doldurulur.
- `src/components/IlkKurulum.jsx` — ilk kurulum sihirbazı (ilk parola değişiminden sonra, `kurulum_tamam` boş ve oyuncu
  yokken; kulüp adı → aidat/indirim → gruplar+sezon → yedek → kurtarma kodları → Excel aktarımı).
- `src/components/Ayarlar.jsx` — yalnız kabuk (bölüm menüsü, `onKirli` uyarısı); bölümler `src/components/ayarlar/` (KulupAyar,
  KalemAyar, KullaniciAyar+KurtarmaKodlari, SezonAyar, YedekAyar, OptimizeAyar, WhatsAppAyar, Hakkinda+Guncelleme). Dış API
  (`Ayarlar`, `KurtarmaKodlari`, `Guncelleme`) Ayarlar.jsx'ten yeniden dışa verilir.
- `src/App.jsx` — üst durum ve sekme kabuğu. Router yok; `tab` string + `TABS` dizisi.
- `src/lib/sezon.js` — SAF sezon mantığı (güncel/sonraki sezon, sezon sonu, üst grup önerisi); Ayarlar > Yeni Sezon
  sihirbazı `db.yeniSezonaGec` (tek işlem: yenileyen → yeni sezon+grup, diğerleri pasif+not). Bkz. `docs/plan.md §10`.
- `src/lib/belge.js` (sağlık raporu geçerliliği), `src/lib/program.js` (haftalık program), `src/lib/takvim.js` (takvim
  şeridi), `electron/oyuncuAktar.cjs` (Excel satır çözümleme) — hepsi SAF, vitest ile test edilir.
- `src/lib/aidat.js` — SAF aidat mantığı (`// @ts-check`): açılış durumu, tesise giriş, dönem, gecikme.
- `src/components/ui.jsx` — ilkeller (`Btn`, `Rozet`, `Kart`, `Alan`, `Sayfalama`, `useToast`, `useDene`). Sayfalama: Oyuncular DB'de
  (`db.playersPage`, 50/sayfa; dışa aktarım tam liste), Raporlar önizleme 100 satır (Excel/PDF tam), oyuncu kartı son
  12 dönem / 12 makbuz / 40 yoklama + "Tümünü göster". Tüm stil inline; renkler
  `src/ui.css` CSS değişkenlerinden (mor `#5B2D8E`, sarı `#F5D000`, kırmızı `#E0101F`).
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
