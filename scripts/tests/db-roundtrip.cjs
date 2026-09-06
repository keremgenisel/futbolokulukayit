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
