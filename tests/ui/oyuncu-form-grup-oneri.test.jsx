// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OyuncuForm } from "../../src/components/OyuncuForm.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Oyuncu formu: yaş grubu ipucu, kalabalık yılda alt gruplar", () => {
  beforeEach(() => {
    window.okul = { db: vi.fn(async (fn) => {
      if (fn === "aidatAyarlari") return { taban: 0, indirimler: {}, sezon: "2026-2027" };
      throw new Error("beklenmeyen " + fn);
    }) };
  });
  const gruplar = [{ id: 1, ad: "U11 A", aktif: 1 }, { id: 2, ad: "U11 B", aktif: 1 }, { id: 3, ad: "U12", aktif: 1 }];
  const kur = () => render(<ToastSaglayici><OyuncuForm gruplar={gruplar} onKaydedildi={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);

  it("U11 yoksa 'U11 A seç' ve 'U11 B seç' bağlantıları çıkar; seçilen bağlantı kaybolur", async () => {
    kur();
    await screen.findByLabelText("Yaş grubu");
    fireEvent.change(screen.getByLabelText("Doğum Tarihi *"), { target: { value: "2016-03-03" } });
    expect(screen.getByText("U11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "U11 B seç" }));
    expect(screen.getByLabelText("Yaş grubu")).toHaveValue("2");
    expect(screen.queryByRole("button", { name: "U11 B seç" })).toBeNull();
    expect(screen.getByRole("button", { name: "U11 A seç" })).toBeInTheDocument();
  });

  it("tek eşleşen grupta tek bağlantı çıkar", async () => {
    kur();
    await screen.findByLabelText("Yaş grubu");
    fireEvent.change(screen.getByLabelText("Doğum Tarihi *"), { target: { value: "2015-03-03" } });
    expect(screen.getByRole("button", { name: "U12 seç" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /U11/ })).toBeNull();
  });
});
