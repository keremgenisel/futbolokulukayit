// Oyuncular ekranı filtreleri uçtan uca: GERÇEK main.cjs + gerçek DB. İki sezon, iki grup, her durumdan oyuncu, ödenen/ödenmeyen
// aidat, sağlık raporu (geçerli / süresi dolmuş / tarihsiz / yok), yabancı uyruklu. Arama (Türkçe harf, TC, pasaport), sezon,
// yaş grubu, durum, "Bu ay ödemeyenler", "Sağlık raporu olmayanlar", birleşimler ve Pano'dan gelen "Tümü" bağlantıları.
// Ek (10.09.2026): satır rozetleri (durum/ücret/aidat/grup, sağlık pili, "Eksik belge (N)" pili), "Eksik belgesi olanlar"
// filtresi, veli adı/telefonu, satıra tıklayınca oyuncu kartı, Yeni Oyuncu formu. [ekranGoruntusuDizini] verilirse görüntü yazar.
// Kullanım: electron scripts/tests/oyuncular-e2e.cjs <dizin> [ekranGoruntusuDizini]
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

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const shot = async (ad) => {
      if (!shotDir) return;
      fs.writeFileSync(path.join(shotDir, ad + ".png"), (await win.webContents.capturePage()).toPNG());
    };
    const tikla = async (metin) => {
      const ok = await js(
        `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
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
    // Listedeki oyuncu adları (satırın ilk hücresindeki kalın ad; rozetler hariç) + "n oyuncu" sayacı
    const adlar = () =>
      js(
        `[...document.querySelectorAll("table tbody tr")].map((tr) => { const divler = [...tr.cells[0].querySelectorAll("div[style*='font-weight: 700']")]; const metin = (d) => [...d.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(""); const ad = divler.map(metin).find((t) => t.length > 3); return ad || ""; }).sort((a, b) => a.localeCompare(b, "tr"))`,
      );
    const sayac = () => js(`(document.body.textContent.match(/(\\d+) oyuncu/) || [])[1]`);
    // Liste debounce'la yenilenir: beklenen küme görünene kadar (en çok 5 sn) bekle, sonra karşılaştır
    const bekleListe = async (beklenen) => {
      const hedef = [...beklenen].sort((a, b) => a.localeCompare(b, "tr")).join(",");
      let son = "";
      for (let i = 0; i < 25; i++) {
        son = (await adlar()).join(",");
        if (son === hedef) return { ok: true, son, sayac: await sayac() };
        await bekle(200);
      }
      return { ok: false, son, sayac: await sayac() };
    };
    const liste = async (ad, beklenen) => {
      const r = await bekleListe(beklenen);
      check(ad, r.ok && String(r.sayac) === String(beklenen.length), `liste: [${r.son}] sayaç: ${r.sayac} (beklenen ${beklenen.length})`);
    };

    // ── Giriş + kurulum atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(600);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "oyuncu-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(300);
    }

    // ── Veri ──
    db.setSetting("aktif_sezon", "2025-2026");
    const g11 = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    const g12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027" });
    const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
    const P = (p) => db.createPlayer({ dogum_tarihi: "2015-01-01", odeme_donemi: "1-10", ucret_tipi: "normal", aylik_aidat: 1000, ...p });
    // Geçen sezon: Ceren (yenilemeyecek) ve Ali (yenileyecek)
    const ceren = P({ ad_soyad: "Ceren Eski", yas_grubu_id: g11.id, durum: "aktif" });
    const ali = P({ ad_soyad: "Ali Aktif", yas_grubu_id: g11.id, durum: "aktif", tc_no: "11111111111" });
    db.hamBaglanti()
      .prepare("INSERT INTO monthly_dues (player_id,yil,ay,tutar,odenen,durum) VALUES (?,?,?,?,0,'odenmedi')")
      .run(ceren.id, 2025, 10, 1000);
    const sg = db.yeniSezonaGec({ sezon: "2026-2027", yenileyenler: [{ id: ali.id }] });
    check(
      "kurulum: sezon geçişi (Ali yeniledi, Ceren pasif)",
      sg.yenilenen === 1 && sg.pasif === 1 && db.getPlayer(ceren.id).durum === "pasif",
      JSON.stringify(sg),
    );
    // Bu sezon
    P({ ad_soyad: "İbrahim Deneme", yas_grubu_id: g11.id, durum: "deneme" });
    const berk = P({ ad_soyad: "Berk Yeni", yas_grubu_id: g12.id, durum: "aktif" });
    const deniz = P({ ad_soyad: "Deniz Sakat", yas_grubu_id: g12.id, durum: "sakat", ucret_tipi: "ucretsiz", aylik_aidat: 0 });
    const emre = P({ ad_soyad: "Emre Ayrıldı", yas_grubu_id: g12.id, durum: "ayrildi", tc_no: "99999999999" });
    const fatma = P({ ad_soyad: "Fatma Pasif", yas_grubu_id: g12.id, durum: "pasif" });
    const john = P({ ad_soyad: "John Yabancı", yas_grubu_id: g12.id, durum: "aktif", uyruk: "yabanci", pasaport_no: "AB123456" });
    // Ali Eylül aidatını ödedi
    db.createReceipt({
      player_id: ali.id,
      tarih: "2026-09-05",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidat.id, tutar: 1000, yil: 2026, ay: 9 }],
    });
    // Sağlık raporları: Ali geçerli (2027), Berk süresi dolmuş, Deniz tarihsiz; İbrahim/John yok
    const belge = (p, gecerlilik) => {
      fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + p.id), { recursive: true });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + p.id, "1-saglik.pdf"), "x");
      db.belgeEkle(p.id, { tip: "saglik", dosya_yolu: `oyuncu-${p.id}/1-saglik.pdf`, orijinal_ad: "s.pdf", gecerlilik_tarihi: gecerlilik });
    };
    belge(ali, "2027-06-01");
    belge(berk, "2026-01-01");
    belge(deniz, null);
    void emre;
    void fatma;
    void john;

    // ── Oyuncular ──
    await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
    await bekle(800);
    await liste("varsayılan: aktif sezon + aktif/deneme/sakat", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
    ]);
    check(
      "varsayılan kutular: sezon 2026-2027, durum 'aktifler'",
      (await js(`document.querySelector("select[aria-label='Sezon']").value`)) === "2026-2027" &&
        (await js(`document.querySelector("select[aria-label='Durum']").value`)) === "aktifler",
    );

    // Durum
    await sec("Durum", "aktif");
    await liste("durum Aktif", ["Ali Aktif", "Berk Yeni", "John Yabancı"]);
    await sec("Durum", "deneme");
    await liste("durum Deneme", ["İbrahim Deneme"]);
    await sec("Durum", "sakat");
    await liste("durum Sakat", ["Deniz Sakat"]);
    await sec("Durum", "pasif");
    await liste("durum Pasif (bu sezon): Fatma; eski sezonun Ceren'i yok", ["Fatma Pasif"]);
    await sec("Durum", "ayrildi");
    await liste("durum Ayrıldı", ["Emre Ayrıldı"]);
    await sec("Durum", "");
    await liste("Tüm durumlar (aktif sezon): 7 oyuncu", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "Emre Ayrıldı",
      "Fatma Pasif",
      "John Yabancı",
    ]);
    await sec("Durum", "aktifler");

    // Yaş grubu
    await sec("Yaş grubu", g11.id);
    await liste("yaş grubu U11", ["Ali Aktif", "İbrahim Deneme"]);
    await sec("Yaş grubu", g12.id);
    await liste("yaş grubu U12", ["Berk Yeni", "Deniz Sakat", "John Yabancı"]);
    await sec("Yaş grubu", "");

    // Sezon
    await sec("Sezon", "2025-2026");
    check(
      "eski sezon seçilince durum kendiliğinden 'Tüm durumlar'",
      (await js(`document.querySelector("select[aria-label='Durum']").value`)) === "",
    );
    await liste("eski sezon 2025-2026: Ali (o sezonda da vardı) ve Ceren (pasif)", ["Ali Aktif", "Ceren Eski"]);
    await sec("Sezon", "");
    await liste("Tüm sezonlar: 8 oyuncu", [
      "Ali Aktif",
      "Ceren Eski",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "Emre Ayrıldı",
      "Fatma Pasif",
      "John Yabancı",
    ]);
    await sec("Sezon", "2026-2027");
    check(
      "aktif sezona dönünce durum yine 'aktifler'",
      (await js(`document.querySelector("select[aria-label='Durum']").value`)) === "aktifler",
    );

    // Bu ay ödemeyenler / Sağlık raporu olmayanlar
    await tikla("Bu ay ödemeyenler");
    await liste("Bu ay ödemeyenler: İbrahim, Berk, John (Ali ödedi, Deniz muaf)", ["İbrahim Deneme", "Berk Yeni", "John Yabancı"]);
    await sec("Yaş grubu", g12.id);
    await liste("ödemeyenler + U12", ["Berk Yeni", "John Yabancı"]);
    await sec("Yaş grubu", "");
    await tikla("✕ Bu ay ödemeyenler");
    await tikla("Sağlık raporu olmayanlar");
    await liste("Sağlık raporu olmayanlar: rapor yok (İbrahim, John), süresi dolmuş (Berk), tarihsiz (Deniz)", [
      "İbrahim Deneme",
      "John Yabancı",
      "Berk Yeni",
      "Deniz Sakat",
    ]);
    await tikla("Bu ay ödemeyenler");
    await liste("ödemeyen + raporsuz birleşimi", ["İbrahim Deneme", "Berk Yeni", "John Yabancı"]);
    await tikla("✕ Bu ay ödemeyenler");
    await tikla("✕ Sağlık raporu olmayanlar");

    // Arama
    await yaz("Ara", "ibr");
    await liste("arama 'ibr' → İbrahim (Türkçe harf duyarsız)", ["İbrahim Deneme"]);
    await yaz("Ara", "ab123");
    await liste("arama pasaport 'ab123' → John", ["John Yabancı"]);
    await yaz("Ara", "99999");
    await liste("arama TC '99999' varsayılan durumda boş (Emre ayrıldı, gizli)", []);
    await sec("Durum", "");
    await liste("arama TC '99999' + Tüm durumlar → Emre", ["Emre Ayrıldı"]);
    await yaz("Ara", "cer");
    await sec("Sezon", "2025-2026");
    await liste("arama 'cer' + eski sezon → Ceren", ["Ceren Eski"]);
    await yaz("Ara", "");
    await sec("Sezon", "2026-2027");
    await liste("arama temizlenince varsayılan liste", ["Ali Aktif", "İbrahim Deneme", "Berk Yeni", "Deniz Sakat", "John Yabancı"]);

    // Pano bağlantıları
    await js(`document.querySelector("button[aria-label='Pano']").click()`);
    await bekle(900);
    await js(
      `[...document.querySelectorAll("a")].find((a) => a.textContent.startsWith("Tümü (") && a.closest("div")?.parentElement?.textContent.includes("Ödemeyenler"))?.click()`,
    );
    await bekle(900);
    await liste("Pano > Aidatı ödemeyenler > Tümü → Oyuncular 'Bu ay ödemeyenler' ile", ["İbrahim Deneme", "Berk Yeni", "John Yabancı"]);
    check(
      "ödemeyenler düğmesi işaretli",
      await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "✕ Bu ay ödemeyenler")`),
    );
    await js(`document.querySelector("button[aria-label='Pano']").click()`);
    await bekle(900);
    await js(
      `[...document.querySelectorAll("a")].find((a) => a.textContent.startsWith("Tümü (") && a.closest("div")?.parentElement?.textContent.includes("Sağlık"))?.click()`,
    );
    await bekle(900);
    await liste("Pano > Sağlık raporu uyarıları > Tümü → Oyuncular 'Sağlık raporu olmayanlar' ile", [
      "İbrahim Deneme",
      "John Yabancı",
      "Berk Yeni",
      "Deniz Sakat",
    ]);
    check(
      "sağlık düğmesi işaretli, ödemeyenler değil",
      (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "✕ Sağlık raporu olmayanlar")`)) &&
        !(await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "✕ Bu ay ödemeyenler")`)),
    );

    // ── Satır rozetleri, piller, veli, kart, yeni oyuncu (10.09.2026) ──
    await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
    await bekle(900);
    await bekleListe(["Ali Aktif", "İbrahim Deneme", "Berk Yeni", "Deniz Sakat", "John Yabancı"]);
    const satir = (ad) =>
      js(
        `([...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(ad)}))?.textContent) || ""`,
      );
    const ali_ = await satir("Ali Aktif");
    check(
      "Ali satırı: U11, Aktif, Normal, Ödendi rozetleri; sağlık pili yok",
      /U11/.test(ali_) && /Aktif/.test(ali_) && /Normal/.test(ali_) && /Ödendi/.test(ali_) && !/rapor|Süresi|tarihsiz/i.test(ali_),
      ali_,
    );
    const deniz_ = await satir("Deniz Sakat");
    check(
      "Deniz satırı: Sakat, Ücretsiz, Muaf, 'Rapor tarihsiz' pili",
      /Sakat/.test(deniz_) && /Ücretsiz/.test(deniz_) && /Muaf/.test(deniz_) && /Rapor tarihsiz/.test(deniz_),
      deniz_,
    );
    check(
      "Berk satırı: 'Süresi doldu' pili, Ödenmedi",
      /Süresi doldu/.test(await satir("Berk Yeni")) && /Ödenmedi/.test(await satir("Berk Yeni")),
      await satir("Berk Yeni"),
    );
    check(
      "İbrahim satırı: 'Sağlık raporu yok' pili, Deneme",
      /Sağlık raporu yok/.test(await satir("İbrahim Deneme")) && /Deneme/.test(await satir("İbrahim Deneme")),
    );
    // Eksik belge pili: Ali'de yalnız sağlık var → 4 eksik; İbrahim'de hiç → 5
    check(
      "eksik belge pili: Ali (4), İbrahim (5)",
      /Eksik belge \(4\)/.test(ali_) && /Eksik belge \(5\)/.test(await satir("İbrahim Deneme")),
      ali_,
    );
    check(
      "eksik belge pili ipucu: eksik türlerin adları",
      /Vesikalık fotoğraf, Sporcu kimlik fotokopisi, Veli kimlik fotokopisi, İmzalı kayıt formu$/.test(
        await js(
          `[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Ali Aktif")).querySelector("[aria-label^='Eksik belge']")?.getAttribute("aria-label") || ""`,
        ),
      ),
    );
    const tam = P({ ad_soyad: "Tam Belgeli", yas_grubu_id: g11.id, durum: "aktif" });
    for (const tip of ["saglik", "foto", "sporcu_kimlik", "veli_kimlik", "kayit_formu"])
      db.belgeEkle(tam.id, {
        tip,
        dosya_yolu: `oyuncu-${tam.id}/${tip}.pdf`,
        orijinal_ad: `${tip}.pdf`,
        gecerlilik_tarihi: tip === "saglik" ? "2027-06-01" : null,
      });
    const digerli = P({ ad_soyad: "Diğer Belgeli", yas_grubu_id: g11.id, durum: "aktif" });
    db.belgeEkle(digerli.id, { tip: "diger", dosya_yolu: `oyuncu-${digerli.id}/d.pdf`, orijinal_ad: "d.pdf" });
    db.addGuardian(ali.id, { tip: "anne", ad_soyad: "Ayşe Veli", gsm: "05321112233", whatsapp_no: "", veli_mi: 1 });
    await yaz("Ara", "x");
    await yaz("Ara", "");
    await liste("yeni oyuncular listede", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
      "Tam Belgeli",
      "Diğer Belgeli",
    ]);
    check(
      "tam belgeli oyuncuda pil yok; yalnız 'Diğer' olanda 5 eksik",
      !/Eksik belge/.test(await satir("Tam Belgeli")) && /Eksik belge \(5\)/.test(await satir("Diğer Belgeli")),
    );
    check(
      "veli adı ve telefonu satırda",
      /Ayşe Veli/.test(await satir("Ali Aktif")) && /0532 111 22 33|05321112233/.test(await satir("Ali Aktif")),
      await satir("Ali Aktif"),
    );
    await shot("01-liste-rozetler");
    // Eksik belge filtresi
    await tikla("Eksik belgesi olanlar");
    await liste("Eksik belgesi olanlar: tam belgeli hariç herkes", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
      "Diğer Belgeli",
    ]);
    check(
      "eksik belge düğmesi işaretli (✕)",
      await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "✕ Eksik belgesi olanlar")`),
    );
    await yaz("Ara", "tam");
    await liste("eksik belge + arama 'tam' → boş", []);
    await yaz("Ara", "");
    await tikla("Sağlık raporu olmayanlar");
    await liste("eksik belge + sağlık raporu olmayanlar birleşimi (Diğer Belgeli'nin de raporu yok)", [
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
      "Diğer Belgeli",
    ]);
    await shot("02-eksik-belge-filtresi");
    await tikla("✕ Sağlık raporu olmayanlar");
    await tikla("✕ Eksik belgesi olanlar");
    await liste("filtreler kapanınca tam liste", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
      "Tam Belgeli",
      "Diğer Belgeli",
    ]);
    // Satıra tıkla → oyuncu kartı
    await js(`[...document.querySelectorAll("table tbody tr")].find((tr) => tr.textContent.includes("Ali Aktif")).click()`);
    await bekle(900);
    check(
      "satıra tıklayınca oyuncu kartı açılır",
      /Ali Aktif/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)) &&
        /Ödemeler/.test(await js(`document.querySelector("[role=dialog]")?.textContent || ""`)),
    );
    await shot("03-oyuncu-karti");
    await js(`document.querySelector("[role=dialog] button[aria-label='Kapat']")?.click()`);
    await bekle(400);
    check("kart kapanır", !(await js(`!!document.querySelector("[role=dialog]")`)));
    // Yeni Oyuncu
    await tikla("Yeni Oyuncu");
    await bekle(500);
    check(
      "Yeni Oyuncu formu açılır",
      /Yeni Oyuncu/.test(await js(`document.querySelector("[role=dialog]")?.getAttribute("aria-label") || ""`)),
    );
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const dlg = document.querySelector("[role=dialog]"); const al = (b) => [...dlg.querySelectorAll("label")].find((l) => l.textContent.startsWith(b)).querySelector("input,select"); set.call(al("Adı Soyadı"), "Zeynep Yeni"); al("Adı Soyadı").dispatchEvent(new Event("input", { bubbles: true })); set.call(al("Doğum Tarihi"), "2016-03-03"); al("Doğum Tarihi").dispatchEvent(new Event("input", { bubbles: true })); const g = dlg.querySelector("select[aria-label='Yaş grubu']"); g.value = String(${g12.id}); g.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await shot("04-yeni-oyuncu-form");
    await tikla("Oyuncuyu Kaydet");
    await bekle(900);
    await liste("yeni oyuncu kaydedilince listede", [
      "Ali Aktif",
      "İbrahim Deneme",
      "Berk Yeni",
      "Deniz Sakat",
      "John Yabancı",
      "Tam Belgeli",
      "Diğer Belgeli",
      "Zeynep Yeni",
    ]);
    check(
      "yeni oyuncu: U12, Aktif, aidat girilmediği için Muaf, 'Sağlık raporu yok', eksik belge (5)",
      /U12/.test(await satir("Zeynep Yeni")) &&
        /Aktif/.test(await satir("Zeynep Yeni")) &&
        /Muaf/.test(await satir("Zeynep Yeni")) &&
        /Sağlık raporu yok/.test(await satir("Zeynep Yeni")) &&
        /Eksik belge \(5\)/.test(await satir("Zeynep Yeni")),
      await satir("Zeynep Yeni"),
    );
    await shot("05-yeni-oyuncu-listede");

    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
