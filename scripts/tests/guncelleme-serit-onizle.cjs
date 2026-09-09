// Güncelleme şeridi önizlemesi: GERÇEK main.cjs ile açılır, giriş yapılır, ana süreçten updater:* olayları elle gönderilir ve her durumun
// ekran görüntüsü alınır (hazır / indiriliyor / indirildi / hata). Geliştirme modunda gerçek güncelleyici çalışmadığı için şeridi
// görmenin tek yolu budur. Ayrıca şeridin kenar menüyü etkilemediği ve başlığın üstünde durduğu doğrulanır.
// Kullanım: npm run build && npx electron scripts/tests/guncelleme-serit-onizle.cjs <çıktı dizini>
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const [cikti] = process.argv.slice(2);
if (!cikti) {
  console.error("Kullanım: electron scripts/tests/guncelleme-serit-onizle.cjs <çıktı dizini>");
  process.exit(2);
}
fs.mkdirSync(cikti, { recursive: true });
const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-serit-onizle-"));
app.setPath("userData", dizin);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
require("../../electron/main.cjs");

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const tikla = async (m) => {
      await js(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(${JSON.stringify(m)}))?.click()`);
      await bekle(400);
    };
    const foto = async (ad) => fs.writeFileSync(path.join(cikti, ad), (await win.webContents.capturePage()).toPNG());
    const serit = () =>
      js(
        `(() => { const s = document.querySelector("[data-testid='guncelleme-seridi']"); if (!s) return null; const m = document.querySelector("main"), a = document.querySelector("aside"), h = document.querySelector("main header"); const r = s.getBoundingClientRect(); return { metin: s.textContent, ust: r.top, mainUst: m.getBoundingClientRect().top, basligiOnceler: r.bottom <= h.getBoundingClientRect().top, kenarYukseklik: a.getBoundingClientRect().height, pencere: window.innerHeight }; })()`,
      );

    // Giriş + zorunlu parola değişimi + kurulum sihirbazını atla
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await tikla("Giriş Yap");
    await bekle(600);
    await js(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "serit-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
    );
    await tikla("Kaydet");
    await bekle(700);
    await tikla("Şimdi değil");
    await bekle(2500); // giriş bildirimleri (toast) kaybolsun

    check("şerit yeni sürüm gelmeden çizilmez", (await serit()) === null);
    win.webContents.send("updater:available", { version: "1.3.0" });
    await bekle(400);
    let s = await serit();
    check(
      "hazır: şerit main'in en üstünde, başlığın üzerinde; kenar menü tam pencere yüksekliğinde",
      s && s.metin.includes("Yeni sürüm 1.3.0 hazır") && s.ust === s.mainUst && s.basligiOnceler && s.kenarYukseklik === s.pencere,
      JSON.stringify(s),
    );
    await foto("1-hazir.png");
    win.webContents.send("updater:progress", 40);
    await bekle(300);
    s = await serit();
    check("indiriliyor: %40", s && s.metin.includes("indiriliyor") && s.metin.includes("%40"), s && s.metin);
    await foto("2-indiriliyor.png");
    win.webContents.send("updater:downloaded", { version: "1.3.0" });
    await bekle(300);
    await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
    await bekle(600);
    s = await serit();
    check(
      "indirildi: sekme değişse de şerit yerinde, 'Yeniden Başlat ve Kur'",
      s && s.metin.includes("Yeniden Başlat ve Kur") && s.ust === s.mainUst,
      s && s.metin,
    );
    await foto("3-indirildi-oyuncular.png");
    win.webContents.send("updater:error", "Sunucuya ulaşılamadı");
    await bekle(300);
    s = await serit();
    check("hata: metin ve 'Yeniden Dene'", s && s.metin.includes("Sunucuya ulaşılamadı") && s.metin.includes("Yeniden Dene"), s && s.metin);
    await foto("4-hata.png");
    await js(`document.querySelector("button[aria-label='Güncelleme şeridini kapat']").click()`);
    await bekle(300);
    check("Kapat şeridi gizler", (await serit()) === null);

    console.log(`Görüntüler: ${cikti}`);
    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
