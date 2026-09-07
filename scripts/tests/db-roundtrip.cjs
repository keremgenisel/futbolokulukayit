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
    check("varsayılan admin oluşturuldu", !!db.getUserByUsername("admin"));
    check("aidat kalemleri tohumlandı", db.listFeeItems().length >= 10);

    const grp = db.createAgeGroup({ ad: "U11", sezon: "2026-2027" });
    check("yaş grubu oluşturuldu", grp.id > 0);

    const oyuncu = db.createPlayer({
      tc_no: "12345678901", ad_soyad: "Test Oyuncu", dogum_tarihi: "2015-11-02",
      yas_grubu_id: grp.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10",
    });
    check("oyuncu oluşturuldu", oyuncu.id > 0);
    check("oyuncu okunuyor", db.getPlayer(oyuncu.id).ad_soyad === "Test Oyuncu");

    db.addGuardian(oyuncu.id, { tip: "baba", ad_soyad: "Test Baba", gsm: "05330000000", whatsapp_no: "05330000000", veli_mi: 1 });
    check("veli eklendi", db.listGuardians(oyuncu.id).length === 1);
    check("veli telefonu listelerde geliyor", db.listPlayersWithDue({ yil: 2026, ay: 9 }).find((p) => p.id === oyuncu.id).veli_tel === db.listGuardians(oyuncu.id)[0].gsm);

    db.ensureMonthlyDues(2026, 9); // kayıt anında zaten açılmış olabilir (bu ay Eylül 2026 ise) → tekrar güvenli
    check("aylık aidat açıldı", !!db.getDue(oyuncu.id, 2026, 9));
    check("aidat ödenmedi durumunda", db.getDue(oyuncu.id, 2026, 9).durum === "odenmedi");

    const aidatKalemi = db.listFeeItems().find((k) => k.kod === "aidat");
    const makbuz = db.createReceipt({
      player_id: oyuncu.id, tarih: "2026-09-06", odeme_yontemi: "nakit", tahsil_eden: "Test",
      satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Eylül 2026", yil: 2026, ay: 9 }],
    });
    check("makbuz numarası üretildi", /^2026-\d{4}$/.test(makbuz.makbuz_no));
    check("aidat ödendi olarak işaretlendi", db.getDue(oyuncu.id, 2026, 9).durum === "odendi");
    check("makbuz toplamı doğru", db.getReceipt(makbuz.id).toplam === 3500);

    const antrenman = db.createTraining({ age_group_id: grp.id, tarih: "2026-09-06", saat: "11:30" });
    db.setAttendance(antrenman.id, oyuncu.id, "geldi");
    check("yoklama kaydedildi", db.listAttendance(antrenman.id)[0].durum === "geldi");

    // Ek sorgular
    check("aidat durumlu liste", db.listPlayersWithDue({ yil: 2026, ay: 9 })[0].aidat_durum === "odendi");
    check("ödemeyen filtresi boş", db.listPlayersWithDue({ yil: 2026, ay: 9, sadeceOdemeyen: true }).length === 0);
    const ozet = db.panoOzet({ yil: 2026, ay: 9, bugun: "2026-09-06" });
    check("pano özeti", ozet.aktif === 1 && ozet.odeyen === 1 && ozet.antrenmanlar.length === 1 && ozet.antrenmanlar[0].geldi === 1);
    check("yoklama raporu", db.attendanceReport("2026-09-01", "2026-09-30")[0].geldi === 1);
    const tk = db.trainingCalendar("2026-09-01", "2026-09-30");
    check("takvim özeti: antrenman, oyuncu ve işaretli sayıları", tk.length === 1 && tk[0].oyuncu === 1 && tk[0].isaretli === 1 && tk[0].geldi === 1 && tk[0].yas_grubu_ad === grp.ad);
    check("takvim özeti aralık dışını getirmez", db.trainingCalendar("2026-10-01", "2026-10-31").length === 0);
    db.cancelReceipt(makbuz.id, "test iptali", "Tester");
    check("makbuz iptali aidatı geri açar", db.getDue(oyuncu.id, 2026, 9).durum === "odenmedi");
    const ipt = db.getReceipt(makbuz.id);
    check("iptal nedeni, iptal eden ve zamanı kayıtta", ipt.iptal === 1 && ipt.iptal_nedeni === "test iptali" && ipt.iptal_eden === "Tester" && !!ipt.iptal_zamani);
    let nedensiz = false; try { db.cancelReceipt(makbuz.id, ""); } catch (e) { nedensiz = /neden/.test(e.message); }
    check("nedensiz iptal reddedilir", nedensiz);
    check("iptaller raporda ayrı listelenir, tahsilatta görünmez", db.listCancelledReceipts("2026-09-01", "2026-09-30").some((r) => r.id === makbuz.id) && !db.listReceiptsByDate("2026-09-01", "2026-09-30").some((r) => r.id === makbuz.id));
    check("iptal sonrası borçlu listesi", db.listUnpaid(2026, 9).length === 1);
    check("borçlu listesinde veli telefonu", !!db.listUnpaid(2026, 9)[0].veli_tel);
    check("grup silme oyuncu varken engellenir", !!db.deleteAgeGroup(grp.id).error);
    const belgeId = db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/x.pdf", orijinal_ad: "x.pdf" });
    check("belge okunuyor", db.getDocument(belgeId).tip === "saglik");
    // Aidat ayarları: taban fiyat + indirim yüzdeleri tek çağrıda; kısmi burslu muaf değil, 0 ₺ burslu muaf
    db.updateFeeItem(db.listFeeItems().find((k) => k.kod === "aidat").id, { varsayilan_fiyat: 4000 });
    db.aidatAyarlariKaydet({ indirimler: { burslu: 50, kardes: 15 } });
    const aa = db.aidatAyarlari();
    check("aidat ayarları okunuyor (ücret tipleri tabloda)", aa.taban === 4000 && aa.indirimler.burslu === 50 && aa.indirimler.kardes === 15 && aa.ucretTipleri.length === 5 && aa.ucretTipleri.find((t) => t.kod === "normal").sabit === 1);
    const bursluKismi = db.createPlayer({ ad_soyad: "Burslu Kısmi", dogum_tarihi: "2014-01-01", yas_grubu_id: grp.id, durum: "aktif", ucret_tipi: "burslu", aylik_aidat: 2000, odeme_donemi: "1-10" });
    const bursluTam = db.createPlayer({ ad_soyad: "Burslu Tam", dogum_tarihi: "2014-01-01", yas_grubu_id: grp.id, durum: "aktif", ucret_tipi: "burslu", aylik_aidat: 0, odeme_donemi: "1-10" });
    db.ensureMonthlyDues(2026, 11);
    check("kısmi burslu aidat bekler, 0 ₺ burslu muaf", db.getDue(bursluKismi.id, 2026, 11).durum === "odenmedi" && db.getDue(bursluTam.id, 2026, 11).durum === "muaf");
    // Vesikalık tekil: ikinci yükleme eskisinin yerine geçer; diğer tipler birikir
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/y.pdf", orijinal_ad: "y.pdf" });
    check("sağlık raporuna birden fazla dosya yüklenebilir", db.listDocuments(oyuncu.id).filter((b) => b.tip === "saglik").length === 2);
    const f1 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f1.jpg", orijinal_ad: "f1.jpg" });
    const f2 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f2.jpg", orijinal_ad: "f2.jpg" });
    const fotolar = db.listDocuments(oyuncu.id).filter((b) => b.tip === "foto");
    check("vesikalık tek dosya kalır, yenisi eskisinin yerine geçer", f1.silinen.length === 0 && f2.silinen[0] === "oyuncu-1/f1.jpg" && fotolar.length === 1 && fotolar[0].dosya_yolu === "oyuncu-1/f2.jpg" && !db.getDocument(f1.id));
    check("oyuncu foto yolu yeni vesikalığa döner", db.getPlayer(oyuncu.id).foto_yolu === "oyuncu-1/f2.jpg");

    // Yabancı uyruklu oyuncu: TC yok, pasaport no; pasaportla aranır; pasaport tekildir
    const yab = db.createPlayer({ uyruk: "yabanci", pasaport_no: "U1234567", ad_soyad: "Ivan Petrov", dogum_tarihi: "2014-02-02", yas_grubu_id: grp.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10" });
    check("yabancı oyuncu TC'siz kaydedilir", yab.tc_no === null && yab.uyruk === "yabanci" && yab.pasaport_no === "U1234567");
    const ibo = db.createPlayer({ ad_soyad: "İbrahim IŞIK", dogum_tarihi: "2015-03-03", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 100, odeme_donemi: "1-10", pasaport_no: null });
    const bulur = (q) => db.listPlayers({ q }).some((p) => p.id === ibo.id) && db.listPlayersWithDue({ q, yil: 2026, ay: 9 }).some((p) => p.id === ibo.id) && db.playersPage({ q, yil: 2026, ay: 9 }).liste.some((p) => p.id === ibo.id);
    check("Türkçe duyarsız arama: 'i', 'ibrahim', 'isik', 'IŞIK', 'ışık' hepsi İbrahim IŞIK'ı bulur", ["i", "ibrahim", "isik", "IŞIK", "ışık", "İbrahim ış"].every(bulur) && !bulur("ibrahimm"));
    check("pasaport araması büyük/küçük harf duyarsız", db.listPlayers({ q: "u1234567" }).some((p) => p.id === yab.id));
    check("pasaport ile arama (liste ve pano)", db.listPlayers({ q: "U12345" }).some((p) => p.id === yab.id) && db.listPlayersWithDue({ q: "U1234567", yil: 2026, ay: 9 }).some((p) => p.id === yab.id));
    let pasaportTekil = false; try { db.createPlayer({ uyruk: "yabanci", pasaport_no: "U1234567", ad_soyad: "Kopya", dogum_tarihi: "2014-02-02" }); } catch (e) { pasaportTekil = /UNIQUE/.test(e.message); }
    check("aynı pasaport ikinci kez reddedilir", pasaportTekil);
    check("iki TC'siz oyuncu sorun çıkarmaz (NULL tekillikte sayılmaz)", !!db.createPlayer({ uyruk: "yabanci", pasaport_no: "P7654321", ad_soyad: "Ana Silva", dogum_tarihi: "2015-03-03" }).id);
    check("şema sürümü 8 ve pasaport sütunu var", db.getMetaValue("schema_version") === "8" && db.getPlayer(yab.id).pasaport_no === "U1234567");

    // Aidat ayarları tek işlemde: iki kalem + indirim birlikte; hatalı girdi hepsini geri alır
    const forma = db.listFeeItems().find((k) => k.kod === "forma"), mont = db.listFeeItems().find((k) => k.kod === "mont");
    const ak = db.aidatAyarlariKaydet({ kalemler: [{ id: forma.id, varsayilan_fiyat: 9000 }, { id: mont.id, varsayilan_fiyat: 8000, ad: "Mont (kışlık)" }], indirimler: { indirimli: 25 } });
    const l2 = db.listFeeItems();
    check("iki kalem ve indirim tek çağrıda kaydedildi", ak.ok && l2.find((k) => k.id === forma.id).varsayilan_fiyat === 9000 && l2.find((k) => k.id === mont.id).ad === "Mont (kışlık)" && db.aidatAyarlari().indirimler.indirimli === 25);
    let geriAlindi = false; try { db.aidatAyarlariKaydet({ kalemler: [{ id: forma.id, varsayilan_fiyat: 1 }, { id: 99999, varsayilan_fiyat: 2 }], indirimler: { kardes: 10 } }); } catch (e) { geriAlindi = /bulunamadı/.test(e.message); }
    check("hatalı satır tüm işlemi geri alır (forma 9000 kaldı, kardeş indirimi yazılmadı)", geriAlindi && db.listFeeItems().find((k) => k.id === forma.id).varsayilan_fiyat === 9000 && db.aidatAyarlari().indirimler.kardes === 15); // önceki adımda 15 yazılmıştı; 10 uygulanmamalı
    let yuzdeRed = false; try { db.aidatAyarlariKaydet({ indirimler: { indirimli: 150 } }); } catch (e) { yuzdeRed = /0-100/.test(e.message); }
    check("yüzde 0-100 dışı reddedilir", yuzdeRed && db.aidatAyarlari().indirimler.indirimli === 25);
    // Kalem ve ücret tipi ekle / düzenle / sil (07.09.2026)
    const ek = db.aidatAyarlariKaydet({ kalemler: [{ yeni: true, ad: "Kamp Ücreti", varsayilan_fiyat: 2500 }], ucretTipleri: [{ yeni: true, ad: "Şampiyon Bursu", indirim: 50 }, { kod: "burslu", ad: "Tam Burslu" }] });
    const kamp = db.listFeeItems().find((k) => k.ad === "Kamp Ücreti"), samp = db.listFeeTypes().find((t) => t.ad === "Şampiyon Bursu");
    check("yeni kalem ve ücret tipi kod üretilerek eklendi, tip adı düzenlendi", ek.ok && kamp?.kod === "kamp_ucreti" && kamp.varsayilan_fiyat === 2500 && samp?.kod === "sampiyon_bursu" && samp.indirim === 50 && db.listFeeTypes().find((t) => t.kod === "burslu").ad === "Tam Burslu");
    const sampOyuncu = db.createPlayer({ ad_soyad: "Bursu Oyuncu", dogum_tarihi: "2015-05-05", durum: "aktif", ucret_tipi: "sampiyon_bursu", aylik_aidat: 2000, odeme_donemi: "1-10" });
    let tipRed = ""; try { db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "sampiyon_bursu", sil: true }] }); } catch (e) { tipRed = e.message; }
    check("oyuncusu olan ücret tipi silinemez (mesaj oyuncu sayısını söyler)", /1 oyuncuda/.test(tipRed) && db.listFeeTypes().some((t) => t.kod === "sampiyon_bursu"));
    let sabitRed = ""; try { db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "normal", sil: true }] }); } catch (e) { sabitRed = e.message; }
    let sabitInd = db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "ucretsiz", indirim: 10 }] }) && db.listFeeTypes().find((t) => t.kod === "ucretsiz").indirim;
    check("sabit tip silinemez, indirimi değişmez", /sabit/.test(sabitRed) && sabitInd === 100);
    let tanimsiz = ""; try { db.updatePlayer(sampOyuncu.id, { ucret_tipi: "yok_boyle_tip" }); } catch (e) { tanimsiz = e.message; }
    check("oyuncuya tanımsız ücret tipi yazılamaz", /Tanımsız ücret tipi/.test(tanimsiz));
    db.updatePlayer(sampOyuncu.id, { ucret_tipi: "normal" });
    const kampMakbuz = db.createReceipt({ player_id: sampOyuncu.id, tarih: "2026-09-07", odeme_yontemi: "nakit", tahsil_eden: "T", satirlar: [{ fee_item_id: kamp.id, tutar: 2500, aciklama: "Kamp" }] });
    let kalemRed = ""; try { db.aidatAyarlariKaydet({ kalemler: [{ id: kamp.id, sil: true }] }); } catch (e) { kalemRed = e.message; }
    let aidatRed = ""; try { db.aidatAyarlariKaydet({ kalemler: [{ id: aidatKalemi.id, sil: true }] }); } catch (e) { aidatRed = e.message; }
    check("makbuzda geçen kalem ve Aidat kalemi silinemez", kampMakbuz.id > 0 && /1 makbuz satırında/.test(kalemRed) && /Aidat kalemi silinemez/.test(aidatRed) && db.listFeeItems().some((k) => k.id === kamp.id));
    const sil = db.aidatAyarlariKaydet({ ucretTipleri: [{ kod: "sampiyon_bursu", sil: true }], kalemler: [{ yeni: true, ad: "Geçici" }] });
    const gecici = db.listFeeItems().find((k) => k.ad === "Geçici");
    db.aidatAyarlariKaydet({ kalemler: [{ id: gecici.id, sil: true }] });
    check("oyuncusu kalmayan tip ve makbuzda geçmeyen kalem silinir", sil.ok && !db.listFeeTypes().some((t) => t.kod === "sampiyon_bursu") && !db.listFeeItems().some((k) => k.ad === "Geçici"));
    let geriAl2 = false; try { db.aidatAyarlariKaydet({ kalemler: [{ yeni: true, ad: "Yarım Kalan" }], ucretTipleri: [{ kod: "normal", sil: true }] }); } catch { geriAl2 = !db.listFeeItems().some((k) => k.ad === "Yarım Kalan"); }
    check("hatalı silme tüm işlemi geri alır (yeni kalem yazılmadı)", geriAl2);

    // Sayfalama: playersPage toplam/sayfa/offset; listDues ve listReceipts limit; playerAttendanceSon yeniden eskiye
    for (let i = 0; i < 7; i++) db.createPlayer({ ad_soyad: `Sayfa Oyuncu ${String(i).padStart(2, "0")}`, dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "aktif" });
    const tumu = db.listPlayersWithDue({ yil: 2026, ay: 9 });
    const s1 = db.playersPage({ yil: 2026, ay: 9, sayfa: 1, sayfaBoyu: 4 });
    const s2 = db.playersPage({ yil: 2026, ay: 9, sayfa: 2, sayfaBoyu: 4 });
    check("sayfa 1 ve 2 birleşince tam liste (aynı sıra)", s1.toplam === tumu.length && [...s1.liste, ...s2.liste].slice(0, tumu.length).map((p) => p.id).join() === tumu.slice(0, 8).map((p) => p.id).join() && s1.liste.length === 4);
    check("taşan sayfa son sayfaya çekilir; filtre toplamı düşürür", db.playersPage({ yil: 2026, ay: 9, sayfa: 99, sayfaBoyu: 4 }).sayfa === Math.ceil(tumu.length / 4) && db.playersPage({ yil: 2026, ay: 9, q: "Sayfa Oyuncu", sayfaBoyu: 3 }).toplam === 7);
    for (let ay = 1; ay <= 12; ay++) db.ensureMonthlyDues(2025, ay);
    check("listDues limit son N dönem (yeniden eskiye)", db.listDues(oyuncu.id, 3).length === 3 && db.listDues(oyuncu.id, 3)[0].yil >= db.listDues(oyuncu.id, 3)[2].yil && db.listDues(oyuncu.id).length > 3);
    check("listReceipts limit", db.listReceipts(oyuncu.id, 1).length === 1);
    const t2 = db.createTraining({ age_group_id: grp.id, tarih: "2026-09-20", saat: "10:00" }); db.setAttendance(t2.id, oyuncu.id, "gelmedi");
    const sonYk = db.playerAttendanceSon(oyuncu.id, 1);
    check("playerAttendanceSon en yeni kaydı verir", sonYk.length === 1 && sonYk[0].tarih === "2026-09-20" && db.playerAttendanceSon(oyuncu.id, 10).length === 2);

    // Sağlık raporu uyarıları: raporu olmayan "yok", süresi dolan "doldu", 30 gün içinde "dolacak", uzun geçerli listelenmez
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/eski.pdf", orijinal_ad: "eski.pdf", gecerlilik_tarihi: "2026-01-01" });
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/yeni.pdf", orijinal_ad: "yeni.pdf", gecerlilik_tarihi: "2026-09-20" });
    const sr = db.saglikRaporuDurumu("2026-09-07", 30);
    const srO = sr.uyarilar.find((u) => u.player_id === oyuncu.id);
    check("sağlık raporu: en son rapor 13 gün içinde dolacak", srO?.durum === "dolacak" && srO.gecerlilik === "2026-09-20");
    check("raporu olmayan aktif oyuncu 'yok' olarak listelenir", sr.uyarilar.some((u) => u.durum === "yok") && sr.yok >= 1);
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/uzun.pdf", orijinal_ad: "uzun.pdf", gecerlilik_tarihi: "2027-09-01" });
    check("uzun geçerli rapor gelince uyarıdan çıkar", !db.saglikRaporuDurumu("2026-09-07", 30).uyarilar.some((u) => u.player_id === oyuncu.id));

    // Haftalık program: gruba Pzt/Çar 17:00 yaz → haftayı doldur → 2 antrenman; tekrar → 2 atlanır; bozuk saat süzülür
    db.updateAgeGroup(grp.id, { program: [{ gun: 1, saat: "17:00", saha: "Saha 1" }, { gun: 3, saat: "17:00", saha: "Saha 1" }, { gun: 5, saat: "bozuk" }] });
    check("program kaydı doğrulanarak saklanır", JSON.parse(db.listAgeGroups().find((g) => g.id === grp.id).program).length === 2);
    const hd = db.haftayiProgramdanDoldur("2027-03-01"); // Pazartesi
    check("haftayı programdan doldur: 2 antrenman", hd.eklenen === 2 && db.listTrainings("2027-03-01", "2027-03-07").filter((t) => t.age_group_id === grp.id).map((t) => t.tarih).join() === "2027-03-01,2027-03-03");
    const hd2 = db.haftayiProgramdanDoldur("2027-03-01");
    check("ikinci doldurma var olanları atlar", hd2.eklenen === 0 && hd2.atlanan === 2 && db.listTrainings("2027-03-01", "2027-03-07").filter((t) => t.age_group_id === grp.id).length === 2);
    let hdHata = false; try { db.haftayiProgramdanDoldur("bozuk"); } catch (e) { hdHata = /yyyy/.test(e.message); }
    check("bozuk hafta başlangıcı reddedilir", hdHata);

    // Kısmi ödeme: 1500 → kismi (kalan 2000), +2000 → odendi; ilk makbuz iptal → yeniden kismi; borçlu listesinde kalan
    db.ensureMonthlyDues(2027, 1);
    const k1 = db.createReceipt({ player_id: oyuncu.id, tarih: "2027-01-03", satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 1500, aciklama: "Ocak 2027", yil: 2027, ay: 1 }] });
    let d1 = db.getDue(oyuncu.id, 2027, 1);
    check("kısmi ödeme: durum kismi, ödenen 1500, borçlu listesinde kalan 2000", d1.durum === "kismi" && d1.odenen === 1500 && d1.tutar === 3500 && db.listUnpaid(2027, 1).find((b) => b.player_id === oyuncu.id)?.kalan === 2000);
    check("pano borçlu sayısı kısmiyi sayar", db.panoOzet({ yil: 2027, ay: 1, bugun: "2027-01-05" }).borclu >= 1 && db.listPlayersWithDue({ yil: 2027, ay: 1, sadeceOdemeyen: true }).some((p) => p.id === oyuncu.id));
    const k2 = db.createReceipt({ player_id: oyuncu.id, tarih: "2027-01-10", satirlar: [{ fee_item_id: aidatKalemi.id, tutar: 2000, aciklama: "Ocak 2027", yil: 2027, ay: 1 }] });
    d1 = db.getDue(oyuncu.id, 2027, 1);
    check("kalan ödenince ödendi", d1.durum === "odendi" && d1.odenen === 3500 && !db.listUnpaid(2027, 1).some((b) => b.player_id === oyuncu.id));
    db.cancelReceipt(k1.id, "test iptali", "Tester");
    d1 = db.getDue(oyuncu.id, 2027, 1);
    check("ilk makbuz iptal → yeniden kısmi (ödenen 2000)", d1.durum === "kismi" && d1.odenen === 2000);
    db.cancelReceipt(k2.id, "test iptali", "Tester");
    check("ikinci de iptal → ödenmedi, ödenen 0", db.getDue(oyuncu.id, 2027, 1).durum === "odenmedi" && db.getDue(oyuncu.id, 2027, 1).odenen === 0);
    check("iptal edilmiş makbuz ikinci kez iptalde ödeneni bozmaz", (db.cancelReceipt(k2.id, "test iptali", "Tester"), db.getDue(oyuncu.id, 2027, 1).odenen === 0));

    // Tek makbuzda iki aidat ayı: ikisi de ödendi; iptal ikisini de geri açar
    db.ensureMonthlyDues(2026, 11); db.ensureMonthlyDues(2026, 12);
    const cift = db.createReceipt({ player_id: oyuncu.id, tarih: "2026-11-05", odeme_yontemi: "nakit", tahsil_eden: "T", satirlar: [
      { fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Kasım 2026", yil: 2026, ay: 11 }, { fee_item_id: aidatKalemi.id, tutar: 3500, aciklama: "Aralık 2026", yil: 2026, ay: 12 }] });
    check("iki aylık makbuz iki ayı da ödendi yapar", db.getDue(oyuncu.id, 2026, 11).durum === "odendi" && db.getDue(oyuncu.id, 2026, 12).durum === "odendi" && db.getReceipt(cift.id).toplam === 7000 && db.getReceipt(cift.id).satirlar.length === 2);
    db.cancelReceipt(cift.id, "test iptali", "Tester");
    check("iki aylık makbuz iptali iki ayı da geri açar", db.getDue(oyuncu.id, 2026, 11).durum === "odenmedi" && db.getDue(oyuncu.id, 2026, 12).durum === "odenmedi");

    // Excel aktarımı: tek işlem; yeni grup açılır, veli eklenir, bu ayın aidatı açılır; hata olursa hiçbiri yazılmaz
    const { aktarUygula } = require("../../electron/ipc/aktar.cjs");
    const { satirlariCoz } = require("../../electron/oyuncuAktar.cjs");
    const coz = satirlariCoz([["Ad Soyad", "TC Kimlik No", "Doğum Tarihi", "Yaş Grubu", "Aylık Aidat", "Veli Adı", "Veli Telefonu"],
      ["Aktarılan Bir", "55555555551", "01.01.2016", "U11", "3000", "Veli Bir", "0532 000 00 01"],
      ["Aktarılan İki", "", "02.02.2016", "U14", "2500", "", ""]], { gruplar: db.listAgeGroups() });
    const oncekiOyuncu = db.listPlayers().length;
    const ak2 = aktarUygula(coz.kayitlar);
    const a1 = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan Bir"), a2 = db.listPlayers().find((p) => p.ad_soyad === "Aktarılan İki");
    check("aktarım: 2 oyuncu, 1 yeni grup (U14), veli ve bu ayın aidatı", ak2.eklenen === 2 && ak2.yeniGrup === 1 && db.listPlayers().length === oncekiOyuncu + 2
      && a1.yas_grubu_ad === "U11" && a2.yas_grubu_ad === "U14" && db.listGuardians(a1.id)[0]?.gsm === "05320000001" && !!db.getDue(a1.id, new Date().getFullYear(), new Date().getMonth() + 1));
    let aktarHata = false; try { aktarUygula([{ ad_soyad: "Sorunsuz", dogum_tarihi: "2016-01-01" }, { ad_soyad: "Kopya", dogum_tarihi: "2016-01-01", tc_no: "55555555551" }]); } catch (e) { aktarHata = /UNIQUE/.test(e.message); }
    check("aktarımda hata olursa hiçbir kayıt yazılmaz", aktarHata && !db.listPlayers().some((p) => p.ad_soyad === "Sorunsuz"));

    // Ay ortasında kaydolan oyuncunun bu ayki aidatı yeniden başlatma beklemeden açılır; pasif→aktif de açar
    const simdi = new Date(); const buYil = simdi.getFullYear(), buAy = simdi.getMonth() + 1;
    const ortada = db.createPlayer({ ad_soyad: "Ay Ortası Kayıt", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 2500, odeme_donemi: "1-10" });
    check("yeni oyuncuya bu ayın aidatı hemen açılır", db.getDue(ortada.id, buYil, buAy)?.durum === "odenmedi" && db.getDue(ortada.id, buYil, buAy).tutar === 2500);
    const pasifOyuncu = db.createPlayer({ ad_soyad: "Pasiften Dönen", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "pasif", aylik_aidat: 2500 });
    check("pasif oyuncuya aidat açılmaz", db.getDue(pasifOyuncu.id, buYil, buAy) === null);
    db.updatePlayer(pasifOyuncu.id, { durum: "aktif" });
    check("pasif→aktif olunca bu ayın aidatı açılır", db.getDue(pasifOyuncu.id, buYil, buAy)?.durum === "odenmedi");
    check("tekrar çağrı kayıt çoğaltmaz", db.ensureMonthlyDues(buYil, buAy, pasifOyuncu.id) === 0);

    // Yeni sezon geçişi: yenileyen yeni sezon + üst grup; yenilemeyen pasif + not; eski borç isteğe bağlı muaf; gruplar/aktif sezon güncellenir
    const u12 = db.createAgeGroup({ ad: "U12", sezon: "2026-2027" });
    db.setSetting("aktif_sezon", "2026-2027");
    const yenileyen = db.createPlayer({ ad_soyad: "Sezon Yenileyen", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "aktif", aylik_aidat: 3500, odeme_donemi: "1-10" });
    const yenilemeyen = db.createPlayer({ ad_soyad: "Sezon Yenilemeyen", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "deneme", aylik_aidat: 3500, odeme_donemi: "1-10", notlar: "eski not" });
    const pasifZaten = db.createPlayer({ ad_soyad: "Zaten Pasif", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.id, durum: "pasif" });
    db.ensureMonthlyDues(2027, 5);
    check("sezon aday listesi aktif/deneme/sakat oyuncuları ve borç bilgisini verir", db.sezonAdayListesi().some((o) => o.id === yenilemeyen.id && o.borc_adet >= 1 && o.borc_tutar >= 3500) && !db.sezonAdayListesi().some((o) => o.id === pasifZaten.id));
    check("sezon durumu", db.sezonDurumu().aktifSezon === "2026-2027" && db.sezonDurumu().baslangicAyi === 9);
    let sezonHata = false; try { db.yeniSezonaGec({ sezon: "bozuk" }); } catch (e) { sezonHata = /biçiminde/.test(e.message); }
    check("bozuk sezon adı reddedilir", sezonHata);
    const sg = db.yeniSezonaGec({ sezon: "2027-2028", yenileyenler: [{ id: yenileyen.id, yas_grubu_id: u12.id }], eskiBorcSil: true });
    const y1 = db.getPlayer(yenileyen.id), y2 = db.getPlayer(yenilemeyen.id);
    check("yenileyen yeni sezon ve üst grupta", sg.ok && y1.sezon === "2027-2028" && y1.yas_grubu_id === u12.id && y1.durum === "aktif" && sg.yenilenen >= 1 && sg.grupDegisen >= 1);
    check("yenilemeyen pasif, not eklendi, eski notu korundu", y2.durum === "pasif" && /2026-2027 sezonu sonunda yenilemedi/.test(y2.notlar) && /eski not/.test(y2.notlar));
    check("yenilemeyenin eski borcu muaf oldu", db.listDues(yenilemeyen.id).every((d) => d.durum !== "odenmedi") && sg.borcSilinen >= 1);
    check("gruplar ve aktif sezon güncellendi", db.listAgeGroups().filter((g) => g.aktif).every((g) => g.sezon === "2027-2028") && db.sezonDurumu().aktifSezon === "2027-2028" && !!db.sezonDurumu().sonGecis);
    db.ensureMonthlyDues(2027, 10);
    check("pasif oyuncuya yeni aidat açılmaz, yenileyene açılır", db.getDue(yenilemeyen.id, 2027, 10) === null && !!db.getDue(yenileyen.id, 2027, 10));
    check("makbuz/yoklama geçmişi silinmedi (oyuncu kaydı duruyor)", !!db.getPlayer(yenilemeyen.id));

    // Kullanıcı silme: son aktif yönetici silinemez; yeni yönetici ilk admin'i silebilir; açılışta admin geri gelmez
    const ilkAdmin = db.getUserByUsername("admin");
    check("son yönetici silinemez", !!db.deleteUser(ilkAdmin.id).error);
    const yeniYonetici = db.createUser({ username: "hoca", password: "hoca-parola-1", ad_soyad: "Hoca", role: "admin" });
    check("ikinci yönetici varken ilk admin silinir", db.deleteUser(ilkAdmin.id).ok === true && db.getUserByUsername("admin") === null);
    db.close(); db.init();
    check("yeniden açılışta admin/admin geri gelmez", db.getUserByUsername("admin") === null && db.listUsers().length === 1);
    check("olmayan kullanıcı silme hatası", !!db.deleteUser(9999).error);
    // Kurtarma kodları: 8 kod, tek kullanımlık, yanlış kod reddedilir, yeni set eskisini geçersiz kılar
    const kk = db.kurtarmaKodlariUret(yeniYonetici.id);
    check("8 kurtarma kodu üretilir (XXXX-XXXX)", kk.ok && kk.kodlar.length === 8 && kk.kodlar.every((k) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(k)) && new Set(kk.kodlar).size === 8);
    check("kod sayısı listede görünür", db.listUsers().find((u) => u.username === "hoca").kurtarma_kodu === 8);
    check("yanlış kod reddedilir", !!db.kurtarmaIleSifirla("hoca", "AAAA-AAAA", "yeni-parola-9").error && !!db.verifyPassword("hoca", "hoca-parola-1"));
    check("olmayan kullanıcı reddedilir", !!db.kurtarmaIleSifirla("yok", kk.kodlar[0], "yeni-parola-9").error);
    const sf = db.kurtarmaIleSifirla("hoca", kk.kodlar[0].toLowerCase().replace("-", " "), "yeni-parola-9");
    check("doğru kod (küçük harf/boşluklu da) parolayı sıfırlar", sf.ok && sf.kalan === 7 && !!db.verifyPassword("hoca", "yeni-parola-9") && !db.verifyPassword("hoca", "hoca-parola-1"));
    check("aynı kod ikinci kez kullanılamaz", !!db.kurtarmaIleSifirla("hoca", kk.kodlar[0], "baska-parola-1").error);
    check("parola sıfırlama jeton sürümünü artırır (eski oturumlar düşer)", db.getUserByUsername("hoca").token_version === yeniYonetici.token_version + 1 || db.getUserByUsername("hoca").token_version >= 2);
    const kk2 = db.kurtarmaKodlariUret(yeniYonetici.id);
    check("yeni set eskisini geçersiz kılar", kk2.ok && !!db.kurtarmaIleSifirla("hoca", kk.kodlar[1], "x-parola-1").error && db.kurtarmaKoduSayisi(yeniYonetici.id) === 8);
    check("kod üretimi olmayan kullanıcıda hata", !!db.kurtarmaKodlariUret(9999).error);

    // Lisans: temiz kurulum → deneme; geçersiz anahtar reddedilir; salt okunur değil
    const ld = db.lisansDurumu();
    check("lisans temiz kurulumda deneme", ld.mod === "deneme" && ld.kalanGun === 30 && !!ld.makineId);
    check("geçersiz anahtar reddedilir", !!db.lisansKaydet("EYUPSPOR.bozuk.anahtar").error);
    check("salt okunur değil", db.lisansSaltOkunurMu() === false);
    check("makineId kalıcı", db.lisansDurumu().makineId === ld.makineId);

    // Yedek al → değişiklik yap → geri yükle → değişiklik geri alınmış olmalı
    const { yedekAl, geriYukleCekirdek } = require("../../electron/ipc/yedek.cjs");
    const yedekKok = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-yedek-"));
    const yedekOncesi = db.listPlayers().length;
    // Bir belge dosyası koy: yedek zip'ine girmeli ve geri yüklemede geri gelmeli
    const upKok = db.getUploadsDir();
    fs.mkdirSync(path.join(upKok, "oyuncu-1"), { recursive: true });
    fs.writeFileSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf"), "%PDF-1.4 yedek testi");
    const y = yedekAl(yedekKok);
    check("yedek tek zip dosyası", y.ok && /eyupspor-yedek-.*\.zip$/.test(y.yol) && fs.existsSync(y.yol) && y.dosya >= 1);
    const { unzipSync } = require("fflate");
    const arsiv = unzipSync(new Uint8Array(fs.readFileSync(y.yol)));
    check("zip içinde data.db ve belge var", !!arsiv["data.db"] && Buffer.from(arsiv["uploads/oyuncu-1/1-saglik-rapor.pdf"]).toString() === "%PDF-1.4 yedek testi");
    const { yedekHazirla } = require("../../electron/ipc/yedek.cjs");
    const hz = yedekHazirla(y.yol);
    check("zip yedek doğrulanıyor", hz.ok && hz.oyuncu === yedekOncesi && hz.gecici);
    fs.rmSync(hz.klasor, { recursive: true, force: true });
    db.createPlayer({ ad_soyad: "Sonradan Eklenen", dogum_tarihi: "2016-01-01" });
    fs.unlinkSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf"));
    check("geri yükleme öncesi bir oyuncu fazla, belge silinmiş", db.listPlayers().length === yedekOncesi + 1 && !fs.existsSync(path.join(upKok, "oyuncu-1", "1-saglik-rapor.pdf")));
    const g = geriYukleCekirdek(y.yol);
    check("zip'ten geri yükleme başarılı", !!g.ok);
    db.init();
    check("geri yükleme sonrası eski oyuncu sayısı", db.listPlayers().length === yedekOncesi);
    check("belge zip'ten geri geldi", fs.readFileSync(path.join(db.getUploadsDir(), "oyuncu-1", "1-saglik-rapor.pdf"), "utf8") === "%PDF-1.4 yedek testi");
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
    const eskiKlasor = path.join(yedekKok, "eski-bicim"); fs.mkdirSync(eskiKlasor);
    fs.writeFileSync(path.join(eskiKlasor, "data.db"), Buffer.from(arsiv["data.db"]));
    check("klasör biçimi yedek de doğrulanır", yedekHazirla(eskiKlasor).ok === true);

    // Resim optimizasyonu: büyük PNG küçülür (≤2000px), küçük dosya ve PDF dokunulmaz
    const { nativeImage } = require("electron");
    const { optimizeImage } = require("../../electron/imageOptimize.cjs");
    const W = 3000, H = 2000, bitmap = Buffer.alloc(W * H * 4);
    // Fotoğraf benzeri yumuşak geçiş (periyodik desen PNG'de aşırı sıkışıp küçültmeyi anlamsız kılar)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; bitmap[i] = (x * 255 / W) | 0; bitmap[i + 1] = (y * 255 / H) | 0; bitmap[i + 2] = ((x + y) * 127 / (W + H)) | 0; bitmap[i + 3] = 255; }
    const buyukPng = nativeImage.createFromBitmap(bitmap, { width: W, height: H }).toPNG();
    const kucuk = optimizeImage(buyukPng, ".png");
    const kucukBoyut = nativeImage.createFromBuffer(kucuk).getSize();
    check("büyük PNG 2000px'e küçülür ve dosya küçülür", kucuk.length < buyukPng.length && kucukBoyut.width === 2000 && kucukBoyut.height === 1333);
    const buyukJpg = nativeImage.createFromBitmap(bitmap, { width: W, height: H }).toJPEG(100);
    const jpgOpt = optimizeImage(buyukJpg, ".jpg");
    check("büyük JPG küçülür", jpgOpt.length < buyukJpg.length && nativeImage.createFromBuffer(jpgOpt).getSize().width === 2000);
    check("PDF ve bozuk veri dokunulmaz", optimizeImage(Buffer.from("%PDF"), ".pdf").toString() === "%PDF" && optimizeImage(Buffer.from("bozuk"), ".png").toString() === "bozuk");
    // Ayarlar aracı: analiz + uygula uploads üzerinde
    const { analiz, uygula } = require("../../electron/ipc/optimize.cjs");
    fs.writeFileSync(path.join(db.getUploadsDir(), "oyuncu-1", `${Date.now()}-foto-vesika.png`), buyukPng);
    const an = analiz();
    check("analiz: 1 resim (vesikalık), 1 diğer (pdf)", an.resim.adet === 1 && an.resim.gruplar.foto?.adet === 1 && an.diger.adet === 1);
    const uy = uygula();
    check("uygula: resim küçültüldü, tasarruf > 0", uy.adet === 1 && uy.kucultulen === 1 && uy.tasarruf > 0 && analiz().resim.bayt === uy.sonra);
    check("ikinci uygulama değişiklik yapmaz", uygula().kucultulen === 0);
    check("geçersiz klasör reddedilir", !!geriYukleCekirdek(yedekKok).error);
    db.init(); // geçersiz denemeden sonra DB yeniden açılır
    fs.rmSync(yedekKok, { recursive: true, force: true });

    // Göç 7 → 8: eski sürümden kalan `indirim_<kod>` ayarları ücret tipi tablosuna bir kez taşınır; sonraki açılışta ezilmez
    db.setMetaValue("schema_version", "7"); db.setSetting("indirim_burslu", "33"); db.setSetting("indirim_ucretsiz", "10");
    db.close(); db.init();
    const goc = db.listFeeTypes();
    check("göç 7→8: eski indirim ayarı tabloya taşındı, sabit tip korundu, sürüm 8", goc.find((t) => t.kod === "burslu").indirim === 33 && goc.find((t) => t.kod === "ucretsiz").indirim === 100 && db.getMetaValue("schema_version") === "8");
    db.aidatAyarlariKaydet({ indirimler: { burslu: 40 } }); db.close(); db.init();
    check("şema 8'de yeniden açılış eski ayarı tekrar yazmaz (40 kaldı)", db.listFeeTypes().find((t) => t.kod === "burslu").indirim === 40);

    db.close();
    // Anahtar varsa dosya şifreli olmalı: anahtarsız açılış sqlite_master okuyamamalı
    if (db.isEncrypted()) {
      const Database = require("better-sqlite3-multiple-ciphers");
      let okunabildi = false;
      try { new Database(path.join(tmp, "data.db")).prepare("SELECT count(*) FROM sqlite_master").get(); okunabildi = true; } catch {}
      check("veritabanı at-rest şifreli", !okunabildi);
    } else {
      console.log("SKIP at-rest şifreleme (safeStorage yok)");
    }
  } catch (e) {
    console.error("HATA:", e && e.stack);
    fail++;
  }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  app.exit(fail === 0 ? 0 : 1);
});
