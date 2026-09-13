// 13.09.2026 işleri uçtan uca (gerçek main.cjs + gerçek DB + gerçek pencere): plan §41 (boş TC/pasaport → kişisel veri silme art arda,
// ayrılan borçlular Pano/WhatsApp/Raporlar, Tahsilat › Kesilen Makbuzlar tüm süzgeç/işlemler/sayfalama/roller), sürüm notu temizliği
// (Hakkında: HTML etiketi ve commit imzası görünmez), takvim noktaları (12 antrenman → ≤4 işaret + '+N', kutudan taşmaz), program
// eşitleme (saha silme Pano/Yoklama'ya yansır; elle değiştirilen ve geçmiş dokunulmaz). Kullanım: electron scripts/tests/plan41-e2e.cjs <dizin>
const { app, ipcMain } = require("electron");
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
const isoGun = (ek = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + ek);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

let ilk = true;
app.on("browser-window-created", async (_e, win) => {
  if (!ilk) return;
  ilk = false;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const D = `[...document.querySelectorAll("[role=dialog]")].pop()`;
    const dMetin = () => js(`(${D})?.textContent || ""`);
    const dVar = () => js(`!!(${D})`);
    const govde = () => js(`document.body.textContent`);
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(400);
    };
    const yaz = async (etiket, deger, kok = "document") => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = ${kok}.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!i) throw new Error("Girdi yok: " + ${JSON.stringify(etiket)}); set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(450);
    };
    const sec = async (etiket, deger, kok = "document") => {
      await js(
        `(() => { const s = ${kok}.querySelector("select[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]"); if (!s) throw new Error("Kutu yok: " + ${JSON.stringify(etiket)}); s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await bekle(450);
    };
    const kutu = async (etiket, kok = "document") => {
      await js(`${kok}.querySelector("input[aria-label=" + ${JSON.stringify(JSON.stringify(etiket))} + "]").click()`);
      await bekle(400);
    };
    const sekme = async (ad) => {
      await js(`document.querySelector("button[aria-label='${ad}']").click()`);
      await bekle(800);
    };
    const satirlar = (kok = "document") => js(`[...${kok}.querySelectorAll("table tbody tr")].map((tr) => tr.textContent)`);
    const giris = async (k, p) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, ${JSON.stringify(k)}); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(p)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(800);
    };
    const cikis = async () => {
      await js(`document.querySelector("button[aria-label='Çıkış']").click()`);
      await bekle(1500);
    };
    // Yazdırma yakalama (pencere açılmasın)
    const yakalanan = {};
    for (const kanal of ["cikti:yazdir", "cikti:pdfAc"]) {
      ipcMain.removeHandler(kanal);
      ipcMain.handle(kanal, async (_e, html) => {
        yakalanan[kanal] = String(html);
        return { ok: true };
      });
    }

    // ── Veri ──
    db.hamBaglanti().prepare("UPDATE users SET ad_soyad='Şerif Çelik' WHERE username='admin'").run();
    db.setSetting("aktif_sezon", "2026-2027");
    db.setSetting("kulup_adi", "Test Kulübü");
    const g11 = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    const aidatK = db.listFeeItems().find((k) => k.kod === "aidat");
    const P = (p) =>
      db.createPlayer({
        dogum_tarihi: "2015-01-01",
        odeme_donemi: "1-10",
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        yas_grubu_id: g11.id,
        ...p,
      });
    const { yil, ay } = { yil: new Date().getFullYear(), ay: new Date().getMonth() + 1 };
    const bugun = isoGun(0);
    const makbuz = (p, tutar, tarih = bugun) =>
      db.createReceipt({
        player_id: p.id,
        tarih,
        odeme_yontemi: "nakit",
        tahsil_eden: "Şerif",
        satirlar: [{ fee_item_id: aidatK.id, tutar, aciklama: "x", yil: null, ay: null }],
      });
    const ali = P({ ad_soyad: "Ali Aktif", tc_no: "11111111111" });
    const berk = P({ ad_soyad: "Berk Borçlu", tc_no: "22222222222" });
    const ceren = P({ ad_soyad: "Ceren Ayrılan", tc_no: "33333333333" });
    const yab1 = P({ ad_soyad: "Yab Bir", uyruk: "yabanci", pasaport_no: "" });
    const yab2 = P({ ad_soyad: "Yab İki", uyruk: "yabanci", pasaport_no: "" });
    db.addGuardian(ali.id, { tip: "anne", ad_soyad: "Anne Ali", gsm: "05321112233", veli_mi: 1 });
    db.addGuardian(berk.id, { tip: "anne", ad_soyad: "Anne Berk", gsm: "05321112244", veli_mi: 1 });
    db.addGuardian(ceren.id, { tip: "anne", ad_soyad: "Anne Ceren", gsm: "05321112255", veli_mi: 1 });
    db.ensureMonthlyDues(yil, ay); // bu ay herkese aidat
    // Vade geçmiş olsun: ödeme dönemi 1-10 ise ayın 11'inden sonra borçlu; e2e günü ne olursa olsun geçmiş bir ay da açalım
    const gecenAy = ay === 1 ? { yil: yil - 1, ay: 12 } : { yil, ay: ay - 1 };
    db.ensureMonthlyDues(gecenAy.yil, gecenAy.ay);
    db.updatePlayer(ceren.id, { durum: "ayrildi" }); // borcu açık kalır
    // Makbuzlar: Ali 2 (biri geçen ay), Berk 1; 60 küçük makbuz (sayfalama > 50) başka bir oyuncuda
    const m1 = makbuz(ali, 1000, isoGun(-3));
    const m2 = makbuz(ali, 250);
    const m3 = makbuz(berk, 500);
    const kalabalik = P({ ad_soyad: "Kalabalık Makbuz", tc_no: "44444444444" });
    for (let i = 0; i < 60; i++) makbuz(kalabalik, 10, isoGun(-40 + (i % 30)));
    // Antrenmanlar: bugüne 12 antrenman (takvim noktaları), U11 programından açılmış yarınki antrenman (saha eşitleme), geçmiş ve elle değiştirilen
    for (let i = 0; i < 12; i++)
      db.createTraining({ age_group_id: g11.id, tarih: bugun, saat: `${String(8 + i).padStart(2, "0")}:00`, saha: "Saha 1" });
    check("kurulum: 12 antrenman bugün", db.listTrainings(bugun, bugun).length === 12);

    // ── Giriş + kurulum atla ──
    await giris("admin", "admin");
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "plan41-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(800);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ══ A. Pano: ayrılan oyuncunun borcu sayılmaz; WhatsApp toplu pencerede yok ══
    await sekme("Pano");
    await bekle(600);
    const pano = await govde();
    const ozet = db.panoOzet({ yil, ay, bugun });
    check(
      "Pano borçlu sayısı ayrılanı saymaz (panoOzet.borclu = sahadaki borçlular)",
      ozet.borclu >= 1 && !/Ceren Ayrılan/.test(pano),
      `borclu=${ozet.borclu}`,
    );
    const borcluKart = `[...document.querySelectorAll("h3")].find((h) => /Aidatı Ödemeyenler/.test(h.textContent))?.closest("div")?.parentElement`;
    const borcluMetin = await js(`(${borcluKart})?.textContent || ""`);
    check(
      "Pano borçlu listesinde Berk var, Ceren (ayrıldı) yok",
      /Berk Borçlu/.test(borcluMetin) && !/Ceren/.test(borcluMetin),
      borcluMetin.slice(0, 200),
    );
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Borçlulara Hatırlat"))`)) {
      await tikla("Borçlulara Hatırlat");
      await bekle(600);
      const wa = await dMetin();
      check("WhatsApp toplu pencere: ayrılan yok", (await dVar()) && !/Ceren/.test(wa) && /Berk/.test(wa), wa.slice(0, 200));
      await tikla("Kapat", D);
    } else console.log("SKIP toplu WhatsApp düğmesi yok (tek borçlu)");

    // ══ B. Raporlar › Borçlu Listesi: küme kutusu ══
    await sekme("Raporlar");
    await tikla("Borçlu Listesi");
    check(
      "Borçlu Listesi kümesi varsayılan 'tumu'",
      (await js(`document.querySelector("select[aria-label='Borçlu oyuncu kümesi']").value`)) === "tumu",
    );
    await tikla("Önizle");
    await bekle(900);
    let rows = await satirlar();
    check(
      "rapor tümü: Berk ve Ceren (ayrıldı) listede",
      rows.some((r) => /Berk Borçlu/.test(r)) && rows.some((r) => /Ceren Ayrılan/.test(r)),
      JSON.stringify(rows).slice(0, 300),
    );
    await sec("Borçlu oyuncu kümesi", "sahada");
    await tikla("Önizle");
    await bekle(900);
    rows = await satirlar();
    check(
      "rapor sahadakiler: Ceren yok, Berk var; başlıkta 'Sahadaki oyuncular'",
      rows.some((r) => /Berk Borçlu/.test(r)) && !rows.some((r) => /Ceren/.test(r)) && /Sahadaki oyuncular/.test(await govde()),
    );
    await sec("Borçlu oyuncu kümesi", "ayrilan");
    await tikla("Önizle");
    await bekle(900);
    rows = await satirlar();
    check(
      "rapor ayrılanlar: yalnız Ceren; başlıkta 'Ayrılan / pasif oyuncular'",
      rows.some((r) => /Ceren Ayrılan/.test(r)) && !rows.some((r) => /Berk/.test(r)) && /Ayrılan \/ pasif oyuncular/.test(await govde()),
    );

    // ══ C. Tahsilat › Kesilen Makbuzlar ══
    await sekme("Tahsilat");
    check(
      "Tahsilat sekmeleri: Tahsilat | Kesilen Makbuzlar",
      /Kesilen Makbuzlar/.test(await govde()) && /Bugün Kesilen Makbuzlar/.test(await govde()),
    );
    await tikla("Kesilen Makbuzlar");
    await bekle(800);
    const sayac = () => js(`document.querySelector("[data-testid=makbuz-sayac]")?.textContent || ""`);
    check(
      "varsayılan: aktif sezon, geçerli makbuzlar, 63 makbuz, sayfada 50",
      (await sayac()).startsWith("63 makbuz") && (await satirlar()).length === 50,
      await sayac(),
    );
    check("sayfalama var (2 sayfa)", !!(await js(`document.querySelector("nav[aria-label='Sayfalama']")`)));
    await js(
      `[...document.querySelectorAll("nav[aria-label='Sayfalama'] button")].find((b) => /Sonraki|›|>/.test(b.textContent) || b.getAttribute("aria-label") === "Sonraki sayfa")?.click()`,
    );
    await bekle(600);
    check("2. sayfa: 13 makbuz", (await satirlar()).length === 13, String((await satirlar()).length));
    await yaz("Makbuz ara", "ali aktif");
    rows = await satirlar();
    check(
      "arama 'ali aktif': 2 makbuz, sayfa 1'e döner",
      rows.length === 2 && rows.every((r) => /Ali Aktif/.test(r)) && (await sayac()).startsWith("2 makbuz"),
      await sayac(),
    );
    await yaz("Makbuz ara", m3.makbuz_no);
    rows = await satirlar();
    check("makbuz no araması: Berk'in makbuzu", rows.length === 1 && /Berk Borçlu/.test(rows[0]), JSON.stringify(rows));
    await yaz("Makbuz ara", "");
    await yaz("Makbuz başlangıç", bugun);
    await yaz("Makbuz bitiş", bugun);
    rows = await satirlar();
    check(
      "tarih aralığı bugün: Ali (250) ve Berk (500) — geçen günkü Ali yok",
      rows.length === 2 && !rows.some((r) => /1\.000/.test(r)),
      JSON.stringify(rows),
    );
    await yaz("Makbuz başlangıç", "");
    await yaz("Makbuz bitiş", "");
    await sec("Makbuz sezonu", "");
    check("Tüm sezonlar: yine 63 (hepsi aktif sezonda)", (await sayac()).startsWith("63 makbuz"));
    await sec("Makbuz sezonu", "2026-2027");
    // İptal akışı: Berk'in makbuzu → neden → liste yenilenir, borç geri gelir, Bugün Kesilenler de yenilenir
    await yaz("Makbuz ara", "berk");
    const berkSatir = `[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Berk Borçlu"))`;
    await js(`[...(${berkSatir}).querySelectorAll("button")].find((b) => b.textContent.trim() === "İptal").click()`);
    await bekle(500);
    check("İptal penceresi açıldı (neden zorunlu)", (await dVar()) && /İptal/.test(await dMetin()));
    await tikla("İptal Et", D);
    check("nedensiz iptal gönderilmez", !!db.getReceipt(m3.id) && !db.getReceipt(m3.id).iptal && /İptal nedeni yazın/.test(await govde()));
    await yaz("İptal nedeni", "Yanlış tutar", D);
    await tikla("İptal Et", D);
    await bekle(900);
    const m3s = db.getReceipt(m3.id);
    rows = await satirlar();
    check(
      "iptal: kayıt iptal (neden, eden), liste geçerlilerde kaybolur, toast",
      m3s.iptal === 1 &&
        m3s.iptal_nedeni === "Yanlış tutar" &&
        m3s.iptal_eden === "Şerif Çelik" &&
        rows.length === 0 &&
        /Makbuz iptal edildi/.test(await govde()),
      JSON.stringify(rows),
    );
    await kutu("İptal edilenleri de göster");
    rows = await satirlar();
    check(
      "iptal edilenler dahil: Berk'in makbuzu 'İptal: Yanlış tutar' rozetiyle, İptal düğmesi yok",
      rows.length === 1 &&
        /İptal: Yanlış tutar/.test(rows[0]) &&
        !(await js(`!![...(${berkSatir}).querySelectorAll("button")].find((b) => b.textContent.trim() === "İptal")`)),
    );
    // Yazdır
    await js(`[...(${berkSatir}).querySelectorAll("button")].find((b) => b.textContent.trim() === "Yazdır").click()`);
    await bekle(1200);
    check(
      "Yazdır: makbuz HTML'i çıktıya gitti (makbuz no)",
      (yakalanan["cikti:yazdir"] || "").includes(m3.makbuz_no),
      (yakalanan["cikti:yazdir"] || "").slice(0, 80),
    );
    // Oyuncu bağlantısı
    await js(`(${berkSatir}).querySelector("button[title='Oyuncu kartını aç']").click()`);
    await bekle(1000);
    check(
      "oyuncu adı → oyuncu kartı (Oyuncular sekmesinde Berk'in kartı)",
      /Berk Borçlu/.test(await dMetin()) && /Ödemeler/.test(await dMetin()),
    );
    await js(`(${D}).querySelector("button[aria-label='Kapat']").click()`);
    await bekle(400);
    // Bugün Kesilenler'de iptal edilen görünmez (iptal listesi yenilendi mi?)
    await sekme("Tahsilat");
    check("Bugün Kesilen Makbuzlar: iptal edilen Berk yok, Ali var", !/Berk Borçlu/.test(await govde()) && /Ali Aktif/.test(await govde()));

    // ══ D. Kişisel veri silme art arda (boş TC/pasaport) ══
    await sekme("Oyuncular");
    const kvkkSil = async (ad) => {
      await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(ad)})).click()`);
      await bekle(900);
      await tikla("Sil", D);
      await bekle(400);
      await tikla("Evet", D);
      await bekle(1200);
    };
    await kvkkSil("Ali Aktif"); // makbuzlu → kişisel veri silme
    check(
      "1. kişisel veri silme: ad anonim, TC NULL, borç yok, makbuzlar damgalı",
      db.getPlayer(ali.id).ad_soyad === `Silinmiş Oyuncu #${ali.id}` &&
        db.getPlayer(ali.id).tc_no === null &&
        db.listDues(ali.id).length === 0 &&
        db.getReceipt(m1.id).ad_soyad === "Ali Aktif" &&
        /kişisel verileri silindi/.test(await govde()),
    );
    await kvkkSil("Berk Borçlu");
    check(
      "2. kişisel veri silme de çalışır (eskiden 'Bu kayıt zaten var')",
      db.getPlayer(berk.id).ad_soyad === `Silinmiş Oyuncu #${berk.id}` &&
        !/zaten var/.test(await govde()) &&
        db.listDues(berk.id).length === 0,
    );
    check(
      "pasaportsuz iki yabancı kaydı çakışmadı (NULL)",
      db.getPlayer(yab1.id).pasaport_no === null && db.getPlayer(yab2.id).pasaport_no === null,
    );
    await sekme("Pano");
    await bekle(600);
    {
      const oz2 = db.panoOzet({ yil, ay, bugun });
      const kalanBorclular = db.listUnpaid(yil, ay, null, null, { bugun, yalnizVadesiGecen: true }).map((u) => u.ad_soyad);
      check(
        "Pano: silinen oyuncuların borcu gitti (Ali/Berk borçlu değil), borçlu sayısı kalan sahadakilerle tutarlı",
        !kalanBorclular.some((a) => /Ali Aktif|Berk Borçlu|Silinmiş/.test(a)) &&
          oz2.borclu === kalanBorclular.length &&
          !/Berk Borçlu/.test(await govde()),
        JSON.stringify({ borclu: oz2.borclu, kalanBorclular }),
      );
    }
    // Kesilen Makbuzlar'da silinen oyuncunun makbuzu damgalı adla
    await sekme("Tahsilat");
    await tikla("Kesilen Makbuzlar");
    await bekle(700);
    await yaz("Makbuz ara", "ali aktif");
    rows = await satirlar();
    check(
      "silinmiş oyuncunun makbuzları damgalı adla listelenir ve aranır",
      rows.length === 2 && rows.every((r) => /Ali Aktif/.test(r)),
      JSON.stringify(rows).slice(0, 200),
    );
    void m2;

    // ══ E. Yoklama takvimi: 12 antrenman → ≤4 işaret + '+N', kutudan taşmaz ══
    await sekme("Yoklama");
    await bekle(800);
    const hucre = `document.querySelector('button[data-iso="${bugun}"]')`;
    const noktaBilgi = await js(
      `(() => { const h = ${hucre}; const n = h.querySelectorAll("[data-nokta]").length; const f = h.querySelector("[data-nokta-fazla]")?.textContent || ""; const kap = h.querySelector("[data-nokta]")?.parentElement; const kr = kap?.getBoundingClientRect(), hr = h.getBoundingClientRect(); return { n, f, sigar: kr ? kr.right <= hr.right + 0.5 && kr.left >= hr.left - 0.5 : false, title: kap?.title || "" }; })()`,
    );
    check(
      "takvim: 12 antrenman → 1 gri nokta + '+11', ipucu '12 antrenman', işaretler kutunun içinde",
      noktaBilgi.n === 1 && noktaBilgi.f === "+11" && noktaBilgi.sigar && noktaBilgi.title === "12 antrenman",
      JSON.stringify(noktaBilgi),
    );

    // ══ F. Program eşitleme: grupta saha silme → gelecek antrenman, Pano/Yoklama ══
    db.updateAgeGroup(g11.id, {
      program: [
        { gun: 1, saat: "17:00", saha: "Saha 1" },
        { gun: 3, saat: "17:00", saha: "Saha 1" },
      ],
    });
    // Yarın ve öbür gün için programdan açılmış gibi antrenmanlar (gün adı ne olursa olsun program gününü tarihten türet)
    const { haftaGunu } = require("../../src/lib/takvim.js");
    const yarin = isoGun(1);
    const yarinGun = haftaGunu(yarin) + 1;
    db.updateAgeGroup(g11.id, { program: [{ gun: yarinGun, saat: "17:00", saha: "Saha 1" }] });
    const tYarin = db.createTraining({ age_group_id: g11.id, tarih: yarin, saat: "17:00", saha: "Saha 1" });
    const tElle = db.createTraining({ age_group_id: g11.id, tarih: isoGun(8), saat: "17:00", saha: "Elle Saha" }); // aynı gün adı, elle farklı saha
    const tGecmis = db.createTraining({ age_group_id: g11.id, tarih: isoGun(-6), saat: "17:00", saha: "Saha 1" });
    await sekme("Yaş Grupları");
    await js(
      `(() => { const tr = [...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("U11")); [...tr.querySelectorAll("button")].find((b) => b.textContent.trim() === "Düzenle").click(); })()`,
    );
    await bekle(600);
    const gunAd = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"][yarinGun - 1];
    check(
      "düzenleme: yarının günü programda 'Saha 1'",
      (await js(`document.querySelector("input[aria-label='${gunAd} sahası']")?.value`)) === "Saha 1",
    );
    await yaz(`${gunAd} sahası`, "");
    await tikla("Kaydet");
    await bekle(900);
    const y1 = db.listTrainings(yarin, yarin).find((t) => t.id === tYarin.id);
    check(
      "saha silindi: yarınki antrenman boş sahaya eşitlendi (toast '1 antrenman'), elle değiştirilen ve geçmiş dokunulmadı",
      y1.saha === "" &&
        y1.bildirim_gerekli === 1 &&
        db.listTrainings(isoGun(8), isoGun(8)).find((t) => t.id === tElle.id).saha === "Elle Saha" &&
        db.listTrainings(isoGun(-6), isoGun(-6)).find((t) => t.id === tGecmis.id).saha === "Saha 1" &&
        /1 antrenman yeni programa göre güncellendi/.test(await govde()),
      JSON.stringify({ y1: y1.saha, toast: (await govde()).slice(-200) }),
    );
    await sekme("Yoklama");
    if (!(await js(`!!document.querySelector('button[data-iso="${yarin}"]')`))) {
      await js(`document.querySelector("button[aria-label='Sonraki hafta']").click()`); // yarın sonraki haftaya düşüyorsa (Pazar)
      await bekle(500);
    }
    await js(`document.querySelector('button[data-iso="${yarin}"]').click()`);
    await bekle(700);
    check("Yoklama: yarınki antrenman 'Saha belirtilmedi'", /Saha belirtilmedi/.test(await govde()) && !/Saha 1/.test(await govde()));

    // ══ G. Hakkında: sürüm notu HTML'i etiketsiz, imza yok ══
    ipcMain.removeHandler("updater:check");
    ipcMain.handle("updater:check", async () => ({
      current: "1.0.0",
      latest: "9.9.9",
      available: true,
      notlar:
        '<h2>Yenilik</h2>\n<ul>\n<li><strong>Kart:</strong> giriş &amp; kod</li>\n</ul>\n<p>Co-Authored-By: Claude X &lt;noreply@anthropic.com&gt;<br />Claude-Session: <a href="https://claude.ai/code/s">https://claude.ai/code/s</a></p>',
    }));
    await sekme("Ayarlar");
    await tikla("Hakkında");
    await bekle(500);
    await tikla("Güncelleme Denetle");
    await bekle(900);
    const notMetin = await js(`document.querySelector("pre")?.textContent || ""`);
    check(
      "Hakkında sürüm notu: etiket yok, imza/oturum yok, madde ve varlık çözülmüş",
      notMetin === "Yenilik\n• Kart: giriş & kod" && !/Claude|anthropic|<[a-z]/i.test(await govde()),
      JSON.stringify(notMetin),
    );

    // ══ H. Kullanıcı rolü: Kesilen Makbuzlar'da iptal edebilir; salt okunurda iptal yok ══
    db.createUser({ username: "hoca", password: "hoca-parola-1", ad_soyad: "Hoca Bey", role: "kullanici", must_change_password: 0 });
    await cikis();
    await giris("hoca", "hoca-parola-1");
    await sekme("Tahsilat");
    await tikla("Kesilen Makbuzlar");
    await bekle(700);
    await yaz("Makbuz ara", "ali aktif");
    check(
      "kullanıcı rolü: liste görünür, İptal düğmesi var (yazma yetkisi)",
      (await satirlar()).length === 2 &&
        (await js(`!![...document.querySelectorAll("table tbody tr button")].find((b) => b.textContent.trim() === "İptal")`)),
    );
    await cikis();
    const gercekDurum = db.lisansDurumu,
      gercekSalt = db.lisansSaltOkunurMu,
      gercekYenile = db.lisansYenile;
    const saltDurum = () => ({ ...gercekDurum(), mod: "saltOkunur", neden: "lisansBitti", kalanGun: 0 });
    db.lisansDurumu = saltDurum;
    db.lisansSaltOkunurMu = () => true;
    db.lisansYenile = async () => ({ ok: true, durum: saltDurum() });
    await giris("admin", "plan41-parola-1");
    await sekme("Tahsilat");
    check(
      "salt okunur: Tahsilat sekmesi 'makbuz kesilemez', Kesilen Makbuzlar açılır",
      /makbuz kesilemez/.test(await govde()) && /Kesilen Makbuzlar/.test(await govde()),
    );
    await tikla("Kesilen Makbuzlar");
    await bekle(700);
    await yaz("Makbuz ara", "ali aktif");
    check(
      "salt okunur: liste var, Yazdır var, İptal yok",
      (await satirlar()).length === 2 &&
        (await js(`!![...document.querySelectorAll("table tbody tr button")].find((b) => b.textContent.trim() === "Yazdır")`)) &&
        !(await js(`!![...document.querySelectorAll("table tbody tr button")].find((b) => b.textContent.trim() === "İptal")`)),
    );
    db.lisansDurumu = gercekDurum;
    db.lisansSaltOkunurMu = gercekSalt;
    db.lisansYenile = gercekYenile;
    void fs;

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
