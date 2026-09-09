// @vitest-environment jsdom
// Ayarlar menüsü grupları (plan §16): başlıklar, sıra, sihirbaz öğesi (bölüm değil eylem), kirli bölümde onay.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Ayarlar menüsü", () => {
  beforeEach(() => {
    window.okul = {
      db: vi.fn(async (fn) =>
        fn === "getSetting"
          ? ""
          : fn === "listFeeItems"
            ? [{ id: 3, kod: "mont", ad: "Mont", varsayilan_fiyat: 0, aktif: 1 }]
            : fn === "aidatAyarlari"
              ? { taban: 0, indirimler: {}, ucretTipleri: [] }
              : fn === "listFeeTypes" || fn === "listUsers"
                ? []
                : null,
      ),
      yedek: { durum: vi.fn(async () => ({ klasor: null, son: null, siklik: "gunluk", sikliklar: [] })) },
      lisans: { durum: vi.fn(async () => ({ mod: "deneme", kalanGun: 30 })) },
      app: { version: vi.fn(async () => "0.1.0") },
    };
  });
  const ac = (props = {}) =>
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ role: "admin" }} onKurulumAc={vi.fn()} {...props} />
      </ToastSaglayici>,
    );

  it("dört grup başlığı ve öğeler doğru grupta, doğru sırada", () => {
    ac();
    const menu = screen.getByText("Kulüp").parentElement.parentElement; // Kart
    const metinler = [...menu.querySelectorAll("div, button")].map((el) => el.textContent.trim());
    const sira = [
      "Kulüp",
      "Kulüp ve Makbuz",
      "Aidat Kalemleri",
      "WhatsApp Mesajları",
      "Sezon ve Veri",
      "Yeni Sezon",
      "Yedekleme",
      "Resim ve Belge Optimizasyonu",
      "Kullanıcılar ve Erişim",
      "Kullanıcılar",
      "Uygulama",
      "İlk Kurulum Sihirbazı",
      "Lisans",
      "Hakkında",
    ];
    let son = -1;
    for (const m of sira) {
      const i = metinler.indexOf(m, son + 1);
      expect(i, m).toBeGreaterThan(son);
      son = i;
    }
    expect(screen.queryByRole("button", { name: "Kulüp" })).toBeNull(); // başlık tıklanmaz
  });

  it("İlk Kurulum Sihirbazı öğesi sihirbazı açar, seçili bölüm değişmez", () => {
    const onKurulumAc = vi.fn();
    ac({ onKurulumAc, baslangicBolum: "hakkinda" });
    fireEvent.click(screen.getByRole("button", { name: "İlk Kurulum Sihirbazı" }));
    expect(onKurulumAc).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Eyüpspor Futbol Okulu Kayıt Programı" })).toBeInTheDocument();
  });

  it("baslangicBolum ile Lisans açılır; onKurulumAc yoksa sihirbaz öğesi görünmez", () => {
    ac({ baslangicBolum: "lisans", onKurulumAc: undefined });
    expect(screen.getByRole("heading", { name: "Lisans" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "İlk Kurulum Sihirbazı" })).toBeNull();
  });

  it("kaydedilmemiş değişiklik varken sihirbaz tıklanınca onay çıkar; evet → sihirbaz açılır", async () => {
    const onKurulumAc = vi.fn();
    ac({ onKurulumAc, baslangicBolum: "kalem" });
    // Aidat Kalemleri bölümünde bir alanı değiştirerek kirli yap
    const kutu = await screen.findByLabelText("Mont fiyatı");
    fireEvent.change(kutu, { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "İlk Kurulum Sihirbazı" }));
    expect(onKurulumAc).not.toHaveBeenCalled();
    const onay = screen.getByText(/kaydedilmemiş değişiklikler var/i).closest("div");
    fireEvent.click(within(onay.parentElement).getByRole("button", { name: "Evet" }));
    expect(onKurulumAc).toHaveBeenCalledTimes(1);
  });
});
