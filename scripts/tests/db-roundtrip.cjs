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

    const acilan = db.ensureMonthlyDues(2026, 9);
    check("aylık aidat açıldı", acilan >= 1);
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
    db.cancelReceipt(makbuz.id);
    check("makbuz iptali aidatı geri açar", db.getDue(oyuncu.id, 2026, 9).durum === "odenmedi");
    check("iptal sonrası borçlu listesi", db.listUnpaid(2026, 9).length === 1);
    check("grup silme oyuncu varken engellenir", !!db.deleteAgeGroup(grp.id).error);
    const belgeId = db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/x.pdf", orijinal_ad: "x.pdf" });
    check("belge okunuyor", db.getDocument(belgeId).tip === "saglik");
    // Vesikalık tekil: ikinci yükleme eskisinin yerine geçer; diğer tipler birikir
    db.addDocument(oyuncu.id, { tip: "saglik", dosya_yolu: "oyuncu-1/y.pdf", orijinal_ad: "y.pdf" });
    check("sağlık raporuna birden fazla dosya yüklenebilir", db.listDocuments(oyuncu.id).filter((b) => b.tip === "saglik").length === 2);
    const f1 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f1.jpg", orijinal_ad: "f1.jpg" });
    const f2 = db.belgeEkle(oyuncu.id, { tip: "foto", dosya_yolu: "oyuncu-1/f2.jpg", orijinal_ad: "f2.jpg" });
    const fotolar = db.listDocuments(oyuncu.id).filter((b) => b.tip === "foto");
    check("vesikalık tek dosya kalır, yenisi eskisinin yerine geçer", f1.silinen.length === 0 && f2.silinen[0] === "oyuncu-1/f1.jpg" && fotolar.length === 1 && fotolar[0].dosya_yolu === "oyuncu-1/f2.jpg" && !db.getDocument(f1.id));
    check("oyuncu foto yolu yeni vesikalığa döner", db.getPlayer(oyuncu.id).foto_yolu === "oyuncu-1/f2.jpg");

    // Lisans: temiz kurulum → deneme; geçersiz anahtar reddedilir; salt okunur değil
    const ld = db.lisansDurumu();
    check("lisans temiz kurulumda deneme", ld.mod === "deneme" && ld.kalanGun === 30 && !!ld.makineId);
    check("geçersiz anahtar reddedilir", !!db.lisansKaydet("EYUPSPOR.bozuk.anahtar").error);
    check("salt okunur değil", db.lisansSaltOkunurMu() === false);
    check("makineId kalıcı", db.lisansDurumu().makineId === ld.makineId);

    // Yedek al → değişiklik yap → geri yükle → değişiklik geri alınmış olmalı
    const { yedekAl, geriYukleCekirdek } = require("../../electron/ipc/yedek.cjs");
    const yedekKok = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-yedek-"));
    const y = yedekAl(yedekKok);
    check("yedek alındı", y.ok && fs.existsSync(path.join(y.yol, "data.db")));
    check("yedek doğrulanıyor", db.yedekBilgisi(path.join(y.yol, "data.db")).oyuncu === 1);
    db.createPlayer({ ad_soyad: "Sonradan Eklenen", dogum_tarihi: "2016-01-01" });
    check("geri yükleme öncesi 2 oyuncu", db.listPlayers().length === 2);
    const g = geriYukleCekirdek(y.yol);
    check("geri yükleme başarılı", !!g.ok);
    db.init();
    check("geri yükleme sonrası 1 oyuncu (eski veri)", db.listPlayers().length === 1);
    check("eski veri kenara alındı", fs.existsSync(g.kenarDb));
    check("geçersiz klasör reddedilir", !!geriYukleCekirdek(yedekKok).error);
    db.init(); // geçersiz denemeden sonra DB yeniden açılır
    fs.rmSync(yedekKok, { recursive: true, force: true });

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
