// @vitest-environment jsdom
// Karakterizasyon (refactor 2. tur §9, 11.09.2026): Tahsilat'ın yazdırma/PDF hata yolları ve boş kalem koruması.
// Davranışı SABİTLER; Tahsilat bölünürken (§8.2) bu testler değişmeden geçmeli.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Tahsilat } from "../../src/components/Tahsilat.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

const kalemler = [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 3500, aktif: 1 }];
const oyuncu = { id: 5, ad_soyad: "Kaan Yıldız", dogum_tarihi: "2015-11-02", yas_grubu_ad: "U11", ucret_tipi: "normal", aylik_aidat: 3500 };
const t = new Date();
const yil = t.getFullYear(),
  ay = t.getMonth() + 1;

/** @param {{ yazdir?: object, pdfYolu?: string, dues?: object[], bugunku?: object[] }} o */
function kur(o = {}) {
  let makbuz = {
    id: 99,
    makbuz_no: "2026-0007",
    tarih: "2026-09-11",
    toplam: 3500,
    odeme_yontemi: "nakit",
    ad_soyad: "Kaan Yıldız",
    satirlar: [],
    pdf_yolu: o.pdfYolu ?? "",
  };
  window.okul = {
    db: vi.fn(async (fn) => {
      if (fn === "listFeeItems") return kalemler;
      if (fn === "getSetting") return "";
      if (fn === "listReceiptsByDate") return o.bugunku || [];
      if (fn === "getPlayer") return oyuncu;
      if (fn === "listDues") return o.dues ?? [{ id: 1, player_id: 5, yil, ay, tutar: 3500, durum: "odenmedi" }];
      if (fn === "createReceipt") return { id: 99, makbuz_no: "2026-0007" };
      if (fn === "getReceipt") return makbuz;
      return [];
    }),
    cikti: {
      makbuzPdf: vi.fn(async () => {
        makbuz = { ...makbuz, pdf_yolu: "/uploads/makbuz/2026-0007.pdf" }; // PDF üretildi → pdf_yolu dolar
        return { ok: true };
      }),
      yazdir: vi.fn(async () => o.yazdir || { ok: true }),
    },
    files: { open: vi.fn(async () => ({ ok: true })) },
    app: { logo: async () => "" },
  };
  render(
    <ToastSaglayici>
      <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} secilenOyuncuId={5} onSecildi={() => {}} />
    </ToastSaglayici>,
  );
}

/** Oyuncu ve kalemler yüklenene kadar düğme kapalıdır; açılmasını bekler. */
async function hazir(ad) {
  const b = await screen.findByRole("button", { name: ad });
  await waitFor(() => expect(b).toBeEnabled());
  return b;
}

describe("Tahsilat — yazdırma/PDF hata yolları", () => {
  it("Kaydet ve Yazdır: yazıcı yoksa makbuz kaydedilir, PDF sistem görüntüleyicisinde açılır, hata mesajı açıklar, form temizlenir", async () => {
    kur({ yazdir: { ok: false, hata: "no printers found" } });
    fireEvent.click(await hazir("Kaydet ve Yazdır"));
    await screen.findByText("Makbuz 2026-0007 kaydedildi");
    await screen.findByText("Bu bilgisayarda tanımlı yazıcı yok. Makbuz PDF olarak açıldı, oradan yazdırabilirsiniz.");
    expect(window.okul.cikti.makbuzPdf).toHaveBeenCalledTimes(1); // kaydette üretildi; yazdırma yedek yolu yeniden üretmez
    expect(window.okul.files.open).toHaveBeenCalledWith("/uploads/makbuz/2026-0007.pdf");
    expect(screen.getByLabelText("Oyuncu ara")).toBeInTheDocument(); // oyuncu seçimi sıfırlandı
    expect(screen.getByRole("button", { name: "Kaydet ve Yazdır" })).toBeDisabled(); // oyuncu seçilene kadar kapalı
  });

  it("Kaydet ve Yazdır: kullanıcı yazdırmayı iptal ederse yalnız 'Yazdırma iptal edildi.' denir, PDF açılmaz", async () => {
    kur({ yazdir: { ok: false, hata: "Print job canceled" } });
    fireEvent.click(await hazir("Kaydet ve Yazdır"));
    await screen.findByText("Yazdırma iptal edildi.");
    expect(window.okul.files.open).not.toHaveBeenCalled();
    expect(window.okul.db).toHaveBeenCalledWith("createReceipt", expect.objectContaining({ player_id: 5 }));
  });

  it("Kaydet (yazdırmadan): yazıcı çağrılmaz, PDF üretilir", async () => {
    kur();
    fireEvent.click(await hazir("Kaydet"));
    await screen.findByText("Makbuz 2026-0007 kaydedildi");
    expect(window.okul.cikti.yazdir).not.toHaveBeenCalled();
    expect(window.okul.cikti.makbuzPdf).toHaveBeenCalledTimes(1);
  });

  it("Bugün Kesilen Makbuzlar › Yazdır: kayıtlı PDF yoksa önce üretilir, yazıcı hatasında PDF açılır ve mesaj gösterilir", async () => {
    const m = { id: 99, makbuz_no: "2026-0007", ad_soyad: "Kaan Yıldız", toplam: 3500, odeme_yontemi: "nakit", tahsil_eden: "Yönetici" };
    kur({ yazdir: { ok: false, hata: "spooler down" }, bugunku: [m] });
    fireEvent.click(await screen.findByRole("button", { name: "Yazdır" }));
    await screen.findByText("Yazdırma başarısız: spooler down Makbuz PDF olarak açıldı, oradan yazdırabilirsiniz.");
    expect(window.okul.cikti.yazdir).toHaveBeenCalledTimes(1);
    expect(String(window.okul.cikti.yazdir.mock.calls[0][0])).toContain("2026-0007"); // makbuz HTML'i üretildi
    expect(window.okul.cikti.makbuzPdf).toHaveBeenCalledTimes(1); // pdf_yolu boştu → üretildi
    expect(window.okul.files.open).toHaveBeenCalledWith("/uploads/makbuz/2026-0007.pdf");
  });

  it("Bugün Kesilen Makbuzlar › Yazdır: yazdırma başarılıysa hata toast'ı yok, PDF açılmaz", async () => {
    const m = { id: 99, makbuz_no: "2026-0007", ad_soyad: "Kaan Yıldız", toplam: 3500, odeme_yontemi: "nakit", tahsil_eden: "Yönetici" };
    kur({ bugunku: [m] });
    fireEvent.click(await screen.findByRole("button", { name: "Yazdır" }));
    await waitFor(() => expect(window.okul.cikti.yazdir).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Yazdırma/)).toBeNull();
    expect(window.okul.files.open).not.toHaveBeenCalled();
  });

  it("hiç kalem seçilmemişse Kaydet 'En az bir kalem seçin' der ve makbuz oluşturmaz", async () => {
    kur({ dues: [] });
    const kaydet = await hazir("Kaydet");
    // seçili gelen ay varsa kaldır (ay pilleri aria-pressed)
    for (const b of screen.queryAllByRole("button", { pressed: true })) fireEvent.click(b);
    fireEvent.click(kaydet);
    await screen.findByText("En az bir kalem seçin");
    expect(window.okul.db).not.toHaveBeenCalledWith("createReceipt", expect.anything());
  });
});
