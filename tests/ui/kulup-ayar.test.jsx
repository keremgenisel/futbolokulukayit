// @vitest-environment jsdom
// Ayarlar > Kulüp ve Makbuz (plan §32.6): alanlar yüklenir, tek Kaydet yalnız değişenleri yazar ve markayı yeniler, Vazgeç geri
// alır, palet kartı tema alanlarını değiştirir, Logo Seç dosya kanalını çağırıp anında yeniler, Kaldır logoyu siler.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { KulupAyar } from "../../src/components/ayarlar/KulupAyar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

function kur(ayar = {}, marka = { logo: "" }) {
  const ayarlar = { kulup_adi: "Anadolu SK Futbol Okulu", kurulus_yili: "1974", ...ayar };
  const dbMock = vi.fn(async (fn, k, v) => {
    if (fn === "getSetting") return ayarlar[k] || "";
    if (fn === "setSetting") {
      ayarlar[k] = v;
      return { ok: true };
    }
    return null;
  });
  const m = { ...marka };
  const kulupLogoSec = vi.fn(async () => {
    m.logo = "data:image/png;base64,WUVOSQ==";
    return { ok: true, yol: "kulup/logo.png" };
  });
  const kulupLogoSil = vi.fn(async () => {
    m.logo = "";
    return { ok: true };
  });
  window.okul = { db: dbMock, files: { kulupLogoSec, kulupLogoSil }, app: { marka: vi.fn(async () => ({ ...m })) } };
  const onMarkaDegisti = vi.fn();
  render(
    <ToastSaglayici>
      <KulupAyar saltOkunur={false} admin onKirli={vi.fn()} onMarkaDegisti={onMarkaDegisti} />
    </ToastSaglayici>,
  );
  return { ayarlar, dbMock, kulupLogoSec, kulupLogoSil, onMarkaDegisti };
}

describe("KulupAyar", () => {
  it("alanları yükler; Kaydet yalnız değişenleri yazar, markayı yeniler; Vazgeç geri alır", async () => {
    const { ayarlar, dbMock, onMarkaDegisti } = kur();
    expect(await screen.findByLabelText("Kulüp adı")).toHaveValue("Anadolu SK Futbol Okulu");
    expect(screen.getByLabelText("Kuruluş yılı")).toHaveValue("1974");
    expect(screen.getByText("Logo yok")).toBeInTheDocument();
    const kaydet = screen.getByRole("button", { name: "Kaydet" });
    expect(kaydet).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Kısa ad"), { target: { value: "ANADOLU SK" } });
    expect(kaydet).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(screen.getByLabelText("Kısa ad")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Kısa ad"), { target: { value: "ANADOLU SK" } });
    fireEvent.change(screen.getByLabelText("Kuruluş yılı"), { target: { value: "1975" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(ayarlar.kulup_kisa_ad).toBe("ANADOLU SK"));
    expect(ayarlar.kurulus_yili).toBe("1975");
    expect(dbMock).not.toHaveBeenCalledWith("setSetting", "kulup_adi", expect.anything()); // değişmedi → yazılmadı
    expect(onMarkaDegisti).toHaveBeenCalled();
    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
  });

  it("palet kartı seçince tema alanları değişir ve Kaydet ile tema_ana/tema_vurgu yazılır; önizleme rengi seçileni gösterir", async () => {
    const { ayarlar } = kur();
    await screen.findByLabelText("Kulüp adı");
    fireEvent.click(screen.getByRole("button", { name: "Palet: Kırmızı · Beyaz" }));
    expect(screen.getByRole("button", { name: "Palet: Kırmızı · Beyaz" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Ana renk (özel)")).toHaveValue("#c8102e");
    const onizleme = screen.getByTestId("tema-onizleme");
    expect(onizleme.firstChild.style.background).toBe("rgb(200, 16, 46)");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(ayarlar.tema_ana).toBe("#c8102e"));
    expect(ayarlar.tema_vurgu).toBe("#ffffff");
  });

  it("açık ana renk seçilince kontrast uyarısı çıkar", async () => {
    kur();
    await screen.findByLabelText("Kulüp adı");
    fireEvent.change(screen.getByLabelText("Ana renk (özel)"), { target: { value: "#f5d000" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Ana renk açık/);
  });

  it("Logo Seç: dosya kanalı çağrılır, önizleme ve logodan renk önerisi gelir, marka yenilenir; Kaldır logoyu siler", async () => {
    const { kulupLogoSec, kulupLogoSil, onMarkaDegisti } = kur();
    await screen.findByLabelText("Kulüp adı");
    fireEvent.click(screen.getByRole("button", { name: /Logo Seç/ }));
    await waitFor(() => expect(kulupLogoSec).toHaveBeenCalled());
    expect(await screen.findByAltText("Kulüp logosu")).toBeInTheDocument();
    expect(onMarkaDegisti).toHaveBeenCalled();
    expect(await screen.findByText("Logo kaydedildi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kaldır" }));
    await waitFor(() => expect(kulupLogoSil).toHaveBeenCalled());
    expect(await screen.findByText("Logo yok")).toBeInTheDocument();
  });

  it("logo seçmek ve kaldırmak kaydedilmemiş alanları SİLMEZ (hata raporu 10.09.2026)", async () => {
    const { kulupLogoSec, kulupLogoSil, dbMock } = kur();
    await screen.findByLabelText("Kulüp adı");
    fireEvent.change(screen.getByLabelText("Kulüp adı"), { target: { value: "Yeni Kulüp" } });
    fireEvent.change(screen.getByLabelText("Kısa ad"), { target: { value: "YENİ" } });
    fireEvent.change(screen.getByLabelText("Kuruluş yılı"), { target: { value: "1999" } });
    fireEvent.change(screen.getByLabelText("Menü alt yazısı"), { target: { value: "Akademi" } });
    fireEvent.change(screen.getByLabelText("Tahsil eden"), { target: { value: "Ali" } });
    fireEvent.click(screen.getByRole("button", { name: "Palet: Yeşil · Beyaz" }));
    fireEvent.click(screen.getByRole("button", { name: /Logo Seç/ }));
    await waitFor(() => expect(kulupLogoSec).toHaveBeenCalled());
    expect(await screen.findByAltText("Kulüp logosu")).toBeInTheDocument();
    expect(screen.getByLabelText("Kulüp adı")).toHaveValue("Yeni Kulüp");
    expect(screen.getByLabelText("Kısa ad")).toHaveValue("YENİ");
    expect(screen.getByLabelText("Kuruluş yılı")).toHaveValue("1999");
    expect(screen.getByLabelText("Menü alt yazısı")).toHaveValue("Akademi");
    expect(screen.getByLabelText("Tahsil eden")).toHaveValue("Ali");
    expect(screen.getByLabelText("Ana renk (özel)")).toHaveValue("#0f7b3e");
    fireEvent.click(screen.getByRole("button", { name: "Kaldır" }));
    await waitFor(() => expect(kulupLogoSil).toHaveBeenCalled());
    expect(screen.getByLabelText("Kısa ad")).toHaveValue("YENİ");
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeEnabled();
    expect(dbMock).not.toHaveBeenCalledWith("setSetting", expect.anything(), expect.anything()); // logo işlemi alanları yazmaz
  });

  it("iptal edilen logo seçimi hiçbir şey değiştirmez; hata toast'a düşer", async () => {
    const { kulupLogoSec, onMarkaDegisti } = kur();
    await screen.findByLabelText("Kulüp adı");
    kulupLogoSec.mockResolvedValueOnce({ iptal: true });
    fireEvent.click(screen.getByRole("button", { name: /Logo Seç/ }));
    await waitFor(() => expect(kulupLogoSec).toHaveBeenCalledTimes(1));
    expect(onMarkaDegisti).not.toHaveBeenCalled();
    kulupLogoSec.mockRejectedValueOnce(new Error("Logo PNG ya da JPEG olmalı"));
    fireEvent.click(screen.getByRole("button", { name: /Logo Seç/ }));
    expect(await screen.findByText(/PNG ya da JPEG/)).toBeInTheDocument();
  });

  it("yönetici olmayan ya da salt okunur: alanlar kilitli, düğmeler yok", async () => {
    window.okul = { db: vi.fn(async () => ""), files: {}, app: { marka: vi.fn(async () => ({ logo: "" })) } };
    render(
      <ToastSaglayici>
        <KulupAyar saltOkunur={false} admin={false} />
      </ToastSaglayici>,
    );
    expect(await screen.findByLabelText("Kulüp adı")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Logo Seç/ })).toBeNull();
  });
});
