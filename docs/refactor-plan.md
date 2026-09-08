# Refactor Hazırlığı ve Planı (08.09.2026)

> **Durum (08.09.2026, aynı gün):** §5'teki 7 adımın tamamı uygulandı; her adım ayrı commit, her commit'te `npm test` yeşil.
> Sonuç ölçüleri §6'da. Kalan iş: 45 farklı biçimli try/catch (finally/ek deyim) isteğe bağlı olarak `useDene`'ye geçirilebilir.

Kod tabanı özellik olarak tamamlandı (Faz 1-3 + güvenlik incelemesi). Bu belge, davranışı DEĞİŞTİRMEDEN yapıyı
iyileştirmek için taban çizgisini, sıcak noktaları, güvenlik ağını ve adım sırasını kaydeder. Her adım ayrı commit,
her commit'te tüm testler yeşil.

## 1. Kurallar

- **Davranış korunur.** Refactor commit'inde şema, IPC beyaz listesi (`electron/yetki.cjs`), `window.okul` köprüsü,
  arayüz metinleri ve dosya biçimleri (yedek, taşıma paketi, makbuz PDF) değişmez. Değişecekse ayrı bir "özellik" commit'i.
- **Küçük adımlar.** Bir commit = bir modül/bileşen taşıması. Taşıma ve içerik düzeltmesi aynı commit'e girmez.
- **Önce test, sonra taşıma.** Kapsaması düşük parça (aşağıda listeli) önce karakterizasyon testi alır.
- **Dış API sabit.** `electron/db.cjs` bölünse de `require("./db.cjs")` aynı 104 fonksiyonu export etmeye devam eder;
  `yetki.cjs` beyaz listesi ve `server.cjs` aynı isimlerle çalışır. Bileşen bölünmelerinde `Ayarlar` gibi dış bileşen adı
  ve prop'ları korunur (testler bunlara bağlı).
- **Her adımda:** `npm run lint && npm run typecheck && npm run test:saf` (19 sn); modül taşımasından sonra
  `npm test` (2 dk, Electron altı) ve smoke ekran görüntüleri.

## 2. Taban çizgisi (08.09.2026, commit 829cbdf sonrası)

| Ölçü | Değer |
|------|-------|
| Kaynak (electron + src) | 7.398 satır, 232 KB; satırlar çok yoğun (100'den fazla satır 300 karakterden uzun) |
| En büyük dosyalar | `electron/db.cjs` 1.118 satır / 74 KB / 117 fonksiyon / 104 export · `src/components/Ayarlar.jsx` 671 satır / 62 KB / 8 bölüm bileşeni · `OyuncuKarti.jsx` 302 / 26 KB · `ipc/yedek.cjs` 299 / 19 KB · `Yoklama.jsx` 231 / 19 KB · `Tahsilat.jsx` 216 / 18 KB · `server.cjs` 211 / 13 KB |
| Testler | 53 dosya, 265 test (vitest); süreç içi: saf + jsdom 49 dosya (19 sn); Electron altı 4 dosya (`db-electron` → `db-roundtrip.cjs` 168 kontrol + `smoke-ui.cjs` ekran görüntüleri, `kalicilik.cjs` 41, `server-security.cjs` 37, `sezon-e2e.cjs` 17) |
| Kapsama (yalnız süreç içi, `npm run test:coverage`) | `src/lib` %95 satır · `src/components` %79 · `electron` saf modüller %90+ (`lisans`, `oyuncuAktar`, `kodUret`, `tasimaKripto`, `yetki`, `makbuzIzin`, `belgeDogrula`, `yedekSiklik`) · `db.cjs`, `ipc/*`, `server.cjs`, `main.cjs`, `App.jsx` **%0 süreç içi** (yalnız Electron alt süreç testleriyle) |
| Düşük kapsamalı bileşenler | `OyuncuKarti.jsx` %57 satır (fonksiyon %28) · `Raporlar.jsx` %73 · `Oyuncular.jsx` %73 · `YasGruplari.jsx` %74 |
| Tekrar kalıpları | IPC'de elle oturum/yönetici kontrolü 14 yerde (`role !== "admin"`), `getSession()` 17 handler'da · renderer'da `toast("err", hataMetni(e))` 73 kez, `useEffect(() => { yukle(); }…)` 7 kez · 703 inline `style={{}}` |
| Tip denetimi | `// @ts-check` yalnız `src/lib/*` ve `types.d.ts` (13 dosya); Electron tarafı tipsiz |

## 3. Sıcak noktalar ve öneri

### 3.1 `electron/db.cjs` → `electron/db/` (en büyük kazanç, en yüksek risk)
Bölüm başlıkları zaten var; her biri bir modül olur. Ortak bağlantı tek yerde:

| Yeni modül | İçerik (bugünkü bölüm) |
|-----------|------------------------|
| `db/baglanti.cjs` | anahtar (`getDbKey`, safeStorage, `db-key.enc`), `init/close/checkpoint`, yollar (`getDbPath`, `getUploadsDir`), `duzKopyaOlustur`, `duzVeritabaniniSifrele`; `baglanti()` ile canlı `Database` nesnesi |
| `db/sema.cjs` | `SCHEMA_VERSION`, `migrate()`, tohum (`tohum_fee_types`/`tohum_fee_items` bayrakları) |
| `db/meta.cjs` | `getMetaValue/setMetaValue/getSetting/setSetting`, `aidatAyarlariKaydet` |
| `db/kullanicilar.cjs` | users + parola + `resetUserPassword` + kurtarma kodları |
| `db/gruplar.cjs` | age groups |
| `db/oyuncular.cjs` | players, guardians, emergency, `playersPage`, `likeKacir` |
| `db/belgeler.cjs` | documents, sağlık raporu sorguları |
| `db/aidat.cjs` | fee items, fee types, monthly dues |
| `db/makbuz.cjs` | receipts, iptal |
| `db/antrenman.cjs` | trainings, attendance, bildirim olayları, `message_log` |
| `db/sorgular.cjs` | pano/rapor özetleri ("Ek sorgular (ekranlar)") |
| `db/sezon.cjs` | `yeniSezonaGec` |
| `db/lisans.cjs` | lisans durumu, lease, `kaliciMetaYaz` (dosya adı çakışmasın: `electron/lisans.cjs` saf çekirdek kalır → `db/lisansDurum.cjs`) |
| `db/yedek.cjs` | `yedekBilgisi`, `yedekBilgisiBuffer` |
| `electron/db.cjs` | `module.exports = { ...require("./db/baglanti.cjs"), ...require("./db/kullanicilar.cjs"), … }` — dış API aynı |

Dikkat: `db.cjs` içinde modül düzeyi `let db` (bağlantı) ve `lisansCache` gibi durumlar var; bunlar `baglanti.cjs`'de
kalır, diğer modüller `baglanti()` çağırır (prepared statement'lar her çağrıda hazırlanıyor, önbellek yok; davranış aynı).
Testi: `scripts/tests/db-roundtrip.cjs` (168 kontrol) taşımadan önce ve sonra aynı çıktıyı vermeli. Her modül ayrı commit.

### 3.2 `src/components/Ayarlar.jsx` → `src/components/ayarlar/`
8 bölüm bileşeni (`WhatsAppAyar`, `KulupAyar`, `KalemAyar`, `KullaniciAyar`, `OptimizeAyar`, `SezonAyar`, `YedekAyar`,
`Hakkinda`) + `BOLUMLER` ayrı dosyalara; `Ayarlar.jsx` yalnız kabuk (bölüm menüsü, `onKirli` uyarısı). Testler
`tests/ui/aidat-ayar`, `sezon`, `yedek-siklik`, `guncelleme`, `whatsapp` `Ayarlar`'ı dıştan render ediyor; adı ve
prop'ları değişmez.

### 3.3 IPC kabuğu: ortak koruma sarmalayıcısı
`electron/ipc/koruma.cjs`: `oturumlu(getSession, fn)`, `yonetici(getSession, fn)`, `sunucudaDegil(fn)` (istemci modu
reddi). 44 handler'daki elle `if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" }` tekrarı
kalkar; hata metinleri tek yerde. `yetki.cjs` (db beyaz listesi) olduğu gibi kalır. Test: `tests/yetki.test.js`
benzeri saf test + `server-security.cjs`/`kalicilik.cjs` mevcut kontrolleri.

### 3.4 Renderer tekrarları
- `src/lib/hooks.js`: `useYukle(fn, deps)` (yükle + hata toast'u + `bekliyor`), `hataYakala(toast, fn)` sarmalayıcısı.
  73 `toast("err", hataMetni(e))` çağrısı aşamalı olarak buna geçer; bileşen başına ayrı commit.
- `OyuncuKarti.jsx` (302 satır, fonksiyon kapsaması %28): önce sekme başına karakterizasyon testi (aidat/dönemler,
  makbuzlar, yoklama, WhatsApp), sonra `oyuncu-karti/` altına sekme bileşenleri.
- `Raporlar.jsx`: rapor tanımları (sütun/satır üreticileri) `src/lib/raporlar.js`'e saf fonksiyon olarak çıkar ve test
  edilir; bileşen yalnız seçim + önizleme + Excel/PDF kalır.

### 3.5 Biçimlendirme (Kerem'in kararı)
100'den fazla satır 300 karakteri aşıyor; diff okunabilirliği düşük. Öneri: Prettier (`printWidth: 140`,
`--no-semi` KAPALI, çift tırnak) tek "biçimlendirme" commit'i olarak, refactor'dan ÖNCE ve içerik değişikliği
OLMADAN; commit hash'i `.git-blame-ignore-revs`'e yazılır. Yapılmazsa refactor mevcut yoğun üslupla sürer.

### 3.6 Kapsam dışı (bu turda yapılmaz)
TypeScript'e geçiş, React Router, inline style → CSS modülleri, şema/IPC değişikliği, yeni özellik, çoklu PC bayrağı.

## 4. Güvenlik ağı

| Komut | Süre | Ne doğrular |
|-------|------|-------------|
| `npm run test:saf` | ~19 sn | Saf mantık + jsdom bileşen testleri (49 dosya, 261 test) — her adımda |
| `npm run test:coverage` | ~25 sn | Aynı küme + kapsama raporu (`coverage/index.html`); refactor sonrası oran düşmemeli |
| `npm test` | ~2 dk | Üstü + Electron altı: SQLite tam tur (168 kontrol), kalıcılık (SIGKILL, yedek/geri yükleme), sunucu güvenliği, sezon e2e, smoke ekran görüntüleri |
| `npx electron scripts/tests/smoke-ui.cjs <dizin>` | ~40 sn | Ekran görüntüleri: refactor öncesi `oncesi/`, sonrası `sonrasi/` dizinine al, `cmp` ile byte karşılaştır (piksel farkı = bak) |
| `npm run lint && npm run typecheck` | ~10 sn | ESLint 0 hata, `@ts-check` dosyaları |

Eksik güvenlik ağı (refactor'dan önce kapatıldı/kapatılacak):
- `raporHtml.js` %0 → `tests/rapor-html.test.js` eklendi (08.09.2026).
- `OyuncuKarti.jsx` sekmeleri → 3.4'te önce test.
- `Raporlar.jsx` rapor üreticileri → 3.4'te saf fonksiyona çıkınca test.

## 5. Sıra

1. (Kerem) Biçimlendirme kararı (3.5). Evetse tek commit + blame-ignore.
2. IPC koruma sarmalayıcısı (3.3) — küçük, ölçülebilir, `server-security`/`kalicilik` doğrular.
3. `db.cjs` bölünmesi (3.1) — modül başına commit; her commit'te `npm test`.
4. `Ayarlar.jsx` bölünmesi (3.2).
5. `OyuncuKarti` testleri + bölünmesi; `Raporlar` saf üreticiler (3.4).
6. `useYukle`/`hataYakala` geçişi, bileşen başına (3.4).
7. Kapsama raporunu yeniden al, bu belgeye "sonrası" sütunu ekle.

## 6. Sonrası (08.09.2026, 7 adım sonunda)

| Ölçü | Öncesi | Sonrası |
|------|--------|---------|
| Kaynak satırı (electron + src) | 7.398 (yoğun, 100+ satır >300 karakter) | 15.069 (Prettier 140 sütun; 6 satır >300 karakter, hepsi SQL/JSX dizgisi) |
| `electron/db.cjs` | 1.118 satır, 117 fonksiyon tek dosya | 127 satırlık dış API; gövde `electron/db/` 15 modül (en büyük `sema.cjs` 340 satır) |
| `src/components/Ayarlar.jsx` | 671 satır (biçimlendirme sonrası 1.906), 8 bölüm | 97 satırlık kabuk + `ayarlar/` 8 dosya (en büyük `KalemAyar.jsx` 448) |
| `OyuncuKarti.jsx` | 302 satır (946), 5 sekme tek dosya | 344 satırlık kabuk + `oyuncu-karti/` 6 dosya; 4 sekme karakterizasyon testi |
| `Raporlar.jsx` | 342 satır, rapor mantığı bileşende | 205 satır; 5 üretici `src/lib/raporlar.js` (saf, 6 test) |
| IPC elle yönetici/oturum kontrolü | 14 yer | 2 yer (`data.cjs` login yolu, `koruma.cjs` tanımı); geri kalanı `ipc/koruma.cjs` |
| `toast("err", hataMetni(e))` | 73 | 45 (32 tam-gövde try/catch `useDene` ile sadeleşti) |
| Test | 53 dosya / 265 test | 56 dosya / 280 test (+ `ipc-koruma`, `raporlar`, `oyuncu-karti-sekmeler`) |
| Kapsama (süreç içi) | `src/lib` %97,8 · `src/components` %79,5 · `electron` %18,5 | `src/lib` %98,2 · `src/components` %76,6 · `electron` %31,9 (saf modüller arttı; `electron/db` yine yalnız Electron altı testle) |
| Komutlar | — | `npm run format`, `format:check`, `test:saf` (~19 sn), `test:coverage`; `.git-blame-ignore-revs` biçimlendirme commit'i |

En büyük kalan dosyalar: `Tahsilat.jsx` 622, `Yoklama.jsx` 588, `ui.jsx` 466, `Pano.jsx` 466, `ipc/yedek.cjs` 455 satır (biçimlendirilmiş
hâlleriyle; hepsi tek sorumlulukta, bölme gerekmedi).
