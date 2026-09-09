// Anahtar dosyası koruması: db-key.enc var ama çözülemiyorsa (bozuk / başka uygulama adıyla şifrelenmiş) init() açık hata verir,
// dosyanın üzerine YAZMAZ ve yeni anahtar üretmez. (09.09.2026: uygulama adı değişince eski kod anahtarı üzerine yazıp veriyi
// kalıcı olarak okunamaz kılıyordu.) Ayrıca anahtar-yeniden-sifrele.cjs eski/yeni adla gidiş-dönüşü doğrular.
// Kullanım: electron scripts/tests/anahtar-koruma.cjs <dizin>
const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const [dizin] = process.argv.slice(2);
app.setPath("userData", dizin);
let fail = 0;
const check = (ad, k, ek = "") => {
  console.log(`${k ? "PASS" : "FAIL"} ${ad}${k ? "" : " → " + ek}`);
  if (!k) fail++;
};
app.whenReady().then(() => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.log("safeStorage yok — atlandı");
      console.log("TUM KONTROLLER GECTI");
      return app.exit(0);
    }
    const anahtarYolu = path.join(dizin, "db-key.enc");
    const bozuk = Buffer.from("v10-bu-bir-anahtar-degil-" + "x".repeat(40));
    fs.writeFileSync(anahtarYolu, bozuk);
    const db = require("../../electron/db.cjs");
    let hata = null;
    try {
      db.init();
    } catch (e) {
      hata = e;
    }
    check(
      "çözülemeyen anahtar dosyasında init() açık hata verir",
      !!hata && /anahtar/i.test(hata.message),
      hata ? hata.message : "hata yok",
    );
    check("anahtar dosyası üzerine yazılmadı (bayt bayt aynı)", fs.readFileSync(anahtarYolu).equals(bozuk));
    check("hata mesajı kurtarma betiğini söyler", !!hata && hata.message.includes("anahtar-yeniden-sifrele"));

    // Gidiş-dönüş: "Ad A" ile şifrelenmiş anahtar → betikle "Ad B"ye taşınır → B adıyla çözülür, A ile çözülmez
    const ham = "ab".repeat(32);
    const aYolu = path.join(dizin, "a-key.enc");
    const betik = path.join(__dirname, "..", "anahtar-yeniden-sifrele.cjs");
    const cozBetik = (ad, kaynak, cikti) => spawnSync(process.execPath, [betik, "--coz", ad, kaynak, cikti], { encoding: "utf-8" });
    const r0 = spawnSync(
      process.execPath,
      [
        betik,
        "--sifrele",
        "Anahtar Test A",
        (() => {
          const t = path.join(dizin, "ham.txt");
          fs.writeFileSync(t, ham);
          return t;
        })(),
        aYolu,
      ],
      { encoding: "utf-8" },
    );
    check("A adıyla şifrelendi", r0.status === 0 && fs.existsSync(aYolu), r0.stderr);
    const r1 = spawnSync(process.execPath, [betik, "Anahtar Test A", "Anahtar Test B", aYolu], { encoding: "utf-8" });
    check(
      "betik A → B taşıdı ve eski dosyayı yedekledi",
      r1.status === 0 && /TAMAM/.test(r1.stdout) && fs.readdirSync(dizin).some((f) => f.startsWith("a-key.enc.eski-")),
      r1.stdout + r1.stderr,
    );
    const cB = path.join(dizin, "coz-b.txt"),
      cA = path.join(dizin, "coz-a.txt");
    const rB = cozBetik("Anahtar Test B", aYolu, cB),
      rA = cozBetik("Anahtar Test A", aYolu, cA);
    check("B adıyla çözülür ve ham anahtar aynı", rB.status === 0 && fs.readFileSync(cB, "utf-8") === ham, rB.stderr);
    check("A adıyla artık çözülmez", rA.status !== 0, "A ile çözüldü");
    if (fail === 0) console.log("TUM KONTROLLER GECTI");
    app.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("HATA:", e && e.stack);
    app.exit(1);
  }
});
