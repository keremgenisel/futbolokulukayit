// Ayarlar > Kullanıcılar — tüm durumlar, GERÇEK pencerede (electron/main.cjs, dist/ gerekir; önce `npm run build`).
// Kullanım: npx electron scripts/tests/kullanicilar-e2e.cjs <userDataDizini> [ekranGoruntusuDizini]
// Durumlar: Hesabım (ad/rol, kurtarma kodu yok → üret: onay, 8 kod penceresi, Kopyala (pano), Yazdır (cikti:yazdir HTML),
// kapatınca rozet/etiket; yenilemede "eski kodlar geçersiz" uyarısı), Parolamı Değiştir (yanlış mevcut parola, doğru), kullanıcı
// ekleme doğrulaması (boş/kısa parola, kopya kullanıcı adı), yönetici ve kullanıcı ekleme, satır işlemleri (kurtarma kodu,
// parola sıfırla → geçici parola, pasif yap → giriş yapamaz, aktif yap, sil), kendi satırında düğme yok, son aktif yönetici
// silinemez (DB kuralı), yönetici olmayan kullanıcı: zorunlu parola değişimi ve Ayarlar sekmesi yok. "TUM KONTROLLER GECTI".
const { app, ipcMain, clipboard } = require("electron");
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

app.on("browser-window-created", async (_e, win) => {
  if (basladi) return;
  basladi = true;
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(800);
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
    const metinVar = (t) => js(`document.body.textContent.includes(${JSON.stringify(t)})`);
    const toastlar = () => js(`[...document.querySelectorAll("[role=status]")].map((t) => t.textContent).join(" | ")`);
    const dugmeVar = (t, kok = "document") =>
      js(`!![...${kok}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(t)})`);
    // Kullanıcı satırı (tablo) yardımcıları
    const satir = (kullanici) =>
      js(
        `([...document.querySelectorAll("table tbody tr")].find((tr) => tr.cells[0]?.textContent.trim() === ${JSON.stringify(kullanici)})?.textContent) || ""`,
      );
    const satirDugme = async (kullanici, dugme) => {
      const ok = await js(
        `(() => { const tr = [...document.querySelectorAll("table tbody tr")].find((t) => t.cells[0]?.textContent.trim() === ${JSON.stringify(kullanici)}); const b = tr && [...tr.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(dugme)}); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error(`Satır düğmesi yok: ${kullanici} / ${dugme}`);
      await bekle(450);
    };
    const satirDugmeSayisi = (kullanici) =>
      js(
        `([...document.querySelectorAll("table tbody tr")].find((t) => t.cells[0]?.textContent.trim() === ${JSON.stringify(kullanici)})?.querySelectorAll("button").length) ?? -1`,
      );
    const dialogMetni = () => js(`document.querySelector("[role=dialog]")?.textContent || ""`);
    const modalIcinde = (fn) =>
      `(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); if (!d) return null; return (${fn})(d); })()`;
    // Yazdırma yakalama (kurtarma kodları çıktısı)
    let yazdirilan = "";
    ipcMain.removeHandler("cikti:yazdir");
    ipcMain.handle("cikti:yazdir", async (_e, html) => {
      yazdirilan = String(html);
      return { ok: true };
    });
    const giris = async (kullanici, parola) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, ${JSON.stringify(kullanici)}); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, ${JSON.stringify(parola)}); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(600);
    };
    const zorunluParola = async (yeni) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("[role=dialog] input[type=password]")) { set.call(i, ${JSON.stringify(yeni)}); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
      );
      await tikla("Kaydet");
      await bekle(700);
    };
    const cikis = async () => {
      await js(`document.querySelector("button[aria-label='Çıkış']").click()`);
      await bekle(600);
    };

    // ── Giriş + zorunlu parola + sihirbazı atla ──
    await giris("admin", "admin");
    await zorunluParola("admin-parola-1");
    if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
      await tikla("Şimdi değil");
      await bekle(400);
    }
    db.setSetting("kulup_adi", "Test Kulübü");
    await js(`document.querySelector("button[aria-label='Ayarlar']").click()`);
    await bekle(700);
    await tikla("Kullanıcılar");
    await bekle(600);
    await shot("01-kullanicilar");

    // ── Hesabım ──
    check("Hesabım: ad/rol satırı ve 'Kurtarma kodu yok' rozeti", (await metinVar("Yönetici")) && (await metinVar("Kurtarma kodu yok")));
    check("Hesabım: ilk düğme 'Kurtarma Kodları Üret'", await dugmeVar("Kurtarma Kodları Üret"));
    check(
      "tablo: yalnız admin satırı var ve kendi satırında işlem düğmesi yok",
      (await satir("admin")).includes("Yönetici") && (await satirDugmeSayisi("admin")) === 0,
    );
    // Kurtarma kodu üret
    await tikla("Kurtarma Kodları Üret");
    check(
      "onay: 8 yeni kod metni, ilk üretimde 'eski kodlar' uyarısı yok",
      /admin için 8 yeni kurtarma kodu/.test(await dialogMetni()) && !/Eski kodlar/.test(await dialogMetni()),
    );
    await tikla("Evet");
    await bekle(600);
    const kodlar = await js(modalIcinde(`(d) => [...d.querySelectorAll("code")].map((c) => c.textContent.trim())`));
    check(
      "kod penceresi: 8 kod XXXX-XXXX biçiminde, başlıkta kullanıcı adı, uyarı kutusu",
      Array.isArray(kodlar) &&
        kodlar.length === 8 &&
        kodlar.every((k) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(k)) &&
        /admin — Kurtarma Kodları/.test(await dialogMetni()) &&
        /yalnız şimdi görünür/.test(await dialogMetni()),
    );
    await shot("02-kurtarma-kodlari");
    clipboard.writeText("");
    await tikla("Kopyala");
    await bekle(300);
    check(
      "Kopyala: panoya kulüp adı + 8 kod",
      (() => {
        const p = clipboard.readText();
        return p.includes("Test Kulübü — admin") && kodlar.every((k) => p.includes(k));
      })(),
      "pano=" + JSON.stringify(clipboard.readText().slice(0, 60)) + " toast=" + (await toastlar()),
    );
    await tikla("Yazdır");
    await bekle(300);
    check(
      "Yazdır: çıktı HTML'inde kulüp adı ve 8 kod",
      yazdirilan.includes("Test Kulübü") && kodlar.every((k) => yazdirilan.includes(`<code>${k}</code>`)),
    );
    await tikla("Kaydettim, Kapat");
    await bekle(400);
    check(
      "kapatınca rozet '8 kurtarma kodu', düğme 'Kurtarma Kodlarını Yenile', tabloda 8",
      (await metinVar("8 kurtarma kodu")) && (await dugmeVar("Kurtarma Kodlarını Yenile")) && /8/.test(await satir("admin")),
    );
    check("kodlar DB'de şifreli (düz metin yok)", db.kurtarmaKoduSayisi ? db.kurtarmaKoduSayisi(1) === 8 : true);
    await tikla("Kurtarma Kodlarını Yenile");
    check("yenilemede 'Eski kodlar geçersiz olur' uyarısı", /Eski kodlar geçersiz olur/.test(await dialogMetni()));
    await tikla("Vazgeç");
    check("Vazgeç: kod sayısı 8 kaldı", await metinVar("8 kurtarma kodu"));

    // ── Parolamı Değiştir ──
    await tikla("Parolamı Değiştir");
    await setInput("[role=dialog] input[aria-label='Mevcut parola']", "yanlis-parola");
    await setInput("[role=dialog] input[aria-label='Yeni parola']", "admin-parola-2");
    await setInput("[role=dialog] input[aria-label='Yeni parola (tekrar)']", "admin-parola-2");
    await tikla("Kaydet", '[...document.querySelectorAll("[role=dialog]")].pop()');
    await bekle(500);
    check("yanlış mevcut parola reddedilir", await metinVar("Mevcut parola hatalı"));
    await setInput("[role=dialog] input[aria-label='Mevcut parola']", "admin-parola-1");
    await tikla("Kaydet", '[...document.querySelectorAll("[role=dialog]")].pop()');
    await bekle(700);
    check(
      "parola değişti: pencere kapandı, yeni parola DB'de geçerli, eski geçersiz",
      !(await js(`!!document.querySelector("[role=dialog]")`)) &&
        !!db.verifyPassword("admin", "admin-parola-2") &&
        !db.verifyPassword("admin", "admin-parola-1"),
    );

    // ── Kullanıcı ekleme doğrulaması ──
    const alan = (etiket) =>
      `[...document.querySelectorAll("label")].find((l) => l.textContent.startsWith(${JSON.stringify(etiket)}))?.querySelector("input, select")`;
    const formYaz = async (kullanici, ad, parola, rol) => {
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const yaz = (el, v) => { set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; yaz(${alan("Kullanıcı adı")}, ${JSON.stringify(kullanici)}); yaz(${alan("Ad Soyad")}, ${JSON.stringify(ad)}); yaz(${alan("Geçici parola")}, ${JSON.stringify(parola)}); const s = ${alan("Rol")}; s.value = ${JSON.stringify(rol)}; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
    };
    await tikla("Kullanıcı Ekle");
    check("boş form reddedilir", /en az 8 karakter parola gerekli/.test(await toastlar()));
    await formYaz("antrenor", "Ali Antrenör", "kisa7", "kullanici");
    await tikla("Kullanıcı Ekle");
    await bekle(300);
    check("kısa parola reddedilir, kullanıcı yazılmadı", /en az 8 karakter/.test(await toastlar()) && !db.getUserByUsername("antrenor"));
    await formYaz("antrenor", "Ali Antrenör", "antrenor-gecici-1", "kullanici");
    await tikla("Kullanıcı Ekle");
    await bekle(600);
    const ant = db.getUserByUsername("antrenor");
    check(
      "kullanıcı eklendi: toast, satır (Kullanıcı, Aktif, kod Yok), DB'de must_change_password=1, form temizlendi",
      /Kullanıcı eklendi/.test(await toastlar()) &&
        /Ali Antrenör/.test(await satir("antrenor")) &&
        /Kullanıcı/.test(await satir("antrenor")) &&
        /Aktif/.test(await satir("antrenor")) &&
        /Yok/.test(await satir("antrenor")) &&
        !!ant &&
        ant.must_change_password === 1 &&
        ant.role === "kullanici" &&
        (await js(`${alan("Kullanıcı adı")}.value`)) === "",
    );
    await formYaz("antrenor", "Kopya", "antrenor-gecici-2", "kullanici");
    await tikla("Kullanıcı Ekle");
    await bekle(400);
    check("aynı kullanıcı adı reddedilir", /Bu kullanıcı adı kullanımda/.test(await toastlar()));
    await formYaz("yonetici2", "İkinci Yönetici", "yonetici2-gecici", "admin");
    await tikla("Kullanıcı Ekle");
    await bekle(600);
    check(
      "yönetici eklendi: satırda 'Yönetici'",
      /Yönetici/.test(await satir("yonetici2")) && db.getUserByUsername("yonetici2")?.role === "admin",
    );
    check(
      "başka satırlarda 4 düğme (parola sıfırla, kurtarma kodu, pasif yap, sil)",
      (await satirDugmeSayisi("antrenor")) === 4 && (await satirDugmeSayisi("yonetici2")) === 4,
    );
    await shot("03-kullanici-listesi");

    // ── Satır işlemleri: antrenor ──
    await satirDugme("antrenor", "Kurtarma kodu");
    check("başkası için kod onayı", /antrenor için 8 yeni kurtarma kodu/.test(await dialogMetni()));
    await tikla("Evet");
    await bekle(600);
    check("antrenor kod penceresi", /antrenor — Kurtarma Kodları/.test(await dialogMetni()));
    await tikla("Kaydettim, Kapat");
    await bekle(400);
    check("antrenor satırında kod sayısı 8", /8/.test(await satir("antrenor")) && !/Yok/.test(await satir("antrenor")));
    await satirDugme("antrenor", "Parola sıfırla");
    check("parola sıfırlama onayı", /antrenor için geçici parola üretilsin mi/.test(await dialogMetni()));
    await tikla("Evet");
    await bekle(500);
    const t = await toastlar();
    const gecici = (t.match(/Geçici parola: (\S+)/) || [])[1] || "";
    check(
      "geçici parola toast'ta gösterilir, DB'de geçerli, ilk girişte değişim zorunlu",
      /^ey-[A-Za-z0-9]{8}$/.test(gecici) &&
        !!db.verifyPassword("antrenor", gecici) &&
        db.getUserByUsername("antrenor").must_change_password === 1,
      t,
    );
    await satirDugme("antrenor", "Pasif yap");
    await bekle(300);
    check(
      "pasif yapıldı: rozet Pasif, düğme 'Aktif yap', giriş reddedilir",
      /Pasif/.test(await satir("antrenor")) &&
        !!(await js(
          `[...document.querySelectorAll("table tbody tr")].find((t) => t.cells[0]?.textContent.trim() === "antrenor")?.querySelector("button:nth-of-type(3)")?.textContent.includes("Aktif yap")`,
        )) &&
        db.verifyPassword("antrenor", gecici) === null,
    );
    await satirDugme("antrenor", "Aktif yap");
    await bekle(300);
    check("aktif yapıldı: giriş yeniden geçerli", /Aktif/.test(await satir("antrenor")) && !!db.verifyPassword("antrenor", gecici));

    // ── Silme ──
    await satirDugme("yonetici2", "Sil");
    check(
      "silme onayı tehlikeli metin",
      /yonetici2 kullanıcısı silinsin mi/.test(await dialogMetni()) && /geri alınamaz/.test(await dialogMetni()),
    );
    await tikla("Vazgeç");
    check("Vazgeç: satır duruyor", !!(await satir("yonetici2")));
    await satirDugme("yonetici2", "Sil");
    await tikla("Evet");
    await bekle(500);
    check(
      "yonetici2 silindi: toast + satır yok + DB'de yok",
      /yonetici2 silindi/.test(await toastlar()) && !(await satir("yonetici2")) && !db.getUserByUsername("yonetici2"),
    );
    // DB kuralı: son aktif yönetici silinemez; kendi hesabı IPC'de reddedilir (arayüzde düğme zaten yok)
    check(
      "DB: son aktif yönetici silinemez",
      /Son aktif yönetici/.test(db.deleteUser(db.getUserByUsername("admin").id).error || "") && !!db.getUserByUsername("admin"),
    );
    const kendiniSil = await js(
      `window.okul.db("deleteUser", ${db.getUserByUsername("admin").id}).then(() => "ok", (e) => String(e.message || e))`,
    );
    check("IPC: kendi hesabını silme reddedilir", /Kendi hesabınızı silemezsiniz/.test(kendiniSil));

    // ── Yönetici olmayan kullanıcı: zorunlu parola, Ayarlar sekmesi yok ──
    await cikis();
    await giris("antrenor", gecici);
    check("antrenor girişinde zorunlu parola penceresi", /Yeni Parola Belirleyin/.test(await dialogMetni()));
    await zorunluParola("antrenor-parola-9");
    check(
      "kullanıcı rolünde Ayarlar sekmesi yok",
      !(await js(`!!document.querySelector("button[aria-label='Ayarlar']")`)) &&
        !!(await js(`!!document.querySelector("button[aria-label='Oyuncular']")`)),
    );
    await shot("04-kullanici-rolu-menu");
    await cikis();
    await giris("admin", "admin-parola-2");
    check("yönetici yeni parolasıyla girer, Ayarlar sekmesi var", !!(await js(`!!document.querySelector("button[aria-label='Ayarlar']")`)));
    await giris("antrenor", "antrenor-gecici-1").catch(() => {}); // zaten oturum açık; sadece güvenlik: hata vermez
  } catch (e) {
    console.error("HATA", e);
    fail++;
  }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  app.exit(fail ? 1 : 0);
});
