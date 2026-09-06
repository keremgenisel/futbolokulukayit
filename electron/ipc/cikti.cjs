// Yazdırma, PDF ve Excel çıktıları. Renderer HTML'i hazırlar (makbuz/rapor şablonu), burada
// gizli pencerede render edilip yazıcıya veya PDF'e gönderilir. Excel exceljs ile üretilir.
const { ipcMain, BrowserWindow, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const db = require("../db.cjs");
const config = require("../config.cjs");
const istemci = require("../istemci.cjs");
const { uploadsIci } = require("./files.cjs");

async function htmlPencere(html) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return w;
}

async function htmlToPdf(html, opts = {}) {
  const w = await htmlPencere(html);
  try {
    return await w.webContents.printToPDF({ pageSize: "A4", printBackground: true, margins: { marginType: "none" }, landscape: !!opts.yatay });
  } finally { w.close(); }
}

function registerCiktiHandlers(getSession) {
  const yetki = () => { if (!getSession()) throw new Error("Oturum gerekli"); };

  ipcMain.handle("cikti:yazdir", async (_e, html) => {
    yetki();
    const w = await htmlPencere(html);
    return new Promise((resolve) => {
      w.webContents.print({ silent: false, printBackground: true }, (ok, hata) => { w.close(); resolve({ ok, hata }); });
    });
  });

  // Makbuz PDF'ini uploads/makbuz/<no>.pdf olarak sakla ve kayda bağla.
  ipcMain.handle("cikti:makbuzPdf", async (_e, receiptId, html) => {
    yetki();
    if (config.istemciMi()) {
      const pdf = await htmlToPdf(html);
      return istemci.istek("/api/cikti/makbuzPdf", { method: "POST", timeoutMs: 120000, body: { receiptId: Number(receiptId), pdfBase64: pdf.toString("base64") } });
    }
    const r = db.getReceipt(Number(receiptId));
    if (!r) throw new Error("Makbuz bulunamadı");
    const pdf = await htmlToPdf(html);
    fs.mkdirSync(uploadsIci("makbuz"), { recursive: true });
    const yol = path.join("makbuz", `${r.makbuz_no}.pdf`);
    fs.writeFileSync(uploadsIci(yol), pdf);
    db.setReceiptPdf(r.id, yol);
    return { ok: true, pdf_yolu: yol };
  });

  // Rapor PDF: kullanıcı konum seçer.
  ipcMain.handle("cikti:pdfKaydet", async (e, html, oneriAd, yatay) => {
    yetki();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showSaveDialog(win, { defaultPath: oneriAd || "rapor.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (r.canceled || !r.filePath) return { iptal: true };
    fs.writeFileSync(r.filePath, await htmlToPdf(html, { yatay }));
    shell.openPath(r.filePath).catch(() => {});
    return { ok: true, yol: r.filePath };
  });

  // Excel: { sayfa, sutunlar: [{baslik, anahtar, genislik?}], satirlar: [obj] }
  ipcMain.handle("cikti:excelKaydet", async (e, veri, oneriAd) => {
    yetki();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showSaveDialog(win, { defaultPath: oneriAd || "rapor.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (r.canceled || !r.filePath) return { iptal: true };
    const wb = new ExcelJS.Workbook();
    wb.creator = "Eyüpspor Futbol Okulu";
    const ws = wb.addWorksheet(String(veri.sayfa || "Rapor").slice(0, 30));
    ws.columns = veri.sutunlar.map((c) => ({ header: c.baslik, key: c.anahtar, width: c.genislik || 18 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE6F6" } };
    for (const s of veri.satirlar) ws.addRow(s);
    await wb.xlsx.writeFile(r.filePath);
    shell.openPath(r.filePath).catch(() => {});
    return { ok: true, yol: r.filePath };
  });
}

module.exports = { registerCiktiHandlers };
