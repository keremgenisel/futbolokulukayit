// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { GuncellemeSeridi } from "../../src/components/GuncellemeSeridi.jsx";

afterEach(cleanup);

function kopru() {
  const dinleyenler = {};
  const u = {
    check: vi.fn(),
    download: vi.fn(async () => ({ ok: true })),
    install: vi.fn(async () => ({ ok: true })),
    on: vi.fn((olay, cb) => {
      dinleyenler[olay] = cb;
      return () => {
        delete dinleyenler[olay];
      };
    }),
  };
  window.okul = { updater: u };
  return {
    u,
    yay: (olay, v) =>
      act(() => {
        dinleyenler[olay]?.(v);
      }),
  };
}
const admin = { role: "admin", username: "admin" };

describe("Uygulama güncelleme şeridi (en üstte)", () => {
  it("yeni sürüm bulununca yöneticiye çıkar: İndir → ilerleme → Yeniden Başlat ve Kur; Hakkında bağlantısı; Kapat gizler", async () => {
    const { u, yay } = kopru();
    const onHakkinda = vi.fn();
    render(<GuncellemeSeridi oturum={admin} onHakkinda={onHakkinda} />);
    expect(screen.queryByTestId("guncelleme-seridi")).toBeNull(); // sürüm yokken çizilmez
    yay("available", { version: "1.2.0" });
    expect(screen.getByRole("status")).toHaveTextContent("Yeni sürüm 1.2.0 hazır.");
    fireEvent.click(screen.getByRole("button", { name: "Hakkında" }));
    expect(onHakkinda).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "İndir" }));
    await waitFor(() => expect(u.download).toHaveBeenCalled());
    yay("progress", 40);
    expect(screen.getByRole("status")).toHaveTextContent("indiriliyor… %40");
    yay("available", { version: "1.2.0" }); // indirme sürerken tekrar gelen olay durumu bozmaz
    expect(screen.getByRole("status")).toHaveTextContent("%40");
    yay("downloaded", { version: "1.2.0" });
    expect(screen.getByRole("status")).toHaveTextContent("Yeni sürüm 1.2.0 indirildi.");
    fireEvent.click(screen.getByRole("button", { name: "Yeniden Başlat ve Kur" }));
    await waitFor(() => expect(u.install).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme şeridini kapat" }));
    expect(screen.queryByTestId("guncelleme-seridi")).toBeNull();
  });

  it("indirme hatası kırmızı şeritte 'Yeniden Dene' ile; kullanıcı rolüne hiç çıkmaz; güncelleyici yoksa çizilmez", async () => {
    const { u, yay } = kopru();
    u.download = vi.fn(async () => ({ error: "Ağ yok" }));
    render(<GuncellemeSeridi oturum={admin} />);
    yay("available", { version: "1.2.0" });
    fireEvent.click(screen.getByRole("button", { name: "İndir" }));
    expect(await screen.findByText(/Güncelleme başarısız/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ağ yok");
    expect(screen.getByRole("status")).toHaveStyle({ background: "var(--kirmizi)" });
    expect(screen.getByRole("button", { name: "Yeniden Dene" })).toBeInTheDocument();
    cleanup();
    const k2 = kopru();
    render(<GuncellemeSeridi oturum={{ role: "kullanici" }} />);
    k2.yay("available", { version: "1.2.0" });
    expect(screen.queryByTestId("guncelleme-seridi")).toBeNull();
    cleanup();
    window.okul = {};
    render(<GuncellemeSeridi oturum={admin} />);
    expect(screen.queryByTestId("guncelleme-seridi")).toBeNull();
  });
});
