// Gömülü HTTPS sunucusu — "sunucu" modundaki PC'de Electron ana sürecinde çalışır. İstemci PC'ler
// LAN/Tailscale üzerinden bağlanır; sertifika self-signed, istemci ilk bağlantıda parmak izini
// sabitler (electron/istemci.cjs). Kimlik: JWT (30 gün, token_version ile iptal). Yetki kararı
// electron/yetki.cjs ile IPC katmanıyla ORTAK — sunucu üzerinden de salt-okunur yaptırımı geçerli.
const express = require("express");
const compression = require("compression");
const https = require("https");
const jwt = require("jsonwebtoken");
const os = require("os");
const fs = require("fs");
const path = require("path");
const db = require("./db.cjs");
const serverTls = require("./serverTls.cjs");
const { getSecret } = require("./jwtSecret.cjs");
const { rateAllow, rateHit, rateRetryAfter, rateReset } = require("./rateLimit.cjs");
const { cagriYetkisi } = require("./yetki.cjs");
const { belgeGirdiDogrula } = require("./belgeDogrula.cjs");
const { optimizeImage } = require("./imageOptimize.cjs");
const { markaOku } = require("./marka.cjs");
const { kulupLogoKaydet, kulupLogoKaldir } = require("./kulupLogo.cjs");

let srv = null;
let bilgi = null; // { port, fp, adresler }
const loginDenemeleri = new Map();
const LOGIN_MAX = 8,
  LOGIN_PENCERE = 15 * 60 * 1000;
const kurtarmaDenemeleri = new Map(); // kullanıcı adı başına 5 / 15 dk
const KURTARMA_MAX = 5,
  KURTARMA_PENCERE = 15 * 60 * 1000;

const yerelIpler = () => {
  const out = [];
  for (const [ad, ifs] of Object.entries(os.networkInterfaces()))
    for (const i of ifs || [])
      if (i.family === "IPv4" && !i.internal) out.push({ ad, ip: i.address, tailscale: i.address.startsWith("100.") });
  return out;
};

function signToken(u) {
  return jwt.sign({ username: u.username, tv: u.token_version ?? 1 }, getSecret(db), { expiresIn: "30d" });
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "Oturum gerekli" });
  try {
    const p = jwt.verify(h.slice(7), getSecret(db));
    const u = db.getUserByUsername(p.username);
    if (!u || !u.is_active || (p.tv ?? 0) !== (u.token_version ?? 1)) return res.status(401).json({ error: "Oturum gerekli" });
    req.user = { username: u.username, ad_soyad: u.ad_soyad, role: u.role, must_change_password: !!u.must_change_password };
    next();
  } catch {
    return res.status(401).json({ error: "Oturum gerekli" });
  }
}
const requireAdmin = (req, res, next) =>
  req.user?.role === "admin" ? next() : res.status(403).json({ error: "Yönetici yetkisi gerekli" });

const guvenliAd = (ad) =>
  String(ad)
    .replace(/[^\w.\-çğıöşüÇĞİÖŞÜ ]+/g, "_")
    .slice(0, 80);
const IZINLI_UZANTI = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"]); // .doc/.docx yok (2. inceleme #8)
const MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
function uploadsIci(p) {
  const kok = path.resolve(db.getUploadsDir());
  const tam = path.resolve(kok, p);
  if (!tam.startsWith(kok + path.sep) && tam !== kok) throw new Error("Geçersiz dosya yolu");
  return tam;
}

function buildApp({ surum = "" } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use(express.json({ limit: "40mb" }));

  app.get("/saglik", (_req, res) => res.json({ ok: true, ad: "futbol-okulu-kayit-programi", surum }));
  // Marka (plan §32.5): istemci PC'nin giriş ekranı için oturumsuz; yalnız kulüp adı/kısa ad/kuruluş yılı/logo/iki renk
  app.get("/api/marka", (_req, res) =>
    res.json({ ok: true, marka: markaOku({ getSetting: db.getSetting, uploadsDir: db.getUploadsDir() }) }),
  );

  app.post("/api/auth/login", (req, res) => {
    const ip = req.socket.remoteAddress || "?";
    const now = Date.now();
    if (!rateAllow(loginDenemeleri, ip, now, LOGIN_MAX, LOGIN_PENCERE)) {
      res.set("Retry-After", String(Math.ceil(rateRetryAfter(loginDenemeleri, ip, now) / 1000)));
      return res.status(429).json({ error: "Çok fazla deneme, 15 dakika sonra tekrar deneyin" });
    }
    const { username, password } = req.body || {};
    const u = db.verifyPassword(String(username || ""), String(password || ""));
    if (!u) {
      rateHit(loginDenemeleri, ip, now, LOGIN_PENCERE);
      return res.status(401).json({ error: "Kullanıcı adı veya parola hatalı" });
    }
    rateReset(loginDenemeleri, ip);
    res.json({
      ok: true,
      token: signToken(u),
      user: { username: u.username, ad_soyad: u.ad_soyad, role: u.role, must_change_password: !!u.must_change_password },
    });
  });
  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ ok: true, user: req.user }));
  app.post("/api/auth/changePassword", requireAuth, (req, res) => {
    const yeni = String(req.body?.newPassword || "");
    if (yeni.length < 8) return res.status(400).json({ error: "Parola en az 8 karakter olmalı" });
    // İnceleme #14: zorunlu ilk değişim dışında mevcut parola doğrulanır
    if (!req.user.must_change_password && !db.verifyPassword(req.user.username, String(req.body?.oldPassword || "")))
      return res.status(400).json({ error: "Mevcut parola hatalı" });
    db.changePassword(req.user.username, yeni);
    // token_version arttı → yeni jeton ver ki istemci düşmesin
    const u = db.getUserByUsername(req.user.username);
    res.json({ ok: true, token: signToken(u) });
  });

  app.post("/api/auth/kurtarmaUret", requireAuth, (req, res) => {
    if (db.lisansSaltOkunurMu()) return res.status(403).json({ error: "Lisans salt okunur modda" });
    const hedef = db.listUsers().find((u) => u.id === Number(req.body?.userId));
    if (!hedef) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    if (req.user.role !== "admin" && hedef.username !== req.user.username)
      return res.status(403).json({ error: "Yalnız kendi hesabınız için kod üretebilirsiniz" });
    const r = db.kurtarmaKodlariUret(hedef.id);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, kodlar: r.kodlar });
  });
  app.post("/api/auth/kurtarmaSifirla", (req, res) => {
    const { username, kod, yeniParola } = req.body || {};
    const ad = String(username || "").trim();
    if (String(yeniParola || "").length < 8) return res.status(400).json({ error: "Parola en az 8 karakter olmalı" });
    const now = Date.now();
    const kAnahtar = `${req.socket.remoteAddress || "?"}|${ad}`; // inceleme #17: IP + kullanıcı adı (tek IP farklı adlarla sınırsız denemesin; başkası kilitleyemesin)
    if (!rateAllow(kurtarmaDenemeleri, kAnahtar, now, KURTARMA_MAX, KURTARMA_PENCERE)) {
      res.set("Retry-After", String(Math.ceil(rateRetryAfter(kurtarmaDenemeleri, kAnahtar, now) / 1000)));
      return res.status(429).json({ error: "Çok fazla deneme, 15 dakika sonra tekrar deneyin" });
    }
    const r = db.kurtarmaIleSifirla(ad, String(kod || ""), String(yeniParola));
    if (r.error) {
      rateHit(kurtarmaDenemeleri, kAnahtar, now, KURTARMA_PENCERE);
      return res.status(401).json({ error: r.error });
    }
    rateReset(kurtarmaDenemeleri, kAnahtar);
    res.json({ ok: true, kalan: r.kalan });
  });

  app.post("/api/db", requireAuth, (req, res) => {
    const { fn, args } = req.body || {};
    const y = cagriYetkisi(String(fn || ""), req.user, db.lisansSaltOkunurMu(), Array.isArray(args) ? args : []);
    if (!y.ok) return res.status(y.kod).json({ error: y.mesaj });
    if (fn === "deleteUser" && db.listUsers().find((u) => u.id === Number(args?.[0]))?.username === req.user.username)
      return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz" });
    if (fn === "cancelReceipt") {
      try {
        return res.json({ ok: true, sonuc: db.cancelReceipt(args?.[0], args?.[1], req.user.ad_soyad || req.user.username) });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    if (fn === "grupBildirimKaydet") {
      try {
        return res.json({ ok: true, sonuc: db.grupBildirimKaydet(args?.[0], req.user.ad_soyad || req.user.username) });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    if (fn === "mesajKaydet") {
      try {
        return res.json({ ok: true, sonuc: db.mesajKaydet({ ...(args?.[0] || {}), kullanici: req.user.ad_soyad || req.user.username }) });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    try {
      res.json({ ok: true, sonuc: db[fn](...(Array.isArray(args) ? args : [])) ?? null });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Dosyalar ──
  const yazmaKontrol = (res) => {
    if (db.lisansSaltOkunurMu()) {
      res.status(403).json({ error: "Lisans salt okunur modda" });
      return false;
    }
    return true;
  };
  app.post("/api/files/addDocument", requireAuth, (req, res) => {
    if (!yazmaKontrol(res)) return;
    try {
      const { ad, base64 } = req.body || {};
      const { playerId, tip, gecerlilik } = belgeGirdiDogrula(req.body || {});
      if (!db.getPlayer(playerId)) return res.status(400).json({ error: "Oyuncu bulunamadı" });
      const uz = path.extname(String(ad || "")).toLowerCase();
      if (!IZINLI_UZANTI.has(uz)) return res.status(400).json({ error: "Bu dosya türü desteklenmiyor" });
      const buf = Buffer.from(String(base64 || ""), "base64");
      if (!buf.length || buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: "Dosya boş veya 25 MB'tan büyük" });
      const klasor = "oyuncu-" + Number(playerId);
      fs.mkdirSync(uploadsIci(klasor), { recursive: true });
      const hedef = path.join(klasor, `${Date.now()}-${tip}-${guvenliAd(path.basename(ad))}`);
      fs.writeFileSync(uploadsIci(hedef), optimizeImage(buf, uz));
      const { id, silinen } = db.belgeEkle(Number(playerId), {
        tip,
        dosya_yolu: hedef,
        orijinal_ad: path.basename(ad),
        gecerlilik_tarihi: gecerlilik || null,
      });
      for (const y of silinen) {
        try {
          fs.unlinkSync(uploadsIci(y));
        } catch {
          /* dosya zaten yok */
        }
      }
      res.json({ ok: true, id, dosya_yolu: hedef });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/files/deleteDocument", requireAuth, (req, res) => {
    if (!yazmaKontrol(res)) return;
    const belge = db.getDocument(Number(req.body?.docId));
    if (belge) {
      try {
        fs.unlinkSync(uploadsIci(belge.dosya_yolu));
      } catch {}
      db.deleteDocument(belge.id);
    }
    res.json({ ok: true });
  });
  // Makbuzlu oyuncunun kişisel verilerini sil (plan §31): yalnız yönetici; ipc/files.cjs ile aynı adımlar
  app.post("/api/files/oyuncuKisiselVeriSil", requireAuth, requireAdmin, (req, res) => {
    if (!yazmaKontrol(res)) return;
    try {
      const r = db.oyuncuKisiselVeriSil(Number(req.body?.playerId), req.user.ad_soyad || req.user.username);
      for (const y of r.dosyalar) {
        try {
          fs.unlinkSync(uploadsIci(y));
        } catch {}
      }
      try {
        fs.rmSync(uploadsIci(r.klasor), { recursive: true, force: true });
      } catch {}
      res.json({ ok: true, makbuz: r.makbuz });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  // Kulüp logosu (plan §32.3): yalnız yönetici; base64 gövde, sunucu küçültüp uploads/kulup/ altına yazar
  app.post("/api/files/kulupLogoSec", requireAuth, requireAdmin, (req, res) => {
    if (!yazmaKontrol(res)) return;
    try {
      const b64 = String(req.body?.base64 || "");
      if (b64.length > 8 * 1024 * 1024) return res.status(400).json({ error: "Logo 5 MB'tan büyük" });
      res.json(kulupLogoKaydet(Buffer.from(b64, "base64"), String(req.body?.uzanti || "")));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/files/kulupLogoSil", requireAuth, requireAdmin, (_req, res) => {
    if (!yazmaKontrol(res)) return;
    res.json(kulupLogoKaldir());
  });
  app.get("/api/files/dataUrl", requireAuth, (req, res) => {
    try {
      const tam = uploadsIci(String(req.query.yol || ""));
      const mime = MIME[path.extname(tam).toLowerCase()];
      if (!mime || !fs.existsSync(tam)) return res.json({ ok: true, dataUrl: null });
      res.json({ ok: true, dataUrl: `data:${mime};base64,${fs.readFileSync(tam).toString("base64")}` });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/files/indir", requireAuth, (req, res) => {
    try {
      const tam = uploadsIci(String(req.query.yol || ""));
      if (!fs.existsSync(tam)) return res.status(404).json({ error: "Dosya yok" });
      res.sendFile(tam);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/cikti/makbuzPdf", requireAuth, (req, res) => {
    if (!yazmaKontrol(res)) return;
    try {
      const r = db.getReceipt(Number(req.body?.receiptId));
      if (!r) return res.status(404).json({ error: "Makbuz bulunamadı" });
      fs.mkdirSync(uploadsIci("makbuz"), { recursive: true });
      const yol = path.join("makbuz", `${r.makbuz_no}.pdf`);
      fs.writeFileSync(uploadsIci(yol), Buffer.from(String(req.body?.pdfBase64 || ""), "base64"));
      db.setReceiptPdf(r.id, yol);
      res.json({ ok: true, pdf_yolu: yol });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Lisans (lisans sahibi sunucu PC; istemciler okur, yönetici anahtar girebilir) ──
  app.get("/api/lisans/durum", requireAuth, (_req, res) => res.json({ ok: true, durum: db.lisansDurumu() }));
  app.post("/api/lisans/kaydet", requireAuth, requireAdmin, (req, res) => {
    const r = db.lisansKaydet(req.body?.anahtar);
    res.json(r.error ? r : { ok: true, durum: r.durum });
  });
  app.post("/api/lisans/lease", requireAuth, requireAdmin, (req, res) => {
    const r = db.leaseKaydet(req.body?.lease);
    res.json(r.error ? r : { ok: true, durum: r.durum });
  });
  app.post("/api/lisans/aktiflestir", requireAuth, requireAdmin, async (_req, res) => res.json(await db.lisansAktiflestir(surum)));
  app.post("/api/lisans/yenile", requireAuth, async (_req, res) => res.json(await db.lisansYenile()));

  app.use((_req, res) => res.status(404).json({ error: "bulunamadı" }));
  app.use((err, _req, res, _next) => {
    console.error("[server]", err.message);
    res.status(500).json({ error: "sunucu hatası" });
  });
  return app;
}

async function baslat({ port, surum = "" }) {
  if (srv) return bilgi;
  const { app: electronApp } = require("electron");
  const { key, cert, fp } = await serverTls.sertifikaUretVeyaYukle(electronApp);
  const app = buildApp({ surum });
  await new Promise((resolve, reject) => {
    srv = https.createServer({ key, cert }, app);
    srv.once("error", reject);
    // İnceleme #17: dinleme adresi ayardan (varsayılan tüm arayüzler; Tailscale 100.x ya da belirli LAN IP seçilebilir)
    const adres = String(db.getSetting("sunucu_adres") || "0.0.0.0").trim() || "0.0.0.0";
    srv.listen(port, adres, resolve);
  });
  bilgi = { port: srv.address().port, fp, adresler: yerelIpler() };
  console.log(`[server] https://0.0.0.0:${bilgi.port} fp=${fp}`);
  return bilgi;
}
function durdur() {
  return new Promise((r) => {
    if (!srv) return r();
    srv.close(() => {
      srv = null;
      bilgi = null;
      r();
    });
  });
}
const durum = () => ({ calisiyor: !!srv, ...(bilgi || {}), adresler: yerelIpler() });

module.exports = { baslat, durdur, durum, buildApp };
