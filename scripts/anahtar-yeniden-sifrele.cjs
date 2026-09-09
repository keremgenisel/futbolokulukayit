// Veritabanı anahtarını (db-key.enc) ESKİ uygulama adının anahtar zinciri kaydıyla çözüp YENİ adla yeniden şifreler.
// Neden: macOS'ta Electron safeStorage anahtarı "<uygulama adı> Safe Storage" keychain kaydında tutar. productName değişince
// (09.09.2026: "Eyüpspor Futbol Okulu" → "Futbol Okulu Kayıt Programı") eski db-key.enc çözülemez ve uygulama açılmaz.
// Windows'ta (DPAPI, kullanıcı hesabına bağlı) gerekmez.
// Kullanım (uygulama KAPALIYKEN, proje kökünde):
//   npx electron scripts/anahtar-yeniden-sifrele.cjs "<eski ad>" "<yeni ad>" "<db-key.enc yolu>" [çıktı yolu = aynı dosya]
// Kendini iki aşamada çalıştırır (bir süreçte tek uygulama adı olabilir): 1) eski adla çöz → geçici dosya (0600),
// 2) yeni adla şifrele → çıktı. Orijinal dosya "<çıktı>.eski-<damga>" olarak yedeklenir; geçici dosya silinir.
const { app, safeStorage } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const [asama, ...arg] = process.argv.slice(2);

function cikis(mesaj, kod = 1) {
  console.error(mesaj);
  app.exit(kod);
}

if (asama === "--coz") {
  const [ad, kaynak, gecici] = arg;
  app.setName(ad);
  app.whenReady().then(() => {
    try {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("safeStorage kullanılamıyor");
      fs.writeFileSync(gecici, safeStorage.decryptString(fs.readFileSync(kaynak)), { mode: 0o600 });
      app.exit(0);
    } catch (e) {
      cikis("Çözme başarısız (" + ad + "): " + e.message);
    }
  });
} else if (asama === "--sifrele") {
  const [ad, gecici, hedef] = arg;
  app.setName(ad);
  app.whenReady().then(() => {
    try {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("safeStorage kullanılamıyor");
      const ham = fs.readFileSync(gecici, "utf-8");
      if (!/^[0-9a-f]{64}$/.test(ham)) throw new Error("Çözülen anahtar beklenen biçimde değil");
      fs.writeFileSync(hedef, safeStorage.encryptString(ham), { mode: 0o600 });
      app.exit(0);
    } catch (e) {
      cikis("Şifreleme başarısız (" + ad + "): " + e.message);
    }
  });
} else {
  const [eskiAd, yeniAd, kaynak, hedefArg] = process.argv.slice(2);
  if (!eskiAd || !yeniAd || !kaynak) {
    console.error('Kullanım: npx electron scripts/anahtar-yeniden-sifrele.cjs "<eski ad>" "<yeni ad>" "<db-key.enc>" [çıktı]');
    app.exit(2);
  } else {
    const hedef = hedefArg || kaynak;
    const gecici = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "anahtar-tasi-")), "ham.key");
    try {
      const r1 = spawnSync(process.execPath, [__filename, "--coz", eskiAd, kaynak, gecici], { stdio: "inherit" });
      if (r1.status !== 0) throw new Error("çözme aşaması başarısız");
      if (fs.existsSync(hedef)) {
        const yedek = `${hedef}.eski-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        fs.copyFileSync(hedef, yedek);
        console.log("Eski anahtar dosyası yedeklendi: " + yedek);
      }
      const r2 = spawnSync(process.execPath, [__filename, "--sifrele", yeniAd, gecici, hedef], { stdio: "inherit" });
      if (r2.status !== 0) throw new Error("şifreleme aşaması başarısız");
      console.log(`TAMAM: ${hedef} artık "${yeniAd}" adıyla açılır.`);
      app.exit(0);
    } catch (e) {
      cikis("HATA: " + e.message);
    } finally {
      try {
        fs.rmSync(path.dirname(gecici), { recursive: true, force: true });
      } catch {
        /* yoksay */
      }
    }
  }
}
