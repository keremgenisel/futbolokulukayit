// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makbuzYazdir } from "../src/lib/yazdir.js";

const makbuz = { id: 7, makbuz_no: "2026-0007", tarih: "2026-09-06", ad_soyad: "X", toplam: 100, odeme_yontemi: "nakit", satirlar: [], pdf_yolu: "" };

describe("makbuzYazdir — yazıcı yoksa PDF'e düşer", () => {
  let yazdir, makbuzPdf, open;
  beforeEach(() => {
    yazdir = vi.fn(); makbuzPdf = vi.fn(async () => { makbuz.pdf_yolu = "makbuz/2026-0007.pdf"; return { ok: true }; }); open = vi.fn(async () => "");
    makbuz.pdf_yolu = "";
    window.okul = {
      db: vi.fn(async (fn) => fn === "getReceipt" ? { ...makbuz } : fn === "listFeeItems" ? [] : null),
      cikti: { yazdir, makbuzPdf }, files: { open }, app: { logo: async () => "" },
    };
  });
  it("yazdırma başarılıysa PDF açılmaz", async () => {
    yazdir.mockResolvedValue({ ok: true });
    expect((await makbuzYazdir(7)).ok).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });
  it("yazıcı yoksa PDF üretilip açılır ve Türkçe mesaj döner", async () => {
    yazdir.mockResolvedValue({ ok: false, hata: "No printers available on the network" });
    const r = await makbuzYazdir(7);
    expect(r.ok).toBe(false);
    expect(r.mesaj).toMatch(/tanımlı yazıcı yok/);
    expect(r.mesaj).toMatch(/PDF olarak açıldı/);
    expect(makbuzPdf).toHaveBeenCalledWith(7, expect.stringContaining("TAHSİLAT MAKBUZU"));
    expect(open).toHaveBeenCalledWith("makbuz/2026-0007.pdf");
  });
  it("kullanıcı iptal ettiyse PDF açılmaz", async () => {
    yazdir.mockResolvedValue({ ok: false, hata: "Print job canceled" });
    const r = await makbuzYazdir(7);
    expect(r.mesaj).toMatch(/iptal/); expect(open).not.toHaveBeenCalled();
  });
});
