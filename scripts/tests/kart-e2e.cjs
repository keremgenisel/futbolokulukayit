// Giriş kartı (plan §40, §40.7) uçtan uca: GERÇEK main.cjs + gerçek DB, gerçek pencere. Giriş Kartları penceresinin tüm durumları:
// varsayılan süzgeç, sezon / yaş grubu / durum / arama / Kart süzgeçleri, satır ve başlık kutusu seçimi (kısmi durum), süzgeç
// değişince korunan seçim ve "listede değil" sayacı, Temizle, yazdırma hatası (kayıt yok), başarılı toplu basım (HTML: foto, QR,
// veli; kayıt: kullanıcı, kart no, sezon), Basılmamış/Basılmış/Tümü sayaçları, 2. basım + sarı not, 200 sınırı, kapatma yolları,
// oyuncu kartından tek basım + şerit + "Basılmadı say", kullanıcı rolü (sil 403), salt okunur lisans (kayıt yok), geçmiş sezon,
// gerçek printToPDF sayfa sayıları (6/7/8/13 oyuncu). Kullanım: electron scripts/tests/kart-e2e.cjs <dizin>
const { app, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const [dizin] = process.argv.slice(2);
app.setPath("userData", dizin);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
const db = require("../../electron/db.cjs");
require("../../electron/main.cjs");
// 1×1 PNG (foto testi)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

let ilkPencere = true;
app.on("browser-window-created", async (_e, win) => {
  if (!ilkPencere) return; // yazdırma penceresi vb.
  ilkPencere = false;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(350);
    };
    const D = `[...document.querySelectorAll("[role=dialog]")].pop()`; // en üstteki pencere
    const dMetin = () => js(`(${D})?.textContent || ""`);
    const dVar = () => js(`!!(${D})`);
    const secD = async (etiket, deger) => {
      await js(
        `(() => { const s = (${D}).querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!s) throw new Error("Kutu yok: " + ${JSON.stringify(etiket)}); s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(500);
    };
    const yazD = async (etiket, deger) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = (${D}).querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(500);
    };
    const kutuD = async (etiket) => {
      await js(`(${D}).querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]").click()`);
      await bekle(200);
    };
    const satirTikla = async (ad) => {
      await js(`[...(${D}).querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(ad)})).click()`);
      await bekle(200);
    };
    const sayac = () => js(`(${D}).querySelector("[data-testid=kart-sayac]")?.textContent || ""`);
    const secildi = async () => Number((await dMetin()).match(/(\d+) oyuncu seçildi/)?.[1] ?? -1);
    const adlar = () =>
      js(
        `[...(${D}).querySelectorAll("tbody tr")].map((tr) => tr.querySelector("input[aria-label]").getAttribute("aria-label").slice(5)).sort((a, b) => a.localeCompare(b, "tr"))`,
      );
    const rozet = (ad) =>
      js(
        `([...(${D}).querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(ad)}))?.cells[3]?.textContent) || ""`,
      );
    const yazdirPasif = () => js(`[...(${D}).querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Yazdır"))?.disabled`);
    const basKutu = () =>
      js(
        `(() => { const k = (${D}).querySelector("input[aria-label='Süzgeçtekilerin tümünü seç']"); return k.checked ? "hepsi" : k.indeterminate ? "kismi" : "hic"; })()`,
      );
    const govde = () => js(`document.body.textContent`);
    const giris = async (k, p) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, ${JSON.stringify(k)}); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(p)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(700);
    };
    const cikis = async () => {
      await js(`document.querySelector("button[aria-label='Çıkış']").click()`);
      await bekle(600);
    };
    const oyuncularAc = async () => {
      await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
      await bekle(800);
    };
    const pencereAc = async () => {
      await tikla("Kartları Yazdır");
      await bekle(900);
    };
    // Yazdırma yakalama: pencere açılmasın, HTML'i tut; `sonuc` ile hata senaryosu
    const yakalanan = { html: "", sonuc: { ok: true } };
    ipcMain.removeHandler("cikti:yazdir");
    ipcMain.handle("cikti:yazdir", async (_e, html) => {
      yakalanan.html = String(html);
      return yakalanan.sonuc;
    });
    yakalanan.pdf = { ok: false, error: "pdf kapalı (test)" }; // yazıcı hatasında PDF yedek yolu da yakalanır (Preview açılmasın)
    ipcMain.removeHandler("cikti:pdfAc");
    ipcMain.handle("cikti:pdfAc", async (_e, html) => {
      yakalanan.pdfHtml = String(html);
      return yakalanan.pdf;
    });
    const kayitlar = (pid) => db.hamBaglanti().prepare("SELECT * FROM card_prints WHERE player_id=? ORDER BY id").all(pid);
    const toplamKayit = () => db.hamBaglanti().prepare("SELECT count(*) AS n FROM card_prints").get().n;

    // ── Veri (girişten önce: oturum ad soyadı login'de okunur) ──
    db.hamBaglanti().prepare("UPDATE users SET ad_soyad='Şerif Çelik' WHERE username='admin'").run();
    db.setSetting("aktif_sezon", "2026-2027");
    db.setSetting("kart_qr", "1");
    db.setSetting("kulup_adi", "Test Kulübü");
    const g11 = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    const g12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027" });
    const g9 = db.createAgeGroup({ ad: "U9", sezon: "2026-2027" });
    const P = (p) => db.createPlayer({ dogum_tarihi: "2015-01-01", odeme_donemi: "1-10", ucret_tipi: "normal", aylik_aidat: 1000, ...p });
    const ali = P({ ad_soyad: "Ali Aktif", yas_grubu_id: g11.id, durum: "aktif" });
    fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + ali.id), { recursive: true });
    fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + ali.id, "foto.png"), PNG);
    db.hamBaglanti().prepare("UPDATE players SET foto_yolu=? WHERE id=?").run(`oyuncu-${ali.id}/foto.png`, ali.id);
    db.addGuardian(ali.id, { tip: "anne", ad_soyad: "Anne Ali", gsm: "05321112233", veli_mi: 1 });
    const berk = P({ ad_soyad: "Berk Yeni", yas_grubu_id: g12.id, durum: "aktif" });
    const deniz = P({ ad_soyad: "Deniz Sakat", yas_grubu_id: g12.id, durum: "sakat" });
    const ibrahim = P({ ad_soyad: "İbrahim Deneme", yas_grubu_id: g11.id, durum: "deneme" });
    P({ ad_soyad: "Emre Ayrıldı", yas_grubu_id: g12.id, durum: "ayrildi" });
    P({ ad_soyad: "Fatma Pasif", yas_grubu_id: g12.id, durum: "pasif" });
    const ceren = P({ ad_soyad: "Ceren Eski", yas_grubu_id: null, durum: "pasif", sezon: "2025-2026" });
    db.hamBaglanti().prepare("INSERT OR IGNORE INTO player_seasons (player_id, sezon) VALUES (?, '2025-2026')").run(ceren.id);
    const AKTIFLER = ["Ali Aktif", "Berk Yeni", "Deniz Sakat", "İbrahim Deneme"];

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await giris("admin", "admin");
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "kart-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }
    await oyuncularAc();

    // ── 1. Açılış ──
    await pencereAc();
    check(
      "pencere açılır: başlık, Kart: Basılmamış varsayılan, Yazdır pasif, 0 seçili",
      /Giriş Kartları/.test(await dMetin()) &&
        (await js(`(${D}).querySelector("select[aria-label='Kart süzgeci']").value`)) === "basilmamis" &&
        (await yazdirPasif()) === true &&
        (await secildi()) === 0,
    );
    check(
      "varsayılan liste: aktif sezon + aktif/deneme/sakat (4), pasif/ayrıldı/geçmiş sezon yok",
      (await adlar()).join(",") === AKTIFLER.join(",") && (await sayac()) === "4 oyuncu",
      (await adlar()).join(","),
    );
    check("her satır 'Basılmadı'", (await rozet("Ali Aktif")) === "Basılmadı" && (await rozet("Deniz Sakat")) === "Basılmadı");

    // ── 2. Süzgeçler ──
    await secD("Kart durum", "");
    check(
      "Tüm durumlar → 6 (ayrıldı ve pasif dahil; geçmiş sezonun Ceren'i yok)",
      (await sayac()) === "6 oyuncu" && !(await adlar()).includes("Ceren Eski"),
      await sayac(),
    );
    await secD("Kart sezonu", "2025-2026");
    check(
      "geçmiş sezon: yalnız o sezonun üyesi (Ceren), 'Basılmadı'",
      (await adlar()).join(",") === "Ceren Eski" && (await rozet("Ceren Eski")) === "Basılmadı",
      (await adlar()).join(","),
    );
    await secD("Kart sezonu", "2026-2027");
    await secD("Kart durum", "aktifler");
    await secD("Kart yaş grubu", String(g12.id));
    check("yaş grubu U12 → Berk, Deniz", (await adlar()).join(",") === "Berk Yeni,Deniz Sakat", (await adlar()).join(","));
    await secD("Kart yaş grubu", "");
    await yazD("Kart ara", "ibr");
    check("arama Türkçe (ibr → İbrahim)", (await adlar()).join(",") === "İbrahim Deneme", (await adlar()).join(","));
    await yazD("Kart ara", "");
    await secD("Kart süzgeci", "basilmis");
    check("Kart: Basılmış → boş liste, boş durum metni", (await sayac()) === "0 oyuncu" && /Bu süzgeçte oyuncu yok/.test(await dMetin()));
    await secD("Kart süzgeci", "basilmamis");
    check("Kart: Basılmamış → 4", (await sayac()) === "4 oyuncu");

    // ── 3. Seçim ──
    await kutuD("Seç: Ali Aktif");
    check(
      "satır kutusu: 1 seçildi · 2 sayfa, Yazdır aktif",
      (await secildi()) === 1 && /2 sayfa \(ön \+ arka\)/.test(await dMetin()) && (await yazdirPasif()) === false,
    );
    await satirTikla("Berk Yeni");
    check("satıra tıklamak seçer (2); başlık kutusu kısmi", (await secildi()) === 2 && (await basKutu()) === "kismi");
    await satirTikla("Berk Yeni");
    check("satıra yeniden tıklamak seçimi kaldırır (1)", (await secildi()) === 1);
    await kutuD("Süzgeçtekilerin tümünü seç");
    check("başlık kutusu tümünü seçer (4), kutu 'hepsi'", (await secildi()) === 4 && (await basKutu()) === "hepsi");
    await kutuD("Süzgeçtekilerin tümünü seç");
    check("başlık kutusu yeniden: tümü kalkar (0), Yazdır pasif", (await secildi()) === 0 && (await yazdirPasif()) === true);
    await kutuD("Seç: Ali Aktif");
    await secD("Kart yaş grubu", String(g12.id));
    check(
      "süzgeç değişince seçim korunur: '1'i şu an listede değil'",
      (await secildi()) === 1 && /1'i şu an listede değil/.test(await dMetin()),
    );
    await kutuD("Süzgeçtekilerin tümünü seç");
    check("U12'de tümünü seç → 3 (Ali + Berk + Deniz)", (await secildi()) === 3);
    await tikla("Temizle", D);
    check("Temizle → 0, listede-değil notu yok", (await secildi()) === 0 && !/listede değil/.test(await dMetin()));
    await secD("Kart yaş grubu", "");

    // ── 4. Yazıcı yok: PDF de açılamazsa kayıt düşmez, seçim kalır; PDF açılırsa üretildi sayılır (kayıt düşer) ──
    yakalanan.sonuc = { ok: false, hata: "no printers" };
    await kutuD("Seç: Ali Aktif");
    await tikla("Yazdır", D);
    await bekle(1500);
    check(
      "yazıcı yok + PDF açılamadı: toast 'tanımlı yazıcı yok … PDF de açılamadı', kayıt yok, seçim korunur",
      /tanımlı yazıcı yok\. PDF de açılamadı: pdf kapalı \(test\)/.test(await govde()) && toplamKayit() === 0 && (await secildi()) === 1,
      (await govde()).slice(-300),
    );
    yakalanan.pdf = { ok: true };
    await tikla("Yazdır", D);
    await bekle(2000);
    check(
      "yazıcı yok + PDF açıldı: toplu HTML PDF'e gitti, kayıt düştü (1), toast 'PDF olarak açıldı', seçim temiz",
      /class="sayfa toplu"/.test(yakalanan.pdfHtml || "") &&
        toplamKayit() === 1 &&
        kayitlar(ali.id).length === 1 &&
        /PDF olarak açıldı/.test(await govde()) &&
        (await secildi()) === 0,
      `kayıt=${toplamKayit()}`,
    );
    db.hamBaglanti().prepare("DELETE FROM card_prints").run(); // sonraki sayımlar sıfırdan
    yakalanan.sonuc = { ok: true };
    yakalanan.pdf = { ok: false, error: "pdf kapalı (test)" };
    await secD("Kart süzgeci", "tumu");
    await secD("Kart süzgeci", "basilmamis");

    // ── 5. Başarılı toplu basım ──
    await kutuD("Süzgeçtekilerin tümünü seç");
    yakalanan.html = "";
    await tikla("Yazdır", D);
    await bekle(2500);
    const h = yakalanan.html;
    check(
      "toplu HTML: toplu düzen, 4 oyuncu, Ali'nin fotoğrafı (data URL), QR açık (GİRİŞ KODU + barkod), veli adı ve tam telefon",
      /class="sayfa toplu"/.test(h) &&
        AKTIFLER.every((a) => h.includes(a)) &&
        /data:image\/(png|jpeg)/.test(h) &&
        /GİRİŞ KODU/.test(h) &&
        /class="cubuk"/.test(h) &&
        h.includes("Anne Ali") &&
        h.includes("0532 111 22 33"),
      `uzunluk=${h.length}`,
    );
    const kAli = kayitlar(ali.id);
    check(
      "basım kaydı: 4 satır, tür toplu, kullanıcı oturumdan (Şerif Çelik), sezon ve kart no",
      toplamKayit() === 4 &&
        kAli.length === 1 &&
        kAli[0].tur === "toplu" &&
        kAli[0].kullanici === "Şerif Çelik" &&
        kAli[0].sezon === "2026-2027" &&
        kAli[0].kart_no === `2026 ${String(ali.id).padStart(4, "0")}`,
      JSON.stringify(kAli),
    );
    check(
      "basım sonrası: toast, pencere açık, seçim temiz, Basılmamış listesi boş",
      /4 kart, 2 sayfa \(ön \+ arka\) basıma gönderildi/.test(await govde()) &&
        (await dVar()) &&
        (await secildi()) === 0 &&
        (await sayac()) === "0 oyuncu" &&
        /basılmamış kartı olan oyuncu yok/.test(await dMetin()),
    );
    await secD("Kart süzgeci", "basilmis");
    const bugunTR = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    check(
      "Kart: Basılmış → 4, rozet bugünün tarihi",
      (await sayac()) === "4 oyuncu" && (await rozet("Ali Aktif")) === bugunTR,
      await rozet("Ali Aktif"),
    );
    await secD("Kart süzgeci", "tumu");
    check("Kart: Tümü → 4", (await sayac()) === "4 oyuncu");

    // ── 6. İkinci basım + sarı not ──
    await kutuD("Seç: Ali Aktif");
    check("daha önce basılmış seçilince sarı not", /1'i daha önce basılmış \(Ali A\.\)/.test(await dMetin()), await dMetin());
    await tikla("Yazdır", D);
    await bekle(2000);
    check(
      "ikinci basım: '2. basım · tarih' rozeti, 2 kayıt",
      (await rozet("Ali Aktif")) === `2. basım · ${bugunTR}` && kayitlar(ali.id).length === 2,
      await rozet("Ali Aktif"),
    );

    // ── 7. 200 sınırı ──
    for (let i = 1; i <= 201; i++) P({ ad_soyad: `Toplu ${String(i).padStart(3, "0")}`, yas_grubu_id: g9.id, durum: "aktif" });
    await secD("Kart yaş grubu", String(g9.id));
    check("U9: 201 oyuncu listelendi", (await sayac()) === "201 oyuncu", await sayac());
    await kutuD("Süzgeçtekilerin tümünü seç");
    const onceki = toplamKayit();
    await tikla("Yazdır", D);
    await bekle(1200);
    check(
      "201 seçili → sınır uyarısı, kayıt yok, seçim kalır",
      /en çok 200 kart/.test(await govde()) && toplamKayit() === onceki && (await secildi()) === 201,
    );
    await tikla("Temizle", D);
    await secD("Kart yaş grubu", "");

    // ── 8. Kapatma yolları ──
    await tikla("Vazgeç", D);
    check("Vazgeç kapatır", !(await dVar()));
    await pencereAc();
    check(
      "yeniden açılış: seçim 0, süzgeç Basılmamış",
      (await secildi()) === 0 && (await js(`(${D}).querySelector("select[aria-label='Kart süzgeci']").value`)) === "basilmamis",
    );
    await js(`(${D}).querySelector("button[aria-label='Pencereyi kapat']").click()`);
    await bekle(300);
    check("× kapatır", !(await dVar()));
    await pencereAc();
    await js(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
    await bekle(300);
    check("Escape kapatır", !(await dVar()));

    // ── 9. Oyuncu kartından tek basım + şerit + Basılmadı say ──
    await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Ali Aktif")).click()`);
    await bekle(900);
    const serit = () => js(`(${D}).querySelector("[data-testid=kart-basim-seridi]")?.textContent || ""`);
    check(
      "oyuncu kartı: şerit 2 toplu basımı gösterir",
      /Giriş kartı basımı:/.test(await serit()) && ((await serit()).match(/\(toplu, Şerif Çelik\)/g) || []).length === 2,
      await serit(),
    );
    yakalanan.html = "";
    await tikla("Giriş Kartı", D);
    await bekle(2000);
    const kAli3 = kayitlar(ali.id);
    check(
      "Giriş Kartı: tek düzen HTML (foto, QR), kayıt tür tek, şeritte '(tek, Şerif Çelik)'",
      /class="sayfa tek"/.test(yakalanan.html) &&
        /data:image\/png/.test(yakalanan.html) &&
        /GİRİŞ KODU/.test(yakalanan.html) &&
        kAli3.length === 3 &&
        kAli3[2].tur === "tek" &&
        /\(tek, Şerif Çelik\)/.test(await serit()),
      await serit(),
    );
    await tikla("Basılmadı say", D);
    await bekle(600);
    check(
      "Basılmadı say: son (tek) kayıt silindi, toplu kayıtlar durur",
      kayitlar(ali.id).length === 2 &&
        kayitlar(ali.id).every((k) => k.tur === "toplu") &&
        !/\(tek,/.test(await serit()) &&
        /Son basım kaydı silindi/.test(await govde()),
    );
    await js(`(${D}).querySelector("button[aria-label='Kapat']").click()`);
    await bekle(400);

    // ── 10. Kullanıcı rolü: basım serbest, silme 403 ──
    db.createUser({ username: "hoca", password: "hoca-parola-1", ad_soyad: "Hoca Bey", role: "kullanici", must_change_password: 0 });
    await cikis();
    await giris("hoca", "hoca-parola-1");
    await oyuncularAc();
    await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Berk Yeni")).click()`);
    await bekle(900);
    check("kullanıcı rolü: şeritte 'Basılmadı say' yok", /Giriş kartı basımı:/.test(await serit()) && !/Basılmadı say/.test(await serit()));
    const silHata = await js(`window.okul.db("kartBasimSil", ${kayitlar(berk.id)[0].id}).then(() => "ok").catch((e) => e.message)`);
    check(
      "kullanıcı rolü: kartBasimSil ana süreçte 403 (yönetici yetkisi)",
      /yönetici yetkisi/.test(silHata) && kayitlar(berk.id).length === 1,
      silHata,
    );
    await tikla("Giriş Kartı", D);
    await bekle(2000);
    check(
      "kullanıcı rolü basabilir; kayıt kullanıcı adı 'Hoca Bey'",
      kayitlar(berk.id).length === 2 && kayitlar(berk.id)[1].kullanici === "Hoca Bey" && kayitlar(berk.id)[1].tur === "tek",
      JSON.stringify(kayitlar(berk.id)),
    );
    await js(`(${D}).querySelector("button[aria-label='Kapat']").click()`);
    await bekle(300);
    await cikis();

    // ── 11. Salt okunur lisans: basım çalışır, kayıt yazılmaz ──
    // Lisans durumu iki yoldan gelir: lisans:durum (girişte) ve lisans:yenile (kalp atışı, girişte hemen); ikisi de yamalanır.
    const gercekDurum = db.lisansDurumu,
      gercekSalt = db.lisansSaltOkunurMu,
      gercekYenile = db.lisansYenile;
    const saltDurum = () => ({ ...gercekDurum(), mod: "saltOkunur", neden: "lisansBitti", kalanGun: 0 });
    db.lisansDurumu = saltDurum;
    db.lisansSaltOkunurMu = () => true;
    db.lisansYenile = async () => ({ ok: true, durum: saltDurum() });
    await bekle(1200);
    await giris("admin", "kart-parola-1");
    await bekle(800);
    check("salt okunur şeridi göründü", /salt okunur mod/.test(await govde()), JSON.stringify((await govde()).slice(0, 300)));
    await oyuncularAc();
    await pencereAc();
    check(
      "salt okunurda pencere açılır; Basılmamış listesi yalnız basılmamış U9'lar (201)",
      (await dVar()) && (await sayac()) === "201 oyuncu",
      await sayac(),
    );
    await secD("Kart süzgeci", "tumu");
    await kutuD("Seç: Deniz Sakat");
    const onceSalt = toplamKayit();
    yakalanan.html = "";
    await tikla("Yazdır", D);
    await bekle(2000);
    check(
      "salt okunur: HTML üretildi, kayıt YAZILMADI, toast 'basım kaydı tutulmadı'",
      /class="sayfa toplu"/.test(yakalanan.html) && toplamKayit() === onceSalt && /basım kaydı tutulmadı/.test(await govde()),
    );
    await tikla("Vazgeç", D);
    db.lisansDurumu = gercekDurum;
    db.lisansSaltOkunurMu = gercekSalt;
    db.lisansYenile = gercekYenile;

    // ── 12. Gerçek printToPDF sayfa sayıları (taşma düzeltmesi, 12.09.2026) ──
    {
      const { girisKartiHtml } = require("../../src/lib/kartHtml.js");
      const { htmlToPdf } = require("../../electron/ipc/cikti.cjs");
      const sayfa = (pdf) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      const oy = (n) =>
        Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          ad_soyad: "Oyuncu " + (i + 1),
          yas_grubu_ad: "U11",
          dogum_tarihi: "2015-01-01",
          veli_ad: "Veli",
          veli_tel: "05321112233",
        }));
      const sonuc = {};
      for (const n of [6, 7, 8, 13])
        sonuc[n] = sayfa(
          await htmlToPdf(girisKartiHtml({ oyuncular: oy(n), ayar: { kulupAdi: "Test", sezon: "2026-2027" }, duzen: "toplu" }), {
            yatay: true,
          }),
        );
      check(
        "toplu PDF sayfa sayıları: 6→2, 7→4, 8→4, 13→6 (üçüncü satır taşmıyor)",
        sonuc[6] === 2 && sonuc[7] === 4 && sonuc[8] === 4 && sonuc[13] === 6,
        JSON.stringify(sonuc),
      );
      const tek = await htmlToPdf(girisKartiHtml({ oyuncular: oy(1), ayar: { kulupAdi: "Test", sezon: "2026-2027" }, duzen: "tek" }), {
        yatay: true,
      });
      check("tek düzen PDF 1 sayfa", sayfa(tek) === 1, String(sayfa(tek)));
    }
    void ibrahim;
    void deniz;

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
