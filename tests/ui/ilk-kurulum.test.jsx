// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { IlkKurulum } from "../../src/components/IlkKurulum.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("İlk kurulum sihirbazı", () => {
  it("kulüp adı → aidat/indirim → gruplar+sezon → yedek (atla) → kurtarma kodları → bitir: her adım doğru çağrıyı yapar", async () => {
    const ayarlar = {}; const gruplar = []; const cagrilar = [];
    window.okul = {
      db: vi.fn(async (fn, ...a) => {
        cagrilar.push([fn, ...a]);
        if (fn === "setSetting") { ayarlar[a[0]] = a[1]; return {}; }
        if (fn === "listFeeItems") return [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 0 }];
        if (fn === "aidatAyarlariKaydet") return { ok: true };
        if (fn === "listAgeGroups") return gruplar.map((ad, i) => ({ id: i + 1, ad }));
        if (fn === "createAgeGroup") { gruplar.push(a[0].ad); return { id: gruplar.length, ad: a[0].ad }; }
        if (fn === "listUsers") return [{ id: 7, username: "admin" }];
        return null;
      }),
      yedek: { durum: vi.fn(async () => ({ klasor: null, son: null })), klasorSec: vi.fn() },
      auth: { kurtarmaUret: vi.fn(async () => ({ ok: true, kodlar: ["AAAA-1111", "BBBB-2222", "CCCC-3333", "DDDD-4444", "EEEE-5555", "FFFF-6666", "GGGG-7777", "HHHH-8888"] })) },
      cikti: { yazdir: vi.fn(async () => ({ ok: true })) },
    };
    const onBitti = vi.fn();
    render(<ToastSaglayici><IlkKurulum oturum={{ username: "admin", ad_soyad: "Yönetici", role: "admin" }} onBitti={onBitti} /></ToastSaglayici>);
    // 1. Kulüp
    fireEvent.change(screen.getByLabelText("Kulüp adı"), { target: { value: "Eyüpspor Futbol Okulu" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve Devam" }));
    await waitFor(() => expect(ayarlar.kulup_adi).toBe("Eyüpspor Futbol Okulu"));
    expect(ayarlar.tahsil_eden).toBe("Yönetici");
    // 2. Aidat
    const taban = await screen.findByLabelText("Aidat taban fiyatı");
    fireEvent.change(taban, { target: { value: "3500" } });
    fireEvent.change(screen.getByLabelText("Kardeş İndirimi indirimi"), { target: { value: "15" } });
    expect(screen.getByLabelText("Kardeş İndirimi indirimi").closest("tr")).toHaveTextContent("2.975 ₺");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve Devam" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("aidatAyarlariKaydet", { kalemler: [{ id: 1, varsayilan_fiyat: 3500 }], indirimler: { burslu: 100, indirimli: 0, kardes: 15 } }));
    // 3. Gruplar + sezon
    const u9 = await screen.findByRole("button", { name: "U9" });
    expect(u9).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(u9); // U9 çıkar
    fireEvent.change(screen.getByLabelText("Başka grup"), { target: { value: "u16" } });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    fireEvent.change(screen.getByLabelText("Aktif sezon"), { target: { value: "2026-2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve Devam" }));
    await waitFor(() => expect(gruplar).toEqual(["U10", "U11", "U12", "U13", "U16"]));
    expect(ayarlar.aktif_sezon).toBe("2026-2027");
    // 4. Yedek → Atla
    await screen.findByRole("button", { name: "Klasör Seç" });
    fireEvent.click(screen.getByRole("button", { name: "Atla" }));
    // 5. Kurtarma kodları
    fireEvent.click(await screen.findByRole("button", { name: "Kurtarma Kodlarını Üret" }));
    await waitFor(() => expect(window.okul.auth.kurtarmaUret).toHaveBeenCalledWith(7));
    const dlg = await screen.findByText("AAAA-1111");
    fireEvent.click(within(dlg.closest("[role=dialog]")).getByRole("button", { name: "Kaydettim" }));
    expect(screen.getByText("8 kurtarma kodu üretildi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    // 6. Bitti
    fireEvent.click(await screen.findByRole("button", { name: "Bitir, Pano'ya Git" }));
    await waitFor(() => expect(ayarlar.kurulum_tamam).toBe("1"));
    expect(onBitti).toHaveBeenCalled();
  });

  it("'Şimdi değil' kurulumu tamam işaretlemez, sonraki girişte yeniden çıkar", async () => {
    const ayarlar = {};
    window.okul = { db: vi.fn(async (fn, ...a) => { if (fn === "setSetting") { ayarlar[a[0]] = a[1]; } return fn === "listAgeGroups" ? [] : null; }), yedek: { durum: vi.fn(async () => ({})) }, auth: {} };
    const onBitti = vi.fn();
    render(<ToastSaglayici><IlkKurulum oturum={{ username: "admin", role: "admin" }} onBitti={onBitti} /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Şimdi değil" }));
    await waitFor(() => expect(onBitti).toHaveBeenCalled());
    expect(ayarlar.kurulum_tamam).toBeUndefined();
  });
});
