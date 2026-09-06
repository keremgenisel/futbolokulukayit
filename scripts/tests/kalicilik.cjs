// Kalıcılık testi: GERÇEK electron/main.cjs ile aynı userData'da iki oturum.
//   1. koşum ("yaz"): arayüzden giriş + parola değişimi + ayar + yaş grubu + oyuncu + makbuz + yoklama,
//      sonra pencere KAPATILIR (window-all-closed → db.close → quit) — kullanıcı akışının aynısı.
//   2. koşum ("oku"): uygulama yeniden açılır, DB'den ve arayüzden veriler okunur.
// Kullanım: electron scripts/tests/kalicilik.cjs <userDataDizini> yaz|oku
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const [dizin, adim] = process.argv.slice(2);
app.setPath("userData", dizin);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ad, k) => { console.log(`${k ? "PASS" : "FAIL"} ${ad}`); if (!k) fail++; };

// main.cjs kendi whenReady'sini kurar; biz de pencere açılınca devreye gireriz.
require("../../electron/main.cjs");

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const setInput = (sel, val) => js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    const tikla = async (metin) => { const ok = await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`); if (!ok) throw new Error("Düğme yok: " + metin); await bekle(500); };
    const db = require("../../electron/db.cjs");

    if (adim === "yaz") {
      const inputs = await js(`document.querySelectorAll("input").length`);
      check("giriş ekranı açıldı", inputs >= 2);
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await tikla("Giriş Yap"); await bekle(500);
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "kalici-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`);
      await tikla("Kaydet"); await bekle(500);
      // Yaş grubu
      await tikla("Yaş Grupları"); await bekle(400);
      await setInput('input[placeholder="U11"]', "U13"); await setInput('input[placeholder="2026-2027"]', "2026-2027");
      await tikla("Grup Ekle"); await bekle(400);
      // Oyuncu (form)
      await tikla("Oyuncular"); await bekle(400); await tikla("Yeni Oyuncu"); await bekle(400);
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const dlg = document.querySelector("[role=dialog]"); const ins = dlg.querySelectorAll("input"); set.call(ins[1], "Kalıcı Oyuncu"); ins[1].dispatchEvent(new Event("input", { bubbles: true })); set.call(ins[2], "2013-05-05"); ins[2].dispatchEvent(new Event("input", { bubbles: true })); const sel = [...dlg.querySelectorAll("label")].find(l => l.textContent.startsWith("Yaş Grubu")).querySelector("select"); sel.value = sel.options[1].value; sel.dispatchEvent(new Event("change", { bubbles: true })); })()`);
      await tikla("Oyuncuyu Kaydet"); await bekle(800);
      // Ayar
      await js(`document.querySelector("[role=dialog] button[aria-label=Kapat]")?.click()`); await bekle(300);
      await tikla("Ayarlar"); await bekle(400);
      await setInput('input[placeholder="EYÜPSPOR FUTBOL OKULU"]', "TEST KULÜBÜ"); await tikla("Kaydet"); await bekle(400);
      // DB'den doğrudan makbuz + yoklama (arayüz yoluyla zaten duman testinde doğrulanıyor)
      const o = db.listPlayers()[0];
      const t = new Date(); db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
      const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
      const m = db.createReceipt({ player_id: o.id, tarih: "2026-09-06", odeme_yontemi: "havale", tahsil_eden: "T", satirlar: [{ fee_item_id: aidat.id, tutar: 1234, yil: t.getFullYear(), ay: t.getMonth() + 1 }] });
      const tr = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-06", saat: "10:00" });
      db.setAttendance(tr.id, o.id, "izinli");
      fs.writeFileSync(path.join(dizin, "beklenen.json"), JSON.stringify({ oyuncu: o.ad_soyad, makbuz: m.makbuz_no }));
      console.log("YAZ TAMAM");
      if (process.env.KABA_KAPANIS) { process.kill(process.pid, "SIGKILL"); } // elektrik kesintisi / görev yöneticisi
      win.close(); // gerçek kapanış yolu: window-all-closed → server.durdur → db.close → app.quit
      return;
    }

    if (adim === "oku") {
      const b = JSON.parse(fs.readFileSync(path.join(dizin, "beklenen.json"), "utf8"));
      // Parola değişti mi? (eski admin/admin ile giriş başarısız, yenisiyle başarılı)
      check("eski parola artık geçersiz", !db.verifyPassword("admin", "admin"));
      check("yeni parola geçerli, parola değişimi işareti kalktı", !!db.verifyPassword("admin", "kalici-parola-1") && !db.getUserByUsername("admin").must_change_password);
      check("yaş grubu kalıcı", db.listAgeGroups().some((g) => g.ad === "U13"));
      const o = db.listPlayers().find((p) => p.ad_soyad === b.oyuncu);
      check("oyuncu kalıcı (grup dahil)", !!o && !!o.yas_grubu_id);
      check("ayar kalıcı", db.getSetting("kulup_adi") === "TEST KULÜBÜ");
      check("makbuz ve aidat kalıcı", db.listReceipts(o.id)[0]?.makbuz_no === b.makbuz && db.listDues(o.id)[0]?.durum === "odendi");
      check("yoklama kalıcı", db.playerAttendance(o.id, "2026-01-01", "2026-12-31")[0]?.durum === "izinli");
      check("lisans makine kimliği kalıcı", !!db.lisansDurumu().makineId && db.getMetaValue("kurulumTarihi") !== null);
      // Arayüz: giriş ekranı yeni parolayla açılıyor ve oyuncu listede
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "kalici-parola-1"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await tikla("Giriş Yap"); await bekle(600);
      check("yeniden açılışta parola değişimi istenmiyor", !(await js(`!!document.querySelector("[role=dialog]")`)));
      await tikla("Oyuncular"); await bekle(600);
      check("oyuncu arayüzde görünüyor", await js(`document.body.textContent.includes(${JSON.stringify(b.oyuncu)})`));
      if (fail === 0) console.log("TUM KONTROLLER GECTI");
      app.exit(fail === 0 ? 0 : 1);
    }
  } catch (e) { console.error("HATA:", e && e.stack); app.exit(1); }
});
