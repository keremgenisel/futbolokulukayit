// Renderer ile ana süreç arasındaki TEK köprü. contextIsolation açık, nodeIntegration kapalı.
const { contextBridge, ipcRenderer } = require("electron");

// Tek genel kanal: renderer "db:<fonksiyon>" çağırır, ipc/data.cjs beyaz listeye göre yönlendirir.
contextBridge.exposeInMainWorld("okul", {
  auth: {
    login: (username, password) => ipcRenderer.invoke("auth:login", username, password),
    logout: () => ipcRenderer.invoke("auth:logout"),
    changePassword: (username, newPassword) => ipcRenderer.invoke("auth:changePassword", username, newPassword),
    session: () => ipcRenderer.invoke("auth:session"),
  },
  db: (fn, ...args) => ipcRenderer.invoke("db:call", fn, args),
  app: {
    version: () => ipcRenderer.invoke("app:version"),
    printHtml: (html, defaultName) => ipcRenderer.invoke("app:printHtml", html, defaultName),
  },
});
