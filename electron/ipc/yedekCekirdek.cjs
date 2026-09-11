// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ (belgeler, vesikalıklar, makbuz PDF'leri)
// TEK dosyaya yazılır: zip oluşturulur, sonra makine anahtarıyla (safeStorage'daki DB anahtarı) şifrelenir →
// futbolokulu-yedek-<damga>.fokyedek (inceleme #6: belgeler/PDF'ler bulut klasöründe düz durmaz). Anahtar yoksa
// (şifreleme kullanılamıyorsa) düz .zip yazılır. Geri yükleme .fokyedek, eski düz .zip ya da klasörden (en eski biçim).
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında sıklık ayarına göre.
// (refactor 2. tur §8.7, 11.09.2026: yedek.cjs üçe bölündü — bu dosya ÇEKİRDEK: zip/kopyalama/yedek alma/geri yükleme/otomatik
// yedek; ipc/tasima.cjs taşıma paketi; ipc/yedek.cjs IPC işleyicileri + dış API (eski isimlerle yeniden dışa verir).)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { zipSync, unzipSync } = require("fflate"); // saf JS zip; native bağımlılık yok
const tasima = require("../tasimaKripto.cjs");
const db = require("../db.cjs");
const { yedekGerekliMi } = require("../yedekSiklik.cjs");

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
  const hedef = path.join(hedefKok, `futbolokulu-yedek-${damga}.${anahtar ? "fokyedek" : "zip"}`);
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
      if (/^futbolokulu-(tasima|geri)-/.test(ad)) {
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
// Geri yüklemede kenara alınan `.pre-restore-*` kopyaları (güvenlik 2. inceleme #5): en yeni 3 kalır (geriYukleCekirdek), ayrıca
// 30 günden eskiler açılışta silinir — KVKK silmesi yapılmış eski veriler süresiz kalmasın. Dönüş: silinen kopya sayısı.
const KENAR_SAKLAMA_MS = 30 * 24 * 60 * 60 * 1000;
function kenarKopyalariniTemizle(userDataDir, now = Date.now()) {
  let silinen = 0;
  try {
    for (const ad of fs.readdirSync(userDataDir)) {
      if (!/^(data\.db|uploads)\.pre-restore-/.test(ad)) continue;
      const yol = path.join(userDataDir, ad);
      try {
        if (now - fs.statSync(yol).mtimeMs > KENAR_SAKLAMA_MS) {
          fs.rmSync(yol, { recursive: true, force: true });
          silinen++;
        }
      } catch {
        /* kilitli */
      }
    }
  } catch {
    /* klasör yok */
  }
  return silinen;
}
function zipAcBuffer(veri) {
  const arsiv = unzipSync(veri);
  if (!arsiv["data.db"]) throw new Error("Zip içinde data.db yok; bu bir Futbol Okulu Kayıt Programı yedeği değil");
  const hedef = fs.mkdtempSync(path.join(os.tmpdir(), "futbolokulu-geri-"));
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
      if (!/\.(zip|fokyedek)$/i.test(yol)) return { error: "Yedek dosyası .fokyedek ya da .zip olmalı" };
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
      .filter((a) => a.startsWith("futbolokulu-yedek-") && !a.endsWith(".tmp"))
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

module.exports = {
  kopyalaKlasor,
  zipGirdileriTopla,
  yedekAl,
  zipAc,
  zipAcBuffer,
  geciciArtiklariTemizle,
  yedekHazirla,
  otomatikYedek,
  geriYukleCekirdek,
  kenarKopyalariniTemizle,
  KENAR_SAKLAMA_MS,
  YEDEK_MAX_BAYT,
};
