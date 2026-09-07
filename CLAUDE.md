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
npx electron scripts/tests/smoke-ui.cjs <dizin>   # ekran görüntüleriyle duman testi (önce npm run build)
npm run lint         # ESLint 9 (hata sayısı 0 tutulur)
npm run typecheck    # tsc --noEmit (// @ts-check işaretli dosyalar)
npm run scan:secrets # gitleaks
npm run audit        # npm audit --audit-level=high
```

## Durum (06.09.2026)

Faz 2 uygulama tarafı tamam: gömülü HTTPS sunucu + istemci modu (Ayarlar > Sunucu / Çoklu PC),
aktivasyon sunucusu kodu hazır (deploy bekliyor: `aktivasyon-sunucu/deploy.sh`). Kullanıcı rehberi
`docs/kurulum.md`. Yazı tipleri @fontsource ile gömülü. Windows yayını `.github/workflows/release.yml`
(tag push) veya `npm run build:win` (macOS'ta da çalışır; ardından `node scripts/ensure-native.cjs`
ile mac native modüllerini geri derle, yoksa Electron testleri düşer).

Faz 1 tamam: giriş + zorunlu parola değişimi, yaş grupları, oyuncu kaydı (aile, acil kişiler, belgeler),
aylık aidat, makbuz kesme/yazdırma/PDF, yoklama, pano (tesise giriş kontrolü), raporlar (Excel/PDF),
ayarlar (kalemler, kullanıcılar, yedekleme), offline lisans çekirdeği. Faz 2: Tailscale/çoklu PC,
online aktivasyon sunucusu. Bkz. `docs/plan.md`.

## Mimari

- `electron/main.cjs` — ana süreç: pencere, güvenlik sertleştirme (contextIsolation, sandbox,
  dış gezinme engeli), tek örnek kilidi, yazdırma, otomatik güncelleme (yalnız paketli).
- `electron/preload.cjs` — renderer'a tek köprü: `window.okul` (`auth.*`, `db(fn, ...args)`, `app.*`).
- `electron/ipc/data.cjs` — `db:call` beyaz listesi; oturum yoksa hiçbir veri çağrısı geçmez.
- `electron/db.cjs` — SQLite şeması, göç (`schema_version`), tohum (aidat kalemleri, ilk admin),
  tüm sorgular, lisans durumu (`lisansDurumu`/`lisansKaydet`/`leaseKaydet`). Şema `docs/plan.md §3`.
  Anahtar `safeStorage` ile OS anahtarlığında.
- `electron/ipc/files.cjs` — belge/foto yükleme (`uploads/oyuncu-<id>/`), yol geçişi koruması. JPG/PNG
  yükleme anında `electron/imageOptimize.cjs` ile nazikçe küçültülür (≤2000px, JPEG %82; yalnız küçülürse).
  `electron/ipc/optimize.cjs` — Ayarlar > Resim ve Belge Optimizasyonu (analiz/uygula, eski dosyalar için).
- `electron/ipc/cikti.cjs` — yazdırma, makbuz PDF (`uploads/makbuz/<no>.pdf`), rapor PDF, Excel (exceljs).
- `electron/ipc/yedek.cjs` — elle ve otomatik yedek (sıklık `yedek_sikligi`: acilis|gunluk|haftalik|kapali, saf karar `electron/yedekSiklik.cjs`) (data.db + uploads → TEK zip `eyupspor-yedek-<damga>.zip`,
  fflate, 30 gün saklama) ve
  geri yükleme (`geriYukleCekirdek`: zip'i geçici klasöre güvenle aç (yol geçişi reddi) ya da eski biçim klasör → doğrula → mevcut veriyi `.pre-restore-<damga>` ile kenara al → kopyala → relaunch).
  Yedek aynı PC'nin safeStorage anahtarıyla şifreli; başka PC'de açılmaz (`db.yedekBilgisi` bunu raporlar).
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
- `src/App.jsx` — üst durum ve sekme kabuğu. Router yok; `tab` string + `TABS` dizisi.
- `src/lib/aidat.js` — SAF aidat mantığı (`// @ts-check`): açılış durumu, tesise giriş, dönem, gecikme.
- `src/components/ui.jsx` — ilkeller (`Btn`, `Rozet`, `Kart`, `Alan`). Tüm stil inline; renkler
  `src/ui.css` CSS değişkenlerinden (mor `#5B2D8E`, sarı `#F5D000`, kırmızı `#E0101F`).
- `design/*.dc.html` — ekran tasarımları (Claude Design tuvali). Yeni ekran yaparken buna uy.

## Kurallar

- Her hata düzeltmesi, onu yakalayacak bir testle birlikte gelir.
- Aidat ve makbuz mantığı önce `src/lib/aidat.js` / `electron/db.cjs`'de saf fonksiyon, sonra arayüz.
- Renderer doğrudan `fs`/`sqlite` görmez; her şey `window.okul.db` üzerinden beyaz listeli.
- İlk admin `admin`/`admin`, `must_change_password=1` — ilk girişte parola değişimi zorunlu. Tohum yalnız
  hiç kullanıcı yokken çalışır (yeni yönetici ilk admin'i silebilir; son aktif yönetici silinemez).
  Parola kurtarma: `recovery_codes` (bcrypt, tek kullanımlık), `auth:kurtarmaUret` / `auth:kurtarmaSifirla`
  IPC'si ve `/api/auth/kurtarma*` uçları; yanlış deneme kullanıcı başına 5/15 dk.
- Türkçe arayüz, Türkçe yorum. Tarih `dd.mm.yyyy`, para `3.500 ₺` (`src/lib/aidat.js`). Büyük harf
  için `toLocaleUpperCase("tr-TR")` (i → İ).
- Salt okunur lisans modu `electron/ipc/data.cjs` beyaz listesinde uygulanır (YAZMA seti reddedilir);
  arayüz `saltOkunur` prop'uyla düğmeleri gizler ama asıl koruma main süreçtedir.
- `scripts/keys/*.pem` ASLA commit edilmez; kaybolursa tüm dağıtılmış lisanslar geçersiz olur — yedekle.
