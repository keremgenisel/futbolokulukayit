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
    let tipler = [{ kod: "normal", ad: "Normal", indirim: 0, aktif: 1, sabit: 1 }, { kod: "burslu", ad: "Burslu", indirim: 100, aktif: 1, sabit: 0 }, { kod: "indirimli", ad: "İndirimli", indirim: 0, aktif: 1, sabit: 0 }, { kod: "kardes", ad: "Kardeş İndirimi", indirim: 0, aktif: 1, sabit: 0 }, { kod: "ucretsiz", ad: "Ücretsiz", indirim: 100, aktif: 1, sabit: 1 }];
    window.okul = { db: vi.fn(async (fn, ...a) => {
      if (fn === "listFeeItems") return kalemler.map((k) => ({ ...k }));
      if (fn === "listFeeTypes") return tipler.map((t) => ({ ...t }));
      if (fn === "aidatAyarlari") return { taban: kalemler[0].varsayilan_fiyat, indirimler: Object.fromEntries(tipler.map((t) => [t.kod, t.indirim])), ucretTipleri: tipler.map((t) => ({ ...t })) };
      if (fn === "aidatAyarlariKaydet") {
        let id = 100;
        for (const k of a[0].kalemler || []) {
          if (k.yeni) kalemler = [...kalemler, { id: ++id, kod: k.ad.toLowerCase(), ad: k.ad, varsayilan_fiyat: k.varsayilan_fiyat, aktif: 1 }];
          else if (k.sil) { if (k.id === 2) throw new Error('"Forma" 3 makbuz satırında kullanılmış; silmek yerine pasife alın'); kalemler = kalemler.filter((x) => x.id !== k.id); }
          else kalemler = kalemler.map((x) => (x.id === k.id ? { ...x, ...k } : x));
        }
        for (const t of a[0].ucretTipleri || []) {
          if (t.yeni) tipler = [...tipler, { kod: t.ad.toLowerCase(), ad: t.ad, indirim: t.indirim, aktif: 1, sabit: 0 }];
          else if (t.sil) tipler = tipler.filter((x) => x.kod !== t.kod);
          else tipler = tipler.map((x) => (x.kod === t.kod ? { ...x, ...t } : x));
        }
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
      ucretTipleri: [{ kod: "indirimli", ad: "İndirimli", indirim: 25, aktif: 1 }],
    }));
    await waitFor(() => expect(screen.queryByText(/değişiklik kaydedilmedi/)).toBeNull()); // toast da role=status taşır; metne bak
    expect(screen.getByLabelText("Forma fiyatı")).toHaveValue("9.000");
    expect(screen.getByLabelText("Mont fiyatı")).toHaveValue("8.000");
    expect(window.okul.db.mock.calls.filter((c) => c[0] === "aidatAyarlariKaydet")).toHaveLength(1);
  });

  it("yeni kalem ve yeni ücret tipi ekranda birikir, tek Kaydet ile yazılır; kaydedince listede görünür", async () => {
    kur();
    await screen.findByLabelText("Forma fiyatı");
    fireEvent.change(screen.getByLabelText("Yeni kalem adı"), { target: { value: "Kamp Ücreti" } });
    fireEvent.change(screen.getByLabelText("Yeni kalem fiyatı"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Kalem Ekle" }));
    expect(screen.getByText("Kamp Ücreti")).toBeInTheDocument();
    expect(screen.getByLabelText("Yeni kalem adı")).toHaveValue(""); // satır temizlendi
    fireEvent.change(screen.getByLabelText("Yeni ücret tipi adı"), { target: { value: "Şampiyon Bursu" } });
    fireEvent.change(screen.getByLabelText("Yeni ücret tipi indirimi"), { target: { value: "50" } });
    fireEvent.keyDown(screen.getByLabelText("Yeni ücret tipi adı"), { key: "Enter" });
    expect(screen.getByText("Şampiyon Bursu").closest("tr")).toHaveTextContent("1.750 ₺"); // 3500 − %50
    expect(screen.getByText(/2 değişiklik kaydedilmedi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlariKaydet", {
      kalemler: [{ yeni: true, ad: "Kamp Ücreti", varsayilan_fiyat: 2500 }],
      ucretTipleri: [{ yeni: true, ad: "Şampiyon Bursu", indirim: 50 }],
    }));
    await waitFor(() => expect(screen.queryByText(/değişiklik kaydedilmedi/)).toBeNull());
    expect(await screen.findByLabelText("Kamp Ücreti fiyatı")).toHaveValue("2.500");
    expect(screen.getByLabelText("Şampiyon Bursu indirimi")).toHaveValue(50);
    expect(screen.getByLabelText("Şampiyon Bursu adı")).toHaveValue("Şampiyon Bursu");
  });

  it("Sil işaretler ve Geri al kaldırır; kaydedince sil isteği gider; ücret tipi adı düzenlenebilir", async () => {
    kur();
    await screen.findByLabelText("Mont fiyatı");
    fireEvent.click(screen.getByRole("button", { name: "Mont sil" }));
    expect(screen.getByLabelText("Mont fiyatı")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(screen.getByLabelText("Mont fiyatı")).not.toBeDisabled();
    expect(screen.queryByText(/değişiklik kaydedilmedi/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mont sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Kardeş İndirimi sil" }));
    fireEvent.change(screen.getByLabelText("Burslu adı"), { target: { value: "Tam Burslu" } });
    expect(screen.getByText(/3 değişiklik kaydedilmedi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlariKaydet", {
      kalemler: [{ id: 3, sil: true }],
      ucretTipleri: [{ kod: "burslu", ad: "Tam Burslu", indirim: 100, aktif: 1 }, { kod: "kardes", sil: true }],
    }));
    await waitFor(() => expect(screen.queryByLabelText("Mont fiyatı")).toBeNull());
    expect(screen.queryByLabelText("Kardeş İndirimi indirimi")).toBeNull();
    expect(screen.getByLabelText("Tam Burslu adı")).toHaveValue("Tam Burslu");
    // Sabit tipler (Normal, Ücretsiz) ve Aidat kalemi silinemez
    expect(screen.queryByRole("button", { name: "Normal sil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ücretsiz sil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aidat sil" })).toBeNull();
  });

  it("makbuzda kullanılmış kalemi silme isteği ana süreçten hata ile döner, ekranda gösterilir ve değişiklik korunur", async () => {
    kur();
    await screen.findByLabelText("Forma fiyatı");
    fireEvent.click(screen.getByRole("button", { name: "Forma sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(/3 makbuz satırında kullanılmış/)).toBeInTheDocument();
    expect(screen.getByText(/1 değişiklik kaydedilmedi/)).toBeInTheDocument(); // kullanıcı Geri al ile vazgeçebilir
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
