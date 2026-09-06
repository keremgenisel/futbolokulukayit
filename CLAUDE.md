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
npm test             # vitest: saf mantık + jsdom bileşen testleri + Electron altında SQLite
npm run lint         # ESLint 9 (hata sayısı 0 tutulur)
npm run typecheck    # tsc --noEmit (// @ts-check işaretli dosyalar)
npm run scan:secrets # gitleaks
npm run audit        # npm audit --audit-level=high
```

## Mimari

- `electron/main.cjs` — ana süreç: pencere, güvenlik sertleştirme (contextIsolation, sandbox,
  dış gezinme engeli), tek örnek kilidi, yazdırma, otomatik güncelleme (yalnız paketli).
- `electron/preload.cjs` — renderer'a tek köprü: `window.okul` (`auth.*`, `db(fn, ...args)`, `app.*`).
- `electron/ipc/data.cjs` — `db:call` beyaz listesi; oturum yoksa hiçbir veri çağrısı geçmez.
- `electron/db.cjs` — SQLite şeması, göç (`schema_version`), tohum (aidat kalemleri, ilk admin),
  tüm sorgular. Şema `docs/plan.md §3` ile aynı. Anahtar `safeStorage` ile OS anahtarlığında.
- `src/App.jsx` — üst durum ve sekme kabuğu. Router yok; `tab` string + `TABS` dizisi.
- `src/lib/aidat.js` — SAF aidat mantığı (`// @ts-check`): açılış durumu, tesise giriş, dönem, gecikme.
- `src/components/ui.jsx` — ilkeller (`Btn`, `Rozet`, `Kart`, `Alan`). Tüm stil inline; renkler
  `src/ui.css` CSS değişkenlerinden (mor `#5B2D8E`, sarı `#F5D000`, kırmızı `#E0101F`).
- `design/*.dc.html` — ekran tasarımları (Claude Design tuvali). Yeni ekran yaparken buna uy.

## Kurallar

- Her hata düzeltmesi, onu yakalayacak bir testle birlikte gelir.
- Aidat ve makbuz mantığı önce `src/lib/aidat.js` / `electron/db.cjs`'de saf fonksiyon, sonra arayüz.
- Renderer doğrudan `fs`/`sqlite` görmez; her şey `window.okul.db` üzerinden beyaz listeli.
- İlk admin `admin`/`admin`, `must_change_password=1` — ilk girişte parola değişimi zorunlu.
- Türkçe arayüz, Türkçe yorum. Tarih `dd.mm.yyyy`, para `3.500 ₺` (`src/lib/aidat.js`).
