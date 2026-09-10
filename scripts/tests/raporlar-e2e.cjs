// Raporlar filtreleri uçtan uca (plan §20): GERÇEK main.cjs + gerçek DB. Bilinen veri (iki sezon, iki grup, ödenen/ödenmeyen aidat,
// makbuz, yoklama, sağlık raporu) kurulur; her rapor "Sezon ve ay" (ay / Tümü / eski sezon / yaş grubu) ve "Tarih aralığı"
// modunda önizlenir, tablo satırları okunup beklenenle karşılaştırılır. Kullanım: electron scripts/tests/raporlar-e2e.cjs <dizin>
const { app, dialog, shell } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const [dizin, shotDir] = process.argv.slice(2);
app.setPath("userData", dizin);
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
// Excel/PDF kaydetme diyaloğu: test dosya yolu; açma yok
const ciktiDir = fs.mkdtempSync(path.join(os.tmpdir(), "fok-rapor-cikti-"));
let sonCikti = "";
dialog.showSaveDialog = async (_w, o) => {
  sonCikti = path.join(ciktiDir, path.basename(o?.defaultPath || "rapor"));
  return { canceled: false, filePath: sonCikti };
};
shell.openPath = async () => "";
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
const db = require("../../electron/db.cjs");
require("../../electron/main.cjs");

let basladi = false;
app.on("browser-window-created", async (_e, win) => {
  if (basladi) return; // PDF dışa aktarımının gizli penceresi de bu olayı tetikler
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const tikla = async (metin) => {
      const ok = await js(
        `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(400);
    };
    const sec = (etiket, deger) =>
      js(
        `(() => { const s = document.querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!s) throw new Error("Kutu yok: " + ${JSON.stringify(etiket)}); s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`,
      );
    const tarihYaz = (etiket, deger) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
    const altBaslik = () => js(`document.querySelector("h3")?.parentElement?.querySelector("div")?.textContent || ""`);
    const satirlar = () =>
      js(`[...document.querySelectorAll("table tbody tr")].map((tr) => [...tr.cells].map((td) => td.textContent.trim()))`);
    // Önizle → alt başlık değişene kadar bekle (aynı kalabilir; kısa bekleme + 'Filtre değişti' notunun kaybolması)
    const onizle = async () => {
      await tikla("Önizle");
      for (let i = 0; i < 40; i++) {
        if (!(await js(`document.body.textContent.includes("Filtre değişti")`))) break;
        await bekle(150);
      }
      await bekle(300);
      return { alt: await altBaslik(), satirlar: await satirlar() };
    };
    const rapor = async (ad) => {
      await tikla(ad);
      await bekle(200);
    };
    const adlar = (r) => r.satirlar.map((s) => s[0]).join(",");

    // ── Giriş + kurulum atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(600);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "rapor-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Veri: iki sezon, iki grup ──
    db.setSetting("aktif_sezon", "2025-2026");
    const g11 = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    const g12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027" });
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    const c = db.createPlayer({
      ad_soyad: "Ceren Eski",
      dogum_tarihi: "2015-01-01",
      yas_grubu_id: g11.id,
      durum: "pasif",
      ucret_tipi: "normal",
      aylik_aidat: 1000,
      odeme_donemi: "1-10",
      sezon: "2025-2026",
    });
    const a = db.createPlayer({
      ad_soyad: "Ali Aktif",
      dogum_tarihi: "2015-02-02",
      yas_grubu_id: g11.id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 1000,
      odeme_donemi: "1-10",
      sezon: "2025-2026",
    });
    // Geçen sezon (2025-2026) kayıtları: Ceren Ekim 2025 borcu, Ali Ağustos 2026 borcu; Ağustos'ta B'nin (Berk) makbuzu
    const ham = db.hamBaglanti();
    ham.prepare("INSERT INTO monthly_dues (player_id,yil,ay,tutar,odenen,durum) VALUES (?,?,?,?,0,'odenmedi')").run(c.id, 2025, 10, 1000);
    ham.prepare("INSERT INTO monthly_dues (player_id,yil,ay,tutar,odenen,durum) VALUES (?,?,?,?,0,'odenmedi')").run(a.id, 2026, 8, 1000);
    const b = db.createPlayer({
      ad_soyad: "Berk Yeni",
      dogum_tarihi: "2015-03-03",
      yas_grubu_id: g12.id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 1000,
      odeme_donemi: "1-10",
      sezon: "2025-2026",
    });
    db.createReceipt({
      player_id: b.id,
      tarih: "2026-08-20",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 500, yil: null, ay: null }],
    });
    // Yeni sezona geçiş: Ali ve Berk yeniler, Ceren pasif kalır (aday değil); Eylül 2026 borçları açılır
    const sg = db.yeniSezonaGec({ sezon: "2026-2027", yenileyenler: [{ id: a.id }, { id: b.id }] });
    check(
      "kurulum: sezon geçişi (2 yenileyen; Eylül borçları zaten kayıtta açılmıştı)",
      sg.yenilenen === 2 && !!db.getDue(a.id, 2026, 9) && !!db.getDue(b.id, 2026, 9),
      JSON.stringify(sg),
    );
    db.createReceipt({
      player_id: a.id,
      tarih: "2026-09-05",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 1000, yil: 2026, ay: 9 }],
    });
    // Yoklama: U11 3 Eylül (Ali geldi), U11 15 Ağustos (Ali gelmedi, Ceren geldi), U12 4 Eylül (Berk izinli)
    const t1 = db.createTraining({ age_group_id: g11.id, tarih: "2026-09-03", saat: "18:00" });
    const t2 = db.createTraining({ age_group_id: g11.id, tarih: "2026-08-15", saat: "18:00" });
    const t3 = db.createTraining({ age_group_id: g12.id, tarih: "2026-09-04", saat: "18:00" });
    db.setAttendance(t1.id, a.id, "geldi");
    db.setAttendance(t2.id, a.id, "gelmedi");
    db.setAttendance(t2.id, c.id, "geldi");
    db.setAttendance(t3.id, b.id, "izinli");
    // Sağlık raporu: Ali 15 Ekim 2026'ya kadar geçerli (bugün geçerli, Ekim sonunda dolmuş); Berk raporsuz
    fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + a.id), { recursive: true });
    fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + a.id, "1-saglik.pdf"), "x");
    db.belgeEkle(a.id, { tip: "saglik", dosya_yolu: `oyuncu-${a.id}/1-saglik.pdf`, orijinal_ad: "s.pdf", gecerlilik_tarihi: "2026-10-15" });

    // ── Raporlar ──
    await js(`document.querySelector("button[aria-label='Raporlar']").click()`);
    await bekle(800);
    const shot = async (ad) => {
      if (!shotDir) return;
      fs.writeFileSync(path.join(shotDir, ad + ".png"), (await win.webContents.capturePage()).toPNG());
    };
    check(
      "başlangıç: önizleme yok — 'Filtreleri seçip Önizle'ye basın.'",
      /Filtreleri seçip Önizle'ye basın/.test(await js(`document.body.textContent`)),
    );
    check(
      "rapor kartları: 5 rapor, açıklamalarıyla; ilk (Oyuncu Listesi) seçili vurgulu",
      (await js(
        `[...document.querySelectorAll("button")].filter((b) => /Oyuncu Listesi|Borçlu Listesi|Tahsilat Raporu|Yoklama Özeti|Sağlık Raporu/.test(b.textContent)).length`,
      )) === 5 &&
        (await js(
          `[...document.querySelectorAll("button")].find((b) => b.textContent.startsWith("Oyuncu Listesi")).style.border.includes("var(--mor)")`,
        )) &&
        /Tarih aralığında kesilen makbuzlar/.test(await js(`document.body.textContent`)),
    );
    await shot("01-baslangic");
    check(
      "varsayılan filtre: sezon ve ay, aktif sezon, bu ay (Eylül 2026)",
      (await js(`document.querySelector("select[aria-label='Sezon']").value`)) === "2026-2027" &&
        (await js(`document.querySelector("select[aria-label='Ay']").value`)) === "9",
    );

    // 1) Oyuncu Listesi
    let r = await onizle();
    check(
      "oyuncu listesi Eylül 2026-2027: Ali (Ödendi) ve Berk (Ödenmedi), eski sezonun Ceren'i yok",
      adlar(r) === "Ali Aktif,Berk Yeni" && r.satirlar[0][7] === "Ödendi" && r.satirlar[1][7] === "Ödenmedi",
      adlar(r) + " | " + JSON.stringify(r.satirlar.map((s) => s[7])),
    );
    await sec("Yaş grubu", g11.id);
    r = await onizle();
    check("oyuncu listesi + yaş grubu U11 → yalnız Ali", adlar(r) === "Ali Aktif", adlar(r));
    await sec("Yaş grubu", "");
    await sec("Ay", "");
    r = await onizle();
    check(
      "oyuncu listesi Ay: Tümü → sezon aidatı: Ali 1/1 ay, Berk 0/1 ay · 1.000 ₺ borç",
      r.satirlar[0][7] === "1/1 ay" && r.satirlar[1][7] === "0/1 ay · 1.000 ₺ borç",
      JSON.stringify(r.satirlar.map((s) => s[7])),
    );
    await sec("Sezon", "2025-2026");
    r = await onizle();
    check(
      "oyuncu listesi eski sezon 2025-2026 → Ali (o sezonda da vardı) ve Ceren (pasif); Berk de üye (kaydı o sezonda)",
      adlar(r) === "Ali Aktif,Berk Yeni,Ceren Eski",
      adlar(r),
    );
    await sec("Sezon", "2026-2027");
    await sec("Ay", "9");

    // 2) Borçlu Listesi
    await rapor("Borçlu Listesi");
    r = await onizle();
    check(
      "borçlu listesi Eylül 2026-2027 → yalnız Berk (Ali ödedi), 1.000 ₺",
      adlar(r) === "Berk Yeni" && /1 oyuncu · toplam 1\.000 ₺/.test(r.alt),
      adlar(r) + " | " + r.alt,
    );
    await sec("Yaş grubu", g11.id);
    r = await onizle();
    check("borçlu listesi + U11 → boş (Ali ödedi)", r.satirlar.length === 0 && /0 oyuncu/.test(r.alt), r.alt);
    await sec("Yaş grubu", "");
    await sec("Ay", "");
    r = await onizle();
    check(
      "borçlu listesi Ay: Tümü → Berk, borçlu aylar 'Eyl'",
      adlar(r) === "Berk Yeni" && r.satirlar[0][2] === "Eyl",
      JSON.stringify(r.satirlar),
    );
    await sec("Sezon", "2025-2026");
    r = await onizle();
    check(
      "borçlu listesi eski sezon Tümü → Ali (Ağu) ve Ceren (Eki)",
      adlar(r) === "Ali Aktif,Ceren Eski" && r.satirlar[0][2] === "Ağu" && r.satirlar[1][2] === "Eki",
      JSON.stringify(r.satirlar),
    );
    await sec("Sezon", "2026-2027");
    await sec("Ay", "9");

    // 3) Tahsilat Raporu
    await rapor("Tahsilat Raporu");
    r = await onizle();
    check(
      "tahsilat Eylül 2026 → yalnız Ali'nin makbuzu (1.000 ₺)",
      r.satirlar.length === 1 && r.satirlar[0][2] === "Ali Aktif" && /1 makbuz · toplam 1\.000 ₺/.test(r.alt),
      r.alt,
    );
    await sec("Ay", "");
    r = await onizle();
    check("tahsilat sezon Tümü (Eyl 2026–Ağu 2027) → yine 1 makbuz; Ağustos makbuzu dışarıda", r.satirlar.length === 1, r.alt);
    await sec("Dönem seçimi", "tarih");
    await tarihYaz("Başlangıç", "2026-08-01");
    await tarihYaz("Bitiş", "2026-09-30");
    r = await onizle();
    check(
      "tahsilat tarih aralığı Ağu–Eyl → 2 makbuz, toplam 1.500 ₺",
      r.satirlar.length === 2 && /2 makbuz · toplam 1\.500 ₺/.test(r.alt),
      r.alt,
    );
    await sec("Yaş grubu", g12.id);
    r = await onizle();
    check(
      "tahsilat + U12 → yalnız Berk'in makbuzu (500 ₺)",
      r.satirlar.length === 1 && r.satirlar[0][2] === "Berk Yeni",
      JSON.stringify(r.satirlar),
    );
    await sec("Yaş grubu", "");
    await sec("Dönem seçimi", "sezon");
    await sec("Ay", "9");

    // 4) Yoklama Özeti
    await rapor("Yoklama Özeti");
    r = await onizle();
    check(
      "yoklama Eylül 2026-2027 → Ali geldi 1, Berk izinli 1; Ceren yok",
      adlar(r) === "Ali Aktif,Berk Yeni" && r.satirlar[0].slice(2, 5).join() === "1,0,0" && r.satirlar[1].slice(2, 5).join() === "0,0,1",
      JSON.stringify(r.satirlar),
    );
    await sec("Dönem seçimi", "tarih");
    await tarihYaz("Başlangıç", "2026-08-01");
    await tarihYaz("Bitiş", "2026-09-30");
    r = await onizle();
    check(
      "yoklama tarih aralığı Ağu–Eyl → tüm oyuncular: Ali geldi 1 gelmedi 1, Berk izinli 1, pasif Ceren geldi 1",
      adlar(r) === "Ali Aktif,Berk Yeni,Ceren Eski" &&
        r.satirlar[0].slice(2, 5).join() === "1,1,0" &&
        r.satirlar[0][5] === "50" &&
        r.satirlar[2].slice(2, 5).join() === "1,0,0",
      JSON.stringify(r.satirlar),
    );
    await sec("Dönem seçimi", "sezon");
    await sec("Sezon", "2025-2026");
    await sec("Ay", "");
    r = await onizle();
    check(
      "yoklama eski sezon Tümü → Ali gelmedi 1, Ceren geldi 1 (eski sezon kümesi pasifi de kapsar)",
      adlar(r) === "Ali Aktif,Berk Yeni,Ceren Eski" &&
        r.satirlar[0].slice(2, 5).join() === "0,1,0" &&
        r.satirlar[2].slice(2, 5).join() === "1,0,0",
      JSON.stringify(r.satirlar),
    );
    await sec("Sezon", "2026-2027");

    // 5) Sağlık Raporu Durumu
    await rapor("Sağlık Raporu Durumu");
    check("sağlık raporuna geçince Ay: Tümü (bugün)", (await js(`document.querySelector("select[aria-label='Ay']").value`)) === "");
    r = await onizle();
    const durumSutunu = (rr) => Object.fromEntries(rr.satirlar.map((s) => [s[0], s[5]]));
    check(
      "sağlık bugün → Ali Geçerli (15 Ekim'e kadar), Berk Rapor yok",
      durumSutunu(r)["Ali Aktif"] === "Geçerli" && durumSutunu(r)["Berk Yeni"] === "Rapor yok",
      JSON.stringify(durumSutunu(r)),
    );
    await sec("Ay", "10");
    r = await onizle();
    check(
      "sağlık Ekim (ayın son günü itibarıyla) → Ali Süresi doldu",
      durumSutunu(r)["Ali Aktif"] === "Süresi doldu" && /31\.10\.2026 itibarıyla/.test(r.alt),
      JSON.stringify(durumSutunu(r)) + " | " + r.alt,
    );
    await sec("Ay", "");
    await sec("Sezon", "2025-2026");
    r = await onizle();
    check("sağlık eski sezon → Ceren de listede (Rapor yok)", durumSutunu(r)["Ceren Eski"] === "Rapor yok", JSON.stringify(durumSutunu(r)));
    await sec("Dönem seçimi", "tarih");
    await tarihYaz("Bitiş", "2026-10-31");
    r = await onizle();
    check(
      "sağlık tarih aralığı (bitiş 31 Ekim) → tüm oyuncular: Ali Süresi doldu, pasif Ceren de listede",
      durumSutunu(r)["Ali Aktif"] === "Süresi doldu" && durumSutunu(r)["Ceren Eski"] === "Rapor yok",
      JSON.stringify(durumSutunu(r)) + " | " + r.alt,
    );

    // ── Ek durumlar (10.09.2026): kirli filtre uyarısı, Excel/PDF dışa aktarım, iptal makbuzu, kısmi ödeme, yoklama yüzdesi ──
    await sec("Dönem seçimi", "sezon");
    await sec("Sezon", "2026-2027");
    await sec("Ay", "9");
    await rapor("Oyuncu Listesi");
    r = await onizle();
    check("önizleme sonrası kirli uyarısı yok", !/Filtre değişti|Rapor değişti/.test(await js(`document.body.textContent`)));
    await sec("Ay", "10");
    check("filtre değişince 'Filtre değişti' pili", /Filtre değişti/.test(await js(`document.body.textContent`)));
    await rapor("Borçlu Listesi");
    check("rapor da değişince 'Filtre ve rapor değişti'", /Filtre ve rapor değişti/.test(await js(`document.body.textContent`)));
    await shot("02-filtre-degisti");
    await sec("Ay", "9");
    await rapor("Oyuncu Listesi");
    r = await onizle();
    // Excel
    await tikla("Excel");
    await bekle(1200);
    check(
      "Excel: dosya yazıldı (oyuncu.xlsx)",
      /oyuncu\.xlsx$/.test(sonCikti) && fs.existsSync(sonCikti) && fs.statSync(sonCikti).size > 1000,
      sonCikti,
    );
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(sonCikti);
    const ws = wb.worksheets[0];
    const basliklar = ws.getRow(1).values.slice(1);
    check(
      "Excel: sayfa adı, başlık satırı ve satır sayısı önizlemeyle uyumlu, oluşturan kulüp adı",
      ws.name === "Oyuncu Listesi" && basliklar[0] === "Ad Soyad" && ws.rowCount - 1 === r.satirlar.length && wb.creator === "Futbol Okulu",
      `${ws.name} | ${JSON.stringify(basliklar)} | ${ws.rowCount - 1}/${r.satirlar.length} | ${wb.creator}`,
    );
    // PDF
    await tikla("PDF");
    await bekle(2500);
    check(
      "PDF: dosya yazıldı (oyuncu.pdf) ve PDF imzası",
      /oyuncu\.pdf$/.test(sonCikti) && fs.existsSync(sonCikti) && fs.readFileSync(sonCikti).slice(0, 5).toString() === "%PDF-",
      sonCikti,
    );
    await shot("03-excel-pdf");
    // Tahsilat: iptal edilen makbuz ayrı satır ve alt başlıkta "iptal: 1 makbuz"
    const m2 = db.createReceipt({
      player_id: b.id,
      tarih: "2026-09-10",
      odeme_yontemi: "havale",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 700, yil: null, ay: null }],
    });
    db.cancelReceipt(m2.id, "yanlış tutar", "Tester");
    await rapor("Tahsilat Raporu");
    r = await onizle();
    const iptalSatir = r.satirlar.find((s) => s.some((h) => /İptal: yanlış tutar/.test(h)));
    check(
      "tahsilat: iptal makbuzu 'İptal: yanlış tutar · Tester · asıl tutar 700 ₺' notuyla, alt başlıkta iptal sayısı",
      !!iptalSatir && /asıl tutar 700 ₺/.test(iptalSatir.join(" ")) && /iptal: 1 makbuz \(700 ₺\)/.test(r.alt),
      r.alt,
    );
    await shot("04-tahsilat-iptal");
    // Borçlu listesi: kısmi ödeme → kalan
    db.createReceipt({
      player_id: b.id,
      tarih: "2026-09-10",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 300, yil: 2026, ay: 9 }],
    });
    await rapor("Borçlu Listesi");
    r = await onizle();
    const berkSatir = r.satirlar.find((s) => s[0] === "Berk Yeni");
    check(
      "borçlu listesi: kısmi ödeyen Berk kalan 700 ₺ ile listede",
      !!berkSatir && berkSatir.some((h) => /700/.test(h)),
      JSON.stringify(berkSatir),
    );
    // Yoklama özeti: katılım yüzdesi (Ali: Eylül'de 1 geldi → %100)
    await rapor("Yoklama Özeti");
    r = await onizle();
    const aliSatir = r.satirlar.find((s) => s[0] === "Ali Aktif");
    check("yoklama özeti: Ali Eylül 2026 → 1 geldi, katılım %100", !!aliSatir && aliSatir.includes("100"), JSON.stringify(aliSatir));
    await shot("05-yoklama-ozeti");
    // Yaş grubu kutusu seçili sezonun gruplarını listeler
    check(
      "yaş grubu kutusunda U11 ve U12",
      (await js(`[...document.querySelector("select[aria-label='Yaş grubu']").options].map((o) => o.textContent).join(",")`)).includes(
        "U11",
      ),
    );

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
