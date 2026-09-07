// Excel'den oyuncu aktarımı: şablon indir → dosya seç ve önizle → onayla ve aktar (tek işlem). Yalnız yönetici, sunucu PC.
const { ipcMain, dialog, BrowserWindow, shell } = require("electron");
const ExcelJS = require("exceljs");
const db = require("../db.cjs");
const config = require("../config.cjs");
const { satirlariCoz, SABLON_BASLIKLAR, SABLON_ORNEK } = require("../oyuncuAktar.cjs");

// exceljs hücre değerini ham değere indirger (formül/richText/hyperlink → metin).
function hucre(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result !== undefined) return hucre(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v.hyperlink) return String(v.text ?? v.hyperlink);
    return String(v);
  }
  return v;
}

async function excelOku(yol) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(yol);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const satirlar = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => { const arr = []; row.eachCell({ includeEmpty: true }, (c, j) => { arr[j - 1] = hucre(c.value); }); satirlar[i - 1] = arr; });
  return satirlar.filter(Boolean);
}

// Önizlemede üretilen kayıtları tek işlemde yazar: yeni gruplar açılır, oyuncu + veli eklenir, bu ayın aidatı açılır (createPlayer içinde).
function aktarUygula(kayitlar) {
  const tx = db.islem(() => {
    const gruplar = db.listAgeGroups();
    const grupId = new Map(gruplar.map((g) => [g.ad.toLocaleUpperCase("tr-TR").replace(/\s+/g, ""), g.id]));
    let eklenen = 0, yeniGrup = 0;
    for (const k of kayitlar) {
      const { veli, yeni_grup, satir: _s, ...p } = k;
      if (yeni_grup && !p.yas_grubu_id) {
        if (!grupId.has(yeni_grup)) { const g = db.createAgeGroup({ ad: yeni_grup, sezon: db.getSetting("aktif_sezon") || "" }); grupId.set(yeni_grup, g.id); yeniGrup++; }
        p.yas_grubu_id = grupId.get(yeni_grup);
      }
      const o = db.createPlayer(p);
      if (veli) db.addGuardian(o.id, { tip: "veli", ad_soyad: veli.ad_soyad, gsm: veli.gsm || "", whatsapp_no: veli.gsm || "", veli_mi: 1, mesaj_onayi: veli.mesaj_onayi === undefined ? 1 : veli.mesaj_onayi });
      eklenen++;
    }
    return { ok: true, eklenen, yeniGrup };
  });
  return tx();
}

function registerAktarHandlers(getSession) {
  const kontrol = () => {
    const s = getSession();
    if (!s || s.role !== "admin") return { error: "Yönetici yetkisi gerekli" };
    if (config.istemciMi()) return { error: "Aktarım yalnızca sunucu bilgisayarında yapılır" };
    if (db.lisansSaltOkunurMu()) return { error: "Lisans salt okunur modda" };
    return null;
  };
  ipcMain.handle("aktar:sablon", async (e) => {
    const k = kontrol(); if (k) return k;
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: "oyuncu-sablonu.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (r.canceled || !r.filePath) return { iptal: true };
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Oyuncular");
    ws.columns = SABLON_BASLIKLAR.map((b) => ({ header: b, key: b, width: Math.max(14, b.length + 4) }));
    ws.getRow(1).font = { bold: true }; ws.addRow(SABLON_ORNEK);
    await wb.xlsx.writeFile(r.filePath); shell.openPath(r.filePath).catch(() => {});
    return { ok: true, yol: r.filePath };
  });
  ipcMain.handle("aktar:onizle", async (e) => {
    const k = kontrol(); if (k) return k;
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: "Oyuncu listesi (Excel)", properties: ["openFile"], filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (r.canceled || !r.filePaths[0]) return { iptal: true };
    try {
      const satirlar = await excelOku(r.filePaths[0]);
      const oyuncular = db.listPlayers();
      const sonuc = satirlariCoz(satirlar, { gruplar: db.listAgeGroups(), ucretTipleri: db.listFeeTypes(), mevcutTc: new Set(oyuncular.map((o) => o.tc_no).filter(Boolean)), mevcutPasaport: new Set(oyuncular.map((o) => o.pasaport_no).filter(Boolean)) });
      return { ok: true, dosya: r.filePaths[0], ...sonuc };
    } catch (err) { return { error: "Excel okunamadı: " + err.message }; }
  });
  ipcMain.handle("aktar:uygula", async (_e, kayitlar) => {
    const k = kontrol(); if (k) return k;
    if (!Array.isArray(kayitlar) || !kayitlar.length) return { error: "Aktarılacak kayıt yok" };
    try { return aktarUygula(kayitlar); } catch (err) { return { error: "Aktarım başarısız, hiçbir kayıt yazılmadı: " + err.message }; }
  });
}

module.exports = { registerAktarHandlers, aktarUygula, excelOku };
