// Sayfalama ve sınırlı listeler uçtan uca (plan §22): GERÇEK main.cjs + gerçek DB. 121 oyuncu → Oyuncular 50/sayfa (sonraki/önceki,
// filtre değişince ilk sayfa, dışa aktarım DB'de tam liste), Raporlar önizleme 100/sayfa (Oyuncu Listesi ve Borçlular; yeni Önizle ilk
// sayfaya döner), oyuncu kartı son 12 dönem / 12 makbuz / 40 yoklama + "Tümünü göster", Excel aktarım önizlemesi 100/sayfa (150 satır,
// aktarım tam liste), Tahsilat "Bugün Kesilen Makbuzlar" (30 makbuz, kaydırma kabı + yapışık başlık), Yeni Sezon sihirbazı sayacı ve
// kaydırma kabı, WhatsApp toplu pencere "n alıcı" sayacı.
// Kullanım: electron scripts/tests/sayfalama-e2e.cjs <dizin>
const { app, dialog } = require("electron");
const path = require("path");
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

// Excel aktarım diyaloğu: 150 satırlık dosya (aşağıda üretilir)
const excelYol = path.join(dizin, "aktarim-150.xlsx");
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [excelYol] });

const P3 = (n) => String(n).padStart(3, "0");
const bugunIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(300);
    };
    const tiklaEtiket = async (etiket, kok = "document") => {
      const ok = await js(
        `(() => { const b = ${kok}.querySelector("button[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok/kapalı: " + etiket);
      await bekle(300);
    };
    const sec = (etiket, deger) =>
      js(
        `(() => { const s = document.querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!s) throw new Error("Kutu yok: " + ${JSON.stringify(etiket)}); s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`,
      );
    const yaz = (etiket, deger) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
    const satirSayisi = (kok = "document") => js(`${kok}.querySelectorAll("table tbody tr").length`);
    const ilkHucre = (kok = "document") => js(`${kok}.querySelector("table tbody tr td")?.textContent.trim() || ""`);
    const ilkSatir = (kok = "document") => js(`${kok}.querySelector("table tbody tr")?.textContent.trim() || ""`);
    const navMetin = (kok = "document") => js(`${kok}.querySelector("nav[aria-label='Sayfalama']")?.textContent || ""`);
    const sonrakiKapali = (kok = "document") =>
      js(`(() => { const b = ${kok}.querySelector("button[aria-label='Sonraki sayfa']"); return b ? b.disabled : null; })()`);
    const metinVar = (m) => js(`document.body.textContent.includes(${JSON.stringify(m)})`);
    // Koşul sağlanana kadar (en çok 6 sn) bekle
    const bekleKosul = async (fn) => {
      for (let i = 0; i < 30; i++) {
        if (await fn().catch(() => false)) return true;
        await bekle(200);
      }
      return false;
    };
    const DLG = `document.querySelector("[role=dialog]")`;

    // ── Giriş + kurulum atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(600);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "sayfa-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Veri ──
    const sezon = db.getSetting("aktif_sezon");
    const g11 = db.createAgeGroup({ ad: "U11", sezon });
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    const P = (p) =>
      db.createPlayer({
        dogum_tarihi: "2015-01-01",
        odeme_donemi: "1-10",
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        yas_grubu_id: g11.id,
        durum: "aktif",
        ...p,
      });
    const kart = P({ ad_soyad: "Aaa Kart Oyuncu" }); // sıralamada ilk
    const oyuncular = [];
    for (let i = 1; i <= 120; i++) oyuncular.push(P({ ad_soyad: `Sayfa Oyuncu ${P3(i)}` }));
    // Kart oyuncusu: 15 geçmiş dönem (2025-01..2025-12, 2026-01..03) → her biri makbuzla ödendi (15 makbuz); 45 yoklama
    const donemler = [];
    for (let ay = 1; ay <= 12; ay++) donemler.push([2025, ay]);
    for (let ay = 1; ay <= 3; ay++) donemler.push([2026, ay]);
    for (const [yil, ay] of donemler) {
      db.hamBaglanti()
        .prepare("INSERT INTO monthly_dues (player_id,yil,ay,tutar,odenen,durum) VALUES (?,?,?,?,0,'odenmedi')")
        .run(kart.id, yil, ay, 1000);
      db.createReceipt({
        player_id: kart.id,
        tarih: `${yil}-${String(ay).padStart(2, "0")}-05`,
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 1000, yil, ay }],
      });
    }
    let sonYoklamaTr = "";
    for (let i = 0; i < 45; i++) {
      const d = new Date(2026, 0, 5 + i * 3);
      const tarih = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      sonYoklamaTr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
      const t = db.createTraining({ age_group_id: g11.id, tarih, saat: "18:00" });
      db.setAttendance(t.id, kart.id, i % 5 === 0 ? "gelmedi" : "geldi");
    }
    const kartAidat = db.listDues(kart.id).length,
      kartMakbuz = db.listReceipts(kart.id).length,
      kartYoklama = db.playerAttendance(kart.id, "1900-01-01", "2999-12-31").length;
    check(
      "kurulum: kart oyuncusunda 16 dönem, 15 makbuz, 45 yoklama",
      kartAidat === 16 && kartMakbuz === 15 && kartYoklama === 45,
      `${kartAidat}/${kartMakbuz}/${kartYoklama}`,
    );
    // Bugün 30 makbuz (Sayfa Oyuncu 001..030 bu ayın aidatını ödedi)
    const { yil: bYil, ay: bAy } = { yil: Number(bugunIso().slice(0, 4)), ay: Number(bugunIso().slice(5, 7)) };
    for (let i = 0; i < 30; i++)
      db.createReceipt({
        player_id: oyuncular[i].id,
        tarih: bugunIso(),
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 1000, yil: bYil, ay: bAy }],
      });
    check("kurulum: bugün 30 makbuz", db.listReceiptsByDate(bugunIso(), bugunIso(), sezon).length === 30);
    // 150 satırlık Excel
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Oyuncular");
    ws.addRow(["Ad Soyad", "Doğum Tarihi", "Yaş Grubu", "Durum", "Aylık Aidat"]);
    for (let i = 1; i <= 150; i++) ws.addRow([`Excel Oyuncu ${P3(i)}`, "01.01.2015", "U11", "aktif", 1000]);
    await wb.xlsx.writeFile(excelYol);

    // ── Oyuncular: 50/sayfa ──
    await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
    await bekleKosul(async () => (await satirSayisi()) === 50);
    check(
      "Oyuncular: ilk sayfa 50 satır, ilk satır 'Aaa Kart Oyuncu', sayaç 121",
      (await satirSayisi()) === 50 && (await ilkHucre()).includes("Aaa Kart Oyuncu") && (await metinVar("121 oyuncu")),
      `${await satirSayisi()} / ${await ilkHucre()}`,
    );
    check(
      "Oyuncular: sayfalama çubuğu '1–50 / 121 oyuncu' ve 'Sayfa 1 / 3'",
      (await navMetin()).includes("1–50 / 121 oyuncu") && (await navMetin()).includes("Sayfa 1 / 3"),
      await navMetin(),
    );
    await tiklaEtiket("Sonraki sayfa");
    await bekleKosul(async () => (await navMetin()).includes("51–100"));
    check(
      "Oyuncular: 2. sayfa 50 satır, ilk satır 'Sayfa Oyuncu 050'",
      (await satirSayisi()) === 50 && (await ilkHucre()).includes("Sayfa Oyuncu 050"),
      `${await satirSayisi()} / ${await ilkHucre()}`,
    );
    await tiklaEtiket("Sonraki sayfa");
    await bekleKosul(async () => (await navMetin()).includes("101–121"));
    check(
      "Oyuncular: 3. sayfa 21 satır, Sonraki kapalı",
      (await satirSayisi()) === 21 && (await sonrakiKapali()) === true,
      `${await satirSayisi()} / ${await sonrakiKapali()}`,
    );
    await tiklaEtiket("Önceki sayfa");
    await bekleKosul(async () => (await navMetin()).includes("51–100"));
    check("Oyuncular: Önceki → 2. sayfa", (await navMetin()).includes("51–100 / 121"), await navMetin());
    await yaz("Ara", "Sayfa Oyuncu 1");
    await bekleKosul(async () => (await metinVar("21 oyuncu")) && (await satirSayisi()) === 21);
    check(
      "Oyuncular: arama filtresi → ilk sayfaya döner, 21 sonuç tek sayfa (çubuk yok)",
      (await satirSayisi()) === 21 && (await navMetin()) === "" && (await ilkHucre()).includes("Sayfa Oyuncu 100"),
      `${await satirSayisi()} / ${await navMetin()}`,
    );
    await yaz("Ara", "");
    await bekleKosul(async () => (await navMetin()).includes("1–50 / 121"));
    check("Oyuncular: arama temizlenince 1. sayfa, 121", (await navMetin()).includes("1–50 / 121 oyuncu"), await navMetin());
    check(
      "Oyuncular: DB'de dışa aktarım listesi tam (121)",
      db.listPlayersWithDue({ yil: bYil, ay: bAy, durum: "aktifler" }).length === 121,
    );

    // ── Oyuncu kartı: son 12 / 12 / 40 + Tümünü göster ──
    await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Aaa Kart Oyuncu")).click()`);
    await bekleKosul(() => js(`!!${DLG}`));
    await tikla("Ödemeler", DLG);
    await bekleKosul(() => metinVar("Son 12 dönem gösteriliyor"));
    const tabloSatir = (i) => js(`${DLG}.querySelectorAll("table")[${i}]?.querySelectorAll("tbody tr").length`);
    check(
      "Kart > Ödemeler: 12 dönem + 12 makbuz, iki 'Tümünü göster'",
      (await tabloSatir(0)) === 12 && (await tabloSatir(1)) === 12 && (await metinVar("Son 12 makbuz gösteriliyor")),
      `${await tabloSatir(0)} / ${await tabloSatir(1)}`,
    );
    await js(`[...${DLG}.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Tümünü göster")[0].click()`);
    await bekleKosul(async () => (await tabloSatir(0)) === 16);
    check(
      "Kart > aidat 'Tümünü göster' → 16 dönem, makbuz hâlâ 12",
      (await tabloSatir(0)) === 16 && (await tabloSatir(1)) === 12 && !(await metinVar("Son 12 dönem gösteriliyor")),
      `${await tabloSatir(0)} / ${await tabloSatir(1)}`,
    );
    await js(`[...${DLG}.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Tümünü göster")[0].click()`);
    await bekleKosul(async () => (await tabloSatir(1)) === 15);
    check(
      "Kart > makbuz 'Tümünü göster' → 15 makbuz",
      (await tabloSatir(1)) === 15 && !(await metinVar("Son 12 makbuz gösteriliyor")),
      `${await tabloSatir(1)}`,
    );
    await tikla("Yoklama", DLG);
    await bekleKosul(() => metinVar("Son 40 yoklama gösteriliyor"));
    check(
      "Kart > Yoklama: son 40 kayıt, en yeni önce",
      (await tabloSatir(0)) === 40 && (await js(`${DLG}.querySelector("table tbody tr td").textContent.trim()`)) === sonYoklamaTr,
      `${await tabloSatir(0)} / ${await js(`${DLG}.querySelector("table tbody tr td")?.textContent`)}`,
    );
    await js(`[...${DLG}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Tümünü göster").click()`);
    await bekleKosul(async () => (await tabloSatir(0)) === 45);
    check(
      "Kart > yoklama 'Tümünü göster' → 45 kayıt, en yeni önce",
      (await tabloSatir(0)) === 45 &&
        (await js(`${DLG}.querySelector("table tbody tr td").textContent.trim()`)) === sonYoklamaTr &&
        !(await metinVar("Son 40 yoklama gösteriliyor")),
      `${await tabloSatir(0)}`,
    );
    await tiklaEtiket("Kapat", DLG);
    await bekleKosul(() => js(`!${DLG}`));

    // ── Excel aktarım önizlemesi: 100/sayfa ──
    await tikla("İçe Aktar");
    await bekleKosul(() => js(`!!${DLG}`));
    await tikla("Excel Dosyası Seç", DLG);
    await bekleKosul(() => metinVar("150 aktarılacak"));
    check(
      "Aktarım önizleme: 150 aktarılacak, 100 satır, '1–100 / 150 satır'",
      (await satirSayisi(DLG)) === 100 &&
        (await navMetin(DLG)).includes("1–100 / 150 satır") &&
        (await ilkSatir(DLG)).includes("Excel Oyuncu 001"),
      `${await satirSayisi(DLG)} / ${await navMetin(DLG)}`,
    );
    await tiklaEtiket("Sonraki sayfa", DLG);
    await bekleKosul(async () => (await satirSayisi(DLG)) === 50);
    check(
      "Aktarım önizleme: 2. sayfa 50 satır (101..150), Sonraki kapalı",
      (await satirSayisi(DLG)) === 50 && (await ilkSatir(DLG)).includes("Excel Oyuncu 101") && (await sonrakiKapali(DLG)) === true,
      `${await satirSayisi(DLG)} / ${await ilkSatir(DLG)}`,
    );
    await tikla("150 Oyuncuyu Aktar", DLG);
    await bekleKosul(() => js(`document.body.textContent.includes("150") && document.body.textContent.includes("aktarıldı")`));
    check(
      "Aktarım: 2. sayfadayken de tüm 150 kayıt DB'ye yazıldı (toplam 271)",
      db.listPlayers().length === 271,
      String(db.listPlayers().length),
    );
    await tiklaEtiket("Kapat", DLG).catch(() => tikla("Kapat", DLG));
    await bekleKosul(() => js(`!${DLG}`));
    await bekleKosul(() => metinVar("271 oyuncu"));
    check(
      "Oyuncular: aktarımdan sonra liste yenilendi, 'Sayfa 1 / 6'",
      (await navMetin()).includes("1–50 / 271 oyuncu") && (await navMetin()).includes("Sayfa 1 / 6"),
      await navMetin(),
    );

    // ── Raporlar: önizleme 100/sayfa ──
    await js(`document.querySelector("button[aria-label='Raporlar']").click()`);
    await bekle(600);
    await tikla("Önizle");
    await bekleKosul(async () => (await satirSayisi()) === 100);
    check(
      "Raporlar > Oyuncu Listesi: 100 satır, '1–100 / 271 satır', 'Sayfa 1 / 3'",
      (await navMetin()).includes("1–100 / 271 satır") && (await navMetin()).includes("Sayfa 1 / 3"),
      await navMetin(),
    );
    await tiklaEtiket("Sonraki sayfa");
    await tiklaEtiket("Sonraki sayfa");
    check(
      "Raporlar: 3. sayfa 71 satır, Sonraki kapalı",
      (await satirSayisi()) === 71 && (await sonrakiKapali()) === true,
      `${await satirSayisi()}`,
    );
    await sec("Durum", "aktif").catch(() => null); // rapor filtresinde durum kutusu yoksa geç
    await tikla("Önizle");
    await bekleKosul(async () => (await navMetin()).includes("Sayfa 1 /"));
    check("Raporlar: yeni Önizle → ilk sayfaya döner", (await navMetin()).includes("1–100 /"), await navMetin());
    await tikla("Borçlu Listesi");
    await tikla("Önizle");
    await bekleKosul(async () => (await navMetin()).includes("/ 241 satır"));
    check(
      "Raporlar > Borçlular: 241 borçlu (271 - bugün ödeyen 30), 100/sayfa",
      (await satirSayisi()) === 100 && (await navMetin()).includes("1–100 / 241 satır"),
      `${await satirSayisi()} / ${await navMetin()}`,
    );
    await tiklaEtiket("Sonraki sayfa");
    await tiklaEtiket("Sonraki sayfa");
    check("Raporlar > Borçlular: 3. sayfa 41 satır", (await satirSayisi()) === 41, `${await satirSayisi()}`);

    // ── Tahsilat: Bugün Kesilen Makbuzlar (30) kaydırma kabı ──
    await js(`document.querySelector("button[aria-label='Tahsilat']").click()`);
    await bekleKosul(() => metinVar("Bugün Kesilen Makbuzlar"));
    const bugunTablo = `[...document.querySelectorAll("h3")].find((h) => h.textContent.includes("Bugün Kesilen Makbuzlar"))?.parentElement?.parentElement`;
    await bekleKosul(() => js(`${bugunTablo}.querySelectorAll("table tbody tr").length === 30`));
    const kap = await js(
      `(() => { const t = ${bugunTablo}?.querySelector("table"); if (!t) return { hata: "tablo yok", h3: [...document.querySelectorAll("h3")].map((h) => h.textContent) }; const kap = t.parentElement; const th = t.querySelector("thead"); return { satir: t.querySelectorAll("tbody tr").length, maxH: getComputedStyle(kap).maxHeight, overflow: getComputedStyle(kap).overflowY, sticky: getComputedStyle(th).position, kapH: kap.clientHeight, icerikH: kap.scrollHeight }; })()`,
    );
    check(
      "Tahsilat: 30 makbuz, kap 460px kaydırmalı, başlık yapışık, içerik kaptan uzun",
      kap.satir === 30 && kap.maxH === "460px" && kap.overflow === "auto" && kap.sticky === "sticky" && kap.icerikH > kap.kapH,
      JSON.stringify(kap),
    );

    // ── Ayarlar > Yeni Sezon: sayaç + kaydırma kabı ──
    await js(`document.querySelector("button[aria-label='Ayarlar']").click()`);
    await bekle(500);
    await tikla("Yeni Sezon");
    await bekleKosul(() => metinVar("271 oyuncu"));
    const sz = await js(
      `(() => { const t = [...document.querySelectorAll("table")].find((x) => x.textContent.includes("YENİLEDİ") || x.textContent.includes("Yeniledi")); if (!t) return null; const kap = t.parentElement; return { satir: t.querySelectorAll("tbody tr").length, overflow: getComputedStyle(kap).overflowY, sticky: getComputedStyle(t.querySelector("thead")).position, kapH: kap.clientHeight, icerikH: kap.scrollHeight }; })()`,
    );
    check(
      "Yeni Sezon: '271 oyuncu' sayacı, 271 aday satırı, kaydırmalı kap + yapışık başlık",
      sz && sz.satir === 271 && sz.overflow === "auto" && sz.sticky === "sticky" && sz.icerikH > sz.kapH,
      JSON.stringify(sz),
    );
    await yaz("Oyuncu ara", "Excel Oyuncu 14");
    await bekleKosul(() => metinVar("10 / 271 oyuncu gösteriliyor"));
    check("Yeni Sezon: arama → '10 / 271 oyuncu gösteriliyor'", await metinVar("10 / 271 oyuncu gösteriliyor"));

    // ── Pano > Borçlulara Hatırlat: 'n alıcı' sayacı + kaydırma kabı ──
    await js(`document.querySelector("button[aria-label='Pano']").click()`);
    await bekleKosul(() =>
      js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Borçlulara Hatırlat"))`),
    );
    await tikla("Borçlulara Hatırlat");
    await bekleKosul(() => js(`!!${DLG} && ${DLG}.textContent.includes("alıcı")`));
    const wa = await js(
      `(() => { const d = ${DLG}; const t = d.querySelector("table"); const kap = t.parentElement; return { sayac: (d.textContent.match(/(\\d+) alıcı( · \\d+ numarasız\\/onaysız)?/) || [])[0], satir: t.querySelectorAll("tbody tr").length, overflow: getComputedStyle(kap).overflowY, kapH: kap.clientHeight, icerikH: kap.scrollHeight }; })()`,
    );
    check(
      "WhatsApp toplu pencere: '241 alıcı · 241 numarasız/onaysız', 241 satır, kaydırmalı kap",
      wa.sayac === "241 alıcı · 241 numarasız/onaysız" && wa.satir === 241 && wa.overflow === "auto" && wa.icerikH > wa.kapH,
      JSON.stringify(wa),
    );

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
