// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Ayarlar > Yedekleme: sıklık seçimi", () => {
  it("mevcut sıklık seçili gelir, değiştirince kaydedilir", async () => {
    let siklik = "gunluk";
    const sikliklar = [{ kod: "acilis", ad: "Her açılışta" }, { kod: "gunluk", ad: "Günde bir (varsayılan)" }, { kod: "haftalik", ad: "Haftada bir" }, { kod: "kapali", ad: "Otomatik yedek kapalı (yalnız elle)" }];
    window.okul = {
      db: vi.fn(async () => null),
      yedek: { durum: vi.fn(async () => ({ klasor: "/yedek", son: null, siklik, sikliklar })), siklik: vi.fn(async (k) => { siklik = k; return { ok: true, siklik: k }; }) },
      app: { version: async () => "0.1.0" }, lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) }, mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(<ToastSaglayici><Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="yedek" /></ToastSaglayici>);
    const secim = await screen.findByLabelText("Otomatik yedekleme sıklığı");
    expect(secim).toHaveValue("gunluk");
    fireEvent.change(secim, { target: { value: "haftalik" } });
    await waitFor(() => expect(window.okul.yedek.siklik).toHaveBeenCalledWith("haftalik"));
    await waitFor(() => expect(screen.getByLabelText("Otomatik yedekleme sıklığı")).toHaveValue("haftalik"));
  });
});
