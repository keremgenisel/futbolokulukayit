// Gömülü HTTPS sunucusu uçtan uca güvenlik testi (Electron altında). Geçici userData'da DB açar,
// sunucuyu rastgele portta başlatır ve sertifika sabitlemeli undici fetch ile vurur:
// 401 (oturumsuz), 429 (login brute-force), 403 (yönetici olmayan admin işlemi), yetkili çağrılar,
// dosya yükleme, TOFU pin uyumsuzluğu. "TUM KONTROLLER GECTI" yoksa başarısız.
const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-srvtest-"));
app.setPath("userData", tmp);
let fail = 0;
const check = (ad, kosul) => { console.log(`${kosul ? "PASS" : "FAIL"} ${ad}`); if (!kosul) fail++; };

app.whenReady().then(async () => {
  try {
    const db = require("../../electron/db.cjs");
    const server = require("../../electron/server.cjs");
    const { pinliDispatcher, pinliFetch, sertifikaParmakIziAl } = require("../../electron/pinnedFetch.cjs");
    db.init();
    const bilgi = await server.baslat({ port: 0, surum: "test" });
    const base = `https://127.0.0.1:${bilgi.port}`;
    const { fp, pem } = await sertifikaParmakIziAl(base);
    check("sunucu parmak izi TOFU ile alınır ve sunucununkiyle aynı", fp === bilgi.fp);
    const d = pinliDispatcher(pem);
    const istek = async (yol, { method = "GET", body, token } = {}) => {
      const h = { "content-type": "application/json" }; if (token) h.authorization = "Bearer " + token;
      const r = await pinliFetch(base + yol, { method, headers: h, body: body ? JSON.stringify(body) : undefined, dispatcher: d });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };

    check("/saglik", (await istek("/saglik")).body.ad === "eyupspor-futbol-okulu");
    check("oturumsuz /api/db 401", (await istek("/api/db", { method: "POST", body: { fn: "listAgeGroups", args: [] } })).status === 401);
    check("yanlış parola 401", (await istek("/api/auth/login", { method: "POST", body: { username: "admin", password: "yanlis" } })).status === 401);

    const giris = await istek("/api/auth/login", { method: "POST", body: { username: "admin", password: "admin" } });
    check("doğru parola jeton verir", giris.status === 200 && !!giris.body.token && giris.body.user.role === "admin");
    const tok = giris.body.token;

    check("jetonla okuma", (await istek("/api/db", { method: "POST", body: { fn: "listFeeItems", args: [] }, token: tok })).body.sonuc.length >= 10);
    const grp = await istek("/api/db", { method: "POST", body: { fn: "createAgeGroup", args: [{ ad: "U11" }] }, token: tok });
    check("jetonla yazma", grp.status === 200 && grp.body.sonuc.id > 0);
    check("beyaz liste dışı fonksiyon 403", (await istek("/api/db", { method: "POST", body: { fn: "close", args: [] }, token: tok })).status === 403);

    // Yönetici olmayan kullanıcı → admin işlemi 403
    await istek("/api/db", { method: "POST", body: { fn: "createUser", args: [{ username: "antrenor", password: "antrenor1", ad_soyad: "Antrenör", role: "kullanici" }] }, token: tok });
    const g2 = await istek("/api/auth/login", { method: "POST", body: { username: "antrenor", password: "antrenor1" } });
    check("ikinci kullanıcı giriş yapar", g2.status === 200);
    check("yönetici olmayan createUser 403", (await istek("/api/db", { method: "POST", body: { fn: "createUser", args: [{ username: "x", password: "xxxxxx" }] }, token: g2.body.token })).status === 403);
    check("yönetici olmayan lisans kaydet 403", (await istek("/api/lisans/kaydet", { method: "POST", body: { anahtar: "EYUPSPOR.a.b" }, token: g2.body.token })).status === 403);
    check("yönetici olmayan okuma serbest", (await istek("/api/db", { method: "POST", body: { fn: "listAgeGroups", args: [] }, token: g2.body.token })).status === 200);

    // Parola değişimi: eski jeton düşer, yeni jeton çalışır
    const pd = await istek("/api/auth/changePassword", { method: "POST", body: { newPassword: "yeni-parola-1" }, token: g2.body.token });
    check("parola değişimi yeni jeton verir", pd.status === 200 && !!pd.body.token);
    check("eski jeton geçersiz (token_version)", (await istek("/api/auth/me", { token: g2.body.token })).status === 401);
    check("yeni jeton geçerli", (await istek("/api/auth/me", { token: pd.body.token })).status === 200);

    // Dosya yükleme
    const oyuncu = await istek("/api/db", { method: "POST", body: { fn: "createPlayer", args: [{ ad_soyad: "Test", dogum_tarihi: "2015-01-01", yas_grubu_id: grp.body.sonuc.id }] }, token: tok });
    const up = await istek("/api/files/addDocument", { method: "POST", body: { playerId: oyuncu.body.sonuc.id, tip: "saglik", ad: "rapor.pdf", base64: Buffer.from("%PDF-1.4 test").toString("base64") }, token: tok });
    check("belge yükleme", up.status === 200 && fs.existsSync(path.join(db.getUploadsDir(), up.body.dosya_yolu)));
    const foto = (ad) => istek("/api/files/addDocument", { method: "POST", body: { playerId: oyuncu.body.sonuc.id, tip: "foto", ad, base64: Buffer.from("PNG test").toString("base64") }, token: tok });
    const f1 = await foto("v1.png"); const f2 = await foto("v2.png");
    const fotoKayitlari = db.listDocuments(oyuncu.body.sonuc.id).filter((b) => b.tip === "foto");
    check("vesikalık sunucuda da tek dosya: eski dosya silinir", f2.status === 200 && fotoKayitlari.length === 1 && fotoKayitlari[0].dosya_yolu === f2.body.dosya_yolu && !fs.existsSync(path.join(db.getUploadsDir(), f1.body.dosya_yolu)));
    check("yasak uzantı reddedilir", (await istek("/api/files/addDocument", { method: "POST", body: { playerId: oyuncu.body.sonuc.id, tip: "diger", ad: "zararli.exe", base64: "AA==" }, token: tok })).status === 400);
    check("yol geçişi reddedilir", (await istek("/api/files/dataUrl?yol=../../etc/passwd", { token: tok })).status === 400);
    check("lisans durumu okunur", (await istek("/api/lisans/durum", { token: tok })).body.durum.mod === "deneme");

    // Login brute-force: 8 yanlış → 429
    let son = 0;
    for (let i = 0; i < 10; i++) son = (await istek("/api/auth/login", { method: "POST", body: { username: "admin", password: "kotu" + i } })).status;
    check("login hız sınırı 429", son === 429);

    // Sabitleme: farklı sertifikayla bağlantı reddedilir
    const yabanci = crypto.generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }); void yabanci;
    let red = false;
    try { await pinliFetch(base + "/saglik", { dispatcher: pinliDispatcher(require("selfsigned").generate ? (await require("selfsigned").generate([{ name: "commonName", value: "x" }], { keySize: 2048, days: 1 })).cert : pem) }); } catch { red = true; }
    check("yabancı sertifika pini ile bağlantı reddedilir", red);

    await server.durdur();
    db.close();
  } catch (e) { console.error("HATA:", e && e.stack); fail++; }
  if (fail === 0) console.log("TUM KONTROLLER GECTI");
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  app.exit(fail === 0 ? 0 : 1);
});
