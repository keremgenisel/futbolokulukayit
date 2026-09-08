// Ayarlar > Optimizasyon: uploads/ altındaki resimleri (jpg/png) tarar ve küçültür. Yeni yüklemeler
// zaten yükleme anında optimize edilir; bu araç eski dosyalara uygular. PDF/Office dosyalarına dokunmaz.
const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const db = require("../db.cjs");
const config = require("../config.cjs");
const koruma = require("./koruma.cjs");
const { optimizeImage, optimizeEdilebilirMi } = require("../imageOptimize.cjs");

function dosyalariTopla(kok) {
  const out = [];
  if (!fs.existsSync(kok)) return out;
  const gez = (d) => {
    for (const ad of fs.readdirSync(d)) {
      const t = path.join(d, ad);
      const st = fs.statSync(t);
      if (st.isDirectory()) gez(t);
      else out.push({ yol: t, boyut: st.size, ad });
    }
  };
  gez(kok);
  return out;
}

// Kategori: dosya adı "<zaman>-<tip>-<ad>" → tip; makbuz/ klasörü → makbuz.
function kategori(dosya, kok) {
  const gorece = path.relative(kok, dosya.yol);
  if (gorece.startsWith("makbuz" + path.sep)) return "makbuz";
  const m = /^\d+-([a-z_]+)-/.exec(dosya.ad);
  return m ? m[1] : "diger";
}

function analiz(kok = db.getUploadsDir()) {
  const hepsi = dosyalariTopla(kok);
  const resimler = hepsi.filter((d) => optimizeEdilebilirMi(d.ad));
  const digerler = hepsi.filter((d) => !optimizeEdilebilirMi(d.ad));
  const gruplar = {};
  for (const d of resimler) {
    const k = kategori(d, kok);
    gruplar[k] ||= { adet: 0, bayt: 0 };
    gruplar[k].adet++;
    gruplar[k].bayt += d.boyut;
  }
  return {
    ok: true,
    resim: { adet: resimler.length, bayt: resimler.reduce((s, d) => s + d.boyut, 0), gruplar },
    diger: { adet: digerler.length, bayt: digerler.reduce((s, d) => s + d.boyut, 0) },
  };
}

// Her resmi optimize eder; yalnız küçülenler yerine yazılır. Dönüş: önce/sonra bayt ve sayılar.
function uygula(kok = db.getUploadsDir()) {
  const resimler = dosyalariTopla(kok).filter((d) => optimizeEdilebilirMi(d.ad));
  let once = 0,
    sonra = 0,
    kucultulen = 0;
  for (const d of resimler) {
    const buf = fs.readFileSync(d.yol);
    once += buf.length;
    const yeni = optimizeImage(buf, path.extname(d.ad));
    if (yeni.length < buf.length) {
      const gecici = d.yol + ".opt-tmp";
      fs.writeFileSync(gecici, yeni);
      fs.renameSync(gecici, d.yol); // atomik değişim
      kucultulen++;
    }
    sonra += Math.min(yeni.length, buf.length);
  }
  return { ok: true, adet: resimler.length, kucultulen, once, sonra, tasarruf: once - sonra };
}

function registerOptimizeHandlers(getSession) {
  const kontrol = koruma.donerek(getSession, {
    yonetici: true,
    istemciMi: config.istemciMi,
    istemciMesaji: "Optimizasyon yalnızca sunucu bilgisayarında çalışır",
    saltOkunurMu: db.lisansSaltOkunurMu,
  });
  ipcMain.handle("optimize:analiz", () => kontrol() || analiz());
  ipcMain.handle("optimize:uygula", () => kontrol() || uygula());
}

module.exports = { registerOptimizeHandlers, analiz, uygula };
