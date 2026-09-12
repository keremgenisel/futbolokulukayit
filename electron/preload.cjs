// Renderer ile ana süreç arasındaki TEK köprü. contextIsolation açık, nodeIntegration kapalı.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("okul", {
  auth: {
    login: (username, password) => ipcRenderer.invoke("auth:login", username, password),
    logout: () => ipcRenderer.invoke("auth:logout"),
    changePassword: (username, newPassword, oldPassword) => ipcRenderer.invoke("auth:changePassword", username, newPassword, oldPassword),
    session: () => ipcRenderer.invoke("auth:session"),
    kurtarmaUret: (userId) => ipcRenderer.invoke("auth:kurtarmaUret", userId),
    kurtarmaSifirla: (username, kod, yeniParola) => ipcRenderer.invoke("auth:kurtarmaSifirla", username, kod, yeniParola),
  },
  // Tek genel kanal: ipc/data.cjs beyaz listeye göre yönlendirir, salt okunurda yazmayı reddeder.
  db: (fn, ...args) => ipcRenderer.invoke("db:call", fn, args),
  files: {
    addDocument: (playerId, tip, gecerlilik) => ipcRenderer.invoke("files:addDocument", playerId, tip, gecerlilik),
    deleteDocument: (docId) => ipcRenderer.invoke("files:deleteDocument", docId),
    oyuncuKisiselVeriSil: (playerId) => ipcRenderer.invoke("files:oyuncuKisiselVeriSil", playerId),
    kulupLogoSec: () => ipcRenderer.invoke("files:kulupLogoSec"),
    kulupLogoSil: () => ipcRenderer.invoke("files:kulupLogoSil"),
    open: (yol) => ipcRenderer.invoke("files:open", yol),
    dataUrl: (yol) => ipcRenderer.invoke("files:dataUrl", yol),
  },
  cikti: {
    yazdir: (html) => ipcRenderer.invoke("cikti:yazdir", html),
    makbuzPdf: (receiptId, html) => ipcRenderer.invoke("cikti:makbuzPdf", receiptId, html),
    pdfKaydet: (html, oneriAd, yatay) => ipcRenderer.invoke("cikti:pdfKaydet", html, oneriAd, yatay),
    pdfAc: (html, ad, yatay) => ipcRenderer.invoke("cikti:pdfAc", html, ad, yatay),
    excelKaydet: (veri, oneriAd) => ipcRenderer.invoke("cikti:excelKaydet", veri, oneriAd),
  },
  yedek: {
    klasorSec: () => ipcRenderer.invoke("yedek:klasorSec"),
    al: () => ipcRenderer.invoke("yedek:al"),
    durum: () => ipcRenderer.invoke("yedek:durum"),
    siklik: (siklik) => ipcRenderer.invoke("yedek:siklik", siklik),
    geriYukleSec: () => ipcRenderer.invoke("yedek:geriYukleSec"),
    geriYukle: (klasor) => ipcRenderer.invoke("yedek:geriYukle", klasor),
    tasimaOlustur: (parola) => ipcRenderer.invoke("yedek:tasimaOlustur", parola),
    tasimaSec: () => ipcRenderer.invoke("yedek:tasimaSec"),
    tasimaBilgi: (yol, parola) => ipcRenderer.invoke("yedek:tasimaBilgi", yol, parola),
    tasimaGeriYukle: (yol, parola) => ipcRenderer.invoke("yedek:tasimaGeriYukle", yol, parola),
  },
  aktar: {
    sablon: () => ipcRenderer.invoke("aktar:sablon"),
    onizle: () => ipcRenderer.invoke("aktar:onizle"),
    uygula: (kayitlar) => ipcRenderer.invoke("aktar:uygula", kayitlar),
  },
  optimize: {
    analiz: () => ipcRenderer.invoke("optimize:analiz"),
    uygula: () => ipcRenderer.invoke("optimize:uygula"),
  },
  lisans: {
    durum: () => ipcRenderer.invoke("lisans:durum"),
    kaydet: (anahtar) => ipcRenderer.invoke("lisans:kaydet", anahtar),
    leaseYapistir: (lease) => ipcRenderer.invoke("lisans:leaseYapistir", lease),
    aktiflestir: () => ipcRenderer.invoke("lisans:aktiflestir"),
    yenile: () => ipcRenderer.invoke("lisans:yenile"),
    baglantiSina: () => ipcRenderer.invoke("lisans:baglantiSina"),
  },
  mod: {
    oku: () => ipcRenderer.invoke("mod:oku"),
    sunucuBaslat: (port) => ipcRenderer.invoke("sunucu:baslat", port),
    sunucuDurdur: () => ipcRenderer.invoke("sunucu:durdur"),
    istemciBaglan: (url, secenek) => ipcRenderer.invoke("istemci:baglan", url, secenek),
    istemciKopar: () => ipcRenderer.invoke("istemci:kopar"),
  },
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.invoke("updater:install"),
    durum: () => ipcRenderer.invoke("updater:durum"), // şerit bağlanınca kaçırdığı olayı okur (12.09.2026)
    // Olaylar: geri çağrı döndürür; bileşen unmount'ta çağırıp dinlemeyi bırakır
    on: (olay, cb) => {
      const kanal = "updater:" + olay;
      const h = (_e, v) => cb(v);
      ipcRenderer.on(kanal, h);
      return () => ipcRenderer.removeListener(kanal, h);
    },
  },
  app: {
    version: () => ipcRenderer.invoke("app:version"),
    logo: () => ipcRenderer.invoke("app:logo"),
    marka: () => ipcRenderer.invoke("app:marka"),
    whatsappAc: (numara, metin) => ipcRenderer.invoke("app:whatsappAc", numara, metin),
  },
});
