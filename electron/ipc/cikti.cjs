// Yazdırma, PDF ve Excel çıktıları. Renderer HTML'i hazırlar (makbuz/rapor şablonu), burada
// gizli pencerede render edilip yazıcıya veya PDF'e gönderilir. Excel exceljs ile üretilir.
const { ipcMain, BrowserWindow, dialog, shell, app, session } = require("electron");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const db = require("../db.cjs");
const config = require("../config.cjs");
const koruma = require("./koruma.cjs");
const istemci = require("../istemci.cjs");
const { uploadsIci } = require("./files.cjs");
const { makbuzPdfIzni } = require("../makbuzIzin.cjs");

// Yazdırma/PDF penceresi (inceleme #5): ayrı oturum bölümü; data:/about:/blob: dışındaki HER istek (http/https/file/…)
// engellenir. JavaScript zaten kapalı; böylece şablonda bir kaçış hatası olsa bile dışarı veri sızmaz.
let ciktiOturumu = null;
function ciktiOturumuAl() {
  if (ciktiOturumu) return ciktiOturumu;
  ciktiOturumu = session.fromPartition("cikti");
  ciktiOturumu.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(data|about|blob):/i.test(d.url) }));
  ciktiOturumu.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  return ciktiOturumu;
}
async function htmlPencere(html) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, session: ciktiOturumuAl() } });
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return w;
}

async function htmlToPdf(html, opts = {}) {
  const w = await htmlPencere(html);
  try {
    return await w.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { marginType: "none" },
      landscape: !!opts.yatay,
    });
  } finally {
    w.close();
  }
}

function registerCiktiHandlers(getSession) {
  const yetki = koruma.firlatarak(getSession);

  ipcMain.handle("cikti:yazdir", async (_e, html) => {
    yetki();
    const w = await htmlPencere(html);
    return new Promise((resolve) => {
      w.webContents.print({ silent: false, printBackground: true }, (ok, hata) => {
        w.close();
        resolve({ ok, hata });
      });
    });
  });

  // Makbuz PDF'ini uploads/makbuz/<no>.pdf olarak sakla ve kayda bağla.
  ipcMain.handle("cikti:makbuzPdf", async (_e, receiptId, html) => {
    yetki();
    if (config.istemciMi()) {
      const pdf = await htmlToPdf(html);
      return istemci.istek("/api/cikti/makbuzPdf", {
        method: "POST",
        timeoutMs: 120000,
        body: { receiptId: Number(receiptId), pdfBase64: pdf.toString("base64") },
      });
    }
    const r = db.getReceipt(Number(receiptId));
    const izin = makbuzPdfIzni(getSession(), r, db.lisansSaltOkunurMu());
    if (!izin.ok) throw new Error(izin.neden);
    const pdf = await htmlToPdf(html);
    fs.mkdirSync(uploadsIci("makbuz"), { recursive: true });
    const yol = path.join("makbuz", `${r.makbuz_no}.pdf`);
    fs.writeFileSync(uploadsIci(yol), pdf);
    db.setReceiptPdf(r.id, yol);
    return { ok: true, pdf_yolu: yol };
  });

  // Yazıcı yokken yedek yol: HTML'i geçici PDF yapıp sistem görüntüleyicisinde açar (oradan yazdırılır).
  ipcMain.handle("cikti:pdfAc", async (_e, html, ad, yatay) => {
    yetki();
    const dosya =
      String(ad || "cikti")
        .replace(/[^\w.-]+/g, "_")
        .replace(/\.pdf$/i, "") + ".pdf";
    const yol = path.join(app.getPath("temp"), "eyupspor-" + Date.now() + "-" + dosya);
    fs.writeFileSync(yol, await htmlToPdf(html, { yatay }));
    const hata = await shell.openPath(yol);
    return hata ? { error: hata } : { ok: true, yol };
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
    const r = await dialog.showSaveDialog(win, {
      defaultPath: oneriAd || "rapor.xlsx",
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
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
