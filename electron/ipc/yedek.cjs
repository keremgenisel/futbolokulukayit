// Yedekleme: data.db (WAL checkpoint sonrası) + uploads/ (belgeler, vesikalıklar, makbuz PDF'leri)
// TEK dosyaya yazılır: zip oluşturulur, sonra makine anahtarıyla (safeStorage'daki DB anahtarı) şifrelenir →
// futbolokulu-yedek-<damga>.fokyedek (inceleme #6: belgeler/PDF'ler bulut klasöründe düz durmaz). Anahtar yoksa
// (şifreleme kullanılamıyorsa) düz .zip yazılır. Geri yükleme .fokyedek, eski düz .zip ya da klasörden (en eski biçim).
// Otomatik yedek: ayarlar.yedek_klasoru doluysa uygulama açılışında sıklık ayarına göre.
// (refactor 2. tur §8.7, 11.09.2026: gövde ipc/yedekCekirdek.cjs + ipc/tasima.cjs'te; burada IPC işleyicileri ve DIŞ API —
// `require("./ipc/yedek.cjs")` eski isimleri aynen verir: main.cjs, testler ve kalıcılık betiği değişmedi.)
const { ipcMain, dialog, BrowserWindow, app } = require("electron");
const fs = require("fs");
const tasima = require("../tasimaKripto.cjs");
const config = require("../config.cjs");
const { sikliktNormalize, SIKLIKLAR } = require("../yedekSiklik.cjs");
const koruma = require("./koruma.cjs");
const db = require("../db.cjs");
const cekirdek = require("./yedekCekirdek.cjs");
const tasimaPaketi = require("./tasima.cjs");
const { yedekAl, geriYukleCekirdek, yedekHazirla, otomatikYedek, geciciArtiklariTemizle } = cekirdek;
const { tasimaPaketiOlustur, tasimaPaketiAc, tasimaPaketiOzet, tasimaGeriYukleCekirdek } = tasimaPaketi;

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
      title: "Yedek dosyasını seçin (futbolokulu-yedek-….fokyedek)",
      properties: ["openFile"],
      filters: [{ name: "Yedek dosyası", extensions: ["fokyedek", "zip"] }],
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
      defaultPath: `futbolokulu-tasima-${damga}.fokpaket`,
      filters: [{ name: "Taşıma paketi", extensions: ["fokpaket"] }],
    });
    if (r.canceled || !r.filePath) return { iptal: true };
    return tasimaPaketiOlustur(r.filePath, String(parola));
  });
  ipcMain.handle("yedek:tasimaSec", async (e) => {
    const hata = yoneticiHata();
    if (hata) return hata;
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: "Taşıma paketini seçin (futbolokulu-tasima-….fokpaket)",
      properties: ["openFile"],
      filters: [{ name: "Taşıma paketi", extensions: ["fokpaket"] }],
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
