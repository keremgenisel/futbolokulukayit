// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { OyuncuForm } from "../../src/components/OyuncuForm.jsx";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
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
    await waitFor(() => expect(aidat).toHaveValue("3.500"));
    expect(screen.getByText(/Taban 3\.500 ₺/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "indirimli" } });
    expect(aidat).toHaveValue("2.625");
    expect(screen.getByText(/− %25 indirim/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "kardes" } });
    expect(aidat).toHaveValue("2.975");
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "burslu" } });
    expect(aidat).toHaveValue("0"); expect(aidat).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "ucretsiz" } });
    expect(aidat).toHaveValue("0"); expect(aidat).toBeDisabled();
    // Elle değiştirilebilir
    fireEvent.change(screen.getByLabelText("Ücret Tipi"), { target: { value: "normal" } });
    fireEvent.change(aidat, { target: { value: "3000" } });
    expect(aidat).toHaveValue("3.000");
  });
  it("düzenlemede mevcut aidat korunur, ücret tipi değişmedikçe yeniden hesaplanmaz", async () => {
    render(<ToastSaglayici><OyuncuForm oyuncu={{ id: 7, ad_soyad: "Ada", dogum_tarihi: "2015-01-01", ucret_tipi: "normal", aylik_aidat: 3000 }} gruplar={[]} onKaydedildi={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlari"));
    expect(screen.getByLabelText("Aylık aidat")).toHaveValue("3.000");
  });
});

describe("Ayarlar > Aidat Kalemleri: tek Kaydet", () => {
  const kur = () => {
    let kalemler = [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 3500, aktif: 1 }, { id: 2, kod: "forma", ad: "Forma", varsayilan_fiyat: 1200, aktif: 1 }, { id: 3, kod: "mont", ad: "Mont", varsayilan_fiyat: 0, aktif: 1 }];
    const ayarlar = {};
    window.okul = { db: vi.fn(async (fn, ...a) => {
      if (fn === "listFeeItems") return kalemler.map((k) => ({ ...k }));
      if (fn === "aidatAyarlari") return { taban: kalemler[0].varsayilan_fiyat, indirimler: { ...ayarlar } };
      if (fn === "aidatAyarlariKaydet") {
        for (const k of a[0].kalemler) kalemler = kalemler.map((x) => (x.id === k.id ? { ...x, ...k } : x));
        Object.assign(ayarlar, a[0].indirimler);
        return { ok: true };
      }
      if (fn === "getSetting") return ""; if (fn === "listUsers") return [];
      return null;
    }), app: { version: async () => "0.1.0" }, lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) }, mod: { oku: async () => ({ mode: "yerel" }) } };
    render(<ToastSaglayici><Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="kalem" /></ToastSaglayici>);
  };

  it("iki satıra fiyat girilip Kaydet'e basılınca ikisi de tek çağrıda kaydedilir, hiçbiri kaybolmaz", async () => {
    kur();
    const forma = await screen.findByLabelText("Forma fiyatı");
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull(); // değişiklik yokken düğme yok
    fireEvent.change(forma, { target: { value: "9000" } });
    fireEvent.change(screen.getByLabelText("Mont fiyatı"), { target: { value: "8000" } });
    fireEvent.change(screen.getByLabelText("İndirimli indirimi"), { target: { value: "25" } });
    expect(screen.getByText(/3 değişiklik kaydedilmedi/)).toBeInTheDocument();
    expect(screen.getByLabelText("İndirimli indirimi").closest("tr")).toHaveTextContent("2.625 ₺");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlariKaydet", {
      kalemler: [{ id: 2, ad: "Forma", varsayilan_fiyat: 9000, aktif: 1 }, { id: 3, ad: "Mont", varsayilan_fiyat: 8000, aktif: 1 }],
      indirimler: { indirimli: 25 },
    }));
    await waitFor(() => expect(screen.queryByText(/değişiklik kaydedilmedi/)).toBeNull()); // toast da role=status taşır; metne bak
    expect(screen.getByLabelText("Forma fiyatı")).toHaveValue("9.000");
    expect(screen.getByLabelText("Mont fiyatı")).toHaveValue("8.000");
    expect(window.okul.db.mock.calls.filter((c) => c[0] === "aidatAyarlariKaydet")).toHaveLength(1);
  });

  it("Vazgeç girdileri kayıtlı değerlere döndürür", async () => {
    kur();
    const forma = await screen.findByLabelText("Forma fiyatı");
    fireEvent.change(forma, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(screen.getByLabelText("Forma fiyatı")).toHaveValue("1.200");
    expect(screen.queryByText(/değişiklik kaydedilmedi/)).toBeNull();
  });

  it("kaydedilmemiş değişiklik varken başka bölüme geçiş onay ister; Vazgeç bölümde tutar, Evet geçer", async () => {
    kur();
    fireEvent.change(await screen.findByLabelText("Forma fiyatı"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Kulüp ve Makbuz/ }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("kaydedilmemiş değişiklikler");
    fireEvent.click(within(dlg).getByRole("button", { name: "Vazgeç" }));
    expect(screen.getByLabelText("Forma fiyatı")).toHaveValue("5");
    fireEvent.click(screen.getByRole("button", { name: /Kulüp ve Makbuz/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(screen.queryByLabelText("Forma fiyatı")).toBeNull());
    expect(window.okul.db).not.toHaveBeenCalledWith("aidatAyarlariKaydet", expect.anything());
  });
});
