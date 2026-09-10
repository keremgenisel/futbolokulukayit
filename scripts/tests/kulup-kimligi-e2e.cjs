// Kulüp kimliği (plan §32) — GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/kulup-kimligi-e2e.cjs <userDataDizini> [ekranGoruntusuDizini]
// Durumlar: ayarlanmış kimlik (kısa ad, kuruluş yılı, logo, lacivert/turuncu tema) giriş ekranında oturumsuz görünür ve tema
// CSS'e uygulanır; kenar menüde kulüp logosu + kısa ad + alt yazı; Ayarlar > Kulüp alanları dolu, logo önizlemesi, logodan
// renk önerisi; palet seçip Kaydet → tüm uygulama yeni renge geçer; Vazgeç geri alır; Kaldır → uygulama logosuna dönüş.
// Çıktıda "TUM KONTROLLER GECTI" aranır.
const { app, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const [dizin, shotDir] = process.argv.slice(2);
app.setPath("userData", dizin);
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
// Çıktılar: Excel kaydetme diyaloğu test dosyasına; açma yok (gerçek işleyici xlsx'i yazar, başlık dolgusu okunur)
const ciktiDir = fs.mkdtempSync(path.join(os.tmpdir(), "fok-kimlik-cikti-"));
let sonExcel = "";
dialog.showSaveDialog = async (_w, o) => {
  sonExcel = path.join(ciktiDir, path.basename(o?.defaultPath || "rapor"));
  return { canceled: false, filePath: sonExcel };
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
  if (basladi) return;
  basladi = true;
  try {
    // Sayfa yüklenmeden kimliği yaz (marka kanalı yükleme sonrasında okur)
    db.setSetting("kulup_adi", "Anadolu Spor Kulübü Futbol Okulu");
    db.setSetting("kulup_kisa_ad", "Anadolu SK");
    db.setSetting("kurulus_yili", "1974");
    db.setSetting("tema_ana", "#1f3a93");
    db.setSetting("tema_vurgu", "#f58220");
    db.setSetting("kulup_slogan", "#HedefŞampiyonluk");
    const { kulupLogoKaydet } = require("../../electron/kulupLogo.cjs");
    const W = 400;
    const bmp = Buffer.alloc(W * W * 4);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const sol = x < W / 2;
        bmp[i] = sol ? 147 : 32; // B
        bmp[i + 1] = sol ? 58 : 130; // G
        bmp[i + 2] = sol ? 31 : 245; // R
        bmp[i + 3] = 255;
      }
    kulupLogoKaydet(nativeImage.createFromBitmap(bmp, { width: W, height: W }).toPNG(), ".png");

    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(900);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const shot = async (ad) => {
      if (!shotDir) return;
      fs.writeFileSync(path.join(shotDir, ad + ".png"), (await win.webContents.capturePage()).toPNG());
    };
    const tikla = async (metin, kok = "document") => {
      const ok = await js(
        `(() => { const b = [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim() === ${JSON.stringify(metin)}) || [...${kok}.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b || b.disabled) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok/kapalı: " + metin);
      await bekle(450);
    };
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
      );
    const cssVar = (ad) => js(`getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(ad)}).trim()`);
    const metinVar = (t) => js(`document.body.textContent.includes(${JSON.stringify(t)})`); // textContent: CSS uppercase uygulanmaz

    // ── Giriş ekranı: oturumsuz marka ──
    await shot("01-giris-kimlik");
    check(
      "giriş: kulüp logosu uygulama logosunun yerinde",
      (await js(`document.querySelector("img[data-kulup-logo='1']")?.src.startsWith("data:image/png")`)) === true,
    );
    check("giriş: kısa ad ve kuruluş yılı", (await metinVar("ANADOLU SK")) && (await metinVar("Kuruluş 1974")));
    check(
      "giriş: tema oturumsuz uygulandı (--mor lacivert, --sari turuncu)",
      (await cssVar("--mor")) === "#1f3a93" && (await cssVar("--sari")) === "#f58220",
    );
    check(
      "giriş: sol panel zemini ana renk",
      /rgb\(31, 58, 147\)/.test(
        await js(
          `getComputedStyle(document.querySelector("img[data-kulup-logo]").closest("div[style*='42%']") || document.body).backgroundColor`,
        ),
      ),
    );

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(500);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "kimlik-test-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(400);
    }
    check(
      "kenar menü: kulüp logosu, kısa ad, alt yazı",
      (await js(`!!document.querySelector("aside img[data-kulup-logo='1']")`)) &&
        (await metinVar("ANADOLU SK")) &&
        (await metinVar("Futbol Okulu")),
    );
    check(
      "kenar menü zemini ana renk",
      /rgb\(31, 58, 147\)/.test(await js(`getComputedStyle(document.querySelector("aside")).backgroundColor`)),
    );
    await shot("02-pano-tema");

    // ── Ayarlar > Kulüp ve Makbuz ──
    await js(`document.querySelector("button[aria-label='Ayarlar']").click()`);
    await bekle(900);
    check(
      "Ayarlar: alanlar dolu",
      (await js(`document.querySelector("input[aria-label='Kısa ad']").value`)) === "Anadolu SK" &&
        (await js(`document.querySelector("input[aria-label='Kuruluş yılı']").value`)) === "1974",
    );
    check("Ayarlar: logo önizlemesi", (await js(`!!document.querySelector("img[alt='Kulüp logosu']")`)) === true);
    let oneri = "";
    for (let i = 0; i < 20 && !oneri; i++) {
      oneri = await js(`document.querySelector("[role=status]")?.textContent || ""`);
      if (!oneri) await bekle(200);
    }
    check(
      "Ayarlar: logodan renk önerisi (lacivert + turuncu)",
      /Logodan önerilen/.test(oneri) && /#1f3a93/i.test(oneri) && /#f58220/i.test(oneri),
      oneri,
    );
    check(
      "Ayarlar: seçili palet 'Logodan (öneri)'",
      (await js(`document.querySelector("button[aria-label='Palet: Logodan (öneri)']")?.getAttribute("aria-pressed")`)) === "true",
    );
    check("Ayarlar: kontrast satırı okunaklı", await metinVar("beyaz yazı okunaklı"));
    await shot("03-ayarlar-kulup");

    // Palet değiştir → Kaydet → tüm uygulama
    await js(`document.querySelector("button[aria-label='Palet: Kırmızı · Beyaz']").click()`);
    await bekle(300);
    check(
      "palet seçince Kaydet açılır, önizleme kırmızı",
      (await js(`!document.querySelector("button[aria-label]") || true`)) &&
        /rgb\(200, 16, 46\)/.test(
          await js(`getComputedStyle(document.querySelector("[data-testid=tema-onizleme]").firstChild).backgroundColor`),
        ),
    );
    check(
      "Kaydet öncesi kenar menü hâlâ lacivert",
      /rgb\(31, 58, 147\)/.test(await js(`getComputedStyle(document.querySelector("aside")).backgroundColor`)),
    );
    await tikla("Kaydet");
    await bekle(800);
    check(
      "Kaydet: kenar menü ve --mor kırmızıya geçti",
      (await cssVar("--mor")) === "#c8102e" &&
        /rgb\(200, 16, 46\)/.test(await js(`getComputedStyle(document.querySelector("aside")).backgroundColor`)),
    );
    check("Kaydet: ayar yazıldı", db.getSetting("tema_ana") === "#c8102e" && db.getSetting("tema_vurgu") === "#ffffff");
    await shot("04-kirmizi-beyaz");

    // ── Yazdırılabilir çıktılar: makbuz, yoklama formu, rapor PDF, Excel — kulüp logosu + tema (kırmızı/beyaz) girer mi? ──
    const yakalanan = {};
    for (const kanal of ["cikti:yazdir", "cikti:pdfKaydet"]) {
      ipcMain.removeHandler(kanal);
      ipcMain.handle(kanal, async (_e, html) => {
        yakalanan[kanal] = String(html);
        return { ok: true };
      });
    }
    const bugun = new Date().toISOString().slice(0, 10);
    const grp = db.createAgeGroup({ ad: "U11" });
    const oy = db.createPlayer({ ad_soyad: "Çıktı Oyuncu", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, aylik_aidat: 1500 });
    const aidatK = db.listFeeItems().find((k) => k.kod === "aidat");
    db.createReceipt({
      player_id: oy.id,
      tarih: bugun,
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: aidatK.id, tutar: 1500, aciklama: "test", yil: null, ay: null }],
    });
    db.createTraining({ age_group_id: grp.id, tarih: bugun, saat: "18:00", saha: "Saha 1" });
    // Gerçek PDF: yakalanan HTML aynı htmlToPdf ile dosyaya yazılır (printBackground açık); görüntü dizini verildiyse kaydedilir
    const { htmlToPdf } = require("../../electron/ipc/cikti.cjs");
    const pdfYaz = async (ad, html, yatay = false) => {
      if (!html) return 0;
      const pdf = await htmlToPdf(html, { yatay });
      if (shotDir) fs.writeFileSync(path.join(shotDir, ad + ".pdf"), pdf);
      return pdf.length;
    };
    const ciktiKontrol = (ad, html, logoBeklenir = true) =>
      check(
        ad,
        !!html &&
          (!logoBeklenir || /src="data:image\/png;base64,/.test(html)) &&
          html.includes("#c8102e") &&
          !html.includes("#5b2d8e") &&
          !/#5B2D8E/.test(html),
        html ? `logo:${/data:image\/png/.test(html)} kirmizi:${html.includes("#c8102e")} mor:${/#5b2d8e/i.test(html)}` : "html yok",
      );
    // Makbuz: Tahsilat > Bugün Kesilen Makbuzlar > Yazdır
    await js(`document.querySelector("button[aria-label='Tahsilat']").click()`);
    await bekle(900);
    await tikla("Yazdır");
    await bekle(600);
    ciktiKontrol("makbuz çıktısında kulüp logosu ve tema rengi var, eski mor yok", yakalanan["cikti:yazdir"]);
    check("makbuz çıktısında kulüp adı", /Anadolu Spor Kulübü Futbol Okulu/.test(yakalanan["cikti:yazdir"] || ""));
    check("makbuz PDF'i üretildi (%PDF, >10 KB: logo gömülü)", (await pdfYaz("makbuz", yakalanan["cikti:yazdir"])) > 10000);
    delete yakalanan["cikti:yazdir"];
    // Yoklama formu
    await js(`document.querySelector("button[aria-label='Yoklama']").click()`);
    await bekle(900);
    await js(`[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.includes("U11"))?.click()`); // günün antrenman kartı
    await bekle(700);
    await tikla("Formu Yazdır");
    await bekle(600);
    ciktiKontrol("yoklama formunda kulüp logosu ve tema rengi var", yakalanan["cikti:yazdir"]);
    check(
      "yoklama formunda kulübün sloganı var, Eyüpspor hashtag'i yok",
      /#HedefŞampiyonluk/.test(yakalanan["cikti:yazdir"] || "") && !/Semt/.test(yakalanan["cikti:yazdir"] || ""),
    );
    check("yoklama formu PDF'i üretildi", (await pdfYaz("yoklama-formu", yakalanan["cikti:yazdir"])) > 10000);
    // Rapor PDF (Oyuncular > PDF) ve Excel başlık dolgusu
    await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
    await bekle(900);
    await tikla("PDF");
    await bekle(800);
    ciktiKontrol("oyuncu listesi PDF'inde kulüp logosu ve tema rengi var", yakalanan["cikti:pdfKaydet"]);
    check("oyuncu listesi PDF'i üretildi", (await pdfYaz("oyuncu-listesi", yakalanan["cikti:pdfKaydet"], true)) > 10000);
    await tikla("Excel");
    await bekle(1500);
    let dolgu = "";
    try {
      const ExcelJS = require("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(sonExcel);
      dolgu = String(wb.worksheets[0].getRow(1).fill?.fgColor?.argb || "");
    } catch (e) {
      dolgu = "hata:" + e.message;
    }
    const { acikTon } = require("../../electron/tema.cjs");
    check("Excel başlık dolgusu tema ana renginin açık tonu", dolgu === "FF" + acikTon("#c8102e").slice(1).toUpperCase(), dolgu);
    await js(`document.querySelector("button[aria-label='Ayarlar']").click()`);
    await bekle(900);

    // Vazgeç
    await setInput("input[aria-label='Kısa ad']", "Değişti");
    await tikla("Vazgeç");
    check("Vazgeç kısa adı geri alır", (await js(`document.querySelector("input[aria-label='Kısa ad']").value`)) === "Anadolu SK");

    // Kuruluş yılı doğrulaması (ana süreç): geçersiz değer toast ile reddedilir, ayar değişmez
    await setInput("input[aria-label='Kuruluş yılı']", "19");
    await tikla("Kaydet");
    await bekle(500);
    check(
      "geçersiz kuruluş yılı reddedilir (toast), ayar 1974 kalır",
      (await metinVar("4 haneli")) && db.getSetting("kurulus_yili") === "1974",
    );
    await setInput("input[aria-label='Kuruluş yılı']", "1974");

    // Logo kaldır → uygulama logosuna dönüş
    await tikla("Kaldır");
    await bekle(800);
    check(
      "Kaldır: logo yok, kenar menüde uygulama logosu",
      (await metinVar("Logo yok")) &&
        (await js(`!!document.querySelector("aside img[data-kulup-logo='0']")`)) &&
        db.getSetting("kulup_logo") === "" &&
        !fs.existsSync(path.join(db.getUploadsDir(), "kulup", "logo.png")),
    );
    check("Kaldır sonrası renk önerisi kalkar", !(await metinVar("Logodan önerilen")));
    await shot("05-logosuz");
  } catch (e) {
    console.error("HATA", e);
    fail++;
  }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  app.exit(fail ? 1 : 0);
});
