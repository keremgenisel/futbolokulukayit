// Renderer ile ana süreç arasındaki TEK köprü. contextIsolation açık, nodeIntegration kapalı.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("okul", {
  auth: {
    login: (username, password) => ipcRenderer.invoke("auth:login", username, password),
    logout: () => ipcRenderer.invoke("auth:logout"),
    changePassword: (username, newPassword) => ipcRenderer.invoke("auth:changePassword", username, newPassword),
    session: () => ipcRenderer.invoke("auth:session"),
  },
  // Tek genel kanal: ipc/data.cjs beyaz listeye göre yönlendirir, salt okunurda yazmayı reddeder.
  db: (fn, ...args) => ipcRenderer.invoke("db:call", fn, args),
  files: {
    addDocument: (playerId, tip, gecerlilik) => ipcRenderer.invoke("files:addDocument", playerId, tip, gecerlilik),
    deleteDocument: (docId) => ipcRenderer.invoke("files:deleteDocument", docId),
    open: (yol) => ipcRenderer.invoke("files:open", yol),
    dataUrl: (yol) => ipcRenderer.invoke("files:dataUrl", yol),
  },
  cikti: {
    yazdir: (html) => ipcRenderer.invoke("cikti:yazdir", html),
    makbuzPdf: (receiptId, html) => ipcRenderer.invoke("cikti:makbuzPdf", receiptId, html),
    pdfKaydet: (html, oneriAd, yatay) => ipcRenderer.invoke("cikti:pdfKaydet", html, oneriAd, yatay),
    excelKaydet: (veri, oneriAd) => ipcRenderer.invoke("cikti:excelKaydet", veri, oneriAd),
  },
  yedek: {
    klasorSec: () => ipcRenderer.invoke("yedek:klasorSec"),
    al: () => ipcRenderer.invoke("yedek:al"),
    durum: () => ipcRenderer.invoke("yedek:durum"),
  },
  lisans: {
    durum: () => ipcRenderer.invoke("lisans:durum"),
    kaydet: (anahtar) => ipcRenderer.invoke("lisans:kaydet", anahtar),
    leaseYapistir: (lease) => ipcRenderer.invoke("lisans:leaseYapistir", lease),
    aktiflestir: () => ipcRenderer.invoke("lisans:aktiflestir"),
    yenile: () => ipcRenderer.invoke("lisans:yenile"),
  },
  mod: {
    oku: () => ipcRenderer.invoke("mod:oku"),
    sunucuBaslat: (port) => ipcRenderer.invoke("sunucu:baslat", port),
    sunucuDurdur: () => ipcRenderer.invoke("sunucu:durdur"),
    istemciBaglan: (url, secenek) => ipcRenderer.invoke("istemci:baglan", url, secenek),
    istemciKopar: () => ipcRenderer.invoke("istemci:kopar"),
  },
  app: {
    version: () => ipcRenderer.invoke("app:version"),
    logo: () => ipcRenderer.invoke("app:logo"),
  },
});
