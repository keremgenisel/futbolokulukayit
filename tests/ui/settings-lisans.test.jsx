// @vitest-environment jsdom
// Ayarlar > Lisans: anahtar kaydı sonrası otomatik aktivasyon sonucu (12.09.2026: kulüpte anahtar kaydedilip aktive edilmedi).
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SettingsLisans } from "../../src/components/SettingsLisans.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);
const kur = (kaydetCevabi) => {
  window.okul = {
    lisans: {
      durum: vi.fn(async () => ({ ok: true, durum: { mod: "deneme", kalanGun: 20, makineId: "M1" } })),
      kaydet: vi.fn(async () => kaydetCevabi),
      aktiflestir: vi.fn(),
      leaseYapistir: vi.fn(),
      yenile: vi.fn(),
    },
  };
  render(
    <ToastSaglayici>
      <SettingsLisans admin />
    </ToastSaglayici>,
  );
};
const kaydet = async () => {
  fireEvent.change(await screen.findByLabelText("Lisans anahtarı"), { target: { value: " FOKLISANS.a.b " } });
  fireEvent.click(screen.getByRole("button", { name: "Anahtarı Kaydet" }));
};

describe("Ayarlar > Lisans — anahtar kaydı", () => {
  it("aktivasyon otomatik başarılıysa 'kaydedildi ve aktive edildi', durum Lisanslı", async () => {
    kur({
      ok: true,
      otomatikAktivasyon: true,
      durum: { mod: "lisansli", firma: "Eyüpspor Kulübü", bitis: null, kalanGun: null, makineId: "M1" },
    });
    await kaydet();
    await screen.findByText("Anahtar kaydedildi ve aktive edildi");
    expect(window.okul.lisans.kaydet).toHaveBeenCalledWith("FOKLISANS.a.b"); // kırpılmış
    expect(screen.getByText("Lisanslı")).toBeInTheDocument();
  });
  it("aktivasyon yapılamazsa anahtar kayıtlı kalır, uyarı toast'ı ne yapılacağını söyler, durum salt okunur + yönlendirme", async () => {
    kur({
      ok: true,
      durum: { mod: "saltOkunur", neden: "aktivasyonGerekli", firma: "Eyüpspor Kulübü", makineId: "M1", kalanGun: 0 },
      uyari:
        'Anahtar kaydedildi ama online aktivasyon yapılamadı: Aktivasyon sunucusuna ulaşılamadı (internet/adres kontrol edin) İnternet bağlantısını kontrol edip "Aktive Et (online)" düğmesine basın; internet yoksa makine kimliğini satıcıya iletip lease alın.',
    });
    await kaydet();
    await screen.findByText(/online aktivasyon yapılamadı/);
    await waitFor(() => expect(screen.getByText("Salt okunur (lisans gerekli)")).toBeInTheDocument());
    expect(screen.getAllByText(/Aktive Et \(online\)/).length).toBeGreaterThanOrEqual(2); // toast + durum kartı yönlendirmesi + düğme
  });
  it("hatalı anahtar: hata toast'ı", async () => {
    kur({ error: "Anahtar imzası geçersiz" });
    await kaydet();
    await screen.findByText("Anahtar imzası geçersiz");
  });
});
