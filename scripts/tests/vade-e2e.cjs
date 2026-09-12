// Vade (plan §38) — tüm durumlar, GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/vade-e2e.cjs <userDataDizini> [ekranGoruntusuDizini]
// Beklentiler BUGÜNÜN GÜNÜNE göre hesaplanır (src/lib/aidat.js vadesiGectiMi): üç dönem (1-10 / 11-20 / 21-31), kısmi ödeme,
// ödenmiş, geçmiş ay borcu. Durumlar: Pano özet ("N oyuncunun vadesi gelmedi"), tesise giriş kontrolü (GİREBİLİR + vade notu /
// AİDAT BORCU), ödemeyenler kartı (yalnız vadesi geçen) + bağlantı → Oyuncular "Vadesi gelmeyenler", Oyuncular süzgeç/rozet,
// Tahsilat arama rozeti ("Borç/Bekliyor/Temiz") + dönem pili (ödenmedi işareti yalnız vade geçince), Yoklama "Aidat" rozeti,
// Hızlı arama rozeti, Oyuncu kartı Ödemeler ("vade dd.mm.yyyy"), Raporlar Borçlu Listesi ("Vadesi gelmeyenleri de göster", Vade
// sütunu), WhatsApp toplu hatırlatma alıcı sayısı, Ayarlar > Kulüp "vade" kutusu KAPALI → eski davranış. Çıktıda "TUM KONTROLLER GECTI".
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
const { vadesiGectiMi, vadeTarihi, tarihTR } = require("../../src/lib/aidat.js"); // ESM tek kaynak (ana süreç require(esm))
require("../../electron/main.cjs");
let basladi = false;
const isoGun = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

app.on("browser-window-created", async (_e, win) => {
  if (basladi) return;
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = async (k) => {
      try {
        return await win.webContents.executeJavaScript(k, true);
      } catch (e) {
        console.log("JS HATA:", String(k).replace(/\s+/g, " ").slice(0, 240));
        throw e;
      }
    };
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
    const govde = () => js(`document.body.innerText`);
    const sekme = async (ad) => {
      const ok = await js(
        `(() => { const b = document.querySelector("button[aria-label='${ad}']"); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok)
        throw new Error(`Sekme düğmesi yok: ${ad} — ekran: ` + (await js(`document.body.innerText.slice(0, 300)`)).replace(/\s+/g, " "));
      await bekle(700);
    };
    const satirlar = () => js(`[...document.querySelectorAll("table tbody tr")].map((tr) => tr.textContent.replace(/\\s+/g, " ").trim())`);
    // Pano'daki "… Aidatı Ödemeyenler" kartının satırları (sağlık uyarı tablosuyla karışmasın)
    const borcluSatirlar = () =>
      js(
        `(() => { const h = [...document.querySelectorAll("h3")].find((x) => /Aidatı Ödemeyenler/.test(x.textContent)); const k = h && h.closest("div[style]")?.parentElement; const t = k && k.querySelector("table"); return t ? [...t.querySelectorAll("tbody tr")].map((tr) => tr.textContent.replace(/\\s+/g, " ").trim()) : []; })()`,
      );

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(500);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "vade-test-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Tohum: bugüne göre beklentiler ──
    const bugun = new Date();
    const bugunIso = isoGun(bugun);
    const yil = bugun.getFullYear(),
      ay = bugun.getMonth() + 1;
    const oncekiYil = ay === 1 ? yil - 1 : yil,
      oncekiAy = ay === 1 ? 12 : ay - 1;
    const sezon = ay >= 9 ? `${yil}-${yil + 1}` : `${yil - 1}-${yil}`;
    db.setSetting("aktif_sezon", sezon);
    const grup = db.createAgeGroup({ ad: "U11", sezon, sira: 1 });
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    const P = (ad, donem) =>
      db.createPlayer({
        ad_soyad: ad,
        dogum_tarihi: "2015-01-01",
        yas_grubu_id: grup.id,
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        odeme_donemi: donem,
        sezon,
      });
    const A = P("Vade Bir", "1-10"); // bu ay ödenmemiş
    const B = P("Vade Onbir", "11-20"); // bu ay ödenmemiş
    const C = P("Vade Yirmibir", "21-31"); // bu ay ödenmemiş
    const D = P("Vade Kismi", "21-31"); // bu ay kısmi (400 ödendi)
    const E = P("Vade Odendi", "1-10"); // bu ay ödendi → Temiz
    const F = P("Vade Gecmis", "21-31"); // geçen ay ödenmemiş, bu ay ödendi → yalnız geçmiş ay borcu (her zaman vadesi geçmiş)
    for (const p of [A, B, C, D, E, F])
      db.addGuardian(p.id, { ad_soyad: p.ad_soyad + " Veli", gsm: "0532" + String(1000000 + p.id).slice(-7), veli_mi: 1, mesaj_onayi: 1 });
    db.ensureMonthlyDues(oncekiYil, oncekiAy); // geçen ay: hepsine açılır
    db.ensureMonthlyDues(yil, ay);
    const ode = (p, y, a, tutar) =>
      db.createReceipt({
        player_id: p.id,
        tarih: bugunIso,
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar, aciklama: "aidat", yil: y, ay: a }],
      });
    // geçen ay: F hariç herkes ödedi (F geçmiş borç); bu ay: D kısmi, E ve F ödedi
    for (const p of [A, B, C, D, E]) ode(p, oncekiYil, oncekiAy, 1000);
    ode(D, yil, ay, 400);
    ode(E, yil, ay, 1000);
    ode(F, yil, ay, 1000);
    const gecti = (donem) => vadesiGectiMi(donem, yil, ay, bugunIso);
    // Beklenen görünümler (bu ay)
    const bekl = {
      A: gecti("1-10") ? "borc" : "bekliyor",
      B: gecti("11-20") ? "borc" : "bekliyor",
      C: gecti("21-31") ? "borc" : "bekliyor",
      D: gecti("21-31") ? "kismi" : "bekliyor",
    };
    const adlar = { A: "Vade Bir", B: "Vade Onbir", C: "Vade Yirmibir", D: "Vade Kismi", E: "Vade Odendi", F: "Vade Gecmis" };
    const borcAdlari = ["A", "B", "C", "D"].filter((k) => bekl[k] !== "bekliyor").map((k) => adlar[k]);
    const bekleyenAdlari = ["A", "B", "C", "D"].filter((k) => bekl[k] === "bekliyor").map((k) => adlar[k]);
    console.log(`BILGI bugün ${bugunIso}: borç=[${borcAdlari}] bekleyen=[${bekleyenAdlari}]`);
    const vadeMetni = (donem) => tarihTR(vadeTarihi(donem, yil, ay));

    // ── 1) Pano ──
    await sekme("Pano");
    await bekle(800);
    let g = await govde();
    check(
      `Pano özet: "Aidat borcu olan" ${borcAdlari.length}` +
        (bekleyenAdlari.length ? ` ve "${bekleyenAdlari.length} oyuncunun vadesi gelmedi"` : ", bekleyen notu yok"),
      new RegExp(`BORCU OLAN\\s*${borcAdlari.length}\\b`, "i").test(g) && // innerText CSS ile büyük harf (İ) yazar
        (bekleyenAdlari.length ? new RegExp(`${bekleyenAdlari.length} oyuncunun vadesi gelmedi`).test(g) : !/vadesi gelmedi/.test(g)),
      g.match(/BORCU OLAN[^\n]*\n[^\n]*\n[^\n]*/i)?.[0],
    );
    const panoTablo = await borcluSatirlar();
    check(
      "ödemeyenler kartı: yalnız vadesi geçenler listede, bekleyenler yok, geçmiş ay borcu (bu ay ödendi) listede DEĞİL",
      borcAdlari.every((a) => panoTablo.some((s) => s.includes(a))) &&
        bekleyenAdlari.every((a) => !panoTablo.some((s) => s.includes(a))) &&
        !panoTablo.some((s) => s.includes(adlar.F)) &&
        !panoTablo.some((s) => s.includes(adlar.E)),
      JSON.stringify(panoTablo),
    );
    await shot("01-pano");
    // Tesise giriş kontrolü
    await setInput("input[aria-label='Tesise giriş araması']", "Vade");
    await bekle(600);
    const kart = (ad) =>
      js(
        `(() => { const el = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes(${JSON.stringify(ad)}) && /GİREBİLİR|GİREMEZ|AİDAT BORCU/.test(d.textContent)).sort((a, b) => a.textContent.length - b.textContent.length)[0]; return el ? el.textContent.replace(/\\s+/g, " ") : ""; })()`,
      );
    for (const k of ["A", "B", "C", "D"]) {
      const m = await kart(adlar[k]);
      const donem = { A: "1-10", B: "11-20", C: "21-31", D: "21-31" }[k];
      const beklenen = bekl[k] === "bekliyor" ? `GİREBİLİR + "vadesi ${vadeMetni(donem)}"` : "AİDAT BORCU";
      check(
        `giriş kontrolü ${adlar[k]} (${donem}, ${bekl[k]}): ${beklenen}`,
        bekl[k] === "bekliyor" ? /GİREBİLİR/.test(m) && m.includes(`vadesi ${vadeMetni(donem)}`) : /AİDAT BORCU/.test(m),
        m,
      );
    }
    check("giriş kontrolü ödemiş oyuncu GİREBİLİR (ödendi)", /GİREBİLİR/.test(await kart(adlar.E)) && /ödendi/.test(await kart(adlar.E)));
    check("giriş kontrolü geçmiş ay borçlusu bu ay ödediyse GİREBİLİR", /GİREBİLİR/.test(await kart(adlar.F)));
    await shot("02-giris-kontrolu");
    // WhatsApp toplu: alıcı = vadesi geçenler
    if (borcAdlari.length) {
      await tikla("Borçlulara Hatırlat");
      const dlg = await js(`document.querySelector("[role=dialog]")?.textContent || ""`);
      check(
        `Borçlulara Hatırlat: ${borcAdlari.length} borçlu (bekleyen yok)`,
        dlg.includes(`${borcAdlari.length} borçlu`) && bekleyenAdlari.every((a) => !dlg.includes(a)),
        dlg.slice(0, 200),
      );
      await js(`document.querySelector("[role=dialog] button[aria-label='Kapat']")?.click()`);
      await bekle(400);
    } else console.log("BILGI bugün vadesi geçen yok; toplu hatırlatma düğmesi görünmez (beklenen)");
    // Bağlantı → Oyuncular "Vadesi gelmeyenler"
    if (bekleyenAdlari.length) {
      await js(`[...document.querySelectorAll("a")].find((a) => /oyuncunun vadesi gelmedi/.test(a.textContent)).click()`);
      await bekle(900);
      const rows = await satirlar();
      check(
        "Pano bağlantısı → Oyuncular 'Vadesi gelmeyenler' süzgeci açık, yalnız bekleyenler listede",
        /✕ Vadesi gelmeyenler/.test(await govde()) &&
          bekleyenAdlari.every((a) => rows.some((s) => s.includes(a))) &&
          borcAdlari.every((a) => !rows.some((s) => s.includes(a))),
        JSON.stringify(rows),
      );
      check(
        "bekleyen satırlarında 'Vadesi gelmedi' rozeti",
        rows.filter((s) => bekleyenAdlari.some((a) => s.includes(a))).every((s) => s.includes("Vadesi gelmedi")),
      );
      await tikla("✕ Vadesi gelmeyenler");
      await bekle(600);
    } else await sekme("Oyuncular");

    // ── 2) Oyuncular ──
    await tikla("Bu ay ödemeyenler");
    await bekle(700);
    let rows = await satirlar();
    check(
      "'Bu ay ödemeyenler': yalnız vadesi geçenler (bekleyen ve ödemiş yok)",
      borcAdlari.every((a) => rows.some((s) => s.includes(a))) &&
        [...bekleyenAdlari, adlar.E, adlar.F].every((a) => !rows.some((s) => s.includes(a))),
      JSON.stringify(rows),
    );
    check(
      "borç satırlarında 'Ödenmedi' (kısmi ise 'Kısmi') rozeti",
      rows.filter((s) => borcAdlari.some((a) => s.includes(a))).every((s) => /Ödenmedi|Kısmi/.test(s)),
    );
    await tikla("✕ Bu ay ödemeyenler");
    await bekle(600);
    rows = await satirlar();
    check(
      "süzgeçsiz liste: ödemiş 'Ödendi', bekleyen 'Vadesi gelmedi'",
      rows.some((s) => s.includes(adlar.E) && s.includes("Ödendi")) &&
        bekleyenAdlari.every((a) => rows.some((s) => s.includes(a) && s.includes("Vadesi gelmedi"))),
    );
    await shot("03-oyuncular");
    // Oyuncu kartı: B (11-20) Ödemeler
    await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(adlar.B)})).click()`);
    await bekle(800);
    await tikla("Ödemeler", 'document.querySelector("[role=dialog]")');
    await bekle(500);
    const dlg = await js(`document.querySelector("[role=dialog]")?.innerText || ""`);
    check(
      `oyuncu kartı Ödemeler (${adlar.B}): bu ay ${bekl.B === "bekliyor" ? `'Vadesi gelmedi' + 'vade ${vadeMetni("11-20")}'` : "'Ödenmedi'"}, geçen ay 'Ödendi'`,
      (bekl.B === "bekliyor" ? dlg.includes("Vadesi gelmedi") && dlg.includes(`vade ${vadeMetni("11-20")}`) : /Ödenmedi/.test(dlg)) &&
        /Ödendi/.test(dlg),
      dlg.slice(0, 400),
    );
    check(
      "oyuncu kartı 'N borç' rozeti yalnız vadesi geçen için",
      bekl.B === "bekliyor" ? !/\d+ borç/.test(dlg) : /1 borç/.test(dlg),
      dlg.match(/\d+ borç/)?.[0] || "rozet yok",
    );
    await js(`document.querySelector("[role=dialog] button[aria-label='Kapat']")?.click()`);
    await bekle(400);

    // ── 3) Hızlı arama ──
    await js(`document.querySelector("button[aria-label='Oyuncu ara (Ctrl+K)']").click()`);
    await bekle(400);
    await setInput("[aria-label='Hızlı arama'] input, input[aria-label='Oyuncu ara']", adlar.B);
    await bekle(600);
    const ha = await js(`document.querySelector("[aria-label='Hızlı arama']")?.innerText || document.body.innerText`);
    check(
      `Hızlı arama ${adlar.B}: ${bekl.B === "bekliyor" ? "Vadesi gelmedi" : "Ödenmedi"}`,
      ha.includes(bekl.B === "bekliyor" ? "Vadesi gelmedi" : "Ödenmedi"),
      ha.slice(0, 200),
    );
    await js(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
    await bekle(300);

    // ── 4) Tahsilat ──
    await sekme("Tahsilat");
    await setInput("input[aria-label='Oyuncu ara']", "Vade");
    await bekle(700);
    const sonuc = await js(
      `[...document.querySelectorAll("input[aria-label='Oyuncu ara'] ~ div > div")].map((d) => d.textContent.replace(/\\s+/g, " ").trim())`,
    );
    const rozet = (ad) => sonuc.find((s) => s.includes(ad)) || "";
    check(
      "Tahsilat arama rozetleri: vadesi geçen 'Borç', bekleyen 'Bekliyor', ödemiş 'Temiz'",
      borcAdlari.every((a) => /Borç$/.test(rozet(a))) &&
        bekleyenAdlari.every((a) => /Bekliyor$/.test(rozet(a))) &&
        /Temiz$/.test(rozet(adlar.E)),
      JSON.stringify(sonuc),
    );
    await js(
      `[...document.querySelectorAll("input[aria-label='Oyuncu ara'] ~ div > div")].find((d) => d.textContent.includes(${JSON.stringify(adlar.B)})).click()`,
    );
    await bekle(700);
    const pil = await js(
      `(() => { const b = [...document.querySelectorAll("button[aria-pressed]")].find((x) => x.getAttribute("aria-label") && /\\d{4}$/.test(x.getAttribute("aria-label")) && x.getAttribute("aria-pressed") === "true"); return b ? { etiket: b.getAttribute("aria-label"), metin: b.textContent.trim() } : null; })()`,
    );
    check(
      `Tahsilat pili (${adlar.B}): bu ay seçili gelir; ${bekl.B === "bekliyor" ? "'ödenmedi' işareti YOK" : "'ödenmedi' işaretli"}`,
      !!pil && (bekl.B === "bekliyor" ? !/ödenmedi/.test(pil.metin) : /ödenmedi/.test(pil.metin)),
      JSON.stringify(pil),
    );
    await shot("04-tahsilat");

    // ── 5) Yoklama ──
    const t = db.createTraining({ age_group_id: grup.id, tarih: bugunIso, saat: "17:00", saha: "Saha 1" });
    await sekme("Yoklama");
    await bekle(800);
    await js(`[...document.querySelectorAll("button[aria-pressed]")].find((b) => /işaretli/.test(b.textContent))?.click()`);
    await bekle(800);
    const yokSatir = (ad) =>
      js(
        `(() => { const satir = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes(${JSON.stringify(ad)}) && [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Geldi")).sort((a, b) => a.textContent.length - b.textContent.length)[0]; return satir ? /Aidat/.test(satir.textContent) : null; })()`,
      );
    check(
      "Yoklama listesi: 'Aidat' rozeti yalnız vadesi geçenlerde (kısmi hariç), bekleyen ve ödemişte yok",
      (await Promise.all(borcAdlari.filter((a) => a !== adlar.D).map(yokSatir))).every((x) => x === true) &&
        (await Promise.all([...bekleyenAdlari, adlar.E].map(yokSatir))).every((x) => x === false),
    );
    check(
      `Yoklama başlık: '${borcAdlari.filter((a) => a !== adlar.D).length} aidat borcu'`,
      borcAdlari.filter((a) => a !== adlar.D).length === 0
        ? !/aidat borcu/.test(await govde())
        : (await govde()).includes(`${borcAdlari.filter((a) => a !== adlar.D).length} aidat borcu`),
    );
    void t;

    // ── 6) Raporlar › Borçlu Listesi ──
    await sekme("Raporlar");
    await tikla("Borçlu Listesi");
    await tikla("Önizle");
    await bekle(900);
    rows = await satirlar();
    check(
      "Borçlu Listesi (varsayılan): yalnız vadesi geçenler; 'Vade' sütunu var",
      /Vade/.test(await js(`document.querySelector("table thead")?.textContent || ""`)) &&
        borcAdlari.every((a) => rows.some((s) => s.includes(a))) &&
        bekleyenAdlari.every((a) => !rows.some((s) => s.includes(a))),
      JSON.stringify(rows),
    );
    if (bekleyenAdlari.length) {
      await js(`document.querySelector("input[aria-label='Vadesi gelmeyenleri de göster']").click()`);
      await bekle(300);
      await tikla("Önizle");
      await bekle(900);
      rows = await satirlar();
      check(
        "'Vadesi gelmeyenleri de göster': bekleyenler 'bekliyor' notuyla listede",
        bekleyenAdlari.every((a) => rows.some((s) => s.includes(a) && s.includes("bekliyor"))),
        JSON.stringify(rows),
      );
    }
    await shot("05-raporlar");

    // ── 7) Ayarlar › Kulüp ve Makbuz: vade KAPALI → eski davranış ──
    await sekme("Ayarlar");
    await tikla("Kulüp ve Makbuz");
    await bekle(500);
    const kutu = "input[aria-label='Aidat ödeme döneminin son gününden sonra borç sayılsın']";
    check("ayar kutusu varsayılan işaretli", (await js(`document.querySelector("${kutu}")?.checked`)) === true);
    await js(`document.querySelector("${kutu}").click()`);
    await bekle(300);
    await tikla("Kaydet");
    await bekle(600);
    check("ayar kaydedildi (aidat_vade_bekle=0)", db.getSetting("aidat_vade_bekle") === "0");
    await sekme("Pano");
    await bekle(900);
    g = await govde();
    const tumAcik = ["A", "B", "C", "D"].map((k) => adlar[k]);
    const panoTablo2 = await borcluSatirlar();
    check(
      "vade KAPALI: Pano 'Aidat borcu olan' 4, bekleyen notu yok, ödemeyenler kartında dördü de",
      /BORCU OLAN\s*4\b/i.test(g) && !/vadesi gelmedi/.test(g) && tumAcik.every((a) => panoTablo2.some((s) => s.includes(a))),
      JSON.stringify(panoTablo2),
    );
    await setInput("input[aria-label='Tesise giriş araması']", adlar.B);
    await bekle(600);
    check("vade KAPALI: 11-20 dönemli oyuncu ayın başında da AİDAT BORCU", /AİDAT BORCU/.test(await kart(adlar.B)));
    await shot("06-vade-kapali");
    db.setSetting("aidat_vade_bekle", "");
  } catch (e) {
    console.error("HATA:", e && e.stack);
    fail++;
  }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  app.exit(fail === 0 ? 0 : 1);
});
