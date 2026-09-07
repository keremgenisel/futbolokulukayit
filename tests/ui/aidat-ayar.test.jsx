// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { OyuncuForm } from "../../src/components/OyuncuForm.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Oyuncu formu: ücret tipine göre aidat", () => {
  beforeEach(() => {
    window.okul = { db: vi.fn(async (fn) => {
      if (fn === "aidatAyarlari") return { taban: 3500, indirimler: { indirimli: 25, kardes: 15 } };
      if (fn === "createPlayer") return { id: 1 };
      throw new Error("beklenmeyen " + fn);
    }) };
  });
  it("yeni kayıtta aidat taban fiyatla dolar; ücret tipi değişince indirim düşülür; ücretsizde alan kilitlenir", async () => {
    render(<ToastSaglayici><OyuncuForm gruplar={[]} onKaydedildi={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);
    const aidat = screen.getByLabelText("Aylık aidat");
    await waitFor(() => expect(aidat).toHaveValue(3500));
    expect(screen.getByText(/Taban 3\.500 ₺/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "indirimli" } });
    expect(aidat).toHaveValue(2625);
    expect(screen.getByText(/− %25 indirim/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "kardes" } });
    expect(aidat).toHaveValue(2975);
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "burslu" } });
    expect(aidat).toHaveValue(0); expect(aidat).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "ucretsiz" } });
    expect(aidat).toHaveValue(0); expect(aidat).toBeDisabled();
    // Elle değiştirilebilir
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "normal" } });
    fireEvent.change(aidat, { target: { value: "3000" } });
    expect(aidat).toHaveValue(3000);
  });
  it("düzenlemede mevcut aidat korunur, ücret tipi değişmedikçe yeniden hesaplanmaz", async () => {
    render(<ToastSaglayici><OyuncuForm oyuncu={{ id: 7, ad_soyad: "Ada", dogum_tarihi: "2015-01-01", ucret_tipi: "normal", aylik_aidat: 3000 }} gruplar={[]} onKaydedildi={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlari"));
    expect(screen.getByLabelText("Aylık aidat")).toHaveValue(3000);
  });
});

describe("Ayarlar > Aidat Kalemleri: fiyat ve indirimler", () => {
  it("aidat fiyatı düzenlenebilir, indirim yüzdeleri kaydedilir ve hesaplanan aidat görünür", async () => {
    const { Ayarlar } = await import("../../src/components/Ayarlar.jsx");
    const ayarlar = {};
    window.okul = { db: vi.fn(async (fn, ...a) => {
      if (fn === "listFeeItems") return [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 3500, aktif: 1 }, { id: 2, kod: "forma", ad: "Forma", varsayilan_fiyat: 1200, aktif: 1 }];
      if (fn === "aidatAyarlari") return { taban: 3500, indirimler: { ...ayarlar } };
      if (fn === "setSetting") { ayarlar[a[0].replace("indirim_", "")] = Number(a[1]); return {}; }
      if (fn === "updateFeeItem") return {};
      if (fn === "getSetting") return "";
      if (fn === "listUsers") return [];
      return null;
    }), app: { version: async () => "0.1.0" }, lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) }, mod: { oku: async () => ({ mode: "yerel" }) } };
    render(<ToastSaglayici><Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: /Aidat Kalemleri/ }));
    const fiyat = await screen.findByLabelText("Aidat fiyatı");
    expect(fiyat).toHaveValue(3500); expect(fiyat).not.toBeDisabled();
    fireEvent.change(fiyat, { target: { value: "4000" } });
    fireEvent.click(within(fiyat.closest("tr")).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updateFeeItem", 1, expect.objectContaining({ varsayilan_fiyat: 4000 })));
    const ind = await screen.findByLabelText("İndirimli indirimi");
    fireEvent.change(ind, { target: { value: "25" } });
    expect(ind.closest("tr")).toHaveTextContent("2.625 ₺");
    fireEvent.change(screen.getByLabelText("Burslu indirimi"), { target: { value: "50" } });
    expect(screen.getByLabelText("Burslu indirimi").closest("tr")).toHaveTextContent("1.750 ₺");
    fireEvent.click(screen.getByRole("button", { name: "İndirimleri Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("setSetting", "indirim_indirimli", "25"));
    expect(window.okul.db).toHaveBeenCalledWith("setSetting", "indirim_burslu", "50");
    expect(window.okul.db).not.toHaveBeenCalledWith("setSetting", "indirim_normal", expect.anything());
  });
});
