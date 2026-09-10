// @vitest-environment jsdom
// Giriş ekranı ve kenar menü markası (plan §32.5): kulüp logosu varsa uygulama logosunun yerine, kısa ad, kuruluş yılı; marka
// yoksa uygulama varsayılanları (Futbol Okulu, kuruluş satırı yok). Tema CSS değişkenleri temaUygula ile köke yazılır.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Giris } from "../../src/components/Giris.jsx";
import { KenarMenu } from "../../src/components/KenarMenu.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { temaUygula } from "../../src/lib/temaUygula.js";

afterEach(cleanup);
const LOGO = "data:image/png;base64,S1VMVVA=";

describe("Giriş ekranı markası", () => {
  it("kulüp logosu + kısa ad + kuruluş yılı", () => {
    window.okul = { auth: { login: vi.fn() } };
    render(
      <ToastSaglayici>
        <Giris onGiris={vi.fn()} mod={null} onModDegisti={vi.fn()} marka={{ kisaAd: "Anadolu SK", kurulusYili: "1974", logo: LOGO }} />
      </ToastSaglayici>,
    );
    const img = screen.getByAltText("ANADOLU SK");
    expect(img).toHaveAttribute("src", LOGO);
    expect(img).toHaveAttribute("data-kulup-logo", "1");
    expect(screen.getByText("ANADOLU SK")).toBeInTheDocument();
    expect(screen.getByText("Kuruluş 1974")).toBeInTheDocument();
  });
  it("marka yokken uygulama logosu, 'FUTBOL OKULU', kuruluş satırı yok; kuruluş boşsa da satır yok", () => {
    window.okul = { auth: { login: vi.fn() } };
    const { unmount } = render(
      <ToastSaglayici>
        <Giris onGiris={vi.fn()} mod={null} onModDegisti={vi.fn()} marka={null} />
      </ToastSaglayici>,
    );
    expect(screen.getByAltText("Futbol Okulu Kayıt Programı")).toHaveAttribute("src", "./logo.png");
    expect(screen.getByText("FUTBOL OKULU")).toBeInTheDocument();
    expect(screen.queryByText(/Kuruluş/)).toBeNull();
    unmount();
    render(
      <ToastSaglayici>
        <Giris onGiris={vi.fn()} mod={null} onModDegisti={vi.fn()} marka={{ kisaAd: "X", kurulusYili: "", logo: "" }} />
      </ToastSaglayici>,
    );
    expect(screen.queryByText(/Kuruluş/)).toBeNull();
  });
});

describe("Kenar menü markası", () => {
  const sekmeler = [{ kod: "pano", ad: "Pano" }];
  it("kulüp logosu, kısa ad ve alt yazı; uzun kısa ad küçük puntoyla sığar", () => {
    render(
      <KenarMenu
        sekmeler={sekmeler}
        tab="pano"
        onSec={vi.fn()}
        oturum={{ ad_soyad: "Yönetici", role: "admin" }}
        mod={null}
        onCikis={vi.fn()}
        marka={{ kisaAd: "Anadolu Spor Kulübü", altYazi: "Futbol Okulu", logo: LOGO }}
      />,
    );
    expect(document.querySelector('img[data-kulup-logo="1"]')).toHaveAttribute("src", LOGO);
    const ad = screen.getByText("ANADOLU SPOR KULÜBÜ");
    expect(ad.style.fontSize).toBe("16px");
    expect(screen.getByText("Futbol Okulu")).toBeInTheDocument();
  });
  it("marka yokken uygulama logosu ve 'FUTBOL OKULU / Kayıt Programı'", () => {
    render(
      <KenarMenu sekmeler={sekmeler} tab="pano" onSec={vi.fn()} oturum={{ role: "admin" }} mod={null} onCikis={vi.fn()} marka={null} />,
    );
    expect(document.querySelector('img[data-kulup-logo="0"]')).toHaveAttribute("src", "./logo.png");
    expect(screen.getByText("FUTBOL OKULU")).toBeInTheDocument();
    expect(screen.getByText("Kayıt Programı")).toBeInTheDocument();
  });
});

describe("temaUygula", () => {
  it("CSS değişkenlerini köke yazar; açık ana renkte --ana-ustu koyu olur", () => {
    const t = temaUygula({ ana: "#1f3a93", vurgu: "#f58220" });
    const s = document.documentElement.style;
    expect(s.getPropertyValue("--mor")).toBe("#1f3a93");
    expect(s.getPropertyValue("--sari")).toBe("#f58220");
    expect(s.getPropertyValue("--mor-koyu")).toBe(t.morKoyu);
    expect(s.getPropertyValue("--ana-ustu")).toBe("#ffffff");
    temaUygula({ ana: "#f5d000", vurgu: "#5b2d8e" });
    expect(s.getPropertyValue("--ana-ustu")).toBe("#1b1530");
    temaUygula({}); // varsayılana dön
    expect(s.getPropertyValue("--mor")).toBe("#5b2d8e");
  });
});
