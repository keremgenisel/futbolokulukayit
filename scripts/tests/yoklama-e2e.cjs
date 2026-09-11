// Yoklama ekranı — tüm durumlar, GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/yoklama-e2e.cjs <userDataDizini> [ekranGoruntusuDizini]
// Durumlar: takvim şeridi (bugün seçili, nokta renkleri, hafta okları, Bugün, Tarihe git), antrenman yok / Antrenman Ekle formu,
// kart (grup · saat, saha, x/y işaretli, seçili), oyuncu listesi (pasif oyuncu yok, "Aidat" rozeti, "n aidat borcu"), Geldi/
// Gelmedi/İzinli işaretleme + yeniden tıklayınca kaldırma, sayaçlar, "Kalanları Geldi İşaretle", Düzenle (saat/saha; yoklama
// alınmışsa tarih kilitli) + bildirim sorusu + "Velilere Bildir" penceresi, "Değişiklik yok", Haftayı Programdan Doldur (ekleme,
// tekrar → atlanan, programsız grup), İptal Et (onay, rozet, düğmeler kapalı, kırmızı nokta). Plan §37: bitiş saati (ekle/düzenle
// doğrulama, kart/başlık aralığı + süre, değişiklik notu eski bitiş, bildirim penceresi aralığı, programdan doldurmada bitiş),
// saha çakışma uyarısı, sezon dışı gün (soluk hücre, rozet, yine de ekleme, doldurma notu). Çıktıda "TUM KONTROLLER GECTI" aranır.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const [dizin, shotDir] = process.argv.slice(2);
app.setPath("userData", dizin);
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
const db = require("../../electron/db.cjs");
require("../../electron/main.cjs");
let basladi = false;
const isoGun = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const gunKaydir = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoGun(d);
};

app.on("browser-window-created", async (_e, win) => {
  if (basladi) return;
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const shot = async (ad) => {
      if (!shotDir) return;
      fs.writeFileSync(path.join(shotDir, ad + ".png"), (await win.webContents.capturePage()).toPNG());
    };
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const l = [...${kok}.querySelectorAll("button")]; const b = l.find(x => x.textContent.trim() === ${JSON.stringify(metin)}) || l.find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok/kapalı: " + metin);
      await bekle(450);
    };
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
      );
    const sec = (sel, deger) =>
      js(
        `(() => { const s = document.querySelector(${JSON.stringify(sel)}); if (!s) return false; s.value = ${JSON.stringify(String(deger))}; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`,
      );
    const govde = () => js(`document.body.innerText`);
    const gun = (iso) =>
      js(
        `(() => { const b = document.querySelector("button[data-iso='${iso}']"); return b ? { etiket: b.getAttribute("aria-label"), secili: b.getAttribute("aria-pressed"), noktalar: [...b.querySelectorAll("[data-nokta]")].map((n) => n.dataset.nokta) } : null; })()`,
      );
    const kartlar = () =>
      js(
        `[...document.querySelectorAll("button[aria-pressed]")].filter((b) => /işaretli/.test(b.textContent)).map((b) => ({ metin: b.textContent.replace(/\\s+/g, " ").trim(), secili: b.getAttribute("aria-pressed") }))`,
      );
    const sayac = async () => {
      const t = await govde();
      const m = t.match(/Toplam\s*(\d+)\s*Geldi\s*(\d+)\s*Gelmedi\s*(\d+)\s*İzinli\s*(\d+)\s*İşaretlenmedi\s*(\d+)/);
      return m ? { toplam: +m[1], geldi: +m[2], gelmedi: +m[3], izinli: +m[4], yok: +m[5] } : null;
    };
    const oyuncuDugme = async (ad, etiket) => {
      const ok = await js(
        `(() => { const satir = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes(${JSON.stringify(ad)}) && [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Geldi")).sort((a, b) => a.textContent.length - b.textContent.length)[0]; const b = satir && [...satir.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(etiket)}); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error(`Oyuncu düğmesi yok/kapalı: ${ad} / ${etiket}`);
      await bekle(450);
    };
    const oyuncuDurum = (ad) =>
      js(
        `(() => { const satir = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes(${JSON.stringify(ad)}) && [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Geldi")).sort((a, b) => a.textContent.length - b.textContent.length)[0]; if (!satir) return null; const on = [...satir.querySelectorAll("button")].find((b) => b.getAttribute("aria-pressed") === "true"); return { secili: on ? on.textContent.trim() : null, aidat: /Aidat/.test(satir.textContent), kapali: [...satir.querySelectorAll("button")].every((b) => b.disabled) }; })()`,
      );

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(500);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "yoklama-test-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Tohum ──
    const bugun = new Date();
    const bugunIso = isoGun(bugun);
    const y = bugun.getFullYear(),
      m = bugun.getMonth() + 1;
    const sezon = m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    db.setSetting("aktif_sezon", sezon);
    // plan §37.6: sezon 1 Eyl'de başlar, bugünden 30 gün sonra biter → "+40 gün" günü sezon dışı; bu hafta sezon içi
    const sezonBitis = isoGun(new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() + 30));
    db.sezonTarihKaydet(sezon, `${sezon.slice(0, 4)}-09-01`, sezonBitis);
    // Program günleri: bugünün haftasında bugün OLMAYAN iki gün (Pzt=1 … Paz=7)
    const bugunGun = ((bugun.getDay() + 6) % 7) + 1;
    const pg1 = (bugunGun % 7) + 1,
      pg2 = ((bugunGun + 1) % 7) + 1;
    const u11 = db.createAgeGroup({ ad: "U11", sezon, sira: 1 });
    db.updateAgeGroup(u11.id, {
      program: [
        { gun: pg1, saat: "18:00", bitis: "19:30", saha: "Saha 1" }, // plan §37: bitiş programdan doldurmaya taşınır
        { gun: pg2, saat: "18:00", saha: "Saha 1" }, // bitişsiz: kart yalnız başlangıcı gösterir
      ],
    });
    const u12 = db.createAgeGroup({ ad: "U12", sezon, sira: 2 });
    const P = (ad, grup, durum, ek = {}) =>
      db.createPlayer({
        ad_soyad: ad,
        dogum_tarihi: "2015-01-01",
        yas_grubu_id: grup,
        durum,
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        odeme_donemi: "1-10",
        ...ek,
      });
    const ali = P("Ali Odedi", u11.id, "aktif");
    const berk = P("Berk Borclu", u11.id, "aktif");
    P("Can Pasif", u11.id, "pasif");
    const deniz = P("Deniz Deneme", u11.id, "deneme");
    P("Ece U12", u12.id, "aktif");
    db.ensureMonthlyDues(y, m);
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    db.createReceipt({
      player_id: ali.id,
      tarih: bugunIso,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 1000, yil: y, ay: m }],
    });
    db.addGuardian(ali.id, {
      tip: "anne",
      ad_soyad: "Ayşe Veli",
      gsm: "05321112233",
      whatsapp_no: "05321112233",
      veli_mi: 1,
      mesaj_onayi: 1,
    });
    db.addGuardian(berk.id, { tip: "baba", ad_soyad: "Bora Veli", gsm: "05331112233", whatsapp_no: "", veli_mi: 1, mesaj_onayi: 1 });
    void deniz;

    await js(`document.querySelector("button[aria-label='Yoklama']").click()`);
    await bekle(900);

    // 1) Şerit ve boş gün
    const g0 = await gun(bugunIso);
    check(
      "şeritte bugün seçili ve '(bugün)' etiketli, nokta yok",
      g0 && g0.secili === "true" && /\(bugün\)/.test(g0.etiket) && g0.noktalar.length === 0,
      JSON.stringify(g0),
    );
    check(
      "başlık: bugün, 'antrenman yok' ve boş gün metni",
      /antrenman yok/.test(await govde()) && /Bu tarihte antrenman yok/.test(await govde()),
    );
    check("'Tarihe git' kutusu bugünü gösterir", (await js(`document.querySelector("input[aria-label='Tarihe git']").value`)) === bugunIso);
    check("yoklama paneli: 'Yoklama almak için yukarıdan bir antrenman seçin.'", /Yoklama almak için/.test(await govde()));
    await shot("01-bos-gun");

    // 2) Antrenman Ekle formu
    await tikla("Antrenman Ekle");
    check(
      "form açıldı: yaş grubu kutusu, saat, saha",
      (await js(`!!document.querySelector("select[aria-label='Yaş grubu']")`)) &&
        (await js(`!!document.querySelector("input[aria-label='Saha']")`)),
    );
    await tikla("Ekle").catch(() => {});
    check("grup seçmeden Ekle → uyarı", /Yaş grubu seçin/.test(await govde()));
    await sec("select[aria-label='Yaş grubu']", u11.id);
    await setInput("input[aria-label='Saat']", "17:00");
    await setInput("input[aria-label='Bitiş']", "16:00"); // plan §37: bitiş başlangıçtan önce → Ekle reddedilir
    await setInput("input[aria-label='Saha']", "Saha 1");
    await tikla("Ekle");
    check(
      "bitiş başlangıçtan önce → 'Bitiş başlangıçtan sonra olmalı', antrenman eklenmez",
      /Bitiş başlangıçtan sonra olmalı/.test(await govde()) && (await kartlar()).length === 0,
    );
    await setInput("input[aria-label='Bitiş']", "18:30");
    await shot("02-antrenman-ekle-formu");
    await tikla("Ekle");
    await bekle(700);
    let k = await kartlar();
    check(
      "kart: 'U11 · 17:00–18:30 · 90 dk', Saha 1, 0/3 işaretli (pasif oyuncu sayılmaz) ve seçili",
      k.length === 1 &&
        /U11 · 17:00–18:30/.test(k[0].metin) &&
        /90 dk/.test(k[0].metin) &&
        /Saha 1/.test(k[0].metin) &&
        /0\/3 işaretli/.test(k[0].metin) &&
        k[0].secili === "true",
      JSON.stringify(k),
    );
    check(
      "şeritte bugün: 1 antrenman, gri nokta (yoklama alınmadı)",
      JSON.stringify((await gun(bugunIso)).noktalar) === '["gri"]' && /1 antrenman/.test((await gun(bugunIso)).etiket),
    );
    let s = await sayac();
    check("sayaçlar: Toplam 3, hepsi işaretlenmedi", s && s.toplam === 3 && s.yok === 3 && s.geldi === 0, JSON.stringify(s));
    check(
      "liste: pasif Can yok; Berk ve Deniz'de (deneme de aidat öder) 'Aidat' rozeti, Ali'de yok; '2 aidat borcu'",
      !/Can Pasif/.test(await govde()) &&
        (await oyuncuDurum("Berk Borclu")).aidat &&
        !(await oyuncuDurum("Ali Odedi")).aidat &&
        (await oyuncuDurum("Deniz Deneme")).aidat &&
        /2 aidat borcu/.test(await govde()),
    );
    await shot("03-antrenman-secili");
    // Saha çakışması uyarısı (plan §37): aynı gün, aynı sahada 17:30 → U11 17:00–18:30 ile çakışır; eklemeden vazgeçilir
    await tikla("Antrenman Ekle");
    await sec("select[aria-label='Yaş grubu']", u12.id);
    await setInput("input[aria-label='Saat']", "17:30");
    await setInput("input[aria-label='Saha']", "saha 1"); // büyük/küçük harf duyarsız
    const cakismaMetni = () =>
      js(`[...document.querySelectorAll("[role=alert]")].map((x) => x.textContent).find((t) => /çakışıyor/.test(t)) || ""`);
    const cakisma = await cakismaMetni();
    check(
      "saha çakışması uyarısı: Saha 1'de 17:00–18:30 U11 antrenmanı var; 17:30 ile çakışıyor",
      /Saha 1'de 17:00–18:30 U11 antrenmanı var; 17:30 ile çakışıyor/.test(cakisma),
      cakisma,
    );
    await setInput("input[aria-label='Saat']", "18:30"); // uçtan uca değen kesişmez
    check("18:30'da başlayan çakışmaz (uyarı kalkar)", (await cakismaMetni()) === "");
    await shot("03b-saha-cakisma");
    await tikla("Vazgeç");
    check("vazgeçince kart sayısı değişmez", (await kartlar()).length === 1);

    // 3) İşaretleme
    await oyuncuDugme("Ali Odedi", "Geldi");
    s = await sayac();
    check(
      "Ali Geldi: sayaç Geldi 1, kart 1/3, nokta mor (kısmen)",
      s.geldi === 1 && /1\/3 işaretli/.test((await kartlar())[0].metin) && JSON.stringify((await gun(bugunIso)).noktalar) === '["mor"]',
      JSON.stringify(s),
    );
    await oyuncuDugme("Ali Odedi", "Geldi");
    s = await sayac();
    check(
      "Ali Geldi'ye yeniden tıklama: işaret kalkar (İşaretlenmedi 3, 0/3, gri nokta)",
      s.geldi === 0 &&
        s.yok === 3 &&
        /0\/3/.test((await kartlar())[0].metin) &&
        JSON.stringify((await gun(bugunIso)).noktalar) === '["gri"]',
      JSON.stringify(s),
    );
    await oyuncuDugme("Ali Odedi", "Geldi");
    await oyuncuDugme("Berk Borclu", "Gelmedi");
    await oyuncuDugme("Deniz Deneme", "İzinli");
    s = await sayac();
    check(
      "üçü işaretli: Geldi 1 / Gelmedi 1 / İzinli 1, kart 3/3, yeşil nokta (tamamlandı)",
      s.geldi === 1 &&
        s.gelmedi === 1 &&
        s.izinli === 1 &&
        s.yok === 0 &&
        /3\/3/.test((await kartlar())[0].metin) &&
        JSON.stringify((await gun(bugunIso)).noktalar) === '["yesil"]',
      JSON.stringify(s),
    );
    await oyuncuDugme("Berk Borclu", "Geldi");
    check("Gelmedi → Geldi: durum değişir (kaldırılmaz)", (await oyuncuDurum("Berk Borclu")).secili === "Geldi");
    await shot("04-isaretleme");
    // Kalanları Geldi İşaretle: Deniz ve Berk'in işaretini kaldır → ikisi de geldi olmalı
    await oyuncuDugme("Deniz Deneme", "İzinli");
    await oyuncuDugme("Berk Borclu", "Geldi");
    check("iki oyuncu işaretsiz", (await sayac()).yok === 2);
    await tikla("Kalanları Geldi İşaretle");
    await bekle(400);
    s = await sayac();
    check(
      "Kalanları Geldi İşaretle: 2 oyuncu geldi, Geldi 3, kart 3/3, toast",
      s.geldi === 3 && s.yok === 0 && /3\/3/.test((await kartlar())[0].metin) && /2 oyuncu geldi olarak kaydedildi/.test(await govde()),
      JSON.stringify(s),
    );
    check(
      "veritabanı: 3 yoklama satırı, hepsi geldi",
      db.listAttendance(db.trainingCalendar(bugunIso, bugunIso)[0].id).every((a) => a.durum === "geldi") &&
        db.listAttendance(db.trainingCalendar(bugunIso, bugunIso)[0].id).length === 3,
    );

    // 4) Düzenle
    await tikla("Düzenle");
    check(
      "düzenleme çubuğu: yoklama alındığı için tarih kilitli, uyarı metni",
      (await js(`document.querySelector("input[aria-label='Antrenman tarihi']").disabled`)) &&
        /yalnız saat ve saha değişir/.test(await govde()),
    );
    await tikla("Kaydet");
    check("değişiklik yapmadan Kaydet → 'Değişiklik yok'", /Değişiklik yok/.test(await govde()));
    await tikla("Düzenle");
    check(
      "Düzenle: kayıtlı bitiş 18:30 dolu gelir",
      (await js(`document.querySelector("input[aria-label='Antrenman bitişi']").value`)) === "18:30",
    );
    await setInput("input[aria-label='Antrenman saati']", "17:30");
    await setInput("input[aria-label='Antrenman bitişi']", "17:00");
    await setInput("input[aria-label='Antrenman sahası']", "Saha 2");
    await tikla("Kaydet");
    check(
      "Düzenle: bitiş başlangıçtan önce → uyarı, kaydedilmez (kart hâlâ 17:00–18:30)",
      /Bitiş başlangıçtan sonra olmalı/.test(await govde()) && /U11 · 17:00–18:30/.test((await kartlar())[0].metin),
    );
    await setInput("input[aria-label='Antrenman bitişi']", "19:00");
    await shot("05-duzenle");
    await tikla("Kaydet");
    await bekle(500);
    check(
      "güncellendi: toast, bildirim sorusu (değişiklik)",
      /Antrenman güncellendi/.test(await govde()) &&
        /değişiklik bildirilsin mi/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)),
    );
    await tikla("Vazgeç", 'document.querySelector("[role=dialog]")');
    await bekle(400);
    k = await kartlar();
    check(
      "kart: 'U11 · 17:30–19:00 · 90 dk', Saha 2, 'Velilere bildirilmedi'; başlıkta 'U11 Yoklama · 17:30–19:00' ve 'Velilere Bildir'",
      /U11 · 17:30–19:00/.test(k[0].metin) &&
        /90 dk/.test(k[0].metin) &&
        /U11 Yoklama · 17:30–19:00/.test(await govde()) &&
        /Saha 2/.test(k[0].metin) &&
        /Velilere bildirilmedi/.test(k[0].metin) &&
        /Velilere Bildir/.test(await govde()),
      JSON.stringify(k),
    );
    check(
      "veritabanı: bitiş 19:00, değişiklik notunda eski saat 17:00 ve eski bitiş 18:30",
      (() => {
        const t = db.listTrainings(bugunIso, bugunIso).find((x) => x.yas_grubu_ad === "U11");
        const n = JSON.parse(t.degisiklik_notu || "{}");
        return t.bitis_saat === "19:00" && t.saat === "17:30" && n.eskiSaat === "17:00" && n.eskiBitis === "18:30";
      })(),
    );
    await tikla("Velilere Bildir");
    await bekle(500);
    const wa = await js(`document.querySelector("[role=dialog]")?.textContent || ""`);
    check(
      "WhatsApp bildirim penceresi: başlık, Ali'nin velisi uygun, Berk'in velisinde numara yok",
      /Antrenman Değişikliği — Velilere Bildir/.test(wa) && /Ayşe Veli/.test(wa) && /Bora Veli/.test(wa) && /numar/i.test(wa),
      wa.slice(0, 300),
    );
    check("bildirim penceresi alt başlığında saat aralığı 17:30–19:00", /17:30–19:00/.test(wa), wa.slice(0, 300));
    await shot("06-velilere-bildir");
    await tikla("Kapat", 'document.querySelector("[role=dialog]")');
    await bekle(400);
    check(
      "pencere kapandı; bildirim hâlâ gerekli (kimseye açılmadı)",
      !(await js(`!!document.querySelector("[role=dialog]")`)) && /Velilere bildirilmedi/.test((await kartlar())[0].metin),
    );

    // 5) Haftayı Programdan Doldur
    await tikla("Haftayı Programdan Doldur");
    await bekle(600);
    check(
      "programdan doldur: 2 antrenman eklendi, 1 grubun programı yok",
      /2 antrenman eklendi, 1 grubun programı yok/.test(await govde()),
      (await govde()).match(/\d+ antrenman eklendi[^\n]*/)?.[0],
    );
    await tikla("Haftayı Programdan Doldur");
    await bekle(600);
    check(
      "ikinci doldurma: 0 eklendi, 2 zaten vardı",
      /0 antrenman eklendi, 2 zaten vardı/.test(await govde()),
      (await govde()).match(/\d+ antrenman eklendi[^\n]*/)?.[0],
    );
    // Program gününe git (şeritte görünür: hafta içinde)
    const haftaBasi = gunKaydir(bugunIso, -(bugunGun - 1));
    const pgIso = gunKaydir(haftaBasi, pg1 - 1);
    const pgGun = await gun(pgIso);
    check("program günü şeritte gri noktalı", pgGun && JSON.stringify(pgGun.noktalar) === '["gri"]', JSON.stringify(pgGun));
    await js(`document.querySelector("button[data-iso='${pgIso}']").click()`);
    await bekle(700);
    k = await kartlar();
    check(
      "program günü: 'U11 · 18:00–19:30 · 90 dk' (bitiş programdan), Saha 1, 0/3",
      /U11 · 18:00–19:30/.test((await kartlar())[0]?.metin || "") &&
        /90 dk/.test((await kartlar())[0]?.metin || "") &&
        k.length === 1 &&
        /U11 · 18:00/.test(k[0].metin) &&
        /Saha 1/.test(k[0].metin) &&
        /0\/3/.test(k[0].metin),
      JSON.stringify(k),
    );
    check("'Tarihe git' program gününü gösterir", (await js(`document.querySelector("input[aria-label='Tarihe git']").value`)) === pgIso);
    await shot("07-program-gunu");

    // 6) Şerit gezinme
    const ilkIso = () => js(`document.querySelector("button[data-iso]").dataset.iso`);
    const ilk0 = await ilkIso();
    await js(`document.querySelector("button[aria-label='Sonraki hafta']").click()`);
    await bekle(500);
    check("Sonraki hafta: şerit 7 gün kayar", (await ilkIso()) === gunKaydir(ilk0, 7), await ilkIso());
    await js(`document.querySelector("button[aria-label='Önceki hafta']").click()`);
    await bekle(500);
    check("Önceki hafta: geri döner", (await ilkIso()) === ilk0);
    await tikla("Bugün");
    check(
      "Bugün: bugün seçili, kart 'U11 · 17:30'",
      (await gun(bugunIso)).secili === "true" && /U11 · 17:30/.test((await kartlar())[0]?.metin || ""),
    );
    const uzak = gunKaydir(bugunIso, 40);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector("input[aria-label='Tarihe git']"); set.call(i, "${uzak}"); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await bekle(600);
    check(
      "Tarihe git (+40 gün): o gün seçili ve şeritte görünür, antrenman yok",
      (await gun(uzak))?.secili === "true" && /antrenman yok/.test(await govde()),
      JSON.stringify(await gun(uzak)),
    );
    check(
      "+40 gün sezon dışı (plan §37.6): hücre 'sezon dışı' etiketli ve soluk işaretli, başlıkta 'Sezon dışı' rozeti, gösterge satırı",
      /sezon dışı/.test((await gun(uzak)).etiket) &&
        (await js(`document.querySelector("button[data-iso='${uzak}']").dataset.sezonDisi`)) === "1" &&
        /Sezon dışı/.test(await govde()) &&
        /Soluk gün: sezon dışı/.test(await govde()),
      (await gun(uzak)).etiket,
    );
    // Sezon dışı günde de antrenman eklenebilir (engel değil)
    await tikla("Antrenman Ekle");
    await sec("select[aria-label='Yaş grubu']", u12.id);
    await setInput("input[aria-label='Saat']", "10:00");
    await setInput("input[aria-label='Saha']", "Saha 3");
    await tikla("Ekle");
    await bekle(600);
    check(
      "sezon dışı güne antrenman eklendi: kart 'U12 · 10:00' ve şeritte nokta",
      /U12 · 10:00/.test((await kartlar())[0]?.metin || "") && (await gun(uzak)).noktalar.length === 1,
    );
    await shot("07b-sezon-disi");
    // "Haftayı Programdan Doldur" sezon dışı haftada: eklenmez (program günü eklenir!) — not: haftanın tamamı dışarıda → toast notu
    await tikla("Haftayı Programdan Doldur");
    await bekle(500);
    check(
      "sezon dışı haftada doldurma: sonuç toast'ı 'bu hafta sezon dışında' notu taşır",
      /bu hafta sezon dışında/.test(await govde()),
      (await govde()).match(/\d+ antrenman eklendi[^\n]*/)?.[0],
    );
    await tikla("Bugün");
    check(
      "bugün sezon içi: hücre soluk değil, başlıkta 'Sezon dışı' rozeti yok",
      (await js(`document.querySelector("button[data-iso='${bugunIso}']")?.dataset.sezonDisi`)) === "0" &&
        !/Sezon dışı\b/.test(await js(`document.querySelector("h3")?.parentElement?.textContent || ""`)),
    );

    // 7) İptal Et (program gününün antrenmanı)
    await js(`document.querySelector("button[data-iso='${pgIso}']").click()`);
    await bekle(600);
    await js(`[...document.querySelectorAll("button[aria-pressed]")].find((b) => /işaretli/.test(b.textContent)).click()`);
    await bekle(500);
    await tikla("İptal Et");
    check(
      "iptal onayı: 'U11 18:00 antrenmanı iptal edilsin mi?'",
      /U11 18:00 antrenmanı iptal edilsin mi/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)),
    );
    await tikla("Vazgeç", 'document.querySelector("[role=dialog]")');
    await bekle(300);
    check("Vazgeç: iptal edilmedi", !/İptal edildi/.test(await govde()));
    await tikla("İptal Et");
    await tikla("Evet", 'document.querySelector("[role=dialog]")');
    await bekle(600);
    check(
      "iptal: toast + bildirim sorusu (iptal)",
      /Antrenman iptal edildi/.test(await govde()) &&
        /iptal bildirilsin mi/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)),
    );
    await tikla("Vazgeç", 'document.querySelector("[role=dialog]")');
    await bekle(500);
    k = await kartlar();
    check(
      "kart 'İptal' rozetli; şeritte kırmızı nokta",
      /İptal/.test(k[0].metin) && JSON.stringify((await gun(pgIso)).noktalar) === '["kirmizi"]',
      JSON.stringify(k),
    );
    await js(`[...document.querySelectorAll("button[aria-pressed]")].find((b) => /işaretli/.test(b.textContent)).click()`);
    await bekle(500);
    check(
      "iptal edilmiş antrenman: 'İptal edildi' rozeti, işaret düğmeleri kapalı, Düzenle/İptal Et yok, 'Velilere Bildir' var",
      /İptal edildi/.test(await govde()) &&
        (await oyuncuDurum("Ali Odedi")).kapali &&
        !/Düzenle/.test(await govde()) &&
        !(await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "İptal Et")`)) &&
        /Velilere Bildir/.test(await govde()),
    );
    check(
      "veritabanı: antrenman iptal, nedeni 'İptal', bildirim gerekli",
      (() => {
        const t = db.trainingCalendar(pgIso, pgIso)[0];
        return t.iptal === 1 && t.iptal_nedeni === "İptal" && t.bildirim_gerekli === 1;
      })(),
    );
    await shot("08-iptal");

    console.log(fail ? `${fail} KONTROL BASARISIZ` : "TUM KONTROLLER GECTI");
  } catch (e) {
    console.error("HATA:", e && e.stack ? e.stack : e);
    fail++;
  } finally {
    setTimeout(() => app.exit(fail ? 1 : 0), 300);
  }
});
