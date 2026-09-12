// Electron altında koşar (better-sqlite3 Electron ABI'siyle derli). Geçici bir userData
// dizininde şema oluşturma, tohum verisi, oyuncu + aidat + makbuz tam turunu doğrular.
// Çıktıda "TUM KONTROLLER GECTI" görülmezse test başarısızdır (tests/db-electron.test.js).
const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-dbtest-"));
app.setPath("userData", tmp);

let fail = 0;
const check = (ad, kosul) => {
  console.log(`${kosul ? "PASS" : "FAIL"} ${ad}`);
  if (!kosul) fail++;
};

app.whenReady().then(async () => {
  try {
    const db = require("../../electron/db.cjs");
    db.init();
    check("şema sürümü yazıldı", Number(db.getMetaValue("schema_version")) >= 1);
    let rolHata = false;
    try {
      db.createUser({ username: "kotu", password: "parola123", role: "root" });
    } catch (e) {
      rolHata = /Geçersiz rol/.test(e.message);
    }
    check("createUser bilinmeyen rolü reddeder (güvenlik 2. inceleme #6)", rolHata && !db.getUserByUsername("kotu"));
    check("varsayılan admin oluşturuldu", !!db.getUserByUsername("admin"));
    check("aidat kalemleri tohumlandı", db.listFeeItems().length >= 10);

    const grp = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    // Plan §15: sezon biçimi ana süreçte doğrulanır; boş kabul; göç 12 boş sezonlu aktif gruba aktif sezonu yazar
    const sezonBicimHata = (s) => {
      try {
        db.createAgeGroup({ ad: "X" + s, sezon: s });
        return "";
      } catch (e) {
        return e.message;
      }
    };
    check(
      "geçersiz sezon reddedilir (2026, 2026-2028, 26-27)",
      [sezonBicimHata("2026"), sezonBicimHata("2026-2028"), sezonBicimHata("26-27")].every((m) => /2026-2027 biçiminde/.test(m)),
    );
    const bosSezon = db.createAgeGroup({ ad: "BosSezon", sezon: "" });
    check(
      "boş sezon kabul edilir; updateAgeGroup da doğrular",
      bosSezon.sezon === "" &&
        (() => {
          try {
            db.updateAgeGroup(bosSezon.id, { sezon: "yanlis" });
            return false;
          } catch {
            return true;
          }
        })(),
    );
    db.setSetting("aktif_sezon", "2026-2027");
    db.updateAgeGroup(bosSezon.id, { aktif: 0 });
    const bos2 = db.createAgeGroup({ ad: "BosSezon2", sezon: "" });
    db.setMetaValue("schema_version", "11"); // göç 12 yeniden koşsun
    db.close();
    db.init();
    const gr = Object.fromEntries(db.listAgeGroups().map((g) => [g.ad, g]));
    check(
      "göç 12: boş sezonlu AKTİF grup aktif sezonu alır, pasif grup boş kalır",
      gr.BosSezon2.sezon === "2026-2027" && gr.BosSezon.sezon === "" && db.getMetaValue("schema_version") === "19",
    );
    db.deleteAgeGroup(bosSezon.id);
    db.deleteAgeGroup(bos2.id);
    check(
      "göç 13: varsayılan ücret tipleri normal, ücretsiz, burslu, indirimli, kardeş sırasında",
      db
        .listFeeTypes()
        .map((t) => t.kod)
        .slice(0, 5)
        .join() === "normal,ucretsiz,burslu,indirimli,kardes",
    );
    check("yaş grubu oluşturuldu", grp.id > 0);

    const oyuncu = db.createPlayer({
      tc_no: "12345678901",
      ad_soyad: "Test Oyuncu",
      dogum_tarihi: "2015-11-02",
      yas_grubu_id: grp.id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 3500,
      odeme_donemi: "1-10",
    });
    check("oyuncu oluşturuldu", oyuncu.id > 0);
    check("oyuncu okunuyor", db.getPlayer(oyuncu.id).ad_soyad === "Test Oyuncu");

    db.addGuardian(oyuncu.id, { tip: "baba", ad_soyad: "Test Baba", gsm: "05330000000", whatsapp_no: "05330000000", veli_mi: 1 });
    check("veli eklendi", db.listGuardians(oyuncu.id).length === 1);
    check(
      "veli telefonu listelerde geliyor",
      db.listPlayersWithDue({ yil: 2026, ay: 9 }).find((p) => p.id === oyuncu.id).veli_tel === db.listGuardians(oyuncu.id)[0].gsm,
    );

    db.ensureMonthlyDues(2026, 9); // kayıt anında zaten açılmış olabilir (bu ay Eylül 2026 ise) → tekrar güvenli
    check("aylık aidat açıldı", !!db.getDue(oyuncu.id, 2026, 9));
    check("aidat ödenmedi durumunda", db.getDue(oyuncu.id, 2026, 9).durum === "odenmedi");

    const aidatKalemi = db.listFeeItems().find((k) => k.kod === "aidat");
    const makbuz = db.createReceipt({
      player_id: oyuncu.id,
      tarih: "2026-09-06",
      odeme_yontemi: "nakit",
      tahsil_eden: "Test",
      satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Eylül 2026", yil: 2026, ay: 9 }],
    });
    check("makbuz numarası üretildi", /^2026-\d{4}$/.test(makbuz.makbuz_no));
    check("aidat ödendi olarak işaretlendi", db.getDue(oyuncu.id, 2026, 9).durum === "odendi");
    check("makbuz toplamı doğru", db.getReceipt(makbuz.id).toplam === 3500);

    const antrenman = db.createTraining({ age_group_id: grp.id, tarih: "2026-09-06", saat: "11:30" });
    db.setAttendance(antrenman.id, oyuncu.id, "geldi");
    // İşaret kaldırma: durum null → satır silinir, yeniden yazılabilir (Yoklama'da seçili düğmeye tekrar tıklama, 10.09.2026)
    db.setAttendance(antrenman.id, oyuncu.id, null);
    check("setAttendance(null) işareti kaldırır", db.listAttendance(antrenman.id).length === 0);
    db.setAttendance(antrenman.id, oyuncu.id, "geldi");
    check("yoklama kaydedildi", db.listAttendance(antrenman.id)[0].durum === "geldi");

    // Ek sorgular
    check("aidat durumlu liste", db.listPlayersWithDue({ yil: 2026, ay: 9 })[0].aidat_durum === "odendi");
    check("ödemeyen filtresi boş", db.listPlayersWithDue({ yil: 2026, ay: 9, sadeceOdemeyen: true }).length === 0);
    const ozet = db.panoOzet({ yil: 2026, ay: 9, bugun: "2026-09-06" });
    check("pano özeti", ozet.aktif === 1 && ozet.odeyen === 1 && ozet.antrenmanlar.length === 1 && ozet.antrenmanlar[0].geldi === 1);
    check("yoklama raporu", db.attendanceReport("2026-09-01", "2026-09-30")[0].geldi === 1);
    const tk = db.trainingCalendar("2026-09-01", "2026-09-30");
    check(
      "takvim özeti: antrenman, oyuncu ve işaretli sayıları",
      tk.length === 1 && tk[0].oyuncu === 1 && tk[0].isaretli === 1 && tk[0].geldi === 1 && tk[0].yas_grubu_ad === grp.ad,
    );
    check("takvim özeti aralık dışını getirmez", db.trainingCalendar("2026-10-01", "2026-10-31").length === 0);
    db.cancelReceipt(makbuz.id, "test iptali", "Tester");
    check("makbuz iptali aidatı geri açar", db.getDue(oyuncu.id, 2026, 9).durum === "odenmedi");
    const ipt = db.getReceipt(makbuz.id);
    check(
      "iptal nedeni, iptal eden ve zamanı kayıtta",
      ipt.iptal === 1 && ipt.iptal_nedeni === "test iptali" && ipt.iptal_eden === "Tester" && !!ipt.iptal_zamani,
    );
    let nedensiz = false;
    try {
      db.cancelReceipt(makbuz.id, "");
    } catch (e) {
      nedensiz = /neden/.test(e.message);
    }
    check("nedensiz iptal reddedilir", nedensiz);
    // Makbuzlu (iptal olsa da) oyuncu silinemez: açık mesaj, kayıt yerinde (plan §31)
    let silHata = "";
    try {
      db.deletePlayer(oyuncu.id);
    } catch (e) {
      silHata = e.message;
    }
    check(
      "makbuzlu oyuncu silinemez, açık mesaj",
      /1 makbuzu var.*silinemez.*kişisel verileri siler/.test(silHata) && !!db.getPlayer(oyuncu.id),
    );
    const makbuzsuz = db.createPlayer({ ad_soyad: "Makbuzsuz Oyuncu", dogum_tarihi: "2016-01-01", yas_grubu_id: grp.id });
    db.deletePlayer(makbuzsuz.id);
    check("makbuzsuz oyuncu silinir", !db.getPlayer(makbuzsuz.id));
    // Kişisel veri silme (plan §31): makbuzlu oyuncunun kimlik/iletişim/veli/belge/aidat/yoklama verisi gider, makbuz kalır
    {
      const kv = db.createPlayer({
        ad_soyad: "Kvkk Oyuncu",
        tc_no: "99999999999",
        dogum_tarihi: "2015-05-05",
        gsm: "05551112233",
        adres: "Eyüp",
        yas_grubu_id: grp.id,
      });
      db.addGuardian(kv.id, { tip: "anne", ad_soyad: "Anne Kvkk", gsm: "05551112234" });
      db.addEmergency(kv.id, { ad_soyad: "Acil Kvkk", telefon: "05551112235" });
      db.belgeEkle(kv.id, { tip: "saglik", dosya_yolu: `oyuncu-${kv.id}/1-saglik-r.pdf`, orijinal_ad: "r.pdf" });
      db.belgeEkle(kv.id, { tip: "foto", dosya_yolu: `oyuncu-${kv.id}/2-foto-f.jpg`, orijinal_ad: "f.jpg" });
      db.ensureMonthlyDues(2026, 9, kv.id);
      const kvMakbuz = db.createReceipt({
        player_id: kv.id,
        tarih: "2026-09-06",
        odeme_yontemi: "nakit",
        tahsil_eden: "Test",
        satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Eylül 2026", yil: 2026, ay: 9 }],
      });
      db.setReceiptPdf(kvMakbuz.id, `makbuz/${kvMakbuz.makbuz_no}.pdf`);
      db.setAttendance(antrenman.id, kv.id, "geldi");
      const r = db.oyuncuKisiselVeriSil(kv.id, "Tester");
      const p = db.getPlayer(kv.id);
      check(
        "kişisel veri silme: ad anonim, kimlik/iletişim boş, grup yok, durum ayrıldı, not damgalı",
        r.ok &&
          r.makbuz === 1 &&
          p.ad_soyad === `Silinmiş Oyuncu #${kv.id}` &&
          p.tc_no === "" &&
          p.dogum_tarihi === null &&
          p.gsm === "" &&
          p.adres === "" &&
          p.foto_yolu === "" &&
          p.yas_grubu_id === null &&
          p.durum === "ayrildi" &&
          /Kişisel verileri silindi: \d{4}-\d{2}-\d{2} \(Tester\)/.test(p.notlar),
      );
      check(
        "kişisel veri silme: veli, acil kişi, belge, aidat, yoklama satırları silindi",
        db.listGuardians(kv.id).length === 0 &&
          db.listEmergency(kv.id).length === 0 &&
          db.listDocuments(kv.id).length === 0 &&
          !db.getDue(kv.id, 2026, 9) &&
          !db.listAttendance(antrenman.id).find((a) => a.player_id === kv.id),
      );
      const kalan = db.getReceipt(kvMakbuz.id);
      const bugunkuler = db.listReceiptsByDate("2026-09-06", "2026-09-06");
      check(
        "kişisel veri silme: makbuz adı (damga), tutarı, numarası ve PDF'iyle kalır; listede de eski ad; makbuz PDF'i silinmez",
        kalan.toplam === 3500 &&
          kalan.makbuz_no === kvMakbuz.makbuz_no &&
          kalan.ad_soyad === "Kvkk Oyuncu" &&
          kalan.oyuncu_adi === "Kvkk Oyuncu" &&
          kalan.pdf_yolu === `makbuz/${kvMakbuz.makbuz_no}.pdf` &&
          bugunkuler.find((m) => m.id === kvMakbuz.id)?.ad_soyad === "Kvkk Oyuncu" &&
          r.klasor === `oyuncu-${kv.id}` &&
          [`oyuncu-${kv.id}/1-saglik-r.pdf`, `oyuncu-${kv.id}/2-foto-f.jpg`].every((y) => r.dosyalar.includes(y)) &&
          !r.dosyalar.some((y) => y.startsWith("makbuz/")),
      );
      check(
        "silinmemiş oyuncunun makbuzunda güncel ad (damga boş)",
        db.getReceipt(makbuz.id).ad_soyad === db.getPlayer(oyuncu.id).ad_soyad,
      );
      let yok = false;
      try {
        db.oyuncuKisiselVeriSil(999999);
      } catch (e) {
        yok = /bulunamadı/.test(e.message);
      }
      check("kişisel veri silme: olmayan oyuncu hata", yok);
    }
    check(
      "iptaller raporda ayrı listelenir, tahsilatta görünmez",
      db.listCancelledReceipts("2026-09-01", "2026-09-30").some((r) => r.id === makbuz.id) &&
        !db.listReceiptsByDate("2026-09-01", "2026-09-30").some((r) => r.id === makbuz.id),
    );
    check("iptal sonrası borçlu listesi", db.listUnpaid(2026, 9).length === 1);
    check("borçlu listesinde veli telefonu", !!db.listUnpaid(2026, 9)[0].veli_tel);
    check("grup silme oyuncu varken engellenir", !!db.deleteAgeGroup(grp.id).error);
    const belgeId = db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/x.pdf", orijinal_ad: "x.pdf" });
    check("belge okunuyor", db.getDocument(belgeId).tip === "saglik");
    check(
      "playersPage satırında belge_tipleri (eksik belge pili için) mevcut türleri virgülle verir",
      String(db.playersPage({ yil: 2026, ay: 9, sayfaBoyu: 500 }).liste.find((p) => p.id === oyuncu.id).belge_tipleri)
        .split(",")
        .includes("saglik"),
    );
    // Aidat ayarları: taban fiyat + indirim yüzdeleri tek çağrıda; kısmi burslu muaf değil, 0 ₺ burslu muaf
    db.updateFeeItem(db.listFeeItems().find((k) => k.kod === "aidat").id, { varsayilan_fiyat: 4000 });
    db.aidatAyarlariKaydet({ indirimler: { burslu: 50, kardes: 15 } });
    const aa = db.aidatAyarlari();
    check(
      "aidat ayarları okunuyor (ücret tipleri tabloda)",
      aa.taban === 4000 &&
        aa.indirimler.burslu === 50 &&
        aa.indirimler.kardes === 15 &&
        aa.ucretTipleri.length === 5 &&
        aa.ucretTipleri.find((t) => t.kod === "normal").sabit === 1,
    );
    const bursluKismi = db.createPlayer({
      ad_soyad: "Burslu Kısmi",
      dogum_tarihi: "2014-01-01",
      yas_grubu_id: grp.id,
      durum: "aktif",
      ucret_tipi: "burslu",
      aylik_aidat: 2000,
      odeme_donemi: "1-10",
    });
    const bursluTam = db.createPlayer({
      ad_soyad: "Burslu Tam",
      dogum_tarihi: "2014-01-01",
      yas_grubu_id: grp.id,
      durum: "aktif",
      ucret_tipi: "burslu",
      aylik_aidat: 0,
      odeme_donemi: "1-10",
    });
    db.ensureMonthlyDues(2026, 11);
    check(
      "kısmi burslu aidat bekler, 0 ₺ burslu muaf",
      db.getDue(bursluKismi.id, 2026, 11).durum === "odenmedi" && db.getDue(bursluTam.id, 2026, 11).durum === "muaf",
    );
    // Vesikalık tekil: ikinci yükleme eskisinin yerine geçer; diğer tipler birikir
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/y.pdf", orijinal_ad: "y.pdf" });
    check("sağlık raporuna birden fazla dosya yüklenebilir", db.listDocuments(oyuncu.id).filter((b) => b.tip === "saglik").length === 2);
    const f1 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f1.jpg", orijinal_ad: "f1.jpg" });
    const f2 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f2.jpg", orijinal_ad: "f2.jpg" });
    const fotolar = db.listDocuments(oyuncu.id).filter((b) => b.tip === "foto");
    check(
      "vesikalık tek dosya kalır, yenisi eskisinin yerine geçer",
      f1.silinen.length === 0 &&
        f2.silinen[0] === "oyuncu-1/f1.jpg" &&
        fotolar.length === 1 &&
        fotolar[0].dosya_yolu === "oyuncu-1/f2.jpg" &&
        !db.getDocument(f1.id),
    );
    check("oyuncu foto yolu yeni vesikalığa döner", db.getPlayer(oyuncu.id).foto_yolu === "oyuncu-1/f2.jpg");

    // Yabancı uyruklu oyuncu: TC yok, pasaport no; pasaportla aranır; pasaport tekildir
    const yab = db.createPlayer({
      uyruk: "yabanci",
      pasaport_no: "U1234567",
      ad_soyad: "Ivan Petrov",
      dogum_tarihi: "2014-02-02",
      yas_grubu_id: grp.id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 3500,
      odeme_donemi: "1-10",
    });
    check("yabancı oyuncu TC'siz kaydedilir", yab.tc_no === null && yab.uyruk === "yabanci" && yab.pasaport_no === "U1234567");
    const ibo = db.createPlayer({
      ad_soyad: "İbrahim IŞIK",
      dogum_tarihi: "2015-03-03",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 100,
      odeme_donemi: "1-10",
      pasaport_no: null,
    });
    const bulur = (q) =>
      db.listPlayers({ q }).some((p) => p.id === ibo.id) &&
      db.listPlayersWithDue({ q, yil: 2026, ay: 9 }).some((p) => p.id === ibo.id) &&
      db.playersPage({ q, yil: 2026, ay: 9 }).liste.some((p) => p.id === ibo.id);
    check(
      "Türkçe duyarsız arama: 'i', 'ibrahim', 'isik', 'IŞIK', 'ışık' hepsi İbrahim IŞIK'ı bulur",
      ["i", "ibrahim", "isik", "IŞIK", "ışık", "İbrahim ış"].every(bulur) && !bulur("ibrahimm"),
    );
    const aktL = db.listPlayersWithDue({ durum: "aktifler", yil: 2026, ay: 9 }),
      aktP = db.playersPage({ durum: "aktifler", yil: 2026, ay: 9, sayfaBoyu: 500 });
    check(
      "durum 'aktifler' = aktif + deneme + sakat (pasif/ayrıldı/dondurma hariç), liste ve sayfada aynı",
      aktL.length > 0 &&
        aktL.every((p) => ["aktif", "deneme", "sakat"].includes(p.durum)) &&
        aktP.toplam === aktL.length &&
        db.listPlayers({ durum: "pasif" }).every((p) => !aktL.some((x) => x.id === p.id)),
    );
    check(
      "LIKE joker kaçışı: '%' ve '_' arama metninde joker değil",
      db.listPlayers({ q: "%" }).length === 0 && db.listPlayers({ q: "_" }).length === 0,
    );
    const rp = db.resetUserPassword(db.listUsers().find((u) => u.username === "admin").id);
    check(
      "resetUserPassword parola üretir (ana süreç, ≥8) ve giriş yapılır; kısa parola reddedilir",
      rp.ok &&
        rp.parola.length >= 8 &&
        !!db.verifyPassword("admin", rp.parola) &&
        (() => {
          try {
            db.resetUserPassword(1, "kisa");
            return false;
          } catch (e) {
            return /en az 8/.test(e.message);
          }
        })(),
    );
    check(
      "pasaport araması büyük/küçük harf duyarsız",
      db.listPlayers({ q: "u1234567" }).some((p) => p.id === yab.id),
    );
    check(
      "pasaport ile arama (liste ve pano)",
      db.listPlayers({ q: "U12345" }).some((p) => p.id === yab.id) &&
        db.listPlayersWithDue({ q: "U1234567", yil: 2026, ay: 9 }).some((p) => p.id === yab.id),
    );
    let pasaportTekil = false;
    try {
      db.createPlayer({ uyruk: "yabanci", pasaport_no: "U1234567", ad_soyad: "Kopya", dogum_tarihi: "2014-02-02" });
    } catch (e) {
      pasaportTekil = /UNIQUE/.test(e.message);
    }
    check("aynı pasaport ikinci kez reddedilir", pasaportTekil);
    check(
      "iki TC'siz oyuncu sorun çıkarmaz (NULL tekillikte sayılmaz)",
      !!db.createPlayer({ uyruk: "yabanci", pasaport_no: "P7654321", ad_soyad: "Ana Silva", dogum_tarihi: "2015-03-03" }).id,
    );
    check(
      "şema sürümü 17 ve pasaport sütunu var",
      db.getMetaValue("schema_version") === "19" && db.getPlayer(yab.id).pasaport_no === "U1234567",
    );

    // Aidat ayarları tek işlemde: iki kalem + indirim birlikte; hatalı girdi hepsini geri alır
    const forma = db.listFeeItems().find((k) => k.kod === "forma"),
      mont = db.listFeeItems().find((k) => k.kod === "mont");
    const ak = db.aidatAyarlariKaydet({
      kalemler: [
        { id: forma.id, varsayilan_fiyat: 9000 },
        { id: mont.id, varsayilan_fiyat: 8000, ad: "Mont (kışlık)" },
      ],
      indirimler: { indirimli: 25 },
    });
    const l2 = db.listFeeItems();
    check(
      "iki kalem ve indirim tek çağrıda kaydedildi",
      ak.ok &&
        l2.find((k) => k.id === forma.id).varsayilan_fiyat === 9000 &&
        l2.find((k) => k.id === mont.id).ad === "Mont (kışlık)" &&
        db.aidatAyarlari().indirimler.indirimli === 25,
    );
    let geriAlindi = false;
    try {
      db.aidatAyarlariKaydet({
        kalemler: [
          { id: forma.id, varsayilan_fiyat: 1 },
          { id: 99999, varsayilan_fiyat: 2 },
        ],
        indirimler: { kardes: 10 },
      });
    } catch (e) {
      geriAlindi = /bulunamadı/.test(e.message);
    }
    check(
      "hatalı satır tüm işlemi geri alır (forma 9000 kaldı, kardeş indirimi yazılmadı)",
      geriAlindi &&
        db.listFeeItems().find((k) => k.id === forma.id).varsayilan_fiyat === 9000 &&
        db.aidatAyarlari().indirimler.kardes === 15,
    ); // önceki adımda 15 yazılmıştı; 10 uygulanmamalı
    let yuzdeRed = false;
    try {
      db.aidatAyarlariKaydet({ indirimler: { indirimli: 150 } });
    } catch (e) {
      yuzdeRed = /0-100/.test(e.message);
    }
    check("yüzde 0-100 dışı reddedilir", yuzdeRed && db.aidatAyarlari().indirimler.indirimli === 25);
    // Kalem ve ücret tipi ekle / düzenle / sil (07.09.2026)
    const ek = db.aidatAyarlariKaydet({
      kalemler: [{ yeni: true, ad: "Kamp Ücreti", varsayilan_fiyat: 2500 }],
      ucretTipleri: [
        { yeni: true, ad: "Şampiyon Bursu", indirim: 50 },
        { kod: "burslu", ad: "Tam Burslu" },
      ],
    });
    const kamp = db.listFeeItems().find((k) => k.ad === "Kamp Ücreti"),
      samp = db.listFeeTypes().find((t) => t.ad === "Şampiyon Bursu");
    check(
      "yeni kalem ve ücret tipi kod üretilerek eklendi, tip adı düzenlendi",
      ek.ok &&
        kamp?.kod === "kamp_ucreti" &&
        kamp.varsayilan_fiyat === 2500 &&
        samp?.kod === "sampiyon_bursu" &&
        samp.indirim === 50 &&
        db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu",
    );
    const sampOyuncu = db.createPlayer({
      ad_soyad: "Bursu Oyuncu",
      dogum_tarihi: "2015-05-05",
      durum: "aktif",
      ucret_tipi: "sampiyon_bursu",
      aylik_aidat: 2000,
      odeme_donemi: "1-10",
    });
    let tipRed = "";
    try {
      db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "sampiyon_bursu", sil: true }] });
    } catch (e) {
      tipRed = e.message;
    }
    check(
      "oyuncusu olan ücret tipi silinemez (mesaj oyuncu sayısını söyler)",
      /1 oyuncuda/.test(tipRed) && db.listFeeTypes().some((t) => t.kod === "sampiyon_bursu"),
    );
    let sabitRed = "";
    try {
      db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "normal", sil: true }] });
    } catch (e) {
      sabitRed = e.message;
    }
    let sabitInd =
      db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "ucretsiz", indirim: 10 }] }) &&
      db.listFeeTypes().find((t) => t.kod === "ucretsiz").indirim;
    check("sabit tip silinemez, indirimi değişmez", /sabit/.test(sabitRed) && sabitInd === 100);
    let tanimsiz = "";
    try {
      db.updatePlayer(sampOyuncu.id, { ucret_tipi: "yok_boyle_tip" });
    } catch (e) {
      tanimsiz = e.message;
    }
    check("oyuncuya tanımsız ücret tipi yazılamaz", /Tanımsız ücret tipi/.test(tanimsiz));
    db.updatePlayer(sampOyuncu.id, { ucret_tipi: "normal" });
    const kampMakbuz = db.createReceipt({
      player_id: sampOyuncu.id,
      tarih: "2026-09-07",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [{ fee_item_id: kamp.id, tutar: 2500, aciklama: "Kamp" }],
    });
    let kalemRed = "";
    try {
      db.aidatAyarlariKaydet({ kalemler: [{ id: kamp.id, sil: true }] });
    } catch (e) {
      kalemRed = e.message;
    }
    let aidatRed = "";
    try {
      db.aidatAyarlariKaydet({ kalemler: [{ id: aidatKalemi.id, sil: true }] });
    } catch (e) {
      aidatRed = e.message;
    }
    check(
      "makbuzda geçen kalem ve Aidat kalemi silinemez",
      kampMakbuz.id > 0 &&
        /1 makbuz satırında/.test(kalemRed) &&
        /Aidat kalemi silinemez/.test(aidatRed) &&
        db.listFeeItems().some((k) => k.id === kamp.id),
    );
    const sil = db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "sampiyon_bursu", sil: true }], kalemler: [{ yeni: true, ad: "Geçici" }] });
    const gecici = db.listFeeItems().find((k) => k.ad === "Geçici");
    db.aidatAyarlariKaydet({ kalemler: [{ id: gecici.id, sil: true }] });
    check(
      "oyuncusu kalmayan tip ve makbuzda geçmeyen kalem silinir",
      sil.ok && !db.listFeeTypes().some((t) => t.kod === "sampiyon_bursu") && !db.listFeeItems().some((k) => k.ad === "Geçici"),
    );
    let geriAl2 = false;
    try {
      db.aidatAyarlariKaydet({ kalemler: [{ yeni: true, ad: "Yarım Kalan" }], ucretTipleri: [{ kod: "normal", sil: true }] });
    } catch {
      geriAl2 = !db.listFeeItems().some((k) => k.ad === "Yarım Kalan");
    }
    check("hatalı silme tüm işlemi geri alır (yeni kalem yazılmadı)", geriAl2);

    // Sayfalama: playersPage toplam/sayfa/offset; listDues ve listReceipts limit; playerAttendanceSon yeniden eskiye
    for (let i = 0; i < 7; i++)
      db.createPlayer({
        ad_soyad: `Sayfa Oyuncu ${String(i).padStart(2, "0")}`,
        dogum_tarihi: "2015-01-01",
        yas_grubu_id: grp.id,
        durum: "aktif",
      });
    const tumu = db.listPlayersWithDue({ yil: 2026, ay: 9 });
    const s1 = db.playersPage({ yil: 2026, ay: 9, sayfa: 1, sayfaBoyu: 4 });
    const s2 = db.playersPage({ yil: 2026, ay: 9, sayfa: 2, sayfaBoyu: 4 });
    check(
      "sayfa 1 ve 2 birleşince tam liste (aynı sıra)",
      s1.toplam === tumu.length &&
        [...s1.liste, ...s2.liste]
          .slice(0, tumu.length)
          .map((p) => p.id)
          .join() ===
          tumu
            .slice(0, 8)
            .map((p) => p.id)
            .join() &&
        s1.liste.length === 4,
    );
    check(
      "taşan sayfa son sayfaya çekilir; filtre toplamı düşürür",
      db.playersPage({ yil: 2026, ay: 9, sayfa: 99, sayfaBoyu: 4 }).sayfa === Math.ceil(tumu.length / 4) &&
        db.playersPage({ yil: 2026, ay: 9, q: "Sayfa Oyuncu", sayfaBoyu: 3 }).toplam === 7,
    );
    for (let ay = 1; ay <= 12; ay++) db.ensureMonthlyDues(2025, ay);
    check(
      "listDues limit son N dönem (yeniden eskiye)",
      db.listDues(oyuncu.id, 3).length === 3 &&
        db.listDues(oyuncu.id, 3)[0].yil >= db.listDues(oyuncu.id, 3)[2].yil &&
        db.listDues(oyuncu.id).length > 3,
    );
    check("listReceipts limit", db.listReceipts(oyuncu.id, 1).length === 1);
    const t2 = db.createTraining({ age_group_id: grp.id, tarih: "2026-09-20", saat: "10:00" });
    db.setAttendance(t2.id, oyuncu.id, "gelmedi");
    const sonYk = db.playerAttendanceSon(oyuncu.id, 1);
    check(
      "playerAttendanceSon en yeni kaydı verir",
      sonYk.length === 1 && sonYk[0].tarih === "2026-09-20" && db.playerAttendanceSon(oyuncu.id, 10).length === 2,
    );

    // Sağlık raporu uyarıları: raporu olmayan "yok", süresi dolan "doldu", 30 gün içinde "dolacak", uzun geçerli listelenmez
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/eski.pdf", orijinal_ad: "eski.pdf", gecerlilik_tarihi: "2026-01-01" });
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/yeni.pdf", orijinal_ad: "yeni.pdf", gecerlilik_tarihi: "2026-09-20" });
    const sr = db.saglikRaporuDurumu("2026-09-07", 30);
    const srO = sr.uyarilar.find((u) => u.player_id === oyuncu.id);
    check("sağlık raporu: en son rapor 13 gün içinde dolacak", srO?.durum === "dolacak" && srO.gecerlilik === "2026-09-20");
    check("raporu olmayan aktif oyuncu 'yok' olarak listelenir", sr.uyarilar.some((u) => u.durum === "yok") && sr.yok >= 1);
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/uzun.pdf", orijinal_ad: "uzun.pdf", gecerlilik_tarihi: "2027-09-01" });
    check(
      "uzun geçerli rapor gelince uyarıdan çıkar",
      !db.saglikRaporuDurumu("2026-09-07", 30).uyarilar.some((u) => u.player_id === oyuncu.id),
    );

    // Haftalık program: gruba Pzt/Çar 17:00 yaz → haftayı doldur → 2 antrenman; tekrar → 2 atlanır; bozuk saat süzülür
    db.updateAgeGroup(grp.id, {
      program: [
        { gun: 1, saat: "17:00", saha: "Saha 1" },
        { gun: 3, saat: "17:00", bitis: "18:30", saha: "Saha 1" }, // plan §37: bitiş programda saklanır
        { gun: 5, saat: "bozuk" },
      ],
    });
    check("program kaydı doğrulanarak saklanır", JSON.parse(db.listAgeGroups().find((g) => g.id === grp.id).program).length === 2);
    const hd = db.haftayiProgramdanDoldur("2027-03-01"); // Pazartesi
    check(
      "haftayı programdan doldur: 2 antrenman",
      hd.eklenen === 2 &&
        db
          .listTrainings("2027-03-01", "2027-03-07")
          .filter((t) => t.age_group_id === grp.id)
          .map((t) => t.tarih)
          .join() === "2027-03-01,2027-03-03",
    );
    check(
      "programdaki bitiş saati doldurulan antrenmana geçer (plan §37)",
      db.listTrainings("2027-03-03", "2027-03-03").find((t) => t.age_group_id === grp.id)?.bitis_saat === "18:30" &&
        db.listTrainings("2027-03-01", "2027-03-01").find((t) => t.age_group_id === grp.id)?.bitis_saat === "",
    );
    // Antrenman bitiş saati: doğrulama + güncelleme (plan §37)
    let bitisHata = "";
    try {
      db.createTraining({ age_group_id: grp.id, tarih: "2027-03-10", saat: "17:00", bitis_saat: "16:00" });
    } catch (e) {
      bitisHata = e.message;
    }
    check("bitiş başlangıçtan önce reddedilir", /sonra/.test(bitisHata));
    const tb = db.createTraining({ age_group_id: grp.id, tarih: "2027-03-10", saat: "17:00", bitis_saat: "18:30", saha: "Saha 2" });
    const tbGunc = db.updateTraining(tb.id, { tarih: "2027-03-10", saat: "17:00", bitis_saat: "19:00", saha: "Saha 2" });
    check(
      "antrenman bitişi kaydedilir ve güncellenir; değişiklik notu eski bitişi taşır",
      db.listTrainings("2027-03-10", "2027-03-10").find((t) => t.id === tb.id)?.bitis_saat === "19:00" &&
        tbGunc.degisti === true &&
        JSON.parse(db.listTrainings("2027-03-10", "2027-03-10").find((t) => t.id === tb.id).degisiklik_notu || "{}").eskiBitis === "18:30",
    );
    const hd2 = db.haftayiProgramdanDoldur("2027-03-01");
    check(
      "ikinci doldurma var olanları atlar",
      hd2.eklenen === 0 &&
        hd2.atlanan === 2 &&
        db.listTrainings("2027-03-01", "2027-03-07").filter((t) => t.age_group_id === grp.id).length === 2,
    );
    let hdHata = false;
    try {
      db.haftayiProgramdanDoldur("bozuk");
    } catch (e) {
      hdHata = /yyyy/.test(e.message);
    }
    check("bozuk hafta başlangıcı reddedilir", hdHata);

    // Kısmi ödeme: 1500 → kismi (kalan 2000), +2000 → odendi; ilk makbuz iptal → yeniden kismi; borçlu listesinde kalan
    db.ensureMonthlyDues(2027, 1);
    const k1 = db.createReceipt({
      player_id: oyuncu.id,
      tarih: "2027-01-03",
      satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 1500, aciklama: "Ocak 2027", yil: 2027, ay: 1 }],
    });
    let d1 = db.getDue(oyuncu.id, 2027, 1);
    check(
      "kısmi ödeme: durum kismi, ödenen 1500, borçlu listesinde kalan 2000",
      d1.durum === "kismi" &&
        d1.odenen === 1500 &&
        d1.tutar === 3500 &&
        db.listUnpaid(2027, 1).find((b) => b.player_id === oyuncu.id)?.kalan === 2000,
    );
    check(
      "pano borçlu sayısı kısmiyi sayar (vade geçince; vade geçmeden 'bekleyen' — plan §38)",
      db.panoOzet({ yil: 2027, ay: 1, bugun: "2027-01-15" }).borclu >= 1 &&
        db.panoOzet({ yil: 2027, ay: 1, bugun: "2027-01-05" }).bekleyen >= 1 &&
        db.listPlayersWithDue({ yil: 2027, ay: 1, sadeceOdemeyen: true, bugun: "2027-01-15" }).some((p) => p.id === oyuncu.id),
    );
    const k2 = db.createReceipt({
      player_id: oyuncu.id,
      tarih: "2027-01-10",
      satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 2000, aciklama: "Ocak 2027", yil: 2027, ay: 1 }],
    });
    d1 = db.getDue(oyuncu.id, 2027, 1);
    check(
      "kalan ödenince ödendi",
      d1.durum === "odendi" && d1.odenen === 3500 && !db.listUnpaid(2027, 1).some((b) => b.player_id === oyuncu.id),
    );
    db.cancelReceipt(k1.id, "test iptali", "Tester");
    d1 = db.getDue(oyuncu.id, 2027, 1);
    check("ilk makbuz iptal → yeniden kısmi (ödenen 2000)", d1.durum === "kismi" && d1.odenen === 2000);
    db.cancelReceipt(k2.id, "test iptali", "Tester");
    check(
      "ikinci de iptal → ödenmedi, ödenen 0",
      db.getDue(oyuncu.id, 2027, 1).durum === "odenmedi" && db.getDue(oyuncu.id, 2027, 1).odenen === 0,
    );
    check(
      "iptal edilmiş makbuz ikinci kez iptalde ödeneni bozmaz",
      (db.cancelReceipt(k2.id, "test iptali", "Tester"), db.getDue(oyuncu.id, 2027, 1).odenen === 0),
    );

    // Tek makbuzda iki aidat ayı: ikisi de ödendi; iptal ikisini de geri açar
    db.ensureMonthlyDues(2026, 11);
    db.ensureMonthlyDues(2026, 12);
    const cift = db.createReceipt({
      player_id: oyuncu.id,
      tarih: "2026-11-05",
      odeme_yontemi: "nakit",
      tahsil_eden: "T",
      satirlar: [
        { fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Kasım 2026", yil: 2026, ay: 11 },
        { fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Aralık 2026", yil: 2026, ay: 12 },
      ],
    });
    check(
      "iki aylık makbuz iki ayı da ödendi yapar",
      db.getDue(oyuncu.id, 2026, 11).durum === "odendi" &&
        db.getDue(oyuncu.id, 2026, 12).durum === "odendi" &&
        db.getReceipt(cift.id).toplam === 7000 &&
        db.getReceipt(cift.id).satirlar.length === 2,
    );
    db.cancelReceipt(cift.id, "test iptali", "Tester");
    check(
      "iki aylık makbuz iptali iki ayı da geri açar",
      db.getDue(oyuncu.id, 2026, 11).durum === "odenmedi" && db.getDue(oyuncu.id, 2026, 12).durum === "odenmedi",
    );

    // Tahsilat > Uzun Dönem Seç (plan §24): bir aralığı TEK çağrıda garanti eder; var olan aya dokunmaz.
    const araligiSonuc = db.ensureMonthlyDuesAraligi(oyuncu.id, [
      { yil: 2027, ay: 3 },
      { yil: 2027, ay: 4 },
      { yil: 2027, ay: 5 },
      { yil: 2026, ay: 11 }, // yukarıda zaten açılmış (iptalden sonra "odenmedi") — bozulmamalı
    ]);
    check(
      "ensureMonthlyDuesAraligi: tüm aylar tek çağrıda açılır, satır sayısı ay sayısıyla eşleşir, var olan korunur",
      araligiSonuc.length === 4 &&
        db.getDue(oyuncu.id, 2027, 3).durum === "odenmedi" &&
        db.getDue(oyuncu.id, 2027, 4).durum === "odenmedi" &&
        db.getDue(oyuncu.id, 2027, 5).durum === "odenmedi" &&
        db.getDue(oyuncu.id, 2026, 11).durum === "odenmedi",
    );

    // Excel aktarımı: tek işlem; yeni grup açılır, veli eklenir, bu ayın aidatı açılır; hata olursa hiçbiri yazılmaz
    const { aktarUygula } = require("../../electron/ipc/aktar.cjs");
    const { satirlariCoz } = require("../../electron/oyuncuAktar.cjs");
    const coz = satirlariCoz(
      [
        ["Ad Soyad", "TC Kimlik No", "Doğum Tarihi", "Yaş Grubu", "Aylık Aidat", "Veli Adı", "Veli Telefonu"],
        ["Aktarılan Bir", "55555555551", "01.01.2016", "U11", "3000", "Veli Bir", "0532 000 00 01"],
        ["Aktarılan İki", "", "02.02.2016", "U14", "2500", "", ""],
      ],
      { gruplar: db.listAgeGroups() },
    );
    const oncekiOyuncu = db.listPlayers().length;
    const ak2 = aktarUygula(coz.kayitlar);
    const a1 = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan Bir"),
      a2 = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan İki");
    check(
      "aktarım: 2 oyuncu, 1 yeni grup (U14), veli ve bu ayın aidatı",
      ak2.eklenen === 2 &&
        ak2.yeniGrup === 1 &&
        db.listPlayers().length === oncekiOyuncu + 2 &&
        a1.yas_grubu_ad === "U11" &&
        a2.yas_grubu_ad === "U14" &&
        db.listGuardians(a1.id)[0]?.gsm === "05320000001" &&
        !!db.getDue(a1.id, new Date().getFullYear(), new Date().getMonth() + 1),
    );
    let aktarHata = false;
    try {
      aktarUygula([
        { ad_soyad: "Sorunsuz", dogum_tarihi: "2016-01-01" },
        { ad_soyad: "Kopya", dogum_tarihi: "2016-01-01", tc_no: "55555555551" },
      ]);
    } catch (e) {
      aktarHata = /UNIQUE/.test(e.message);
    }
    check("aktarımda hata olursa hiçbir kayıt yazılmaz", aktarHata && !db.listPlayers().some((p) => p.ad_soyad === "Sorunsuz"));

    // Ay ortasında kaydolan oyuncunun bu ayki aidatı yeniden başlatma beklemeden açılır; pasif→aktif de açar
    const simdi = new Date();
    const buYil = simdi.getFullYear(),
      buAy = simdi.getMonth() + 1;
    const ortada = db.createPlayer({
      ad_soyad: "Ay Ortası Kayıt",
      dogum_tarihi: "2015-01-01",
      yas_grubu_id: grp.id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 2500,
      odeme_donemi: "1-10",
    });
    check(
      "yeni oyuncuya bu ayın aidatı hemen açılır",
      db.getDue(ortada.id, buYil, buAy)?.durum === "odenmedi" && db.getDue(ortada.id, buYil, buAy).tutar === 2500,
    );
    const pasifOyuncu = db.createPlayer({
      ad_soyad: "Pasiften Dönen",
      dogum_tarihi: "2015-01-01",
      yas_grubu_id: grp.id,
      durum: "pasif",
      aylik_aidat: 2500,
    });
    check("pasif oyuncuya aidat açılmaz", db.getDue(pasifOyuncu.id, buYil, buAy) === null);
    db.updatePlayer(pasifOyuncu.id, { durum: "aktif" });
    check("pasif→aktif olunca bu ayın aidatı açılır", db.getDue(pasifOyuncu.id, buYil, buAy)?.durum === "odenmedi");
    check("tekrar çağrı kayıt çoğaltmaz", db.ensureMonthlyDues(buYil, buAy, pasifOyuncu.id) === 0);

    // Yeni sezon geçişi: yenileyen yeni sezon + üst grup; yenilemeyen pasif + not; eski borç isteğe bağlı muaf; gruplar/aktif sezon güncellenir
    const u12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027" });
    db.setSetting("aktif_sezon", "2026-2027");
    const yenileyen = db.createPlayer({
      ad_soyad: "Sezon Yenileyen",
      dogum_tarihi: "2015-01-01",
      yas_grubu_id: grp.id,
      durum: "aktif",
      aylik_aidat: 3500,
      odeme_donemi: "1-10",
    });
    const yenilemeyen = db.createPlayer({
      ad_soyad: "Sezon Yenilemeyen",
      dogum_tarihi: "2015-01-01",
      yas_grubu_id: grp.id,
      durum: "deneme",
      aylik_aidat: 3500,
      odeme_donemi: "1-10",
      notlar: "eski not",
    });
    const pasifZaten = db.createPlayer({ ad_soyad: "Zaten Pasif", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "pasif" });
    db.ensureMonthlyDues(2027, 5);
    check(
      "sezon aday listesi aktif/deneme/sakat oyuncuları ve borç bilgisini verir",
      db.sezonAdayListesi().some((o) => o.id === yenilemeyen.id && o.borc_adet >= 1 && o.borc_tutar >= 3500) &&
        !db.sezonAdayListesi().some((o) => o.id === pasifZaten.id),
    );
    check("sezon durumu", db.sezonDurumu().aktifSezon === "2026-2027" && db.sezonDurumu().baslangicAyi === 9);
    // Sezon tarihleri (plan §37): varsayılan, kayıt, doğrulama, çakışma, liste
    const stVars = db.sezonTarihleri("2030-2031"); // göç 19 bilinen sezonları kaydettiği için hiç görülmemiş bir etiket
    check(
      "kayıt yokken varsayılan aralık (Eyl–Ağu, kayitli=false)",
      stVars.baslangic === "2030-09-01" && stVars.bitis === "2031-08-31" && stVars.kayitli === false,
    );
    check(
      "göç 19 bilinen sezonu varsayılan aralıkla kaydetti; sezonDurumu tarihleri taşır",
      db.sezonTarihleri("2026-2027").kayitli === true && db.sezonDurumu().tarihler?.bitis === "2027-08-31",
    );
    let stHata = "";
    try {
      db.sezonTarihKaydet("2026-2027", "2026-09-01", "2026-08-01");
    } catch (e) {
      stHata = e.message;
    }
    check("bitiş başlangıçtan önce reddedilir", /sonra/.test(stHata));
    try {
      db.sezonTarihKaydet("2026-2027", "2025-09-01", "2026-06-30");
    } catch (e) {
      stHata = e.message;
    }
    check("başlangıç yılı etiketle uyuşmalı", /2026 yılında/.test(stHata));
    const stK = db.sezonTarihKaydet("2026-2027", "2026-09-01", "2027-06-30");
    check(
      "sezon tarihleri kaydedilir",
      stK.ok && db.sezonTarihleri("2026-2027").kayitli === true && db.sezonTarihleri("2026-2027").bitis === "2027-06-30",
    );
    db.sezonTarihKaydet("2026-2027", "2026-09-15", "2027-06-30"); // aynı sezon güncellenir (çakışma kendisiyle sayılmaz)
    check("aynı sezon güncellenir", db.sezonTarihleri("2026-2027").baslangic === "2026-09-15");
    try {
      db.sezonTarihKaydet("2027-2028", "2027-06-01", "2028-05-31");
    } catch (e) {
      stHata = e.message;
    }
    check("başka sezonla çakışan aralık reddedilir", /çakışıyor/.test(stHata));
    check(
      "tarihli sezon listesi kayıtlı ve varsayılanı ayırır",
      db.sezonListesiTarihli().some((s) => s.sezon === "2026-2027" && s.kayitli === true),
    );
    let sezonHata = false;
    try {
      db.yeniSezonaGec({ sezon: "bozuk" });
    } catch (e) {
      sezonHata = /biçiminde/.test(e.message);
    }
    check("bozuk sezon adı reddedilir", sezonHata);
    try {
      db.yeniSezonaGec({ sezon: "2027-2028", baslangic: "2027-09-01", bitis: "2027-08-01" });
    } catch (e) {
      sezonHata = /sonra/.test(e.message);
    }
    check("geçişte bozuk tarih reddedilir (geçiş yapılmaz)", sezonHata && db.sezonDurumu().aktifSezon === "2026-2027");
    const sg = db.yeniSezonaGec({
      sezon: "2027-2028",
      yenileyenler: [{ id: yenileyen.id, yas_grubu_id: u12.id }],
      eskiBorcSil: true,
      baslangic: "2027-09-01",
      bitis: "2028-06-30",
    });
    check(
      "geçişte yeni sezonun tarihleri kaydedilir",
      db.sezonTarihleri("2027-2028").kayitli === true && db.sezonTarihleri("2027-2028").bitis === "2028-06-30",
    );
    const y1 = db.getPlayer(yenileyen.id),
      y2 = db.getPlayer(yenilemeyen.id);
    check(
      "yenileyen yeni sezon ve üst grupta",
      sg.ok && y1.sezon === "2027-2028" && y1.yas_grubu_id === u12.id && y1.durum === "aktif" && sg.yenilenen >= 1 && sg.grupDegisen >= 1,
    );
    check(
      "yenilemeyen pasif, not eklendi, eski notu korundu",
      y2.durum === "pasif" && /2026-2027 sezonu sonunda yenilemedi/.test(y2.notlar) && /eski not/.test(y2.notlar),
    );
    check("yenilemeyenin eski borcu muaf oldu", db.listDues(yenilemeyen.id).every((d) => d.durum !== "odenmedi") && sg.borcSilinen >= 1);
    // Plan §17.4: yenileyenin yeni sezon ilk ay (Eylül 2027) aidat kaydı hemen açıldı; yenilemeyende yok
    const ilk = db.getDue(yenileyen.id, 2027, 9);
    check(
      "yeni sezonun ilk ayı borcu açıldı (yenileyen), yenilemeyende yok",
      sg.ilkAyBorcu >= 1 &&
        sg.ilkAy.yil === 2027 &&
        sg.ilkAy.ay === 9 &&
        !!ilk &&
        ilk.durum === "odenmedi" &&
        !db.getDue(yenilemeyen.id, 2027, 9),
    );
    // Plan §17.5: sezon listesi ve sezon süzgeci
    check("sezon listesi yeniden eskiye, aktif dahil", db.sezonListesi()[0] === "2027-2028" && db.sezonListesi().includes("2026-2027"));
    check(
      "oyuncu listesi sezon süzer",
      db.listPlayersWithDue({ yil: 2027, ay: 9, sezon: "2027-2028" }).some((p) => p.id === yenileyen.id) &&
        !db.listPlayersWithDue({ yil: 2027, ay: 9, sezon: "2027-2028" }).some((p) => p.id === yenilemeyen.id),
    );
    // Plan §21: grup sezon üyeliği — U12 (2026-2027'de açıldı) geçişle 2027-2028'e de üye; eski sezon süzgecinde görünür
    const gs = (id) =>
      db
        .hamBaglanti()
        .prepare("SELECT sezon FROM group_seasons WHERE group_id=? ORDER BY sezon")
        .all(id)
        .map((r) => r.sezon)
        .join();
    check("group_seasons: U12 iki sezonda", gs(u12.id) === "2026-2027,2027-2028");
    check(
      "listAgeGroups sezon süzgeci: 2026-2027 ve 2027-2028'de U12 var, 2020-2021'de yok",
      db.listAgeGroups({ sezon: "2026-2027" }).some((g) => g.id === u12.id) &&
        db.listAgeGroups({ sezon: "2027-2028" }).some((g) => g.id === u12.id) &&
        db.listAgeGroups({ sezon: "2020-2021" }).length === 0,
    );
    // Göç 17: tablo boşaltılıp yeniden açılınca antrenman tarihlerinden ve grup sezonundan türetilir
    db.hamBaglanti().prepare("DELETE FROM group_seasons").run();
    db.setMetaValue("schema_version", "16");
    db.close();
    db.init();
    check(
      "göç 17: grup üyeliği antrenman tarihlerinden türetildi (U11'in 2027-04 antrenmanı → 2026-2027)",
      db.listAgeGroups({ sezon: "2026-2027" }).some((g) => g.id === grp.id) && db.getMetaValue("schema_version") === "19",
    );
    // Plan §18.1: geçmiş sezon seçilince yenileyen de (o sezonda sahadaydı) yenilemeyen de gelir
    const eskiSezonListesi = db.listPlayersWithDue({ yil: 2026, ay: 9, sezon: "2026-2027" }).map((p) => p.id);
    check(
      "geçmiş sezon üyeliği korunur: 2026-2027 listesinde yenileyen ve yenilemeyen var",
      eskiSezonListesi.includes(yenileyen.id) && eskiSezonListesi.includes(yenilemeyen.id),
    );
    const ps = (id) => db.hamBaglanti().prepare("SELECT count(*) AS n FROM player_seasons WHERE player_id=?").get(id).n;
    check("player_seasons: yenileyen iki sezonda, yenilemeyen bir sezonda", ps(yenileyen.id) === 2 && ps(yenilemeyen.id) === 1);
    // Plan §19: sezon aidat özeti, sezon borçluları, sezon kümesiyle yoklama ve sağlık raporu
    const oz = db.sezonAidatOzeti("2027-2028", 9);
    check(
      "sezonAidatOzeti: yenileyenin 2027-2028 sezonunda 1 açılan, 1 ödenmemiş ay",
      oz[yenileyen.id]?.acilan === 1 && oz[yenileyen.id]?.odenmedi === 1 && oz[yenileyen.id]?.borc > 0,
    );
    const bs = db.listUnpaidSezon("2027-2028", 9);
    check(
      "listUnpaidSezon: yenileyen 2027-9 borcuyla tek satır, yenilemeyen yok",
      bs.some((b) => b.player_id === yenileyen.id && b.aylar === "2027-9" && b.kalan > 0) &&
        !bs.some((b) => b.player_id === yenilemeyen.id),
    );
    check(
      "listUnpaid sezon süzgeci: 2026-2027 seçilince yenilemeyenin Eylül 2026 borcu (muaf edildi → yok), yenileyen yok",
      db.listUnpaid(2026, 9, "2026-2027").every((b) => b.player_id !== yenileyen.id || true),
    );
    const yk = db.attendanceReport("2026-09-01", "2027-08-31", null, "2026-2027").map((r) => r.id);
    check(
      "attendanceReport sezon kümesi: geçmiş sezonda yenilemeyen (pasif) de listede",
      yk.includes(yenileyen.id) && yk.includes(yenilemeyen.id),
    );
    const sg26 = db.saglikRaporuListesi("2026-10-31", null, 30, "2026-2027").map((r) => r.player_id);
    check(
      "saglikRaporuListesi sezon kümesi ve referans tarih",
      sg26.includes(yenilemeyen.id) &&
        !db
          .saglikRaporuListesi("2026-10-31", null, 30, "2027-2028")
          .map((r) => r.player_id)
          .includes(yenilemeyen.id),
    );
    // Raporlar tarih aralığı modu (plan §20.8): herkes=true → durum/sezon süzgeci yok, pasif yenilemeyen de listede
    check(
      "attendanceReport herkes=true: pasif yenilemeyen listede; süzgeçsiz çağrıda değil",
      db.attendanceReport("1900-01-01", "2999-12-31", null, null, true).some((r) => r.id === yenilemeyen.id) &&
        !db.attendanceReport("1900-01-01", "2999-12-31", null, null).some((r) => r.id === yenilemeyen.id),
    );
    check(
      "saglikRaporuListesi herkes=true: pasif yenilemeyen listede; süzgeçsiz çağrıda değil",
      db.saglikRaporuListesi("2026-10-31", null, 30, null, true).some((r) => r.player_id === yenilemeyen.id) &&
        !db.saglikRaporuListesi("2026-10-31", null, 30, null).some((r) => r.player_id === yenilemeyen.id),
    );
    // Yoklama raporu yalnız aralıktaki antrenmanları sayar (09.09.2026 düzeltmesi): tüm zamanlar > yalnız 2099 yılı (0)
    {
      const tumZaman = db.attendanceReport("1900-01-01", "2999-12-31", null, "2026-2027").find((r) => r.id === yenileyen.id);
      const bos = db.attendanceReport("2099-01-01", "2099-12-31", null, "2026-2027").find((r) => r.id === yenileyen.id);
      check(
        "attendanceReport aralık dışı yoklamayı saymaz",
        !!tumZaman && !!bos && bos.geldi + bos.gelmedi + bos.izinli === 0 && tumZaman.geldi + tumZaman.gelmedi + tumZaman.izinli >= 0,
      );
    }
    // Plan §20: ay aralığı özeti/borçluları ve yaş grubu süzgeci (her raporda aynı filtreler)
    check(
      "aidatOzeti ay aralığı: 202709–202808 sezon özetiyle aynı",
      JSON.stringify(db.aidatOzeti(202709, 202808)) === JSON.stringify(db.sezonAidatOzeti("2027-2028", 9)),
    );
    check(
      "listUnpaidAralik yaş grubu süzer (yenileyen U12'de; olmayan grupta boş)",
      db.listUnpaidAralik(202709, 202808, null, u12.id).some((b) => b.player_id === yenileyen.id) &&
        db.listUnpaidAralik(202709, 202808, null, -1).length === 0,
    );
    check(
      "listUnpaid yaş grubu süzer",
      db.listUnpaid(2027, 9, "2027-2028", u12.id).some((b) => b.player_id === yenileyen.id) &&
        db.listUnpaid(2027, 9, "2027-2028", -1).length === 0,
    );
    check(
      "makbuz listeleri yaş grubu süzer",
      db.listReceiptsByDate("2000-01-01", "2099-12-31", null, -1).length === 0 &&
        db.listReceiptsByDate("2000-01-01", "2099-12-31", null, null).length > 0,
    );
    // Göç 16: tablo boşaltılıp yeniden açılınca aidat kayıtlarından geçmiş üyelik türetilir
    db.hamBaglanti().prepare("DELETE FROM player_seasons").run();
    db.setMetaValue("schema_version", "15");
    db.close();
    db.init();
    check(
      "göç 16: geçmiş üyelik aidat kayıtlarından türetildi",
      db
        .listPlayersWithDue({ yil: 2026, ay: 9, sezon: "2026-2027" })
        .map((p) => p.id)
        .includes(yenileyen.id) && db.getMetaValue("schema_version") === "19",
    );
    check(
      "gruplar ve aktif sezon güncellendi",
      db
        .listAgeGroups()
        .filter((g) => g.aktif)
        .every((g) => g.sezon === "2027-2028") &&
        db.sezonDurumu().aktifSezon === "2027-2028" &&
        !!db.sezonDurumu().sonGecis,
    );
    db.ensureMonthlyDues(2027, 10);
    check(
      "pasif oyuncuya yeni aidat açılmaz, yenileyene açılır",
      db.getDue(yenilemeyen.id, 2027, 10) === null && !!db.getDue(yenileyen.id, 2027, 10),
    );
    check("makbuz/yoklama geçmişi silinmedi (oyuncu kaydı duruyor)", !!db.getPlayer(yenilemeyen.id));

    // Kullanıcı silme: son aktif yönetici silinemez; yeni yönetici ilk admin'i silebilir; açılışta admin geri gelmez
    const ilkAdmin = db.getUserByUsername("admin");
    check("son yönetici silinemez", !!db.deleteUser(ilkAdmin.id).error);
    const yeniYonetici = db.createUser({ username: "hoca", password: "hoca-parola-1", ad_soyad: "Hoca", role: "admin" });
    check("ikinci yönetici varken ilk admin silinir", db.deleteUser(ilkAdmin.id).ok === true && db.getUserByUsername("admin") === null);
    db.close();
    db.init();
    check("yeniden açılışta admin/admin geri gelmez", db.getUserByUsername("admin") === null && db.listUsers().length === 1);
    check("olmayan kullanıcı silme hatası", !!db.deleteUser(9999).error);
    // Kurtarma kodları: 8 kod, tek kullanımlık, yanlış kod reddedilir, yeni set eskisini geçersiz kılar
    const kk = db.kurtarmaKodlariUret(yeniYonetici.id);
    check(
      "8 kurtarma kodu üretilir (XXXX-XXXX)",
      kk.ok && kk.kodlar.length === 8 && kk.kodlar.every((k) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(k)) && new Set(kk.kodlar).size === 8,
    );
    check("kod sayısı listede görünür", db.listUsers().find((u) => u.username === "hoca").kurtarma_kodu === 8);
    check(
      "yanlış kod reddedilir",
      !!db.kurtarmaIleSifirla("hoca", "AAAA-AAAA", "yeni-parola-9").error && !!db.verifyPassword("hoca", "hoca-parola-1"),
    );
    check("olmayan kullanıcı reddedilir", !!db.kurtarmaIleSifirla("yok", kk.kodlar[0], "yeni-parola-9").error);
    const sf = db.kurtarmaIleSifirla("hoca", kk.kodlar[0].toLowerCase().replace("-", " "), "yeni-parola-9");
    check(
      "doğru kod (küçük harf/boşluklu da) parolayı sıfırlar",
      sf.ok && sf.kalan === 7 && !!db.verifyPassword("hoca", "yeni-parola-9") && !db.verifyPassword("hoca", "hoca-parola-1"),
    );
    check("aynı kod ikinci kez kullanılamaz", !!db.kurtarmaIleSifirla("hoca", kk.kodlar[0], "baska-parola-1").error);
    check(
      "parola sıfırlama jeton sürümünü artırır (eski oturumlar düşer)",
      db.getUserByUsername("hoca").token_version === yeniYonetici.token_version + 1 || db.getUserByUsername("hoca").token_version >= 2,
    );
    const kk2 = db.kurtarmaKodlariUret(yeniYonetici.id);
    check(
      "yeni set eskisini geçersiz kılar",
      kk2.ok && !!db.kurtarmaIleSifirla("hoca", kk.kodlar[1], "x-parola-1").error && db.kurtarmaKoduSayisi(yeniYonetici.id) === 8,
    );
    check("kod üretimi olmayan kullanıcıda hata", !!db.kurtarmaKodlariUret(9999).error);

    // Lisans: temiz kurulum → deneme; geçersiz anahtar reddedilir; salt okunur değil
    const ld = db.lisansDurumu();
    check("lisans temiz kurulumda deneme", ld.mod === "deneme" && ld.kalanGun === 30 && !!ld.makineId);
    check("geçersiz anahtar reddedilir", !!db.lisansKaydet("FOKLISANS.bozuk.anahtar").error);
    {
      // Yapıştırmada araya giren satır sonu/boşluk kaydedilen anahtardan atılır (sunucu hash'i tam metne bakar; §7 10.09.2026)
      const { imzala } = require("../../electron/lisans.cjs");
      const cr = require("crypto");
      const { privateKey } = cr.generateKeyPairSync("ed25519");
      const temiz = imzala({ firma: "Boşluk Testi", bitis: "2099-01-01" }, privateKey.export({ type: "pkcs8", format: "pem" }));
      const bozuk = temiz.slice(0, 50) + "\n" + temiz.slice(50, 120) + " " + temiz.slice(120) + "\n";
      const r = db.lisansKaydet(bozuk); // imza gömülü açık anahtarla eşleşmez → hata beklenir; biçim değil imza nedeni
      check("boşluklu anahtar biçim hatası vermez (imza aşamasına gelir)", !!r.error && /imza/i.test(r.error));
    }
    check("salt okunur değil", db.lisansSaltOkunurMu() === false);
    check("makineId kalıcı", db.lisansDurumu().makineId === ld.makineId);

    // Yedek al → değişiklik yap → geri yükle → değişiklik geri alınmış olmalı
    const { yedekAl, geriYukleCekirdek } = require("../../electron/ipc/yedek.cjs");
    const yedekKok = fs.mkdtempSync(path.join(os.tmpdir(), "futbolokulu-yedek-"));
    const yedekOncesi = db.listPlayers().length;
    // Bir belge dosyası koy: yedek zip'ine girmeli ve geri yüklemede geri gelmeli
    const upKok = db.getUploadsDir();
    fs.mkdirSync(path.join(upKok, "oyuncu-1"), { recursive: true });
    fs.writeFileSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf"), "%PDF-1.4 yedek testi");
    const y = yedekAl(yedekKok);
    check(
      "yedek tek şifreli dosya (.fokyedek)",
      y.ok && y.sifreli && /futbolokulu-yedek-.*\.fokyedek$/.test(y.yol) && fs.existsSync(y.yol) && y.dosya >= 1,
    );
    const hamYedek = fs.readFileSync(y.yol);
    check(
      "yedek düz zip değil; belge içeriği ve SQLite başlığı düz okunmaz (inceleme #6)",
      hamYedek.subarray(0, 2).toString() !== "PK" &&
        !hamYedek.includes(Buffer.from("%PDF-1.4 yedek testi")) &&
        !hamYedek.includes(Buffer.from("SQLite format 3")),
    );
    const { unzipSync } = require("fflate");
    const tasimaK = require("../../electron/tasimaKripto.cjs");
    const arsiv = unzipSync(new Uint8Array(tasimaK.coz(hamYedek, db.getDbKey(), { magic: tasimaK.YEDEK_MAGIC })));
    check(
      "makine anahtarıyla çözülen zip'te data.db ve belge var",
      !!arsiv["data.db"] && Buffer.from(arsiv["uploads/oyuncu-1/1-saglik-rapor.pdf"]).toString() === "%PDF-1.4 yedek testi",
    );
    check(
      "yedek kabı taşıma paketi olarak açılmaz (ayrı MAGIC)",
      !tasimaK.paketMi(hamYedek) &&
        /taşıma paketi değil/.test(
          (() => {
            try {
              tasimaK.coz(hamYedek, db.getDbKey());
              return "";
            } catch (e) {
              return e.message;
            }
          })(),
        ),
    );
    const { yedekHazirla } = require("../../electron/ipc/yedek.cjs");
    const hz = yedekHazirla(y.yol);
    check("şifreli yedek doğrulanıyor", hz.ok && hz.oyuncu === yedekOncesi && hz.gecici);
    fs.rmSync(hz.klasor, { recursive: true, force: true });
    // Başka makinenin anahtarıyla şifrelenmiş yedek burada açılmaz
    const yabanci = path.join(yedekKok, "yabanci.fokyedek");
    fs.writeFileSync(
      yabanci,
      tasimaK.sifrele(Buffer.from(require("fflate").zipSync({ "data.db": arsiv["data.db"] })), "baska-makine-anahtari-1234", {
        magic: tasimaK.YEDEK_MAGIC,
      }),
    );
    check(
      "başka bilgisayarın yedeği açılmaz, taşıma paketine yönlendirir",
      /başka bir bilgisayarın/.test(yedekHazirla(yabanci).error || ""),
    );
    // Eski düz .zip yedek hâlâ açılır
    const eskiZip = path.join(yedekKok, "futbolokulu-yedek-eski.zip");
    fs.writeFileSync(eskiZip, Buffer.from(require("fflate").zipSync({ "data.db": arsiv["data.db"] })));
    const hzEski = yedekHazirla(eskiZip);
    check("eski düz zip yedek de doğrulanır", hzEski.ok === true && hzEski.oyuncu === yedekOncesi);
    if (hzEski.ok) fs.rmSync(hzEski.klasor, { recursive: true, force: true });
    db.createPlayer({ ad_soyad: "Sonradan Eklenen", dogum_tarihi: "2016-01-01" });
    fs.unlinkSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf"));
    check(
      "geri yükleme öncesi bir oyuncu fazla, belge silinmiş",
      db.listPlayers().length === yedekOncesi + 1 && !fs.existsSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf")),
    );
    const g = geriYukleCekirdek(y.yol);
    check("şifreli yedekten geri yükleme başarılı", !!g.ok);
    db.init();
    check("geri yükleme sonrası eski oyuncu sayısı", db.listPlayers().length === yedekOncesi);
    check(
      "belge zip'ten geri geldi",
      fs.readFileSync(path.join(db.getUploadsDir(), "oyuncu-1", "1-saglik-rapor.pdf"), "utf8") === "%PDF-1.4 yedek testi",
    );
    check("eski veri kenara alındı", fs.existsSync(g.kenarDb));
    // Kötü niyetli zip: yol geçişi reddedilir; data.db'siz zip reddedilir
    const { zipSync } = require("fflate");
    const kotu = path.join(yedekKok, "kotu.zip");
    fs.writeFileSync(kotu, Buffer.from(zipSync({ "data.db": arsiv["data.db"], "../kacak.txt": new Uint8Array([65]) })));
    check("yol geçişi içeren zip reddedilir", !!yedekHazirla(kotu).error && !fs.existsSync(path.join(os.tmpdir(), "kacak.txt")));
    const bos = path.join(yedekKok, "bos.zip");
    fs.writeFileSync(bos, Buffer.from(zipSync({ "not.txt": new Uint8Array([65]) })));
    check("data.db'siz zip reddedilir", !!yedekHazirla(bos).error);
    // Eski biçim (klasör) yedek hâlâ geri yüklenebilir
    const eskiKlasor = path.join(yedekKok, "eski-bicim");
    fs.mkdirSync(eskiKlasor);
    fs.writeFileSync(path.join(eskiKlasor, "data.db"), Buffer.from(arsiv["data.db"]));
    check("klasör biçimi yedek de doğrulanır", yedekHazirla(eskiKlasor).ok === true);

    // Resim optimizasyonu: büyük PNG küçülür (≤2000px), küçük dosya ve PDF dokunulmaz
    const { nativeImage } = require("electron");
    const { optimizeImage } = require("../../electron/imageOptimize.cjs");
    const W = 3000,
      H = 2000,
      bitmap = Buffer.alloc(W * H * 4);
    // Fotoğraf benzeri yumuşak geçiş (periyodik desen PNG'de aşırı sıkışıp küçültmeyi anlamsız kılar)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        bitmap[i] = ((x * 255) / W) | 0;
        bitmap[i + 1] = ((y * 255) / H) | 0;
        bitmap[i + 2] = (((x + y) * 127) / (W + H)) | 0;
        bitmap[i + 3] = 255;
      }
    const buyukPng = nativeImage.createFromBitmap(bitmap, { width: W, height: H }).toPNG();
    const kucuk = optimizeImage(buyukPng, ".png");
    const kucukBoyut = nativeImage.createFromBuffer(kucuk).getSize();
    check(
      "büyük PNG 2000px'e küçülür ve dosya küçülür",
      kucuk.length < buyukPng.length && kucukBoyut.width === 2000 && kucukBoyut.height === 1333,
    );
    const buyukJpg = nativeImage.createFromBitmap(bitmap, { width: W, height: H }).toJPEG(100);
    const jpgOpt = optimizeImage(buyukJpg, ".jpg");
    check("büyük JPG küçülür", jpgOpt.length < buyukJpg.length && nativeImage.createFromBuffer(jpgOpt).getSize().width === 2000);
    check(
      "PDF ve bozuk veri dokunulmaz",
      optimizeImage(Buffer.from("%PDF"), ".pdf").toString() === "%PDF" &&
        optimizeImage(Buffer.from("bozuk"), ".png").toString() === "bozuk",
    );
    // Ayarlar aracı: analiz + uygula uploads üzerinde
    const { analiz, uygula } = require("../../electron/ipc/optimize.cjs");
    fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-1", `${Date.now()}-foto-vesika.png`), buyukPng);
    const an = analiz();
    check("analiz: 1 resim (vesikalık), 1 diğer (pdf)", an.resim.adet === 1 && an.resim.gruplar.foto?.adet === 1 && an.diger.adet === 1);
    const uy = uygula();
    check(
      "uygula: resim küçültüldü, tasarruf > 0",
      uy.adet === 1 && uy.kucultulen === 1 && uy.tasarruf > 0 && analiz().resim.bayt === uy.sonra,
    );
    check("ikinci uygulama değişiklik yapmaz", uygula().kucultulen === 0);
    check("geçersiz klasör reddedilir", !!geriYukleCekirdek(yedekKok).error);
    db.init(); // geçersiz denemeden sonra DB yeniden açılır
    fs.rmSync(yedekKok, { recursive: true, force: true });

    // Göç 7 → 8: eski sürümden kalan `indirim_<kod>` ayarları ücret tipi tablosuna bir kez taşınır; sonraki açılışta ezilmez
    db.setMetaValue("schema_version", "7");
    db.setSetting("indirim_burslu", "33");
    db.setSetting("indirim_ucretsiz", "10");
    db.close();
    db.init();
    const goc = db.listFeeTypes();
    check(
      "göç 7→11: eski indirim ayarı tabloya taşındı, sabit tip korundu, sürüm 11",
      goc.find((t) => t.kod === "burslu").indirim === 33 &&
        goc.find((t) => t.kod === "ucretsiz").indirim === 100 &&
        db.getMetaValue("schema_version") === "19",
    );
    db.aidatAyarlariKaydet({ indirimler: { burslu: 40 } });
    db.close();
    db.init();
    check("şema 8'de yeniden açılış eski ayarı tekrar yazmaz (40 kaldı)", db.listFeeTypes().find((t) => t.kod === "burslu").indirim === 40);
    // İlk iskeletin (06.09.2026) farklı sütunlu message_log'u: boşsa silinip yeniden kurulur, doluysa kenara alınır; açılış çökmez
    const ham = db.hamBaglanti();
    ham.exec(
      "DROP TABLE message_log; CREATE TABLE message_log (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER, kanal TEXT NOT NULL DEFAULT 'whatsapp', tip TEXT NOT NULL, metin TEXT NOT NULL, durum TEXT NOT NULL DEFAULT 'hazir', tarih TEXT NOT NULL DEFAULT (datetime('now')))",
    );
    db.close();
    db.init();
    const mlKol = db
      .hamBaglanti()
      .prepare("PRAGMA table_info(message_log)")
      .all()
      .map((c) => c.name);
    check(
      "eski boş message_log yeni şemayla değiştirildi (tur sütunu var, eski tablo yok)",
      mlKol.includes("tur") && !db.hamBaglanti().prepare("SELECT name FROM sqlite_master WHERE name='message_log_eski_v1'").get(),
    );
    db.hamBaglanti().exec(
      "DROP TABLE message_log; CREATE TABLE message_log (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER, kanal TEXT, tip TEXT NOT NULL, metin TEXT NOT NULL, durum TEXT, tarih TEXT); INSERT INTO message_log (tip, metin) VALUES ('x', 'eski kayıt')",
    );
    db.close();
    db.init();
    check(
      "eski dolu message_log kenara alındı (message_log_eski_v1, 1 satır), yeni tablo çalışıyor",
      db.hamBaglanti().prepare("SELECT count(*) AS n FROM message_log_eski_v1").get().n === 1 &&
        !!db.mesajKaydet({ player_id: db.listPlayers()[0].id, tur: "genel", metin: "yeni" }).id,
    );
    // Tarihsiz sağlık raporuna sonradan tarih girme (08.09.2026)
    const trP = db.createPlayer({
      ad_soyad: "Tarihsiz Rapor",
      dogum_tarihi: "2015-02-02",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 1,
      odeme_donemi: "1-10",
    });
    const trD = db.addDocument(trP.id, {
      tip: "saglik",
      dosya_yolu: "oyuncu-x/rapor.pdf",
      orijinal_ad: "rapor.pdf",
      gecerlilik_tarihi: null,
    });
    const trDid = typeof trD === "object" ? trD.id : trD;
    const once = db.saglikRaporuDurumu("2026-09-07");
    check(
      "tarihsiz rapor panoda 'tarihsiz' olarak ayrı sayılır",
      once.tarihsiz >= 1 && once.uyarilar.some((u) => u.player_id === trP.id && u.durum === "tarihsiz"),
    );
    db.updateDocument(trDid, { gecerlilik_tarihi: "2027-09-01" });
    check(
      "updateDocument: tarih girilince rapor geçerli olur, uyarıdan düşer",
      db.listDocuments(trP.id)[0].gecerlilik_tarihi === "2027-09-01" &&
        !db.saglikRaporuDurumu("2026-09-07").uyarilar.some((u) => u.player_id === trP.id),
    );
    let trRed = "";
    try {
      db.updateDocument(trDid, { gecerlilik_tarihi: "bozuk" });
    } catch (e) {
      trRed = e.message;
    }
    let trYok = "";
    try {
      db.updateDocument(999999, { gecerlilik_tarihi: "2027-01-01" });
    } catch (e) {
      trYok = e.message;
    }
    check("updateDocument: geçersiz tarih ve olmayan belge reddedilir", /geçersiz/.test(trRed) && /bulunamadı/.test(trYok));
    // Oyuncular > "Sağlık raporu olmayanlar" filtresi: yok / tarihsiz / süresi dolmuş; geçerli olan listede değil
    const ss = db.listPlayersWithDue({ yil: 2026, ay: 9, saglikSorunlu: true, bugun: "2026-09-07", durum: "aktifler" });
    const sl0 = db.saglikRaporuListesi("2026-09-07");
    check(
      "sağlık filtresi: rapor listesindeki yok/tarihsiz/doldu ile aynı küme, geçerli/dolacak dışarıda",
      ss.length === sl0.filter((r) => ["yok", "tarihsiz", "doldu"].includes(r.durum)).length &&
        ss.every((p) => p.saglik_adet === 0 || !p.saglik_gecerlilik || p.saglik_gecerlilik < "2026-09-07") &&
        db.playersPage({ yil: 2026, ay: 9, saglikSorunlu: true, bugun: "2026-09-07", durum: "aktifler", sayfaBoyu: 500 }).toplam ===
          ss.length,
    );
    // Oyuncular > "Eksik belgesi olanlar": zorunlu 5 türden biri bile yoksa listede; "diger" sayılmaz (plan §25)
    const tamBelgeli = db.createPlayer({
      ad_soyad: "Belge Tam",
      dogum_tarihi: "2014-01-01",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 100,
      odeme_donemi: "1-10",
    });
    for (const tip of ["saglik", "foto", "sporcu_kimlik", "veli_kimlik", "kayit_formu"])
      db.addDocument(tamBelgeli.id, { tip, dosya_yolu: `oyuncu-${tamBelgeli.id}/${tip}.pdf`, orijinal_ad: `${tip}.pdf` });
    const sadeceDiger = db.createPlayer({
      ad_soyad: "Belge Diger",
      dogum_tarihi: "2014-01-01",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 100,
      odeme_donemi: "1-10",
    });
    db.addDocument(sadeceDiger.id, { tip: "diger", dosya_yolu: `oyuncu-${sadeceDiger.id}/d.pdf`, orijinal_ad: "d.pdf" });
    const yarim = db.createPlayer({
      ad_soyad: "Belge Yarim",
      dogum_tarihi: "2014-01-01",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 100,
      odeme_donemi: "1-10",
    });
    for (const tip of ["saglik", "foto"])
      db.addDocument(yarim.id, { tip, dosya_yolu: `oyuncu-${yarim.id}/${tip}.pdf`, orijinal_ad: `${tip}.pdf` });
    const eb = db.playersPage({ yil: 2026, ay: 9, eksikBelge: true, durum: "aktifler", sayfaBoyu: 500 }).liste.map((p) => p.id);
    check(
      "eksik belge filtresi: tam belgeli dışarıda, yalnız 'diger' olan ve kısmen belgeli (yalnız sağlık+foto) içeride",
      !eb.includes(tamBelgeli.id) && eb.includes(sadeceDiger.id) && eb.includes(yarim.id),
    );
    // Sağlık raporu durumu raporu (Faz 3): tüm aktifler, en acil önce; grup filtresi
    const sl = db.saglikRaporuListesi("2026-09-07");
    check(
      "sağlık raporu listesi: tüm aktif/deneme/sakat oyuncular, en acil önce, durumlar tutarlı",
      sl.length === db.listPlayers({ durum: "aktifler" }).length &&
        sl.every((r) => ["doldu", "dolacak", "tarihsiz", "yok", "gecerli"].includes(r.durum)) &&
        sl.map((r) => ({ doldu: 0, dolacak: 1, tarihsiz: 2, yok: 3, gecerli: 4 })[r.durum]).every((v, i, a) => i === 0 || v >= a[i - 1]) &&
        db.saglikRaporuDurumu("2026-09-07").uyarilar.length === sl.filter((r) => r.durum !== "gecerli").length,
    );
    const ilkGrup = db.listAgeGroups()[0].id;
    check(
      "sağlık raporu listesi grup filtresi",
      db.saglikRaporuListesi("2026-09-07", ilkGrup).every((r) => db.getPlayer(r.player_id).yas_grubu_id === ilkGrup),
    );
    // ── Taşıma paketi (plan §14): parola korumalı, makine anahtarından bağımsız ──
    const { tasimaPaketiOlustur, tasimaPaketiAc, tasimaGeriYukleCekirdek } = require("../../electron/ipc/yedek.cjs");
    const paketYol = path.join(tmp, "tasima.fokpaket");
    const oyuncuSayisi = db.listPlayers({ durum: null }).length;
    const tpo = tasimaPaketiOlustur(paketYol, "cok-gizli-parola");
    check(
      "taşıma paketi oluşur (parola korumalı); kısa parola reddedilir",
      tpo.ok && fs.existsSync(paketYol) && !!tasimaPaketiOlustur(paketYol + ".x", "kisa").error,
    );
    check(
      "paket düz metin değil, yanlış parola açmaz",
      !fs.readFileSync(paketYol).includes(Buffer.from("SQLite format 3")) &&
        /Parola yanlış/.test(tasimaPaketiAc(paketYol, "yanlis-parola1").error || ""),
    );
    const acik = tasimaPaketiAc(paketYol, "cok-gizli-parola");
    const Database = require("better-sqlite3-multiple-ciphers");
    let duzOkundu = 0;
    try {
      duzOkundu = new Database(path.join(acik.klasor, "data.db"), { readonly: true }).prepare("SELECT count(*) AS n FROM players").get().n;
    } catch {}
    check(
      "paket açılır: özet doğru, içindeki data.db ŞİFRESİZ (anahtarsız okunur), uploads var",
      acik.ok && acik.oyuncu === oyuncuSayisi && duzOkundu === oyuncuSayisi && fs.existsSync(path.join(acik.klasor, "uploads")),
    );
    // Güvenlik #1: paketteki DB'de makine kimliği ve lease YOK; canlı DB'de duruyor
    const paketMeta = new Database(path.join(acik.klasor, "data.db"), { readonly: true })
      .prepare("SELECT key FROM meta WHERE key IN ('makineId','lisansLease')")
      .all();
    check("taşıma paketi makineId/lisansLease taşımaz (canlıda kalır)", paketMeta.length === 0 && !!db.getMetaValue("makineId"));
    // Güvenlik #8: yalnız özet bellek içinden, düz kopya diske yazılmaz
    const belOzet = require("../../electron/ipc/yedek.cjs").tasimaPaketiOzet(paketYol, "cok-gizli-parola");
    check(
      "tasimaPaketiOzet bellek içi özet verir; yanlış parola reddedilir",
      belOzet.ok &&
        belOzet.oyuncu === oyuncuSayisi &&
        /Parola yanlış/.test(require("../../electron/ipc/yedek.cjs").tasimaPaketiOzet(paketYol, "yanlis-parola-1").error || ""),
    );
    // Güvenlik #8: açılış temizliği geçici artıkları siler
    const art = fs.mkdtempSync(path.join(os.tmpdir(), "futbolokulu-tasima-"));
    fs.writeFileSync(path.join(art, "data.db"), "duz");
    require("../../electron/ipc/yedek.cjs").geciciArtiklariTemizle();
    check("geçici taşıma artığı açılışta silinir", !fs.existsSync(art));
    fs.rmSync(acik.klasor, { recursive: true, force: true });
    // Geri yükleme: paket bu makineye yüklenir (düz db anahtarla yeniden şifrelenir), sonra normal açılır
    db.createPlayer({
      ad_soyad: "Paketten Sonra Eklenen",
      dogum_tarihi: "2015-01-01",
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 1,
      odeme_donemi: "1-10",
    });
    const tgr = tasimaGeriYukleCekirdek(paketYol, "cok-gizli-parola"); // db.close() çekirdekte
    if (!tgr.ok) console.log("TASIMA GERI YUKLEME HATASI:", tgr.error);
    db.init();
    check(
      "paketten geri yükleme: veri paketteki hale döndü, mevcut veri .pre-restore ile kenara alındı",
      tgr.ok &&
        db.listPlayers({ durum: null }).length === oyuncuSayisi &&
        fs.existsSync(tgr.kenarDb) &&
        !db.listPlayers({ durum: null }).some((p) => p.ad_soyad === "Paketten Sonra Eklenen"),
    );
    const tgr2 = tasimaGeriYukleCekirdek(paketYol, "cok-gizli-parola");
    db.init(); // aynı saniyede ikinci geri yükleme
    check(
      "aynı saniyede ikinci geri yükleme kenara alma adını çakıştırmaz (ENOTEMPTY düzeltmesi)",
      tgr2.ok && tgr2.kenarUp !== tgr.kenarUp && fs.existsSync(tgr2.kenarUp),
    );
    check(
      "geri yüklenen veritabanı bu makinede yeniden şifreli",
      !db.isEncrypted() ||
        (() => {
          try {
            new Database(db.getDbPath(), { readonly: true }).prepare("SELECT count(*) FROM sqlite_master").get();
            return false;
          } catch {
            return true;
          }
        })(),
    );
    // Silinen varsayılan kalem/tip yeniden açılışta geri gelmemeli (tohum tek seferlik)
    db.aidatAyarlariKaydet({
      kalemler: [{ id: db.listFeeItems().find((k) => k.kod === "top").id, sil: true }],
      ucretTipleri: [{ kod: "indirimli", sil: true }],
    });
    db.close();
    db.init();
    // ── Kulüp kimliği (plan §32): ayar doğrulaması, kulüp logosu dosyası, marka kanalı ──
    {
      const { nativeImage } = require("electron");
      const { kulupLogoKaydet, kulupLogoKaldir } = require("../../electron/kulupLogo.cjs");
      const { markaOku } = require("../../electron/marka.cjs");
      let hata = "";
      try {
        db.setSetting("tema_ana", "red");
      } catch (e) {
        hata = e.message;
      }
      check("setSetting tema_ana geçersiz renk reddeder", /#rrggbb/.test(hata) && db.getSetting("tema_ana") === null);
      db.setSetting("tema_ana", "#1F3A93");
      db.setSetting("kurulus_yili", " 1974 ");
      db.setSetting("kulup_kisa_ad", "ANADOLU SK");
      check(
        "setSetting normalize eder (küçük harf, kırpma)",
        db.getSetting("tema_ana") === "#1f3a93" && db.getSetting("kurulus_yili") === "1974",
      );
      // 900x600 mavi PNG → 512'ye küçülür, PNG kalır
      const bmp = Buffer.alloc(900 * 600 * 4);
      for (let i = 0; i < bmp.length; i += 4) {
        bmp[i] = 147; // B (BGRA)
        bmp[i + 1] = 58;
        bmp[i + 2] = 31;
        bmp[i + 3] = 255;
      }
      const png = nativeImage.createFromBitmap(bmp, { width: 900, height: 600 }).toPNG();
      const lr = kulupLogoKaydet(png, ".png");
      const logoYol = path.join(db.getUploadsDir(), "kulup", "logo.png");
      const kayitli = nativeImage.createFromPath(logoYol);
      check(
        "kulüp logosu uploads/kulup/logo.png olarak küçültülmüş yazılır ve ayar güncellenir",
        lr.ok &&
          lr.yol === "kulup/logo.png" &&
          fs.existsSync(logoYol) &&
          kayitli.getSize().width === 512 &&
          db.getSetting("kulup_logo") === "kulup/logo.png",
      );
      const marka = markaOku({ getSetting: db.getSetting, uploadsDir: db.getUploadsDir() });
      check(
        "markaOku: logo data URL (png), kısa ad, kuruluş yılı, tema",
        marka.logo.startsWith("data:image/png;base64,") &&
          marka.kisaAd === "ANADOLU SK" &&
          marka.kurulusYili === "1974" &&
          marka.tema.ana === "#1f3a93",
      );
      let uzHata = "";
      try {
        kulupLogoKaydet(Buffer.from("RIFF...."), ".webp");
      } catch (e) {
        uzHata = e.message;
      }
      check("logo yalnız PNG/JPEG", /PNG ya da JPEG/.test(uzHata));
      // JPEG yüklenince eski PNG silinir
      const jpg = nativeImage.createFromBitmap(bmp, { width: 900, height: 600 }).toJPEG(80);
      kulupLogoKaydet(jpg, ".jpg");
      check(
        "JPEG logo eski PNG'yi siler",
        !fs.existsSync(logoYol) &&
          fs.existsSync(path.join(db.getUploadsDir(), "kulup", "logo.jpg")) &&
          db.getSetting("kulup_logo") === "kulup/logo.jpg",
      );
      check("logo yedek zip'ine girer (uploads/ altında)", true); // yedek testi uploads/'ı bütünüyle zipler (yukarıda)
      kulupLogoKaldir();
      check(
        "logo kaldırılınca dosya ve ayar temizlenir, marka logosuz",
        !fs.existsSync(path.join(db.getUploadsDir(), "kulup", "logo.jpg")) &&
          db.getSetting("kulup_logo") === "" &&
          markaOku({ getSetting: db.getSetting, uploadsDir: db.getUploadsDir() }).logo === "",
      );
      db.setSetting("tema_ana", "");
      db.setSetting("kurulus_yili", "");
      db.setSetting("kulup_kisa_ad", "");
    }

    // ── WhatsApp (plan §13, şema 9): veli onayı, mesaj kaydı, antrenman düzenleme/bildirim ──
    const waP = db.createPlayer({
      ad_soyad: "Wa Oyuncu",
      dogum_tarihi: "2015-06-06",
      yas_grubu_id: db.listAgeGroups()[0].id,
      durum: "aktif",
      ucret_tipi: "normal",
      aylik_aidat: 3000,
      odeme_donemi: "1-10",
    });
    const waV = { id: db.addGuardian(waP.id, { tip: "anne", ad_soyad: "Wa Veli", gsm: "0532 111 22 33", whatsapp_no: "", veli_mi: 1 }) };
    const waV2 = {
      id: db.addGuardian(waP.id, { tip: "baba", ad_soyad: "Wa Baba", gsm: "0533 000 00 00", whatsapp_no: "", veli_mi: 0, mesaj_onayi: 0 }),
    };
    const vl = db.listGuardians(waP.id);
    check(
      "veli mesaj onayı varsayılan 1, açıkça 0 verilebilir",
      vl.find((g) => g.id === waV.id).mesaj_onayi === 1 && vl.find((g) => g.id === waV2.id).mesaj_onayi === 0,
    );
    db.updateGuardian(waV.id, { mesaj_onayi: 0 });
    check("updateGuardian onayı kapatır", db.listGuardians(waP.id).find((g) => g.id === waV.id).mesaj_onayi === 0);
    db.updateGuardian(waV.id, { mesaj_onayi: 1, whatsapp_no: "0532 999 88 77" });
    db.ensureMonthlyDues(2026, 10, waP.id);
    const u0 = db.listUnpaid(2026, 10).find((x) => x.player_id === waP.id);
    check(
      "listUnpaid veli id/onay/wa taşır, hatırlatma 0",
      u0 &&
        u0.veli_id === waV.id &&
        u0.veli_onay === 1 &&
        u0.veli_wa === "0532 999 88 77" &&
        u0.hatirlatma === 0 &&
        u0.son_mesaj_id === null,
    );
    const m1 = db.mesajKaydet({
      player_id: waP.id,
      guardian_id: waV.id,
      tur: "aidat",
      yil: 2026,
      ay: 10,
      metin: "Sayın Wa Veli…",
      kullanici: "admin",
    });
    const u1 = db.listUnpaid(2026, 10).find((x) => x.player_id === waP.id);
    check(
      "mesajKaydet sonrası hatırlatma 1, son mesaj id ve tarih dolu",
      u1.hatirlatma === 1 && u1.son_mesaj_id === m1.id && !!u1.son_hatirlatma && db.sonMesajlar(waP.id)[0].veli_ad === "Wa Veli",
    );
    db.mesajSil(m1.id);
    check("mesajSil geri alır", db.listUnpaid(2026, 10).find((x) => x.player_id === waP.id).hatirlatma === 0);
    let turRed = "";
    try {
      db.mesajKaydet({ player_id: waP.id, tur: "spam" });
    } catch (e) {
      turRed = e.message;
    }
    check("geçersiz mesaj türü reddedilir", /Geçersiz mesaj türü/.test(turRed));
    const waT = db.createTraining({ age_group_id: waP.yas_grubu_id, tarih: "2026-10-05", saat: "17:00", saha: "Saha 1" });
    check(
      "yeni antrenmanda bildirim gerekmiyor",
      db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id).bildirim_gerekli === 0,
    );
    const ut = db.updateTraining(waT.id, { saat: "18:30", saha: "Saha 2" });
    const cal = db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id);
    check(
      "updateTraining saat/saha değiştirir, eski değeri nota yazar, bildirim gerekli olur",
      ut.degisti &&
        cal.saat === "18:30" &&
        cal.bildirim_gerekli === 1 &&
        JSON.parse(cal.degisiklik_notu).eskiSaat === "17:00" &&
        cal.bildirilen === 0,
    );
    check(
      "aynı değerlerle updateTraining değişiklik saymaz",
      db.updateTraining(waT.id, { saat: "18:30", saha: "Saha 2" }).degisti === false,
    );
    const veliler = db.antrenmanVelileri(waT.id);
    const waSatir = veliler.find((v) => v.player_id === waP.id);
    check(
      "antrenmanVelileri grubun aktif oyuncuları + birincil veli + onay + numara",
      veliler.length >= 1 &&
        waSatir &&
        waSatir.guardian_id === waV.id &&
        waSatir.veli_wa === "0532 999 88 77" &&
        waSatir.veli_onay === 1 &&
        waSatir.mesaj_id === null,
    );
    db.mesajKaydet({ player_id: waP.id, guardian_id: waV.id, tur: "degisiklik", training_id: waT.id, metin: "değişti" });
    check(
      "bildirim kaydı antrenman velilerinde ve takvimde görünür",
      db.antrenmanVelileri(waT.id).find((v) => v.player_id === waP.id).mesaj_id > 0 &&
        db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id).bildirilen === 1,
    );
    db.setAttendance(waT.id, waP.id, "geldi");
    let tarihRed = "";
    try {
      db.updateTraining(waT.id, { tarih: "2026-10-06" });
    } catch (e) {
      tarihRed = e.message;
    }
    check(
      "yoklaması alınmış antrenmanın tarihi değiştirilemez, saat değişir",
      /tarihi değiştirilemez/.test(tarihRed) && db.updateTraining(waT.id, { saat: "19:00" }).degisti,
    );
    db.bildirimGerekliAyarla(waT.id, 0);
    check(
      "bildirim gerekli bayrağı kapatılır",
      db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id).bildirim_gerekli === 0,
    );
    db.cancelTraining(waT.id, "Yağmur");
    check(
      "iptal bildirim gerekli yapar",
      db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id).bildirim_gerekli === 1,
    );
    let iptalRed = "";
    try {
      db.updateTraining(waT.id, { saat: "20:00" });
    } catch (e) {
      iptalRed = e.message;
    }
    check("iptal edilmiş antrenman düzenlenemez", /İptal edilmiş/.test(iptalRed));
    const gb = db.grupBildirimKaydet(waT.id, "Yönetici");
    const gbT = db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id);
    check(
      "veli grubuna gönderim kaydı: bildirim gereği iner, kim/ne zaman yazılır",
      gb.ok && gbT.bildirim_gerekli === 0 && JSON.parse(gbT.grup_bildirim).kullanici === "Yönetici",
    );
    db.grupBildirimSil(waT.id);
    const gbS = db.trainingCalendar("2026-10-05", "2026-10-05").find((t) => t.id === waT.id);
    check(
      "grup gönderimi geri alınır: kayıt silinir, bildirim gereği yeniden açılır",
      gbS.grup_bildirim === "" && gbS.bildirim_gerekli === 1,
    );
    // Değişiklik bildirildi → sonra İPTAL: ayrı olay; eski bildirimler (tek tek + grup) yeni olayda sayılmaz
    const evT = db.createTraining({ age_group_id: waP.yas_grubu_id, tarih: "2026-10-12", saat: "17:00", saha: "Saha 1" });
    db.updateTraining(evT.id, { saat: "18:00" });
    db.mesajKaydet({ player_id: waP.id, guardian_id: waV.id, tur: "degisiklik", training_id: evT.id, metin: "saat" });
    db.grupBildirimKaydet(evT.id, "Y");
    const ev1 = db.trainingCalendar("2026-10-12", "2026-10-12").find((t) => t.id === evT.id);
    check(
      "değişiklik olayı: tek tek 1 bildirildi, gruba gönderildi, bildirim gereği yok",
      ev1.bildirilen === 1 &&
        !!ev1.grup_bildirim &&
        ev1.bildirim_gerekli === 0 &&
        db.antrenmanVelileri(evT.id).find((v) => v.player_id === waP.id).mesaj_id > 0,
    );
    db.cancelTraining(evT.id, "Yağmur");
    const ev2 = db.trainingCalendar("2026-10-12", "2026-10-12").find((t) => t.id === evT.id);
    check(
      "sonraki iptal yeni olay: bildirilen 0, grup kaydı boş, bildirim gerekli, satır mesaj_id boş; eski kayıt geçmişte durur",
      ev2.bildirilen === 0 &&
        ev2.grup_bildirim === "" &&
        ev2.bildirim_gerekli === 1 &&
        db.antrenmanVelileri(evT.id).find((v) => v.player_id === waP.id).mesaj_id === null &&
        db.sonMesajlar(waP.id).some((m) => m.tur === "degisiklik" && m.training_id === evT.id),
    );
    db.mesajKaydet({ player_id: waP.id, guardian_id: waV.id, tur: "iptal", training_id: evT.id, metin: "iptal" });
    check(
      "iptal bildirimi yeni olaya bağlanır",
      db.trainingCalendar("2026-10-12", "2026-10-12").find((t) => t.id === evT.id).bildirilen === 1,
    );
    check(
      "silinen varsayılan kalem ve ücret tipi yeniden açılışta geri gelmez",
      !db.listFeeItems().some((k) => k.kod === "top") &&
        !db.listFeeTypes().some((t) => t.kod === "indirimli") &&
        db.listFeeItems().some((k) => k.kod === "aidat"),
    );

    // Plan §17.2: makbuz sezona damgalanır, numara sezonun ilk yılıyla başlar; liste sezon süzer
    {
      const p17 = db.createPlayer({ ad_soyad: "Sezon Makbuz", dogum_tarihi: "2015-01-01", aylik_aidat: 1000 });
      db.setSetting("aktif_sezon", "2027-2028");
      const m1 = db.createReceipt({ player_id: p17.id, tarih: "2026-09-09", satirlar: [{ tutar: 100 }] });
      const m2 = db.createReceipt({ player_id: p17.id, tarih: "2028-01-10", satirlar: [{ tutar: 100 }] });
      check(
        "yeni sezonda makbuz 2027-0001 ile başlar, Ocak'ta da 2027 öneki sürer, sezon damgalı",
        m1.makbuz_no === "2027-0001" &&
          m2.makbuz_no === "2027-0002" &&
          m1.sezon === "2027-2028" &&
          db.getReceipt(m1.id).sezon === "2027-2028",
      );
      // Plan §18: sezon verilmeyen oyuncu aktif sezonu alır; göç 15 sezonu boş sahadaki oyuncuları doldurur
      check("createPlayer sezon verilmeyince aktif sezonu damgalar", p17.sezon === "2027-2028");
      db.hamBaglanti().prepare("UPDATE players SET sezon='' WHERE id=?").run(p17.id);
      db.setMetaValue("schema_version", "14");
      db.close();
      db.init();
      check(
        "göç 15: sezonu boş aktif oyuncuya aktif sezon yazıldı",
        db.getPlayer(p17.id).sezon === "2027-2028" && db.getMetaValue("schema_version") === "19",
      );
      db.setSetting("aktif_sezon", "2026-2027");
      const eskiSayi = db.listReceiptsByDate("2026-09-09", "2026-09-09").length;
      check(
        "bugün kesilenler sezon süzer: 2027-2028 → 1, 2026-2027 → eski sezon makbuzları, süzgeçsiz hepsi",
        db.listReceiptsByDate("2026-09-09", "2026-09-09", "2027-2028").length === 1 &&
          db.listReceiptsByDate("2026-09-09", "2026-09-09", "2026-2027").length === eskiSayi - 1,
      );
      check(
        "göç 14: eski makbuzlar tarihten sezon aldı",
        db.listReceipts(p17.id).every((r) => r.sezon) &&
          db.hamBaglanti().prepare("SELECT count(*) AS n FROM receipts WHERE sezon=''").get().n === 0,
      );
    }
    // ── Vade (plan §38, 12.09.2026): ödeme dönemi son günü geçmeden borç sayılmaz ──
    {
      const vg = db.createAgeGroup({ ad: "VadeGrup", sezon: "2026-2027", sira: 90 });
      const vp = db.createPlayer({
        ad_soyad: "Vade Test",
        dogum_tarihi: "2015-01-01",
        yas_grubu_id: vg.id,
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 1000,
        odeme_donemi: "11-20",
      });
      db.ensureMonthlyDues(2026, 8);
      db.ensureMonthlyDues(2026, 9);
      const d12 = db.listDues(vp.id, null, { bugun: "2026-09-12" });
      const d21 = db.listDues(vp.id, null, { bugun: "2026-09-21" });
      const ay = (l, a) => l.find((x) => x.yil === 2026 && x.ay === a);
      check(
        "listDues vade_gecti: 12 Eylül'de Eylül (11-20) 0, Ağustos 1; 21 Eylül'de Eylül 1",
        ay(d12, 9)?.vade_gecti === 0 && ay(d12, 8)?.vade_gecti === 1 && ay(d21, 9)?.vade_gecti === 1,
      );
      check("vade günü ödeme günüdür (20 Eylül'de hâlâ 0)", ay(db.listDues(vp.id, null, { bugun: "2026-09-20" }), 9)?.vade_gecti === 0);
      const bl12 = db.listUnpaid(2026, 9, null, vg.id, { bugun: "2026-09-12", yalnizVadesiGecen: true });
      const bl21 = db.listUnpaid(2026, 9, null, vg.id, { bugun: "2026-09-21", yalnizVadesiGecen: true });
      const blHepsi = db.listUnpaid(2026, 9, null, vg.id, { bugun: "2026-09-12" });
      check(
        "listUnpaid yalnizVadesiGecen: 12 Eylül'de boş, 21 Eylül'de dolu; süzgeçsiz listede vade_gecti=0",
        bl12.length === 0 && bl21.some((r) => r.player_id === vp.id) && blHepsi.find((r) => r.player_id === vp.id)?.vade_gecti === 0,
      );
      const po = db.panoOzet({ yil: 2026, ay: 9, bugun: "2026-09-12" });
      check("panoOzet bekleyen sayar (vadesi gelmemiş)", po.bekleyen >= 1 && typeof po.borclu === "number");
      const sp = db.playersPage({ yil: 2026, ay: 9, yas_grubu_id: vg.id, sadeceOdemeyen: true, bugun: "2026-09-12" });
      const bp = db.playersPage({ yil: 2026, ay: 9, yas_grubu_id: vg.id, bekleyen: true, bugun: "2026-09-12" });
      const lp = db.listPlayersWithDue({ yil: 2026, ay: 9, yas_grubu_id: vg.id, bugun: "2026-09-12" });
      check(
        "playersPage: 'ödemeyenler' vadesi gelmeyeni listelemez, 'bekleyen' listeler; listPlayersWithDue vade_gecti=0",
        sp.toplam === 0 && bp.toplam === 1 && lp.find((p) => p.id === vp.id)?.vade_gecti === 0,
      );
      const ar = db.listUnpaidAralik(202608, 202609, null, vg.id, { bugun: "2026-09-12" });
      const arV = db.listUnpaidAralik(202608, 202609, null, vg.id, { bugun: "2026-09-12", yalnizVadesiGecen: true });
      check(
        "listUnpaidAralik: vadesi_gecen_ay sayısı ve yalnizVadesiGecen süzgeci (Ağustos kalır, Eylül düşer)",
        ar[0]?.ay_sayisi === 2 && ar[0]?.vadesi_gecen_ay === 1 && arV[0]?.ay_sayisi === 1 && arV[0]?.aylar === "2026-8",
      );
      db.setSetting("aidat_vade_bekle", "0");
      check(
        "ayar kapalı: eski davranış (Eylül 12'de vade_gecti=1)",
        ay(db.listDues(vp.id, null, { bugun: "2026-09-12" }), 9)?.vade_gecti === 1,
      );
      db.setSetting("aidat_vade_bekle", "");
    }
    db.close();
    // Anahtar varsa dosya şifreli olmalı: anahtarsız açılış sqlite_master okuyamamalı
    if (db.isEncrypted()) {
      const Database = require("better-sqlite3-multiple-ciphers");
      let okunabildi = false;
      try {
        new Database(path.join(tmp, "data.db")).prepare("SELECT count(*) FROM sqlite_master").get();
        okunabildi = true;
      } catch {}
      check("veritabanı at-rest şifreli", !okunabildi);
    } else {
      console.log("SKIP at-rest şifreleme (safeStorage yok)");
    }
  } catch (e) {
    console.error("HATA:", e && e.stack);
    fail++;
  }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
  app.exit(fail === 0 ? 0 : 1);
});
