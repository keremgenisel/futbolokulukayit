// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { onerilenGecerlilik } from "../../src/lib/belge.js";
import { bugun } from "../../src/lib/api.js";

afterEach(cleanup);

describe("Oyuncu kartı > Belgeler: sağlık raporu geçerlilik tarihi", () => {
  beforeEach(() => {
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "getPlayer")
          return {
            id: 7,
            ad_soyad: "Kerem Genişel",
            dogum_tarihi: "2015-01-01",
            durum: "aktif",
            ucret_tipi: "normal",
            aylik_aidat: 0,
            odeme_donemi: "1-10",
            kayit_tarihi: "2026-09-01",
            updated_at: "2026-09-01",
          };
        if (fn === "listDocuments")
          return [
            {
              id: 1,
              tip: "saglik",
              dosya_yolu: "oyuncu-7/1-saglik.pdf",
              orijinal_ad: "rapor.pdf",
              yuklenme_tarihi: "2026-09-01",
              gecerlilik_tarihi: null,
            },
          ];
        if (fn === "attendanceSummary") return [];
        return [];
      }),
      files: { dataUrl: vi.fn(async () => ""), addDocument: vi.fn(async () => ({ ok: true })), open: vi.fn() },
      app: { logo: async () => "" },
    };
  });
  it("rapor varken tek tarih kutusu görünmez: 'Yeni Rapor Yükle' → tarih (bir yıl önerili) + Yükle; boşsa Yükle kapalı; tarihsiz eski rapor 'Tarih girilmemiş'", async () => {
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Belgeler" }));
    await screen.findByText("Tarih girilmemiş");
    expect(screen.queryByLabelText("Sağlık raporu geçerlilik tarihi")).toBeNull(); // rapor varken kutu kapalı
    fireEvent.click(screen.getByRole("button", { name: "Yeni Rapor Yükle" }));
    const tarih = await screen.findByLabelText("Sağlık raporu geçerlilik tarihi");
    expect(tarih).toHaveValue(onerilenGecerlilik(bugun().iso));
    expect(screen.getByText("Tarih girilmemiş")).toBeInTheDocument(); // mevcut tarihsiz rapor uyarı olarak kalır
    const yukle = screen.getAllByRole("button", { name: "Yükle" })[0]; // sağlık raporu satırı ilk sırada
    expect(yukle).not.toBeDisabled();
    fireEvent.change(tarih, { target: { value: "" } });
    expect(yukle).toBeDisabled();
    fireEvent.change(tarih, { target: { value: "2027-03-15" } });
    fireEvent.click(yukle);
    await waitFor(() => expect(window.okul.files.addDocument).toHaveBeenCalledWith(7, "saglik", "2027-03-15"));
  });

  it("tarihsiz mevcut rapora 'Tarih gir' ile tarih girilir (dosya yeniden yüklenmez)", async () => {
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Belgeler" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tarih gir" }));
    const kutu = screen.getByLabelText("Belge geçerlilik tarihi");
    expect(kutu).toHaveValue(onerilenGecerlilik(bugun().iso)); // öneri bir yıl
    fireEvent.change(kutu, { target: { value: "2027-01-10" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Kaydet" }).at(-1));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updateDocument", 1, { gecerlilik_tarihi: "2027-01-10" }));
    expect(window.okul.files.addDocument).not.toHaveBeenCalled();
  });

  it("hiç rapor yokken tarih kutusu doğrudan açık gelir (ilk yükleme)", async () => {
    window.okul.db = vi.fn(async (fn) =>
      fn === "getPlayer"
        ? {
            id: 7,
            ad_soyad: "Yeni",
            dogum_tarihi: "2015-01-01",
            durum: "aktif",
            ucret_tipi: "normal",
            aylik_aidat: 0,
            odeme_donemi: "1-10",
            kayit_tarihi: "2026-09-01",
            updated_at: "2026-09-01",
          }
        : [],
    );
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Belgeler" }));
    expect(await screen.findByLabelText("Sağlık raporu geçerlilik tarihi")).toHaveValue(onerilenGecerlilik(bugun().iso));
    expect(screen.queryByRole("button", { name: "Yeni Rapor Yükle" })).toBeNull();
  });

  it("'Diğer' belgesi isteğe bağlı: yoksa 'Eksik' değil 'İsteğe bağlı'; zorunlu tipler 'Eksik'", async () => {
    window.okul.db = vi.fn(async (fn) =>
      fn === "getPlayer"
        ? {
            id: 7,
            ad_soyad: "Yeni",
            dogum_tarihi: "2015-01-01",
            durum: "aktif",
            ucret_tipi: "normal",
            aylik_aidat: 0,
            odeme_donemi: "1-10",
            kayit_tarihi: "2026-09-01",
            updated_at: "2026-09-01",
          }
        : [],
    );
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Belgeler" }));
    await screen.findByText("Diğer");
    expect(screen.getAllByText("Eksik")).toHaveLength(5); // sağlık, foto, sporcu kimlik, veli kimlik, kayıt formu
    expect(screen.getByText("İsteğe bağlı")).toBeInTheDocument();
  });
});
