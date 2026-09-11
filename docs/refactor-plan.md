# Refactor Hazırlığı ve Planı (08.09.2026)

> **Durum (08.09.2026, aynı gün):** §5'teki 7 adımın tamamı uygulandı; her adım ayrı commit, her commit'te `npm test` yeşil.
> Sonuç ölçüleri §6'da. try/catch + toast kalıbının tamamı `useDene`'ye geçirildi (08.09.2026).

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
| `toast("err", hataMetni(e))` | 73 | 0 (tamamı `useDene` ile: `dene(fn, { sonunda, hata })`; `hataMetni` yalnız 4 özel yerde: form/parola/güncelleme durum metni) |
| Test | 53 dosya / 265 test | 56 dosya / 280 test (+ `ipc-koruma`, `raporlar`, `oyuncu-karti-sekmeler`) |
| Kapsama (süreç içi) | `src/lib` %97,8 · `src/components` %79,5 · `electron` %18,5 | `src/lib` %98,2 · `src/components` %76,6 · `electron` %31,9 (saf modüller arttı; `electron/db` yine yalnız Electron altı testle) |
| Komutlar | — | `npm run format`, `format:check`, `test:saf` (~19 sn), `test:coverage`; `.git-blame-ignore-revs` biçimlendirme commit'i |

En büyük kalan dosyalar: `Tahsilat.jsx` 622, `Yoklama.jsx` 588, `ui.jsx` 466, `Pano.jsx` 466, `ipc/yedek.cjs` 455 satır (biçimlendirilmiş
hâlleriyle; hepsi tek sorumlulukta, bölme gerekmedi).

---

# Refactor Hazırlığı — 2. tur (11.09.2026, sürüm 1.1.0 + 13 commit, HEAD aee65ec)

> Kerem: "uygulamayı refactor'e hazırla". Bu bölüm 1. turdan (08.09.2026) sonra eklenen özelliklerin (§13 WhatsApp, §14 taşıma,
> §15–§22 sezon, §24 uzun dönem, §25 sağlık, §31 KVKK, §32 kulüp kimliği, §36 tasarım tutarlılığı, §37 sezon/antrenman saatleri)
> ardından yeni taban çizgisi, sıcak noktalar, güvenlik ağı ve önerilen adımları kaydeder. Kodda DEĞİŞİKLİK YAPILMADI; §1'deki
> kurallar aynen geçerli. Refactor öncesi duman ekran görüntüleri (33 adet) alındı: oturum scratchpad `refactor-oncesi/`
> (kalıcı değil; refactor günü `npx electron scripts/tests/smoke-ui.cjs <dizin>` ile yeniden alınır ve `sonrasi/` ile `cmp` edilir).

## 7. Taban çizgisi (11.09.2026)

| Ölçü | 1. tur sonrası (08.09) | Şimdi (11.09) |
|------|------------------------|---------------|
| Kaynak satırı (src + electron) | 15.069 | 18.026 (src/components 9.468 · src/lib 1.777 · electron 5.790 · App/main/preload vb.) |
| Test kodu | — | 14.812 satır; 79 vitest dosyası / 412 test (süreç içi 65 dosya / 396 test, ~20 sn) + 16 Electron betiği (`scripts/tests/`) |
| Tam `npm test` | ~2 dk | ~5 dk (db-roundtrip, kalıcılık, sunucu güvenliği, 10 e2e, duman) |
| En büyük dosyalar | Tahsilat 622 · Yoklama 588 · ui 466 · Pano 466 · yedek.cjs 455 | **Tahsilat.jsx 724** (tek bileşen 704 satır, 18 useState) · **Yoklama.jsx 661** (645 satırlık tek bileşen, 14 useState, 5 modal/form bloğu) · ui.jsx 519 · **Pano.jsx 505** (478 satırlık bileşen) · **IlkKurulum.jsx 474** (14 useState) · ipc/yedek.cjs 455 · **sema.cjs 437** (`migrate()` 166 satır, 9 sürüm bloğu) · SezonAyar 428 (13 useState) · KalemAyar 428 · WhatsAppHatirlat 399 · server.cjs 347 |
| Kapsama (süreç içi, `npm run test:coverage`) | lib %98,2 · components %76,6 · electron %31,9 | **lib %97,3 · components %84,2 · electron %34,5**; `electron/db` %0 (yalnız Electron altı), `App.jsx` %1 (yalnız e2e/duman) |
| Fonksiyon kapsaması düşük bileşenler | — | Pano %57 · Tahsilat %65 · Oyuncular %70 · IlkKurulum %71 · Giris %72 · TemaSecici %73 · SezonAyar %74 |
| Tekrar kalıpları | — | `db("sezonDurumu")` **8 bileşende** ayrı ayrı (Pano, Raporlar, Tahsilat, Yoklama, YasGruplari, Oyuncular, SezonSecim, SezonAyar) · `db("listAgeGroups")` 11 bileşende · `useEffect` yükleme kalıbı 74 · Pano'da iki özdeş uyarı şeridi (`role="alert"`, sezon bitti / bitiş yakın) · `hataMetni` 7 dosyada (4'ü kasıtlı durum metni) |
| Stil | 703 inline `style={{}}` | **829** inline · `#fff` sabiti 62 yerde (menü/şerit üstü yazılar `var(--ana-ustu)` olmalı; §32 kuralı) · 28 sabit hex (çoğu nokta/gölge tonu) |
| Saf modül ikizleri (ESM ↔ CJS, elle senkron) | tema/ayarDogrula | **5 çift:** `tema`, `ayarDogrula`, `sezonTarih` (↔ `sezon.js`), `saatAralik` (↔ `program.js`), `makbuzNo`; eşitlik testleri `tests/{tema,sezon,program}.test.js` |
| Dış API | db.cjs 104 export · yetki 60+ | **db.cjs 112 export · yetki.cjs beyaz listesi 79 ad** |
| Tip denetimi | 13 `@ts-check` dosyası | 17 dosya (`src/lib/*`, `types.d.ts` 251 satır); Electron tarafı tipsiz |
| Lint | 0 hata | 0 hata, 0 uyarı; Prettier temiz (md/html hariç) |

## 8. Sıcak noktalar ve öneri (öncelik sırasıyla)

### 8.1 `Yoklama.jsx` (661) → `src/components/yoklama/` — en yüksek kazanç
Tek bileşende 5 bağımsız blok: Antrenman Ekle formu (+ çakışma uyarısı), antrenman kartları, Düzenle çubuğu, yoklama listesi
(oyuncu satırı + sayaçlar + Kalanları Geldi), modallar (İptal onayı, bildirim sorusu, WhatsApp penceresi). Öneri: `AntrenmanEkleFormu`,
`AntrenmanKarti`, `AntrenmanDuzenle`, `YoklamaListesi` ayrı dosyalar; ana bileşen durum + veri yükleme. Saf yardımcılar zaten
`program.js`'de. Güvenlik ağı hazır: `tests/ui/yoklama.test.jsx` (%96 satır) + `yoklama-e2e` 50 kontrol. Dış ad `Yoklama` ve
prop'ları (`saltOkunur`) sabit.

### 8.2 `Tahsilat.jsx` (724) → `src/components/tahsilat/`
18 useState tek bileşende: oyuncu arama/seçim, aidat ayları (kısmi/elle/uzun dönem), kalem satırları, makbuz kesme + yazdırma,
Bugün Kesilen Makbuzlar (sayfalı), iptal modalı. Öneri: `AidatAySecimi`, `KalemSatirlari`, `BugunKesilenler`, `MakbuzIptal` ayrı;
toplam/aidat hesapları `src/lib/aidat.js`'e saf fonksiyon olarak (bugün bileşen içinde `aidatToplam`, `toplam` reduce'ları).
ÖNCE karakterizasyon: fonksiyon kapsaması %65 → uzun dönem + kısmi + ücretsiz akışları `tests/ui/tahsilat.test.jsx`'te var,
"Bugün Kesilen" sayfalama ve iptal yolu `tahsilat-e2e`/`sayfalama-e2e`'de; eksik: makbuz yazdır/PDF hata yolu (satır 672–681, 704–719).

### 8.3 Sezon durumu için tek kaynak: `useSezonDurumu()` kancası
8 bileşen aynı `db("sezonDurumu")` çağrısını kendi `useState/useEffect`'iyle yapıyor; `tarihler` (§37) eklenince her biri ayrı ayrı
`d?.tarihler?.baslangic && …` süzüyor. Öneri: `src/lib/useSezonDurumu.js` — `{ durum, aktifSezon, tarihler, yenile }`; test mock'ları
değişmez (`window.okul.db` aynı çağrı). Aynı kalıp `useYasGruplari()` için (11 bileşen). `App.jsx` seviyesinde tek yükleme + context
DAHA sonra (davranış: sezon geçişinden sonra `yenile` gerek).

**Sonuç (11.09.2026):** `src/lib/useSezonDurumu.js` — `{ durum, aktifSezon, baslangicAyi, tarihler, yenile }`; Pano, Raporlar, Yoklama,
Oyuncular, YasGruplari, Tahsilat (`bugunkuYukle` artık `aktifSezon`'a bağlı: sezon yüklenince yeniden çeker), SezonAyar (`yenile()` sonucu
kullanır) geçirildi; SezonSecim prop almaya devam eder. `useYasGruplari` YAPILMADI: 11 çağrının 5'i sezon filtresi/aktif süzgeci gibi
farklı parametrelerle (Oyuncular/Raporlar `{ sezon }`, Yoklama `aktif` süzer, IlkKurulum ad kümesi) — ortak kanca davranışı değiştirirdi.

### 8.4 Uyarı şeridi bileşeni `UyariSeridi`
Pano'da iki özdeş `role="alert"` bloğu (sezon bitti / bitişe ≤30 gün), `SifresizUyari`, deneme/salt okunur şeridi ve `GuncellemeSeridi`
aynı görsel dili elle kuruyor. Öneri: `ui.jsx`'e `UyariSeridi({ ton, eylem, children })`; `#fff`/sabit hex temizliği bu adımda
(62 `#fff` → `var(--ana-ustu)` yalnız marka zemini üstündekiler; modal/kart zeminindeki `#fff` kalır).

**Sonuç (11.09.2026):** `ui.jsx UyariSeridi({ ton, baslik, eylem, yogun, children })`; Pano (2), App (salt okunur / deneme / lisans
bitiyor — `yogun` kip pikselleri korur), SifresizUyari geçirildi; GuncellemeSeridi kendi düzeninde kaldı (sarı marka zemini, ilerleme). `#fff`
→ `var(--ana-ustu)`: TakvimSeridi seçili gün, Tahsilat ödeme yöntemi/toplam paneli, WhatsAppHatirlat başlık, IlkKurulum adım pili/grup
pili, OyuncuKarti başlığı (13 yer). Kalanlar bilinçli: toast/yeşil düğme/kırmızı zemin (anlam renkleri sabit), kart/modal zemini.
Duman karşılaştırması: kaydırmasız 8 sayfa birebir aynı; kaydırmalı sayfalarda tek fark macOS'un beliren kaydırma çubuğu (öncesi
görüntüde çubuk görünür, metin bir kelime erken kırılır) — kod kaynaklı fark yok. NOT: piksel karşılaştırması için duman betiğinde
çubuğu gizlemek (`::-webkit-scrollbar{display:none}`) ileride eklenebilir.

### 8.5 `sema.cjs migrate()` (166 satır, 9 blok) → sürüm başına fonksiyon
`GOCLER = { 12: (db) => …, 13: …, 19: … }` haritası; `migrate()` sıralı uygular, `schema_version` yazar. Davranış aynı (idempotent
PRAGMA kontrolleri korunur). Güvenlik ağı: db-roundtrip 7/11/15/16 → 19 yeniden göç kontrolleri, kalıcılık "şema 19".

### 8.6 ESM/CJS ikizleri (5 çift)
Elle senkron tutulan 5 çift, her yeni saf yardımcıda büyüyor. Seçenekler: (a) `electron/` tarafında `require` ile ESM'i yükleyemeyiz
(CJS ana süreç) → tek kaynak `.cjs` yazıp Vite'ta `import x from "../../electron/x.cjs"` (Vite CJS interop ile çalışır; test edilmeli);
(b) mevcut eşitlik testleri yeterli, olduğu gibi bırak. Öneri: (a) tek modülle deneme (`saatAralik`), geçerse diğerleri; olmazsa (b).
Bu adım KARAR ister (Kerem).

**Sonuç (11.09.2026, Kerem: "tek kaynak denemesi yapılsın"):** (a) UYGULANDI, ama Vite interop yerine tersi yönde: Electron 42'nin
Node 24'ü CJS'den ESM'i eşzamanlı `require` edebiliyor (`require(esm)`); asar arşivi içinden de doğrulandı (@electron/asar ile
paketlenmiş kopya). Ana süreç artık `src/lib/{sezon,program,tema}.js`'i doğrudan yüklüyor; `electron/tema.cjs`, `sezonTarih.cjs`,
`saatAralik.cjs` silindi, `acikTon` ve `varsayilanSezonAraligi` ESM'e taşındı, `build.files`'a `src/lib/**/*` eklendi. Eşitlik
testleri kaldırıldı (tek kaynak). `ayarDogrula.cjs` ve `makbuzNo.cjs` yalnız ana süreçte kullanılan saf modüller; ikizi yok, kaldı.

### 8.7 Küçük temizlikler
`IlkKurulum.jsx` adım başına bileşen (14 useState → adım state'i); `SezonAyar.jsx` "Sezon tarihleri" kartı ayrı bileşen (§37'de
büyüdü); `Pano.jsx` sağlık/borçlu tabloları ayrı; `ipc/yedek.cjs` yedek/geri yükle/taşıma üç dosya (455 satır, 14 fonksiyon).

### 8.8 Kapsam dışı (bu turda yapılmaz)
TypeScript'e geçiş, React Router/context'e genel geçiş, inline style → CSS modülleri, şema/IPC/yetki değişikliği, yeni özellik,
`electron/db` için süreç içi test altyapısı (better-sqlite3 native; Electron altı kalır), çoklu PC bayrağı.

## 9. Güvenlik ağı (11.09.2026)

| Komut | Süre | Ne doğrular |
|-------|------|-------------|
| `npm run lint && npm run typecheck` | ~10 sn | 0 hata/0 uyarı, `@ts-check` 17 dosya |
| `npm run test:saf` | ~20 sn | 65 dosya / 396 test — her commit'te |
| `npm run test:coverage` | ~30 sn | oran düşmemeli: lib %97 · components %84 · electron %34 |
| `npm test` | ~5 dk | + db-roundtrip (şema 19, 200+ kontrol), kalıcılık (yedek/geri yükleme/taşıma, SIGKILL), sunucu güvenliği, e2e: sezon, taşıma, raporlar, oyuncular, sayfalama, tahsilat, yaş grupları (48), yoklama (50), kulüp kimliği (PDF), kullanıcılar; duman (33 görüntü) |
| `npx electron scripts/tests/smoke-ui.cjs oncesi/` → refactor → `sonrasi/` + `cmp` | ~40 sn | piksel farkı = bak |

Eksikler (ilgili adımdan ÖNCE kapatılır): Tahsilat yazdır/PDF hata yolu (8.2) · Pano fonksiyon kapsaması %57: WhatsApp
hatırlatma düğmeleri ve sağlık "Tümü" bağlantısı (8.4'ten önce `tests/ui/pano.test.jsx`'e) · `App.jsx` yalnız e2e (sekme kabuğu;
refactor'da dokunulmayacak) · `Giris.jsx` kurtarma kodu akışı (%72; `kullanicilar-e2e` kapsıyor, süreç içi yok).

## 10. Sıra ve ön koşullar

0. **Sürüm:** refactor, etiketli bir sürümden başlar → önce v1.1.1 (13 yayınlanmamış commit: §33 aktivasyon, §34.5 ikon, §36, §37).
   Refactor commit'leri sürüm çıkarmaz; bitince v1.2.0.
1. Karakterizasyon testleri (Tahsilat yazdır/PDF hata yolu, Pano düğmeleri) — §9 eksikleri.
2. 8.3 `useSezonDurumu` / `useYasGruplari` — küçük, 8+11 bileşen, test mock'ları değişmez.
3. 8.4 `UyariSeridi` + `#fff` temizliği — duman görüntüleri karşılaştırılır.
4. 8.1 Yoklama bölünmesi — dosya başına commit.
5. 8.2 Tahsilat bölünmesi + saf hesaplar `aidat.js`'e.
6. 8.5 `migrate()` sürüm haritası.
7. 8.6 ikiz kararı (Kerem) → uygulanırsa modül başına commit.
8. 8.7 küçük temizlikler; kapsama raporu yeniden; bu belgeye "sonrası" sütunu.
