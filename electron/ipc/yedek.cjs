// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ (belgeler, vesikalıklar, makbuz PDF'leri)
// TEK dosyaya yazılır: zip oluşturulur, sonra makine anahtarıyla (safeStorage'daki DB anahtarı) şifrelenir →
// eyupspor-yedek-<damga>.eyupyedek (inceleme #6: belgeler/PDF'ler bulut klasöründe düz durmaz). Anahtar yoksa
// (şifreleme kullanılamıyorsa) düz .zip yazılır. Geri yükleme .eyupyedek, eski düz .zip ya da klasörden (en eski biçim).
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında sıklık ayarına göre.
const { ipcMain, dialog, BrowserWindow, app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { zipSync, unzipSync } = require("fflate"); // saf JS zip; native bağımlılık yok
const tasima = require("../tasimaKripto.cjs");
const db = require("../db.cjs");
const config = require("../config.cjs");
const { sikliktNormalize, yedekGerekliMi, SIKLIKLAR } = require("../yedekSiklik.cjs");
const koruma = require("./koruma.cjs");

function kopyalaKlasor(kaynak, hedef) {
  if (!fs.existsSync(kaynak)) return;
  fs.mkdirSync(hedef, { recursive: true });
  for (const ad of fs.readdirSync(kaynak)) {
    const k = path.join(kaynak, ad),
      h = path.join(hedef, ad);
    if (fs.statSync(k).isDirectory()) kopyalaKlasor(k, h);
    else fs.copyFileSync(k, h);
  }
}

// Klasördeki tüm dosyaları zip girdisi olarak toplar (yol ayırıcı her zaman "/").
function zipGirdileriTopla(kok, onek, girdiler) {
  if (!fs.existsSync(kok)) return;
  for (const ad of fs.readdirSync(kok)) {
    const k = path.join(kok, ad);
    if (fs.statSync(k).isDirectory()) zipGirdileriTopla(k, onek + ad + "/", girdiler);
    else girdiler[onek + ad] = [new Uint8Array(fs.readFileSync(k)), { level: 0 }]; // resim/pdf/şifreli db zaten sıkışık
  }
}

function yedekAl(hedefKok) {
  const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const anahtar = db.getDbKey();
  const hedef = path.join(hedefKok, `eyupspor-yedek-${damga}.${anahtar ? "eyupyedek" : "zip"}`);
  fs.mkdirSync(hedefKok, { recursive: true });
  db.checkpoint();
  const girdiler = { "data.db": [new Uint8Array(fs.readFileSync(db.getDbPath())), { level: 0 }] };
  zipGirdileriTopla(db.getUploadsDir(), "uploads/", girdiler);
  const zip = Buffer.from(zipSync(girdiler));
  const gecici = hedef + ".tmp";
  fs.writeFileSync(gecici, anahtar ? tasima.sifrele(zip, anahtar, { magic: tasima.YEDEK_MAGIC }) : zip);
  fs.renameSync(gecici, hedef);
  db.setSetting("son_yedek", new Date().toISOString());
  return { ok: true, yol: hedef, dosya: Object.keys(girdiler).length - 1, sifreli: !!anahtar };
}

// Zip yedeğini geçici klasöre güvenle açar (yol geçişi/mutlak yol reddedilir). Dönüş: klasör yolu.
const YEDEK_MAX_BAYT = 2 * 1024 * 1024 * 1024; // inceleme #16: zip tümüyle belleğe açılır; 2 GB üstü reddedilir
function zipAc(zipYol) {
  if (fs.statSync(zipYol).size > YEDEK_MAX_BAYT) throw new Error("Yedek dosyası 2 GB'tan büyük");
  let veri = fs.readFileSync(zipYol);
  if (tasima.paketMi(veri, tasima.YEDEK_MAGIC)) {
    // şifreli yedek: yalnız bu makinenin anahtarıyla açılır
    const anahtar = db.getDbKey();
    try {
      if (!anahtar) throw new Error("anahtar yok");
      veri = tasima.coz(veri, anahtar, { magic: tasima.YEDEK_MAGIC });
    } catch {
      throw new Error(
        "Bu yedek başka bir bilgisayarın anahtarıyla şifrelenmiş; burada açılamaz. Bilgisayar değiştiyse taşıma paketi kullanın",
      );
    }
  }
  return zipAcBuffer(new Uint8Array(veri));
}
// Kaba kapanıştan kalan geçici klasörler (düz data.db içerebilir) — açılışta silinir (inceleme #8).
function geciciArtiklariTemizle() {
  try {
    const kok = os.tmpdir();
    for (const ad of fs.readdirSync(kok))
      if (/^eyupspor-(tasima|geri)-/.test(ad)) {
        try {
          fs.rmSync(path.join(kok, ad), { recursive: true, force: true });
        } catch {
          /* başka süreç */
        }
      }
  } catch {
    /* tmp okunamadı */
  }
}
function zipAcBuffer(veri) {
  const arsiv = unzipSync(veri);
  if (!arsiv["data.db"]) throw new Error("Zip içinde data.db yok; bu bir Eyüpspor yedeği değil");
  const hedef = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-geri-"));
  const kok = path.resolve(hedef);
  for (const [ad, veri] of Object.entries(arsiv)) {
    if (ad.endsWith("/")) continue; // klasör girdisi
    if (path.isAbsolute(ad) || ad.split("/").includes("..") || ad.includes("\\"))
      throw new Error("Yedek içinde geçersiz dosya yolu: " + ad);
    const tam = path.resolve(kok, ad);
    if (!tam.startsWith(kok + path.sep)) throw new Error("Yedek içinde geçersiz dosya yolu: " + ad);
    fs.mkdirSync(path.dirname(tam), { recursive: true });
    fs.writeFileSync(tam, Buffer.from(veri));
  }
  return hedef;
}

// Yedek zip mi klasör mü? Klasöre çevirip özet döner; zip için geçici klasör de döner (çağıran siler).
function yedekHazirla(yol) {
  try {
    if (fs.existsSync(yol) && fs.statSync(yol).isFile()) {
      if (!/\.(zip|eyupyedek)$/i.test(yol)) return { error: "Yedek dosyası .eyupyedek ya da .zip olmalı" };
      const klasor = zipAc(yol);
      const bilgi = db.yedekBilgisi(path.join(klasor, "data.db"));
      if (bilgi.error) {
        fs.rmSync(klasor, { recursive: true, force: true });
        return bilgi;
      }
      return { ok: true, klasor, gecici: true, ...bilgi };
    }
    const bilgi = db.yedekBilgisi(path.join(yol, "data.db"));
    return bilgi.error ? bilgi : { ok: true, klasor: yol, gecici: false, ...bilgi };
  } catch (e) {
    return { error: "Yedek açılamadı: " + e.message };
  }
}

// Otomatik yedek (açılışta çağrılır): sıklık ayarına göre (her açılış / günlük / haftalık / kapalı). Hata uygulamayı durdurmaz.
function otomatikYedek() {
  try {
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor || !fs.existsSync(klasor)) return;
    if (!yedekGerekliMi(db.getSetting("yedek_sikligi"), db.getSetting("son_yedek") || null, new Date())) return;
    yedekAl(klasor);
    // 30'dan eski yedekleri sil (zip ve eski biçim klasörler birlikte)
    const eski = fs
      .readdirSync(klasor)
      .filter((a) => a.startsWith("eyupspor-yedek-") && !a.endsWith(".tmp"))
      .sort();
    for (const a of eski.slice(0, Math.max(0, eski.length - 30))) fs.rmSync(path.join(klasor, a), { recursive: true, force: true });
  } catch (e) {
    console.error("[yedek] otomatik yedek başarısız:", e.message);
  }
}

// ── Geri yükleme çekirdeği (relaunch yapmaz; test edilebilir) ──
// Mevcut data.db ve uploads/ önce "<ad>.pre-restore-<damga>" olarak kenara alınır, sonra yedek
// kopyalanır. Herhangi bir adım patlarsa kenara alınanlar geri konur. Çağıran DB'yi kapatmış olmalı.
// yedekYolu: .zip dosyası (yeni) ya da içinde data.db olan klasör (eski biçim).
function geriYukleCekirdek(yedekYolu) {
  const hazir = yedekHazirla(String(yedekYolu || ""));
  if (hazir.error) return hazir;
  const kaynakDb = path.join(hazir.klasor, "data.db");
  const kaynakUp = path.join(hazir.klasor, "uploads");
  const bilgi = { ok: true, oyuncu: hazir.oyuncu, makbuz: hazir.makbuz, sonMakbuz: hazir.sonMakbuz, schema: hazir.schema };
  const temizle = () => {
    if (hazir.gecici) {
      try {
        fs.rmSync(hazir.klasor, { recursive: true, force: true });
      } catch {}
    }
  };
  const hedefDb = db.getDbPath();
  const hedefUp = db.getUploadsDir();
  // Kenara alma adı benzersiz olmalı: aynı saniyede ikinci geri yükleme (ya da hızlı tekrar) mevcut klasörün üstüne
  // rename edemez (ENOTEMPTY) ve geri yükleme düşerdi. Damga + gerekirse -2, -3 …
  const temel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  let damga = temel;
  for (let i = 2; fs.existsSync(hedefDb + ".pre-restore-" + damga) || fs.existsSync(hedefUp + ".pre-restore-" + damga); i++)
    damga = `${temel}-${i}`;
  const kenarDb = hedefDb + ".pre-restore-" + damga;
  const kenarUp = hedefUp + ".pre-restore-" + damga;
  db.close();
  try {
    for (const ek of ["", "-wal", "-shm"]) {
      try {
        fs.rmSync(hedefDb + ek + ".tmp", { force: true });
      } catch {}
    }
    if (fs.existsSync(hedefDb)) fs.renameSync(hedefDb, kenarDb);
    for (const ek of ["-wal", "-shm"]) {
      try {
        fs.rmSync(hedefDb + ek, { force: true });
      } catch {}
    }
    if (fs.existsSync(hedefUp)) fs.renameSync(hedefUp, kenarUp);
    fs.copyFileSync(kaynakDb, hedefDb);
    kopyalaKlasor(kaynakUp, hedefUp);
    temizle();
    // Kenara alınan kopyalar birikmesin: en yeni 3 kalır (bilgi notu)
    try {
      const kok = path.dirname(hedefDb);
      const eski = fs
        .readdirSync(kok)
        .filter((a) => a.startsWith("data.db.pre-restore-"))
        .sort();
      for (const a of eski.slice(0, Math.max(0, eski.length - 3))) {
        fs.rmSync(path.join(kok, a), { recursive: true, force: true });
        fs.rmSync(path.join(kok, a.replace(/^data\.db/, "uploads")), { recursive: true, force: true });
      }
    } catch {
      /* temizlik başarısız olabilir */
    }
    return { ok: true, kenarDb, kenarUp, bilgi };
  } catch (e) {
    // Geri al
    try {
      fs.rmSync(hedefDb, { force: true });
      if (fs.existsSync(kenarDb)) fs.renameSync(kenarDb, hedefDb);
    } catch {}
    try {
      fs.rmSync(hedefUp, { recursive: true, force: true });
      if (fs.existsSync(kenarUp)) fs.renameSync(kenarUp, hedefUp);
    } catch {}
    temizle();
    return { error: "Geri yükleme başarısız, eski veriler korundu: " + e.message };
  }
}

// ── Taşıma paketi (plan §14): başka bilgisayarda açılabilen, PAROLA korumalı yedek ──
// İçerik: data.db (ŞİFRESİZ kopya) + uploads/ + paket.json; tamamı tasimaKripto ile şifrelenir. Uzantı .eyupspor.
function tasimaPaketiOlustur(hedefYol, parola) {
  if (!tasima.parolaGecerliMi(parola)) return { error: `Parola en az ${tasima.PAROLA_MIN} karakter olmalı` };
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-tasima-"));
  try {
    const duzDb = path.join(gecici, "data.db");
    db.duzKopyaOlustur(duzDb);
    const girdiler = {
      "data.db": [new Uint8Array(fs.readFileSync(duzDb)), { level: 0 }],
      "paket.json": [
        new TextEncoder().encode(
          JSON.stringify({ tur: "eyupspor-tasima", surum: 1, olusturma: new Date().toISOString(), sifreliKaynak: db.isEncrypted() }),
        ),
        { level: 6 },
      ],
    };
    zipGirdileriTopla(db.getUploadsDir(), "uploads/", girdiler);
    const zip = Buffer.from(zipSync(girdiler));
    const paket = tasima.sifrele(zip, parola);
    fs.writeFileSync(hedefYol + ".tmp", paket);
    fs.renameSync(hedefYol + ".tmp", hedefYol);
    return { ok: true, yol: hedefYol, boyut: paket.length };
  } catch (e) {
    return { error: "Taşıma paketi oluşturulamadı: " + e.message };
  } finally {
    try {
      fs.rmSync(gecici, { recursive: true, force: true });
    } catch {}
  } // düz kopya diskte kalmaz
}
// Yalnız özet (inceleme #8): paket bellekte açılır, düz data.db DİSKE YAZILMAZ.
function tasimaPaketiOzet(paketYol, parola) {
  let zip;
  try {
    if (fs.statSync(paketYol).size > YEDEK_MAX_BAYT) throw new Error("Paket 2 GB'tan büyük");
    zip = tasima.coz(fs.readFileSync(paketYol), parola);
  } catch (e) {
    return { error: e.message };
  }
  let arsiv;
  try {
    arsiv = unzipSync(new Uint8Array(zip));
  } catch (e) {
    return { error: "Paket açılamadı: " + e.message };
  }
  if (!arsiv["data.db"]) return { error: "Paket içinde data.db yok" };
  return db.yedekBilgisiBuffer(arsiv["data.db"]);
}
// Paketi parolayla açar: geçici klasör (data.db düz, uploads/) + özet. Çağıran klasörü siler.
function tasimaPaketiAc(paketYol, parola) {
  let zip;
  try {
    if (fs.statSync(paketYol).size > YEDEK_MAX_BAYT) throw new Error("Paket 2 GB'tan büyük");
    zip = tasima.coz(fs.readFileSync(paketYol), parola);
  } catch (e) {
    return { error: e.message };
  }
  let klasor;
  try {
    klasor = zipAcBuffer(new Uint8Array(zip));
  } catch (e) {
    return { error: "Paket açılamadı: " + e.message };
  }
  const bilgi = db.yedekBilgisi(path.join(klasor, "data.db"), { duz: true });
  if (bilgi.error) {
    try {
      fs.rmSync(klasor, { recursive: true, force: true });
    } catch {}
    return bilgi;
  }
  return { ok: true, klasor, ...bilgi };
}
// Paketten geri yükle: aç → düz data.db'yi BU makinenin anahtarıyla şifrele → mevcut çekirdekle yerine koy.
function tasimaGeriYukleCekirdek(paketYol, parola) {
  const h = tasimaPaketiAc(paketYol, parola);
  if (h.error) return h;
  try {
    db.duzVeritabaniniSifrele(path.join(h.klasor, "data.db"));
  } catch (e) {
    try {
      fs.rmSync(h.klasor, { recursive: true, force: true });
    } catch {}
    return { error: "Veritabanı bu bilgisayar için şifrelenemedi: " + e.message };
  }
  const r = geriYukleCekirdek(h.klasor); // klasör biçimi; çekirdek geçici klasörü silmez (gecici bayrağı yok), burada silinir
  try {
    fs.rmSync(h.klasor, { recursive: true, force: true });
  } catch {}
  return r;
}

function registerYedekHandlers(getSession) {
  // İnceleme #16: geri yükleme yolu diyalogdan gelir; renderer'ın verdiği yol YALNIZ diyalogda seçilenle aynıysa kabul edilir.
  let bekleyenYedek = null,
    bekleyenPaket = null;
  const ISTEMCI_MESAJI = "Yedek yalnızca sunucu bilgisayarında alınır";
  const istemciHata = () => ({ error: ISTEMCI_MESAJI });
  const yonetici = koruma.firlatarak(getSession, { yonetici: true });
  const yoneticiHata = koruma.donerek(getSession, { yonetici: true, istemciMi: config.istemciMi, istemciMesaji: ISTEMCI_MESAJI });
  ipcMain.handle("yedek:klasorSec", async (e) => {
    yonetici();
    if (config.istemciMi()) return istemciHata();
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    db.setSetting("yedek_klasoru", r.filePaths[0]);
    return { ok: true, klasor: r.filePaths[0] };
  });
  ipcMain.handle("yedek:al", async () => {
    yonetici();
    if (config.istemciMi()) return istemciHata();
    const klasor = db.getSetting("yedek_klasoru");
    if (!klasor) return { error: "Önce yedek klasörü seçin" };
    return yedekAl(klasor);
  });
  // Geri yükleme: klasör seç → doğrula (özet göster) → onay → geri yükle → uygulamayı yeniden başlat.
  ipcMain.handle("yedek:geriYukleSec", async (e) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: "Yedek dosyasını seçin (eyupspor-yedek-….eyupyedek)",
      properties: ["openFile"],
      filters: [{ name: "Eyüpspor yedeği", extensions: ["eyupyedek", "zip"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    const yol = r.filePaths[0];
    const h = yedekHazirla(yol);
    if (h.error) return h;
    bekleyenYedek = yol;
    if (h.gecici) {
      try {
        fs.rmSync(h.klasor, { recursive: true, force: true });
      } catch {}
    } // özet için açıldı; asıl geri yükleme yeniden açar
    return { ok: true, klasor: yol, oyuncu: h.oyuncu, makbuz: h.makbuz, sonMakbuz: h.sonMakbuz };
  });
  ipcMain.handle("yedek:geriYukle", async (_e, klasor) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    if (!bekleyenYedek || String(klasor || "") !== bekleyenYedek) return { error: "Önce yedek dosyasını seçin" };
    const r = geriYukleCekirdek(bekleyenYedek);
    bekleyenYedek = null;
    if (r.error) {
      try {
        db.init();
      } catch {}
      return r;
    }
    // Yeni veriyle temiz açılış için uygulamayı yeniden başlat.
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 400);
    return { ok: true };
  });
  // Taşıma paketi: oluştur (parola) / paketi seç / özetini göster / geri yükle
  ipcMain.handle("yedek:tasimaOlustur", async (e, parola) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    if (!tasima.parolaGecerliMi(parola)) return { error: `Parola en az ${tasima.PAROLA_MIN} karakter olmalı` };
    const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
      title: "Taşıma paketini kaydet",
      defaultPath: `eyupspor-tasima-${damga}.eyupspor`,
      filters: [{ name: "Eyüpspor taşıma paketi", extensions: ["eyupspor"] }],
    });
    if (r.canceled || !r.filePath) return { iptal: true };
    return tasimaPaketiOlustur(r.filePath, String(parola));
  });
  ipcMain.handle("yedek:tasimaSec", async (e) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: "Taşıma paketini seçin (eyupspor-tasima-….eyupspor)",
      properties: ["openFile"],
      filters: [{ name: "Eyüpspor taşıma paketi", extensions: ["eyupspor"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    bekleyenPaket = r.filePaths[0];
    return { ok: true, yol: bekleyenPaket };
  });
  ipcMain.handle("yedek:tasimaBilgi", async (_e, yol, parola) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    if (!bekleyenPaket || String(yol || "") !== bekleyenPaket) return { error: "Önce paket dosyasını seçin" };
    const h = tasimaPaketiOzet(bekleyenPaket, String(parola || "")); // bellek içi; düz kopya diske yazılmaz
    if (h.error) return h;
    return { ok: true, yol: bekleyenPaket, oyuncu: h.oyuncu, makbuz: h.makbuz, sonMakbuz: h.sonMakbuz, schema: h.schema };
  });
  ipcMain.handle("yedek:tasimaGeriYukle", async (_e, yol, parola) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    if (!bekleyenPaket || String(yol || "") !== bekleyenPaket) return { error: "Önce paket dosyasını seçin" };
    const r = tasimaGeriYukleCekirdek(bekleyenPaket, String(parola || ""));
    bekleyenPaket = null;
    if (r.error) {
      try {
        db.init();
      } catch {}
      return r;
    }
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 400);
    return { ok: true };
  });
  ipcMain.handle("yedek:durum", () =>
    config.istemciMi()
      ? { klasor: null, son: null, istemci: true }
      : {
          klasor: db.getSetting("yedek_klasoru"),
          son: db.getSetting("son_yedek"),
          siklik: sikliktNormalize(db.getSetting("yedek_sikligi")),
          sikliklar: SIKLIKLAR,
        },
  );
  ipcMain.handle("yedek:siklik", (_e, siklik) => {
    yonetici();
    if (config.istemciMi()) return istemciHata();
    if (!SIKLIKLAR.some((x) => x.kod === siklik)) return { error: "Geçersiz sıklık" };
    db.setSetting("yedek_sikligi", siklik);
    return { ok: true, siklik };
  });
}

module.exports = {
  registerYedekHandlers,
  otomatikYedek,
  yedekAl,
  geriYukleCekirdek,
  yedekHazirla,
  tasimaPaketiOlustur,
  tasimaPaketiAc,
  tasimaPaketiOzet,
  tasimaGeriYukleCekirdek,
  geciciArtiklariTemizle,
};
