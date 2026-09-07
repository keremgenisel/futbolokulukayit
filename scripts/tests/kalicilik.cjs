// Kalıcılık testi: GERÇEK electron/main.cjs ile aynı userData'da iki oturum.
//   1. koşum ("yaz"): arayüzden giriş + parola değişimi + ayar + yaş grubu + oyuncu + makbuz + yoklama,
//      sonra pencere KAPATILIR (window-all-closed → db.close → quit) — kullanıcı akışının aynısı.
//   2. koşum ("oku"): uygulama yeniden açılır, DB'den ve arayüzden veriler okunur.
// Kullanım: electron scripts/tests/kalicilik.cjs <userDataDizini> yaz|oku
const { app } = require("electron");
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
      await tikla("Kaydet"); await bekle(700);
      // İlk kurulum sihirbazı (oyuncu yok) → bu testte atla; kurulum akışı kendi testinde
      if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) { await tikla("Şimdi değil"); await bekle(300); }
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
      // Aidat Kalemleri: iki satıra binlik ayraçlı fiyat + indirim, tek Kaydet (07.09.2026 akışı)
      await tikla("Aidat Kalemleri"); await bekle(500);
      await setInput("input[aria-label='Forma fiyatı']", "9000"); await setInput("input[aria-label='Mont fiyatı']", "8000");
      await setInput("input[aria-label='İndirimli indirimi']", "25");
      // Arayüzden yeni kalem + yeni ücret tipi + tip adı düzenleme + Yağmurluk silme (07.09.2026 akşam akışı), tek Kaydet
      await setInput("input[aria-label='Yeni kalem adı']", "Turnuva Katılımı"); await setInput("input[aria-label='Yeni kalem fiyatı']", "750"); await tikla("Kalem Ekle");
      await setInput("input[aria-label='Yeni ücret tipi adı']", "Üç Kardeş"); await setInput("input[aria-label='Yeni ücret tipi indirimi']", "40"); await tikla("Ücret Tipi Ekle");
      await setInput("input[aria-label='Burslu adı']", "Tam Burslu");
      await js(`[...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Yağmurluk sil")?.click()`); await bekle(200);
      await tikla("Kaydet"); await bekle(800);
      // WhatsApp şablonu arayüzden (Ayarlar > WhatsApp Mesajları, tek Kaydet)
      await tikla("WhatsApp Mesajları"); await bekle(400);
      if (await js(`!!document.querySelector("[role=dialog]")`)) { await js(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Evet")?.click()`); await bekle(400); }
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; const t = document.querySelector("textarea[aria-label='Aidat hatırlatma']"); set.call(t, "Kalıcı şablon {veli} {kalan}"); t.dispatchEvent(new Event("input", { bubbles: true })); })()`); await bekle(200);
      await tikla("Kaydet"); await bekle(600);
      check("WhatsApp şablonu arayüzden kaydedildi", db.getSetting("wa_sablon_aidat") === "Kalıcı şablon {veli} {kalan}");
      await tikla("Aidat Kalemleri"); await bekle(400);
      check("arayüzden kalem/tip ekleme-silme kaydedildi", db.listFeeItems().some((k) => k.kod === "turnuva_katilimi") && !db.listFeeItems().some((k) => k.kod === "yagmurluk") && db.listFeeTypes().some((t) => t.kod === "uc_kardes" && t.indirim === 40) && db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu");
      // DB'den doğrudan makbuz + yoklama (arayüz yoluyla zaten duman testinde doğrulanıyor)
      const o = db.listPlayers()[0];
      const t = new Date(); db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
      const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
      const m = db.createReceipt({ player_id: o.id, tarih: "2026-09-06", odeme_yontemi: "havale", tahsil_eden: "T", satirlar: [{ fee_item_id: aidat.id, tutar: 1234, yil: t.getFullYear(), ay: t.getMonth() + 1 }] });
      const tr = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-06", saat: "10:00" });
      db.setAttendance(tr.id, o.id, "izinli");
      // WhatsApp (plan §13): veli onayı kapatma, aidat hatırlatma kaydı, antrenman saat değişikliği + bildirim kaydı
      const waVeli = db.listGuardians(o.id)[0] || null;
      const waVeliId = waVeli ? waVeli.id : db.addGuardian(o.id, { tip: "anne", ad_soyad: "Kalıcı Veli", gsm: "0532 000 00 01", veli_mi: 1 });
      db.updateGuardian(waVeliId, { mesaj_onayi: 0 });
      db.mesajKaydet({ player_id: o.id, guardian_id: waVeliId, tur: "aidat", yil: t.getFullYear(), ay: t.getMonth() + 1, metin: "Kalıcı hatırlatma", kullanici: "admin" });
      const tr2 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-08", saat: "17:00", saha: "Saha 1" });
      db.updateTraining(tr2.id, { saat: "18:30" });
      db.mesajKaydet({ player_id: o.id, guardian_id: waVeliId, tur: "degisiklik", training_id: tr2.id, metin: "Saat değişti" });
      const tr3 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-09", saat: "17:00", saha: "Saha 1" });
      db.cancelTraining(tr3.id, "Yağmur"); db.grupBildirimKaydet(tr3.id, "Test Yönetici");
      // Son eklenen özellikler (07.09.2026): aidat taban fiyatı + indirim, yedek sıklığı, yabancı oyuncu,
      // ikinci kullanıcı + kurtarma kodları, belge kaydı (dosya + tekil vesikalık), kenar menü tercihi
      db.updateFeeItem(aidat.id, { varsayilan_fiyat: 4321 });
      db.aidatAyarlariKaydet({ indirimler: { kardes: 15 }, kalemler: [{ yeni: true, ad: "Kamp Ücreti", varsayilan_fiyat: 2500 }], ucretTipleri: [{ yeni: true, ad: "Şampiyon Bursu", indirim: 50 }] });
      db.setSetting("yedek_sikligi", "haftalik");
      const yab = db.createPlayer({ uyruk: "yabanci", pasaport_no: "K9876543", ad_soyad: "Kalıcı Yabancı", dogum_tarihi: "2014-01-01", yas_grubu_id: o.yas_grubu_id, durum: "aktif", ucret_tipi: "kardes", aylik_aidat: 3673, odeme_donemi: "1-10" });
      const hoca = db.createUser({ username: "hoca", password: "hoca-ilk-parola", ad_soyad: "Hoca", role: "kullanici" });
      const kk = db.kurtarmaKodlariUret(hoca.id);
      fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id), { recursive: true });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id, "1-foto-v1.png"), "eski");
      db.belgeEkle(o.id, { tip: "foto", dosya_yolu: `oyuncu-${o.id}/1-foto-v1.png`, orijinal_ad: "v1.png" });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id, "2-foto-v2.png"), "yeni");
      db.belgeEkle(o.id, { tip: "foto", dosya_yolu: `oyuncu-${o.id}/2-foto-v2.png`, orijinal_ad: "v2.png" });
      // 07.09.2026 öğleden sonra: kısmi ödeme, iptal nedeni, haftalık program + doldurma, Excel aktarımı, kurulum/sezon ayarları
      const t2 = new Date(); const y2 = t2.getFullYear(), a2 = t2.getMonth() + 1;
      const yabanciDue = db.getDue(yab.id, y2, a2);
      const kismi = db.createReceipt({ player_id: yab.id, tarih: t2.toISOString().slice(0, 10), odeme_yontemi: "nakit", tahsil_eden: "T", satirlar: [{ fee_item_id: aidat.id, tutar: 1000, aciklama: "kısmi", yil: y2, ay: a2 }] });
      const iptalli = db.createReceipt({ player_id: o.id, tarih: t2.toISOString().slice(0, 10), odeme_yontemi: "havale", tahsil_eden: "T", satirlar: [{ fee_item_id: aidat.id, tutar: 50, aciklama: "iptal edilecek", yil: null, ay: null }] });
      db.cancelReceipt(iptalli.id, "Yanlış oyuncu", "Test Yönetici");
      db.updateAgeGroup(o.yas_grubu_id, { program: [{ gun: 2, saat: "18:00", saha: "Saha 3" }] });
      const hd = db.haftayiProgramdanDoldur("2027-04-05");
      const { aktarUygula } = require("../../electron/ipc/aktar.cjs");
      aktarUygula([{ ad_soyad: "Aktarılan Kalıcı", dogum_tarihi: "2016-04-04", uyruk: "tc", tc_no: null, pasaport_no: null, durum: "aktif", ucret_tipi: "normal", odeme_donemi: "1-10", aylik_aidat: 0, yeni_grup: "U15", veli: { ad_soyad: "Aktarılan Veli", gsm: "05320000009" } }]);
      db.setSetting("kurulum_tamam", "1"); db.setSetting("aktif_sezon", "2026-2027");
      await js(`document.querySelector("button[aria-label='Menüyü daralt']").click()`); await bekle(300);
      fs.writeFileSync(path.join(dizin, "beklenen.json"), JSON.stringify({ oyuncu: o.ad_soyad, makbuz: m.makbuz_no, yabanci: yab.id, kod: kk.kodlar[0], kodSayisi: kk.kodlar.length, kismi: kismi.id, iptalli: iptalli.id, yil: y2, ay: a2, doldurulan: hd.eklenen, yabanciDueTutar: yabanciDue?.tutar ?? null }));
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
      check("makbuz ve aidat kalıcı", db.listReceipts(o.id).some((r) => r.makbuz_no === b.makbuz && !r.iptal) && db.listDues(o.id).find((d) => d.yil === b.yil && d.ay === b.ay)?.durum === "odendi");
      check("yoklama kalıcı", db.playerAttendance(o.id, "2026-01-01", "2026-12-31")[0]?.durum === "izinli");
      check("lisans makine kimliği kalıcı", !!db.lisansDurumu().makineId && db.getMetaValue("kurulumTarihi") !== null);
      // 07.09.2026 özellikleri
      const aa = db.aidatAyarlari();
      check("aidat taban fiyatı ve indirim yüzdesi kalıcı", aa.taban === 4321 && aa.indirimler.kardes === 15);
      const uk = db.listFeeTypes().find((t) => t.kod === "uc_kardes"), tk = db.listFeeItems().find((k) => k.kod === "turnuva_katilimi");
      check("arayüzden eklenen kalem/tip, düzenlenen tip adı ve silinen kalem kalıcı", tk?.varsayilan_fiyat === 750 && uk?.indirim === 40 && uk.ad === "Üç Kardeş" && db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu" && !db.listFeeItems().some((k) => k.kod === "yagmurluk") && db.listFeeTypes().length === 7);
      check("eski indirim ayarı yeniden açılışta tabloyu ezmedi (göç bir kez)", db.getSetting("indirim_kardes") === null || db.aidatAyarlari().indirimler.kardes === 15);
      check("eklenen kalem ve ücret tipi kalıcı", db.listFeeItems().some((k) => k.kod === "kamp_ucreti" && k.varsayilan_fiyat === 2500) && aa.ucretTipleri.some((t) => t.kod === "sampiyon_bursu" && t.indirim === 50));
      const kal = db.listFeeItems();
      check("arayüzden tek Kaydet ile girilen iki fiyat ve indirim kalıcı", kal.find((k) => k.kod === "forma").varsayilan_fiyat === 9000 && kal.find((k) => k.kod === "mont").varsayilan_fiyat === 8000 && aa.indirimler.indirimli === 25);
      check("yedek sıklığı kalıcı", db.getSetting("yedek_sikligi") === "haftalik");
      const yab = db.getPlayer(b.yabanci);
      check("yabancı oyuncu pasaportla kalıcı ve aranıyor", yab?.uyruk === "yabanci" && yab.pasaport_no === "K9876543" && db.listPlayers({ q: "K98765" }).some((p) => p.id === b.yabanci));
      const hoca = db.listUsers().find((u) => u.username === "hoca");
      check("ikinci kullanıcı ve 8 kurtarma kodu kalıcı", !!hoca && hoca.kurtarma_kodu === b.kodSayisi);
      check("yanlış kurtarma kodu reddedilir", !!db.kurtarmaIleSifirla("hoca", "AAAA-AAAA", "yeni-parola-77").error);
      const sf = db.kurtarmaIleSifirla("hoca", b.kod, "yeni-parola-77");
      check("kurtarma kodu yeniden açılışta çalışır, tek kullanımlık", sf.ok && sf.kalan === b.kodSayisi - 1 && !!db.verifyPassword("hoca", "yeni-parola-77") && !!db.kurtarmaIleSifirla("hoca", b.kod, "x-parola-1").error);
      const fotolar = db.listDocuments(o.id).filter((d) => d.tip === "foto");
      check("vesikalık tek kayıt ve oyuncu foto yolu kalıcı", fotolar.length === 1 && fotolar[0].orijinal_ad === "v2.png" && db.getPlayer(o.id).foto_yolu === fotolar[0].dosya_yolu && fs.existsSync(path.join(db.getUploadsDir(), fotolar[0].dosya_yolu)));
      check("şema sürümü 11 (göç tekrar çalışmadı, sütunlar yerinde)", db.getMetaValue("schema_version") === "11");
      const kd = db.getDue(b.yabanci, b.yil, b.ay);
      check("kısmi ödeme kalıcı (ödenen 1000, durum kismi, kalan borçlu listesinde)", kd?.durum === "kismi" && kd.odenen === 1000 && db.listUnpaid(b.yil, b.ay).some((x) => x.player_id === b.yabanci && x.kalan === kd.tutar - 1000));
      const ip = db.getReceipt(b.iptalli);
      check("makbuz iptal nedeni ve iptal eden kalıcı", ip?.iptal === 1 && ip.iptal_nedeni === "Yanlış oyuncu" && ip.iptal_eden === "Test Yönetici" && !!ip.iptal_zamani);
      const waV = db.listGuardians(o.id)[0];
      const waM = db.sonMesajlar(o.id);
      const waT = db.trainingCalendar("2026-09-08", "2026-09-08").find((x) => x.saat === "18:30");
      check("WhatsApp: veli onayı, hatırlatma ve bildirim kayıtları, antrenman değişikliği kalıcı", waV?.mesaj_onayi === 0 && waM.length === 2 && waM.some((m) => m.tur === "aidat" && m.kullanici === "admin") && !!waT && waT.bildirim_gerekli === 1 && waT.bildirilen === 1 && JSON.parse(waT.degisiklik_notu).eskiSaat === "17:00");
      const gT = db.trainingCalendar("2026-09-09", "2026-09-09").find((x) => x.iptal === 1);
      check("veli grubuna bildirim kaydı ve WhatsApp şablonu kalıcı", !!gT && gT.bildirim_gerekli === 0 && JSON.parse(gT.grup_bildirim).kullanici === "Test Yönetici" && db.getSetting("wa_sablon_aidat") === "Kalıcı şablon {veli} {kalan}");
      check("haftalık program ve doldurulan antrenmanlar kalıcı", JSON.parse(db.listAgeGroups().find((g) => g.id === o.yas_grubu_id).program)[0]?.saat === "18:00" && b.doldurulan === 1 && db.listTrainings("2027-04-05", "2027-04-11").some((tr) => tr.saat === "18:00" && tr.saha === "Saha 3"));
      const akt = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan Kalıcı");
      check("Excel'den aktarılan oyuncu, yeni grubu ve velisi kalıcı", !!akt && akt.yas_grubu_ad === "U15" && db.listGuardians(akt.id)[0]?.gsm === "05320000009");
      check("kurulum ve sezon ayarları kalıcı", db.getSetting("kurulum_tamam") === "1" && db.sezonDurumu().aktifSezon === "2026-2027");
      // Arayüz: kullanıcı adı önceki oturumdan hatırlanıyor, giriş yeni parolayla
      check("kullanıcı adı yeniden açılışta hatırlanıyor", (await js(`document.querySelector("input").value`)) === "admin");
      await js(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const p = document.querySelector("input[type=password]"); set.call(p, "kalici-parola-1"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await tikla("Giriş Yap"); await bekle(600);
      check("yeniden açılışta parola değişimi istenmiyor", !(await js(`!!document.querySelector("[role=dialog]")`)));
      // Kenar menü tercihi tarayıcı deposunda (localStorage): düzgün kapanışta kalıcı; SIGKILL'de Chromium'un
      // son birkaç saniyelik yazımı diske düşmemiş olabilir — veri değil, arayüz tercihi; bilgi olarak raporlanır.
      const menuDar = (await js(`document.querySelector("aside")?.dataset.dar`)) === "1";
      if (process.env.KABA_KAPANIS) console.log(`BILGI kenar menü tercihi SIGKILL sonrası ${menuDar ? "korundu" : "kayboldu (beklenen: localStorage gecikmeli yazar)"}`);
      else check("kenar menü daraltılmış olarak hatırlanıyor", menuDar);
      await js(`document.querySelector("button[aria-label='Oyuncular']").click()`); await bekle(600); // menü dar olabilir (yalnız ikon)
      check("oyuncu arayüzde görünüyor", await js(`document.body.textContent.includes(${JSON.stringify(b.oyuncu)})`));
      if (fail === 0) console.log("TUM KONTROLLER GECTI");
      app.exit(fail === 0 ? 0 : 1);
    }
  } catch (e) { console.error("HATA:", e && e.stack); app.exit(1); }
});
