// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Ayarlar > Yedekleme: sıklık seçimi", () => {
  it("mevcut sıklık seçili gelir, değiştirince kaydedilir", async () => {
    let siklik = "gunluk";
    const sikliklar = [
      { kod: "acilis", ad: "Her açılışta" },
      { kod: "gunluk", ad: "Günde bir (varsayılan)" },
      { kod: "haftalik", ad: "Haftada bir" },
      { kod: "kapali", ad: "Otomatik yedek kapalı (yalnız elle)" },
    ];
    window.okul = {
      db: vi.fn(async () => null),
      yedek: {
        durum: vi.fn(async () => ({ klasor: "/yedek", son: null, siklik, sikliklar })),
        siklik: vi.fn(async (k) => {
          siklik = k;
          return { ok: true, siklik: k };
        }),
      },
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="yedek" />
      </ToastSaglayici>,
    );
    const secim = await screen.findByLabelText("Otomatik yedekleme sıklığı");
    expect(secim).toHaveValue("gunluk");
    fireEvent.change(secim, { target: { value: "haftalik" } });
    await waitFor(() => expect(window.okul.yedek.siklik).toHaveBeenCalledWith("haftalik"));
    await waitFor(() => expect(screen.getByLabelText("Otomatik yedekleme sıklığı")).toHaveValue("haftalik"));
  });

  it("taşıma paketi: parola doğrulaması, oluşturma; paket seç → parola → özet onayı → geri yükleme", async () => {
    window.okul = {
      db: vi.fn(async () => null),
      yedek: {
        durum: vi.fn(async () => ({ klasor: "/yedek", son: null, siklik: "gunluk", sikliklar: [{ kod: "gunluk", ad: "Günde bir" }] })),
        tasimaOlustur: vi.fn(async () => ({ ok: true, yol: "/x/eyupspor-tasima-1.eyupspor" })),
        tasimaSec: vi.fn(async () => ({ ok: true, yol: "/x/paket.eyupspor" })),
        tasimaBilgi: vi.fn(async (_y, p) =>
          p === "dogru-parola1"
            ? { ok: true, yol: "/x/paket.eyupspor", oyuncu: 42, makbuz: 7, sonMakbuz: "2026-09-05" }
            : { error: "Parola yanlış ya da paket bozuk" },
        ),
        tasimaGeriYukle: vi.fn(async () => ({ ok: true })),
      },
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="yedek" />
      </ToastSaglayici>,
    );
    const p1 = await screen.findByLabelText("Paket parolası");
    fireEvent.change(p1, { target: { value: "kisa" } });
    fireEvent.change(screen.getByLabelText("Paket parolası tekrar"), { target: { value: "kisa" } });
    fireEvent.click(screen.getByRole("button", { name: "Taşıma Paketi Oluştur" }));
    expect(await screen.findByText("Parola en az 10 karakter olmalı")).toBeInTheDocument();
    fireEvent.change(p1, { target: { value: "cok-gizli-1" } });
    fireEvent.change(screen.getByLabelText("Paket parolası tekrar"), { target: { value: "cok-gizli-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Taşıma Paketi Oluştur" }));
    expect(await screen.findByText("Parolalar aynı değil")).toBeInTheDocument();
    expect(window.okul.yedek.tasimaOlustur).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Paket parolası tekrar"), { target: { value: "cok-gizli-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Taşıma Paketi Oluştur" }));
    await waitFor(() => expect(window.okul.yedek.tasimaOlustur).toHaveBeenCalledWith("cok-gizli-1"));
    expect(await screen.findByText(/Taşıma paketi kaydedildi/)).toBeInTheDocument();
    // Geri yükleme
    fireEvent.click(screen.getByRole("button", { name: "Paket Dosyası Seç" }));
    expect(await screen.findByText("paket.eyupspor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Geri yükleme parolası"), { target: { value: "yanlis" } });
    fireEvent.click(screen.getByRole("button", { name: "Paketi Aç ve Geri Yükle" }));
    expect(await screen.findByText("Parola yanlış ya da paket bozuk")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Geri yükleme parolası"), { target: { value: "dogru-parola1" } });
    fireEvent.click(screen.getByRole("button", { name: "Paketi Aç ve Geri Yükle" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("42 oyuncu, 7 makbuz, son makbuz 05.09.2026");
    fireEvent.click(within(dlg).getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(window.okul.yedek.tasimaGeriYukle).toHaveBeenCalledWith("/x/paket.eyupspor", "dogru-parola1"));
  });
});
