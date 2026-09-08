// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { Guncelleme } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

function kopru(check) {
  const dinleyenler = {};
  const u = { check: vi.fn(check), download: vi.fn(async () => ({ ok: true })), install: vi.fn(async () => ({ ok: true })), on: vi.fn((olay, cb) => { dinleyenler[olay] = cb; return () => { delete dinleyenler[olay]; }; }) };
  window.okul = { updater: u, app: { version: async () => "1.0.0" } };
  return { u, yay: (olay, v) => act(() => { dinleyenler[olay]?.(v); }) };
}

describe("Ayarlar > Hakkında > Uygulama güncellemesi", () => {
  it("geliştirme modunda bilgi verir; güncelse 'Güncel'", async () => {
    kopru(async () => ({ devMode: true, current: "1.0.0" }));
    render(<ToastSaglayici><Guncelleme admin /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme Denetle" }));
    expect(await screen.findByText(/Geliştirme modunda güncelleme denetlenmez/)).toBeInTheDocument();
    cleanup();
    kopru(async () => ({ current: "1.0.0", latest: "1.0.0", available: false }));
    render(<ToastSaglayici><Guncelleme admin /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme Denetle" }));
    expect(await screen.findByText("Güncel")).toBeInTheDocument();
  });
  it("yeni sürüm: İndir → ilerleme → İndirildi → Yeniden Başlat ve Kur; kullanıcı rolünde İndir yok", async () => {
    const { u, yay } = kopru(async () => ({ current: "1.0.0", latest: "1.1.0", available: true, notlar: "WhatsApp hatırlatma eklendi" }));
    render(<ToastSaglayici><Guncelleme admin /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme Denetle" }));
    expect(await screen.findByText("Yeni sürüm 1.1.0")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp hatırlatma eklendi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "İndir" }));
    await waitFor(() => expect(u.download).toHaveBeenCalled());
    yay("progress", 42);
    expect(screen.getByRole("status")).toHaveTextContent("%42");
    yay("downloaded", { version: "1.1.0" });
    expect(await screen.findByText("İndirildi · 1.1.0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yeniden Başlat ve Kur" }));
    await waitFor(() => expect(u.install).toHaveBeenCalled());
    cleanup();
    kopru(async () => ({ current: "1.0.0", latest: "1.1.0", available: true }));
    render(<ToastSaglayici><Guncelleme admin={false} /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme Denetle" }));
    await screen.findByText("Yeni sürüm 1.1.0");
    expect(screen.queryByRole("button", { name: "İndir" })).toBeNull();
    expect(screen.getByText(/yönetici girişi gerekir/)).toBeInTheDocument();
  });
  it("sunucuya erişilemezse hata ve 'Tekrar dene'; olay dinleyicileri unmount'ta bırakılır", async () => {
    const { u } = kopru(async () => ({ error: "Güncelleme sunucusuna erişilemedi: ENOTFOUND" }));
    const { unmount } = render(<ToastSaglayici><Guncelleme admin /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Güncelleme Denetle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("erişilemedi");
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(u.on).toHaveBeenCalledTimes(4);
    unmount();
  });
});
