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
const check = (ad, k) => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}`);
  if (!k) fail++;
};

// main.cjs kendi whenReady'sini kurar; biz de pencere açılınca devreye gireriz.
require("../../electron/main.cjs");

app.on("browser-window-created", async (_e, win) => {
  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await bekle(700);
    const js = (k) => win.webContents.executeJavaScript(k, true);
    const setInput = (sel, val) =>
      js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const i = document.querySelector(${JSON.stringify(sel)}); set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
    const tikla = async (metin) => {
      const ok = await js(
        `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(${JSON.stringify(metin)})); if (!b) return false; b.click(); return true; })()`,
      );
      if (!ok) throw new Error("Düğme yok: " + metin);
      await bekle(500);
    };
    const db = require("../../electron/db.cjs");

    if (adim === "yaz") {
      const inputs = await js(`document.querySelectorAll("input").length`);
      check("giriş ekranı açıldı", inputs >= 2);
      // Güvenlik #2: yerel giriş deneme sınırı (kullanıcı adı başına 8/15 dk) — köprüden 9 yanlış deneme
      // Panoya yazma (telefon numarası kopyalama) gerçek izin işleyicisiyle çalışmalı; pano okuma kapalı kalmalı (09.09.2026)
      const pano = await js(
        `(async () => { let y = "ok", o = "ok"; try { await navigator.clipboard.writeText("0532 pano testi"); } catch (e) { y = String(e); } try { await navigator.clipboard.readText(); } catch (e) { o = String(e); } return { y, o }; })()`,
      );
      check(
        "panoya yazma izinli, okuma reddedilir",
        pano.y === "ok" && pano.o !== "ok" && require("electron").clipboard.readText() === "0532 pano testi",
      );
      const sonuclar = await js(
        `(async () => { const r = []; for (let i = 0; i < 9; i++) r.push((await window.okul.auth.login("kaba-kuvvet", "p" + i)).error); return r; })()`,
      );
      check(
        "9. yanlış girişte 'çok fazla deneme' engeli; admin etkilenmez",
        /Çok fazla/.test(sonuclar[8]) && !/Çok fazla/.test(sonuclar[0]),
      );
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const [u, p] = document.querySelectorAll("input"); set.call(u, "admin"); u.dispatchEvent(new Event("input", { bubbles: true })); set.call(p, "admin"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(500);
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; for (const i of document.querySelectorAll("input[type=password]")) { set.call(i, "kalici-parola-1"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`,
      );
      await tikla("Kaydet");
      await bekle(700);
      // İlk kurulum sihirbazı (oyuncu yok) → bu testte atla; kurulum akışı kendi testinde
      if (await js(`!![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Şimdi değil")`)) {
        await tikla("Şimdi değil");
        await bekle(300);
      }
      // Yaş grubu
      await tikla("Yaş Grupları");
      await bekle(400);
      await setInput('input[placeholder="U11"]', "U13");
      // Sezon kutusu seçim kutusu (plan §15): aktif sezonla dolu gelir, elle yazılmaz
      check(
        "sezon kutusu seçim kutusu ve dolu",
        await js(
          `(() => { const s = document.querySelector('select[aria-label="Sezon"]'); return !!s && /^\\d{4}-\\d{4}$/.test(s.value); })()`,
        ),
      );
      await tikla("Grup Ekle");
      await bekle(400);
      // İkinci grup: Düzenle → sezon kutusundan SONRAKİ sezon → Kaydet; sonra durum rozetiyle pasife al (plan §15, §17.1)
      await setInput('input[placeholder="U11"]', "U14");
      await tikla("Grup Ekle");
      await bekle(400);
      await js(
        `(() => { const tr = [...document.querySelectorAll("tr")].find((t) => t.textContent.includes("U14")); [...tr.querySelectorAll("button")].find((b) => b.textContent.trim() === "Düzenle")?.click(); })()`,
      );
      await bekle(300);
      const u14Sezon = await js(
        `(() => { const s = document.querySelector("table tbody select[aria-label='Sezon']"); s.value = s.options[1].value; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`, // düzenlenen satırın kutusu: tablo içindeki tek Sezon seçicisi (ekle formu tablonun dışında/altında, §36)
      );
      await tikla("Kaydet");
      await bekle(500);
      await js(`document.querySelector("button[aria-label='U14 durum: Aktif']")?.click()`);
      await bekle(500);
      check(
        "U14 arayüzden pasife alındı ve varsayılan listeden düştü",
        !(await js(`!!document.querySelector("button[aria-label^='U14 durum']")`)), // toast metni "U14" içerir; satır düğmesine bakılır
      );
      // Oyuncu (form)
      await tikla("Oyuncular");
      await bekle(400);
      await tikla("Yeni Oyuncu");
      await bekle(400);
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const dlg = document.querySelector("[role=dialog]"); const ins = dlg.querySelectorAll("input"); set.call(ins[1], "Kalıcı Oyuncu"); ins[1].dispatchEvent(new Event("input", { bubbles: true })); set.call(ins[2], "2013-05-05"); ins[2].dispatchEvent(new Event("input", { bubbles: true })); const sel = [...dlg.querySelectorAll("label")].find(l => l.textContent.startsWith("Yaş Grubu")).querySelector("select"); sel.value = sel.options[1].value; sel.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await tikla("Oyuncuyu Kaydet");
      await bekle(800);
      // Ayar
      await js(`document.querySelector("[role=dialog] button[aria-label=Kapat]")?.click()`);
      await bekle(300);
      await tikla("Ayarlar");
      await bekle(400);
      await setInput('input[placeholder="Kulübünüzün adı"]', "TEST KULÜBÜ");
      await tikla("Kaydet");
      await bekle(400);
      // Aidat Kalemleri: iki satıra binlik ayraçlı fiyat + indirim, tek Kaydet (07.09.2026 akışı)
      await tikla("Aidat Kalemleri");
      await bekle(500);
      await setInput("input[aria-label='Forma fiyatı']", "9000");
      await setInput("input[aria-label='Mont fiyatı']", "8000");
      await setInput("input[aria-label='İndirimli indirimi']", "25");
      // Arayüzden yeni kalem + yeni ücret tipi + tip adı düzenleme + Yağmurluk silme (07.09.2026 akşam akışı), tek Kaydet
      await setInput("input[aria-label='Yeni kalem adı']", "Turnuva Katılımı");
      await setInput("input[aria-label='Yeni kalem fiyatı']", "750");
      await tikla("Kalem Ekle");
      await setInput("input[aria-label='Yeni ücret tipi adı']", "Üç Kardeş");
      await setInput("input[aria-label='Yeni ücret tipi indirimi']", "40");
      await tikla("Ücret Tipi Ekle");
      await setInput("input[aria-label='Burslu adı']", "Tam Burslu");
      await js(`[...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Yağmurluk sil")?.click()`);
      await bekle(200);
      await tikla("Kaydet");
      await bekle(800);
      // WhatsApp şablonu arayüzden (Ayarlar > WhatsApp Mesajları, tek Kaydet)
      await tikla("WhatsApp Mesajları");
      await bekle(400);
      if (await js(`!!document.querySelector("[role=dialog]")`)) {
        await js(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Evet")?.click()`);
        await bekle(400);
      }
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; const t = document.querySelector("textarea[aria-label='Aidat hatırlatma']"); set.call(t, "Kalıcı şablon {veli} {kalan}"); t.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await bekle(200);
      await tikla("Kaydet");
      await bekle(600);
      check("WhatsApp şablonu arayüzden kaydedildi", db.getSetting("wa_sablon_aidat") === "Kalıcı şablon {veli} {kalan}");
      await tikla("Aidat Kalemleri");
      await bekle(400);
      check(
        "arayüzden kalem/tip ekleme-silme kaydedildi",
        db.listFeeItems().some((k) => k.kod === "turnuva_katilimi") &&
          !db.listFeeItems().some((k) => k.kod === "yagmurluk") &&
          db.listFeeTypes().some((t) => t.kod === "uc_kardes" && t.indirim === 40) &&
          db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu",
      );
      // DB'den doğrudan makbuz + yoklama (arayüz yoluyla zaten duman testinde doğrulanıyor)
      const o = db.listPlayers()[0];
      const t = new Date();
      db.ensureMonthlyDues(t.getFullYear(), t.getMonth() + 1);
      const aidat = db.listFeeItems().find((k) => k.kod === "aidat");
      const m = db.createReceipt({
        player_id: o.id,
        tarih: "2026-09-06",
        odeme_yontemi: "havale",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 1234, yil: t.getFullYear(), ay: t.getMonth() + 1 }],
      });
      const tr = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-06", saat: "10:00" });
      db.setAttendance(tr.id, o.id, "izinli");
      // WhatsApp (plan §13): veli onayı kapatma, aidat hatırlatma kaydı, antrenman saat değişikliği + bildirim kaydı
      const waVeli = db.listGuardians(o.id)[0] || null;
      const waVeliId = waVeli
        ? waVeli.id
        : db.addGuardian(o.id, { tip: "anne", ad_soyad: "Kalıcı Veli", gsm: "0532 000 00 01", veli_mi: 1 });
      db.updateGuardian(waVeliId, { mesaj_onayi: 0 });
      db.mesajKaydet({
        player_id: o.id,
        guardian_id: waVeliId,
        tur: "aidat",
        yil: t.getFullYear(),
        ay: t.getMonth() + 1,
        metin: "Kalıcı hatırlatma",
        kullanici: "admin",
      });
      const tr2 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-08", saat: "17:00", saha: "Saha 1" });
      db.updateTraining(tr2.id, { saat: "18:30" });
      db.mesajKaydet({ player_id: o.id, guardian_id: waVeliId, tur: "degisiklik", training_id: tr2.id, metin: "Saat değişti" });
      const tr3 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-09", saat: "17:00", saha: "Saha 1" });
      db.cancelTraining(tr3.id, "Yağmur");
      db.grupBildirimKaydet(tr3.id, "Test Yönetici");
      // Olay ayrımı (şema 11): değişiklik bildirildi → iptal → yeni olay; ayrıca grup geri alma
      const tr4 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-10", saat: "17:00", saha: "Saha 1" });
      db.updateTraining(tr4.id, { saat: "18:00" });
      db.mesajKaydet({ player_id: o.id, guardian_id: waVeliId, tur: "degisiklik", training_id: tr4.id, metin: "d" });
      db.grupBildirimKaydet(tr4.id, "Y");
      db.cancelTraining(tr4.id, "İptal");
      const tr5 = db.createTraining({ age_group_id: o.yas_grubu_id, tarih: "2026-09-11", saat: "17:00", saha: "Saha 1" });
      db.cancelTraining(tr5.id, "İptal");
      db.grupBildirimKaydet(tr5.id, "Y");
      db.grupBildirimSil(tr5.id);

      // Son eklenen özellikler (07.09.2026): aidat taban fiyatı + indirim, yedek sıklığı, yabancı oyuncu,
      // ikinci kullanıcı + kurtarma kodları, belge kaydı (dosya + tekil vesikalık), kenar menü tercihi
      db.updateFeeItem(aidat.id, { varsayilan_fiyat: 4321 });
      db.aidatAyarlariKaydet({
        indirimler: { kardes: 15 },
        kalemler: [{ yeni: true, ad: "Kamp Ücreti", varsayilan_fiyat: 2500 }],
        ucretTipleri: [{ yeni: true, ad: "Şampiyon Bursu", indirim: 50 }],
      });
      db.setSetting("yedek_sikligi", "haftalik");
      const yab = db.createPlayer({
        uyruk: "yabanci",
        pasaport_no: "K9876543",
        ad_soyad: "Kalıcı Yabancı",
        dogum_tarihi: "2014-01-01",
        yas_grubu_id: o.yas_grubu_id,
        durum: "aktif",
        ucret_tipi: "kardes",
        aylik_aidat: 3673,
        odeme_donemi: "1-10",
      });
      const hoca = db.createUser({ username: "hoca", password: "hoca-ilk-parola", ad_soyad: "Hoca", role: "kullanici" });
      const kk = db.kurtarmaKodlariUret(hoca.id);
      fs.mkdirSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id), { recursive: true });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id, "1-foto-v1.png"), "eski");
      db.belgeEkle(o.id, { tip: "foto", dosya_yolu: `oyuncu-${o.id}/1-foto-v1.png`, orijinal_ad: "v1.png" });
      fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-" + o.id, "2-foto-v2.png"), "yeni");
      db.belgeEkle(o.id, { tip: "foto", dosya_yolu: `oyuncu-${o.id}/2-foto-v2.png`, orijinal_ad: "v2.png" });
      // 07.09.2026 öğleden sonra: kısmi ödeme, iptal nedeni, haftalık program + doldurma, Excel aktarımı, kurulum/sezon ayarları
      const t2 = new Date();
      const y2 = t2.getFullYear(),
        a2 = t2.getMonth() + 1;
      const yabanciDue = db.getDue(yab.id, y2, a2);
      const kismi = db.createReceipt({
        player_id: yab.id,
        tarih: t2.toISOString().slice(0, 10),
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 1000, aciklama: "kısmi", yil: y2, ay: a2 }],
      });
      const iptalli = db.createReceipt({
        player_id: o.id,
        tarih: t2.toISOString().slice(0, 10),
        odeme_yontemi: "havale",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 50, aciklama: "iptal edilecek", yil: null, ay: null }],
      });
      db.cancelReceipt(iptalli.id, "Yanlış oyuncu", "Test Yönetici");
      db.updateAgeGroup(o.yas_grubu_id, { program: [{ gun: 2, saat: "18:00", saha: "Saha 3" }] });
      const hd = db.haftayiProgramdanDoldur("2027-04-05");
      const { aktarUygula } = require("../../electron/ipc/aktar.cjs");
      aktarUygula([
        {
          ad_soyad: "Aktarılan Kalıcı",
          dogum_tarihi: "2016-04-04",
          uyruk: "tc",
          tc_no: null,
          pasaport_no: null,
          durum: "aktif",
          ucret_tipi: "normal",
          odeme_donemi: "1-10",
          aylik_aidat: 0,
          yeni_grup: "U15",
          veli: { ad_soyad: "Aktarılan Veli", gsm: "05320000009" },
        },
      ]);
      db.setSetting("kurulum_tamam", "1");
      db.setSetting("aktif_sezon", "2026-2027");
      // Plan §17: yeni sezona geçiş (herkes yeniler → kimse pasife düşmez), ilk ay borcu açılır; yeni sezon makbuzu 2027-0001
      db.sezonTarihKaydet("2026-2027", "2026-09-01", "2027-06-30"); // plan §37: sezon tarihleri
      const sg = db.yeniSezonaGec({
        sezon: "2027-2028",
        yenileyenler: db.sezonAdayListesi().map((a) => ({ id: a.id })),
        baslangic: "2027-09-01",
        bitis: "2028-06-30",
      });
      db.createTraining({
        age_group_id: db.listAgeGroups()[0].id,
        tarih: "2027-05-03",
        saat: "17:00",
        bitis_saat: "18:30",
        saha: "Saha 9",
      });
      const m27 = db.createReceipt({
        player_id: yab.id,
        tarih: t2.toISOString().slice(0, 10),
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 100, aciklama: "yeni sezon", yil: null, ay: null }],
      });
      check(
        "yeni sezon makbuzu 2027-0001 ve sezon damgalı",
        m27.makbuz_no === "2027-0001" && m27.sezon === "2027-2028" && sg.ilkAyBorcu >= 1,
      );
      // ── 10.09.2026 eklemeleri: kulüp kimliği (§32), uzun dönem aidat (§24), sağlık belgesi (§25), kişisel veri silme (§31) ──
      db.setSetting("aidat_vade_bekle", "0"); // plan §38: ayar kalıcı, yeniden açılışta eski davranış (vade_gecti=1)
      db.setSetting("kulup_kisa_ad", "Kalıcı SK");
      db.setSetting("kurulus_yili", "1965");
      db.setSetting("kulup_alt_yazi", "Akademi");
      db.setSetting("tema_ana", "#0f7b3e");
      db.setSetting("tema_vurgu", "#ffffff");
      {
        const { nativeImage } = require("electron");
        const { kulupLogoKaydet } = require("../../electron/kulupLogo.cjs");
        const bmp = Buffer.alloc(64 * 64 * 4);
        for (let i = 0; i < bmp.length; i += 4) {
          bmp[i] = 62;
          bmp[i + 1] = 123;
          bmp[i + 2] = 15;
          bmp[i + 3] = 255;
        }
        kulupLogoKaydet(nativeImage.createFromBitmap(bmp, { width: 64, height: 64 }).toPNG(), ".png");
      }
      // Uzun dönem: 4 ay tek makbuzla (özet satır eşiği üstü)
      const uzun = db.createPlayer({
        ad_soyad: "Uzun Dönem Oyuncu",
        dogum_tarihi: "2015-03-03",
        yas_grubu_id: o.yas_grubu_id,
        aylik_aidat: 1000,
      });
      const uzunAylar = [
        [2027, 10],
        [2027, 11],
        [2027, 12],
        [2028, 1],
      ];
      db.ensureMonthlyDuesAraligi(
        uzun.id,
        uzunAylar.map(([yil, ay]) => ({ yil, ay })),
      );
      const uzunMakbuz = db.createReceipt({
        player_id: uzun.id,
        tarih: "2027-11-11", // t2 değil: "bugün kesilenler" sayısı kontrolü bozulmasın
        odeme_yontemi: "havale",
        tahsil_eden: "T",
        satirlar: uzunAylar.map(([yil, ay]) => ({ fee_item_id: aidat.id, tutar: 1000, aciklama: `${ay}/${yil}`, yil, ay })),
      });
      db.belgeEkle(uzun.id, {
        tip: "saglik",
        dosya_yolu: `oyuncu-${uzun.id}/1-saglik-r.pdf`,
        orijinal_ad: "r.pdf",
        gecerlilik_tarihi: "2028-06-30",
      });
      // Kişisel veri silme: makbuzlu oyuncu → ad makbuza damgalanır, kişisel alanlar gider
      const kvkk = db.createPlayer({
        ad_soyad: "Kvkk Kalıcı",
        tc_no: "11111111110",
        dogum_tarihi: "2014-04-04",
        yas_grubu_id: o.yas_grubu_id,
        gsm: "05550000000",
      });
      db.addGuardian(kvkk.id, { tip: "anne", ad_soyad: "Anne Kvkk", gsm: "05550000001" });
      const kvkkMakbuz = db.createReceipt({
        player_id: kvkk.id,
        tarih: "2027-11-11", // t2 değil: "bugün kesilenler" sayısı kontrolü bozulmasın
        odeme_yontemi: "nakit",
        tahsil_eden: "T",
        satirlar: [{ fee_item_id: aidat.id, tutar: 250, aciklama: "kvkk", yil: null, ay: null }],
      });
      db.oyuncuKisiselVeriSil(kvkk.id, "kalicilik");
      check(
        "yazım: uzun dönem 4 ay ödendi, sağlık belgesi var, kvkk anonim ama makbuz adı damgalı",
        uzunAylar.every(([yil, ay]) => db.getDue(uzun.id, yil, ay)?.durum === "odendi") &&
          db.listDocuments(uzun.id).some((d) => d.tip === "saglik") &&
          db.getPlayer(kvkk.id).ad_soyad === `Silinmiş Oyuncu #${kvkk.id}` &&
          db.getReceipt(kvkkMakbuz.id).ad_soyad === "Kvkk Kalıcı",
      );
      await js(`document.querySelector("button[aria-label='Menüyü daralt']").click()`);
      await bekle(300);
      // Taşıma paketi (plan §14): tüm kayıtlardan sonra oluşturulur; yeniden açılışta parolayla açılıp sayıları beklenenle karşılaştırılır
      const tp = require("../../electron/ipc/yedek.cjs").tasimaPaketiOlustur(path.join(dizin, "kalici-tasima.fokpaket"), "kalici-parola-1");
      check("taşıma paketi oluşturuldu", tp.ok && fs.existsSync(path.join(dizin, "kalici-tasima.fokpaket")));
      // Normal yedek → aynı saniyede İKİ geri yükleme (ENOTEMPTY düzeltmesi) → yeniden açılışta veri aynı, .pre-restore klasörleri iki adet
      const yk = require("../../electron/ipc/yedek.cjs");
      const yedekKlasoru = path.join(dizin, "yedekler");
      fs.mkdirSync(yedekKlasoru, { recursive: true });
      const ya = yk.yedekAl(yedekKlasoru);
      const gy1 = yk.geriYukleCekirdek(ya.yol);
      db.init();
      const gy2 = yk.geriYukleCekirdek(ya.yol);
      db.init();
      check(
        "yedek alındı; aynı saniyede iki geri yükleme de başarılı, kenara alma adları farklı",
        ya.ok && gy1.ok && gy2.ok && gy1.kenarDb !== gy2.kenarDb && fs.existsSync(gy1.kenarDb) && fs.existsSync(gy2.kenarDb),
      );
      const tpOyuncu = db.listPlayers({ durum: null }).length,
        tpMakbuz = db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts").get().n;
      fs.writeFileSync(
        path.join(dizin, "beklenen.json"),
        JSON.stringify({
          tpOyuncu,
          tpMakbuz,
          oyuncu: o.ad_soyad,
          makbuz: m.makbuz_no,
          yabanci: yab.id,
          kod: kk.kodlar[0],
          kodSayisi: kk.kodlar.length,
          kismi: kismi.id,
          iptalli: iptalli.id,
          yil: y2,
          ay: a2,
          doldurulan: hd.eklenen,
          yabanciDueTutar: yabanciDue?.tutar ?? null,
          u14Sezon,
          makbuz27: m27.makbuz_no,
          ilkAyBorcu: sg.ilkAyBorcu,
          bugun: t2.toISOString().slice(0, 10),
          uzun: uzun.id,
          uzunMakbuz: uzunMakbuz.makbuz_no,
          kvkk: kvkk.id,
          kvkkMakbuz: kvkkMakbuz.id,
        }),
      );
      console.log("YAZ TAMAM");
      if (process.env.KABA_KAPANIS) {
        process.kill(process.pid, "SIGKILL");
      } // elektrik kesintisi / görev yöneticisi
      win.close(); // gerçek kapanış yolu: window-all-closed → server.durdur → db.close → app.quit
      return;
    }

    if (adim === "oku") {
      const b = JSON.parse(fs.readFileSync(path.join(dizin, "beklenen.json"), "utf8"));
      // Parola değişti mi? (eski admin/admin ile giriş başarısız, yenisiyle başarılı)
      check("eski parola artık geçersiz", !db.verifyPassword("admin", "admin"));
      check(
        "yeni parola geçerli, parola değişimi işareti kalktı",
        !!db.verifyPassword("admin", "kalici-parola-1") && !db.getUserByUsername("admin").must_change_password,
      );
      check(
        "yaş grubu kalıcı",
        db.listAgeGroups().some((g) => g.ad === "U13"),
      );
      const o = db.listPlayers().find((p) => p.ad_soyad === b.oyuncu);
      check("oyuncu kalıcı (grup dahil)", !!o && !!o.yas_grubu_id);
      check(
        "grup sezonu otomatik dolu ve biçimli (plan §15)",
        /^\d{4}-\d{4}$/.test(db.listAgeGroups().find((g) => g.ad === "U13")?.sezon || ""),
      );
      check("ayar kalıcı", db.getSetting("kulup_adi") === "TEST KULÜBÜ");
      check(
        "makbuz ve aidat kalıcı",
        db.listReceipts(o.id).some((r) => r.makbuz_no === b.makbuz && !r.iptal) &&
          db.listDues(o.id).find((d) => d.yil === b.yil && d.ay === b.ay)?.durum === "odendi",
      );
      check("yoklama kalıcı", db.playerAttendance(o.id, "2026-01-01", "2026-12-31")[0]?.durum === "izinli");
      check("lisans makine kimliği kalıcı", !!db.lisansDurumu().makineId && db.getMetaValue("kurulumTarihi") !== null);
      // 07.09.2026 özellikleri
      const aa = db.aidatAyarlari();
      check("aidat taban fiyatı ve indirim yüzdesi kalıcı", aa.taban === 4321 && aa.indirimler.kardes === 15);
      const uk = db.listFeeTypes().find((t) => t.kod === "uc_kardes"),
        tk = db.listFeeItems().find((k) => k.kod === "turnuva_katilimi");
      check(
        "arayüzden eklenen kalem/tip, düzenlenen tip adı ve silinen kalem kalıcı",
        tk?.varsayilan_fiyat === 750 &&
          uk?.indirim === 40 &&
          uk.ad === "Üç Kardeş" &&
          db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu" &&
          !db.listFeeItems().some((k) => k.kod === "yagmurluk") &&
          db.listFeeTypes().length === 7,
      );
      check(
        "eski indirim ayarı yeniden açılışta tabloyu ezmedi (göç bir kez)",
        db.getSetting("indirim_kardes") === null || db.aidatAyarlari().indirimler.kardes === 15,
      );
      check(
        "eklenen kalem ve ücret tipi kalıcı",
        db.listFeeItems().some((k) => k.kod === "kamp_ucreti" && k.varsayilan_fiyat === 2500) &&
          aa.ucretTipleri.some((t) => t.kod === "sampiyon_bursu" && t.indirim === 50),
      );
      const kal = db.listFeeItems();
      check(
        "arayüzden tek Kaydet ile girilen iki fiyat ve indirim kalıcı",
        kal.find((k) => k.kod === "forma").varsayilan_fiyat === 9000 &&
          kal.find((k) => k.kod === "mont").varsayilan_fiyat === 8000 &&
          aa.indirimler.indirimli === 25,
      );
      check("yedek sıklığı kalıcı", db.getSetting("yedek_sikligi") === "haftalik");
      const yab = db.getPlayer(b.yabanci);
      check(
        "yabancı oyuncu pasaportla kalıcı ve aranıyor",
        yab?.uyruk === "yabanci" && yab.pasaport_no === "K9876543" && db.listPlayers({ q: "K98765" }).some((p) => p.id === b.yabanci),
      );
      const hoca = db.listUsers().find((u) => u.username === "hoca");
      check("ikinci kullanıcı ve 8 kurtarma kodu kalıcı", !!hoca && hoca.kurtarma_kodu === b.kodSayisi);
      check("yanlış kurtarma kodu reddedilir", !!db.kurtarmaIleSifirla("hoca", "AAAA-AAAA", "yeni-parola-77").error);
      const sf = db.kurtarmaIleSifirla("hoca", b.kod, "yeni-parola-77");
      check(
        "kurtarma kodu yeniden açılışta çalışır, tek kullanımlık",
        sf.ok &&
          sf.kalan === b.kodSayisi - 1 &&
          !!db.verifyPassword("hoca", "yeni-parola-77") &&
          !!db.kurtarmaIleSifirla("hoca", b.kod, "x-parola-1").error,
      );
      const fotolar = db.listDocuments(o.id).filter((d) => d.tip === "foto");
      check(
        "vesikalık tek kayıt ve oyuncu foto yolu kalıcı",
        fotolar.length === 1 &&
          fotolar[0].orijinal_ad === "v2.png" &&
          db.getPlayer(o.id).foto_yolu === fotolar[0].dosya_yolu &&
          fs.existsSync(path.join(db.getUploadsDir(), fotolar[0].dosya_yolu)),
      );
      check("şema sürümü 19 (göç tekrar çalışmadı, sütunlar yerinde)", db.getMetaValue("schema_version") === "19");
      const kd = db.getDue(b.yabanci, b.yil, b.ay);
      check(
        "kısmi ödeme kalıcı (ödenen 1000, durum kismi, kalan borçlu listesinde)",
        kd?.durum === "kismi" &&
          kd.odenen === 1000 &&
          db.listUnpaid(b.yil, b.ay).some((x) => x.player_id === b.yabanci && x.kalan === kd.tutar - 1000),
      );
      const ip = db.getReceipt(b.iptalli);
      check(
        "makbuz iptal nedeni ve iptal eden kalıcı",
        ip?.iptal === 1 && ip.iptal_nedeni === "Yanlış oyuncu" && ip.iptal_eden === "Test Yönetici" && !!ip.iptal_zamani,
      );
      const waV = db.listGuardians(o.id)[0];
      const waM = db.sonMesajlar(o.id);
      const waT = db.trainingCalendar("2026-09-08", "2026-09-08").find((x) => x.saat === "18:30");
      check(
        "WhatsApp: veli onayı, hatırlatma ve bildirim kayıtları, antrenman değişikliği kalıcı",
        waV?.mesaj_onayi === 0 &&
          waM.length >= 2 &&
          waM.some((m) => m.tur === "aidat" && m.kullanici === "admin") &&
          waM.some((m) => m.tur === "degisiklik" && m.metin === "Saat değişti") &&
          !!waT &&
          waT.bildirim_gerekli === 1 &&
          waT.bildirilen === 1 &&
          JSON.parse(waT.degisiklik_notu).eskiSaat === "17:00",
      );
      const gT = db.trainingCalendar("2026-09-09", "2026-09-09").find((x) => x.iptal === 1);
      check(
        "veli grubuna bildirim kaydı ve WhatsApp şablonu kalıcı",
        !!gT &&
          gT.bildirim_gerekli === 0 &&
          JSON.parse(gT.grup_bildirim).kullanici === "Test Yönetici" &&
          db.getSetting("wa_sablon_aidat") === "Kalıcı şablon {veli} {kalan}",
      );
      const t4 = db.trainingCalendar("2026-09-10", "2026-09-10")[0],
        t5 = db.trainingCalendar("2026-09-11", "2026-09-11")[0];
      check(
        "olay ayrımı kalıcı: değişiklik sonrası iptal yeni olay (bildirilen 0, grup boş, gerekli 1); eski değişiklik kaydı geçmişte",
        t4 &&
          t4.iptal === 1 &&
          t4.bildirilen === 0 &&
          t4.grup_bildirim === "" &&
          t4.bildirim_gerekli === 1 &&
          !!t4.bildirim_olay &&
          db.sonMesajlar(o.id).some((m) => m.training_id === t4.id && m.tur === "degisiklik"),
      );
      check("grup bildirimi geri alma kalıcı (kayıt boş, bildirim gerekli)", t5 && t5.grup_bildirim === "" && t5.bildirim_gerekli === 1);
      const tpa = require("../../electron/ipc/yedek.cjs").tasimaPaketiAc(path.join(dizin, "kalici-tasima.fokpaket"), "kalici-parola-1");
      check(
        "iki geri yükleme sonrası yeniden açılış: oyuncu/makbuz sayısı korunmuş, kenara alınan iki kopya duruyor",
        db.listPlayers({ durum: null }).length === b.tpOyuncu &&
          db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts").get().n === b.tpMakbuz &&
          fs.readdirSync(dizin).filter((f) => f.startsWith("data.db.pre-restore-")).length === 2,
      );
      check(
        "yeniden açılışta taşıma paketi parolayla açılıyor; oyuncu/makbuz sayısı paket anındaki veriyle aynı",
        tpa.ok && tpa.oyuncu === b.tpOyuncu && tpa.makbuz === b.tpMakbuz && tpa.oyuncu === db.listPlayers({ durum: null }).length,
      );
      if (tpa.ok) fs.rmSync(tpa.klasor, { recursive: true, force: true });
      check(
        "haftalık program ve doldurulan antrenmanlar kalıcı",
        JSON.parse(db.listAgeGroups().find((g) => g.id === o.yas_grubu_id).program)[0]?.saat === "18:00" &&
          b.doldurulan === 1 &&
          db.listTrainings("2027-04-05", "2027-04-11").some((tr) => tr.saat === "18:00" && tr.saha === "Saha 3"),
      );
      const akt = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan Kalıcı");
      check(
        "Excel'den aktarılan oyuncu, yeni grubu ve velisi kalıcı",
        !!akt && akt.yas_grubu_ad === "U15" && db.listGuardians(akt.id)[0]?.gsm === "05320000009",
      );
      check("kurulum ve sezon ayarları kalıcı", db.getSetting("kurulum_tamam") === "1" && db.sezonDurumu().aktifSezon === "2027-2028");
      check(
        "vade ayarı kalıcı (plan §38): aidat_vade_bekle=0 → vade_gecti hep 1; ayar silinince dönem son gününe göre",
        db.getSetting("aidat_vade_bekle") === "0" &&
          db.listDues(b.yabanci, 1, { bugun: "2027-04-02" }).every((d) => d.vade_gecti === 1) &&
          (() => {
            db.setSetting("aidat_vade_bekle", "");
            const ok = db.listUnpaid(2027, 4, null, null, { bugun: "2027-04-02", yalnizVadesiGecen: true }).length === 0;
            db.setSetting("aidat_vade_bekle", "0");
            return ok;
          })(),
      );
      check(
        "sezon tarihleri kalıcı (plan §37): eski sezon kayıtlı, yeni sezon geçişte kaydedildi",
        db.sezonTarihleri("2026-2027").kayitli === true &&
          db.sezonTarihleri("2026-2027").bitis === "2027-06-30" &&
          db.sezonDurumu().tarihler?.bitis === "2028-06-30",
      );
      check(
        "antrenman bitiş saati kalıcı (plan §37)",
        db.listTrainings("2027-05-03", "2027-05-03").some((t) => t.saat === "17:00" && t.bitis_saat === "18:30" && t.saha === "Saha 9"),
      );
      // 09.09.2026 özellikleri (plan §15, §17, göç 13/14)
      const u14 = db.listAgeGroups().find((g) => g.ad === "U14");
      check("düzenlenen grup sezonu (sonraki sezon) ve pasif durumu kalıcı", !!u14 && u14.sezon === b.u14Sezon && u14.aktif === 0);
      check(
        "yeni sezon makbuzu 2027 numaralı ve sezon damgalı; bugün kesilenler sezona göre ayrışıyor",
        db.listReceipts(b.yabanci).some((r) => r.makbuz_no === b.makbuz27 && r.sezon === "2027-2028") &&
          db.listReceiptsByDate(b.bugun, b.bugun, "2027-2028").length === 1 &&
          db.listReceiptsByDate(b.bugun, b.bugun, "2026-2027").length >= 1 &&
          db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts WHERE sezon=''").get().n === 0,
      );
      check("yeni sezonun ilk ay aidatı kalıcı", b.ilkAyBorcu >= 1 && db.getDue(b.yabanci, 2027, 9)?.durum === "odenmedi");
      check(
        "ücret tipi sırası kalıcı (normal, ücretsiz, …)",
        db
          .listFeeTypes()
          .map((t) => t.kod)
          .slice(0, 3)
          .join() === "normal,ucretsiz,burslu",
      );
      check("sezon listesi yeniden eskiye", db.sezonListesi()[0] === "2027-2028" && db.sezonListesi().includes("2026-2027"));
      // Plan §18/§18.1: formdan kaydedilen oyuncu sezon damgası aldı (2026-2027), sezon geçişiyle 2027-2028 üyeliği eklendi;
      // geçmiş sezon süzgeci onu hâlâ bulur; arayüzdeki varsayılan (aktif sezon) süzgeç de gösterir
      const ps = db
        .hamBaglanti()
        .prepare("SELECT sezon FROM player_seasons WHERE player_id=? ORDER BY sezon")
        .all(o.id)
        .map((r) => r.sezon);
      check("oyuncunun sezon damgası ve geçmiş sezon üyeliği kalıcı", o.sezon === "2027-2028" && ps.join() === "2026-2027,2027-2028");
      check(
        "geçmiş sezon süzgeci yeniden açılışta oyuncuyu bulur; yeni sezon süzgeci de",
        db.listPlayersWithDue({ yil: 2026, ay: 9, sezon: "2026-2027" }).some((p) => p.id === o.id) &&
          db.playersPage({ yil: 2027, ay: 9, sezon: "2027-2028", durum: "aktifler" }).liste.some((p) => p.id === o.id),
      );
      check(
        "grup sezon üyeliği kalıcı: U13 kayıtta 2026-2027, geçişle 2027-2028 (plan §21)",
        db
          .hamBaglanti()
          .prepare("SELECT sezon FROM group_seasons WHERE group_id=? ORDER BY sezon")
          .all(db.listAgeGroups().find((g) => g.ad === "U13").id)
          .map((r) => r.sezon)
          .join() === "2026-2027,2027-2028",
      );
      check(
        "hiç oyuncu sezonsuz kalmadı (göç 15 + createPlayer damgası)",
        db.hamBaglanti().prepare("SELECT count(*) AS n FROM players WHERE sezon='' AND durum IN ('aktif','deneme','sakat')").get().n === 0,
      );
      // ── 10.09.2026 eklemeleri ──
      check(
        "kulüp kimliği ayarları kalıcı (kısa ad, kuruluş, alt yazı, tema)",
        db.getSetting("kulup_kisa_ad") === "Kalıcı SK" &&
          db.getSetting("kurulus_yili") === "1965" &&
          db.getSetting("kulup_alt_yazi") === "Akademi" &&
          db.getSetting("tema_ana") === "#0f7b3e" &&
          db.getSetting("tema_vurgu") === "#ffffff",
      );
      const { markaOku } = require("../../electron/marka.cjs");
      const marka = markaOku({ getSetting: db.getSetting, uploadsDir: db.getUploadsDir() });
      check(
        "kulüp logosu dosyası ve ayarı kalıcı (yedek/geri yükleme sonrası da); marka kanalı okur",
        db.getSetting("kulup_logo") === "kulup/logo.png" &&
          fs.existsSync(path.join(db.getUploadsDir(), "kulup", "logo.png")) &&
          marka.logo.startsWith("data:image/png;base64,") &&
          marka.kisaAd === "Kalıcı SK" &&
          marka.kurulusYili === "1965",
      );
      check(
        "giriş ekranı (oturumsuz) kalıcı kimliği gösteriyor: kısa ad, kuruluş yılı, kulüp logosu, yeşil tema",
        (await js(`document.body.textContent.includes("KALICI SK") && document.body.textContent.includes("Kuruluş 1965")`)) &&
          (await js(`!!document.querySelector("img[data-kulup-logo='1']")`)) &&
          (await js(`getComputedStyle(document.documentElement).getPropertyValue("--mor").trim()`)) === "#0f7b3e",
      );
      check(
        "uzun dönem: 4 ayın aidatı ödendi ve tek makbuza bağlı kalıcı",
        [
          [2027, 10],
          [2027, 11],
          [2027, 12],
          [2028, 1],
        ].every(([yil, ay]) => db.getDue(b.uzun, yil, ay)?.durum === "odendi") &&
          db.listReceipts(b.uzun).some((m) => m.makbuz_no === b.uzunMakbuz && m.toplam === 4000),
      );
      check(
        "sağlık belgesi geçerlilik tarihiyle kalıcı; belge_tipleri listede",
        db.listDocuments(b.uzun).some((d) => d.tip === "saglik" && d.gecerlilik_tarihi === "2028-06-30") &&
          /saglik/.test(
            db.getPlayer(b.uzun) &&
              db.playersPage({ yil: 2027, ay: 10, sayfaBoyu: 100, durum: null }).liste.find((p) => p.id === b.uzun)?.belge_tipleri,
          ),
      );
      const kv = db.getPlayer(b.kvkk);
      check(
        "kişisel veri silme kalıcı: oyuncu anonim, veli yok, makbuz adı damgayla duruyor",
        kv.ad_soyad === `Silinmiş Oyuncu #${b.kvkk}` &&
          kv.tc_no === "" &&
          kv.durum === "ayrildi" &&
          db.listGuardians(b.kvkk).length === 0 &&
          db.getReceipt(b.kvkkMakbuz).ad_soyad === "Kvkk Kalıcı" &&
          db.getReceipt(b.kvkkMakbuz).oyuncu_adi === "Kvkk Kalıcı",
      );
      // Arayüz: kullanıcı adı önceki oturumdan hatırlanıyor, giriş yeni parolayla
      check("kullanıcı adı yeniden açılışta hatırlanıyor", (await js(`document.querySelector("input").value`)) === "admin");
      await js(
        `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const p = document.querySelector("input[type=password]"); set.call(p, "kalici-parola-1"); p.dispatchEvent(new Event("input", { bubbles: true })); })()`,
      );
      await tikla("Giriş Yap");
      await bekle(600);
      check("yeniden açılışta parola değişimi istenmiyor", !(await js(`!!document.querySelector("[role=dialog]")`)));
      // Kenar menü tercihi tarayıcı deposunda (localStorage): düzgün kapanışta kalıcı; SIGKILL'de Chromium'un
      // son birkaç saniyelik yazımı diske düşmemiş olabilir — veri değil, arayüz tercihi; bilgi olarak raporlanır.
      const menuDar = (await js(`document.querySelector("aside")?.dataset.dar`)) === "1";
      if (process.env.KABA_KAPANIS)
        console.log(
          `BILGI kenar menü tercihi SIGKILL sonrası ${menuDar ? "korundu" : "kayboldu (beklenen: localStorage gecikmeli yazar)"}`,
        );
      else check("kenar menü daraltılmış olarak hatırlanıyor", menuDar);
      await js(`document.querySelector("button[aria-label='Oyuncular']").click()`);
      await bekle(600); // menü dar olabilir (yalnız ikon)
      check("oyuncu arayüzde görünüyor", await js(`document.body.textContent.includes(${JSON.stringify(b.oyuncu)})`));
      // Yaş Grupları: pasif U14 varsayılan listede yok, onay kutusuyla gelir
      await js(`document.querySelector("button[aria-label='Yaş Grupları']").click()`);
      await bekle(600);
      const u13Var = await js(`document.body.textContent.includes("U13")`);
      const u14Gizli = !(await js(`document.body.textContent.includes("U14")`));
      await js(
        `[...document.querySelectorAll("label")].find((l) => l.textContent.includes("Pasif grupları da göster"))?.querySelector("input")?.click()`,
      );
      await bekle(300);
      check(
        "yeniden açılışta pasif grup gizli, onay kutusuyla görünür",
        u13Var && u14Gizli && (await js(`document.body.textContent.includes("U14")`)),
      );
      if (fail === 0) console.log("TUM KONTROLLER GECTI");
      app.exit(fail === 0 ? 0 : 1);
    }
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
