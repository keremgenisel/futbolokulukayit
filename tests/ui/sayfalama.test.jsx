// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Sayfalama, ToastSaglayici } from "../../src/components/ui.jsx";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { Raporlar } from "../../src/components/Raporlar.jsx";

afterEach(cleanup);

describe("Sayfalama bileşeni", () => {
  it("tek sayfada çizilmez; çok sayfada aralık, sayfa ve düğmeler doğru", () => {
    const { container } = render(<Sayfalama sayfa={1} toplam={40} sayfaBoyu={50} onSayfa={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    const onSayfa = vi.fn();
    render(<Sayfalama sayfa={2} toplam={312} sayfaBoyu={50} onSayfa={onSayfa} birim="oyuncu" />);
    expect(screen.getByText("51–100 / 312 oyuncu")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sayfalama" })).toHaveTextContent("Sayfa 2 / 7");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" })); expect(onSayfa).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Önceki sayfa" })); expect(onSayfa).toHaveBeenCalledWith(1);
    cleanup();
    render(<Sayfalama sayfa={7} toplam={312} sayfaBoyu={50} onSayfa={onSayfa} />);
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeDisabled();
    expect(screen.getByText("301–312 / 312 kayıt")).toBeInTheDocument();
  });
});

describe("Oyuncular: sayfalı liste", () => {
  it("ilk 50 gösterilir, sonraki sayfaya geçilir, filtre değişince 1. sayfaya dönülür, dışa aktarım tam listeyi alır", async () => {
    const hepsi = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, ad_soyad: `Oyuncu ${String(i + 1).padStart(3, "0")}`, uyruk: "tc", tc_no: null, dogum_tarihi: "2015-01-01", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 1, aidat_durum: "odendi" }));
    const cagrilar = [];
    window.okul = {
      db: vi.fn(async (fn, a) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "playersPage") { cagrilar.push(a); const boy = a.sayfaBoyu, s = a.sayfa; const f = a.q ? hepsi.filter((o) => o.ad_soyad.includes(a.q)) : hepsi; return { liste: f.slice((s - 1) * boy, s * boy), toplam: f.length, sayfa: s, sayfaBoyu: boy }; }
        if (fn === "listPlayersWithDue") return hepsi;
        return null;
      }),
      cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) }, app: { logo: async () => "" },
    };
    render(<ToastSaglayici><Oyuncular oturum={{ role: "admin" }} saltOkunur={false} /></ToastSaglayici>);
    await screen.findByText("Oyuncu 001");
    expect(screen.queryByText("Oyuncu 051")).toBeNull();
    expect(screen.getByText("120 oyuncu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    await screen.findByText("Oyuncu 051");
    expect(screen.queryByText("Oyuncu 001")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Ad, soyad/), { target: { value: "Oyuncu 11" } });
    await waitFor(() => expect(screen.getByText("10 oyuncu")).toBeInTheDocument());
    expect(cagrilar.at(-1)).toMatchObject({ q: "Oyuncu 11", sayfa: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(window.okul.cikti.excelKaydet).toHaveBeenCalled());
    expect(window.okul.cikti.excelKaydet.mock.calls[0][0].satirlar).toHaveLength(120);
  });
});

describe("Raporlar: önizleme sayfalı", () => {
  it("250 satırlık rapor önizlemede 100'er gösterilir, Excel tamamını alır", async () => {
    const l = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, ad_soyad: `Rapor Oyuncu ${String(i + 1).padStart(3, "0")}`, uyruk: "tc", dogum_tarihi: "2015-01-01", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 1, aidat_durum: "odendi" }));
    window.okul = { db: vi.fn(async (fn) => (fn === "listAgeGroups" ? [] : fn === "listPlayersWithDue" ? l : null)), cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) }, app: { logo: async () => "" } };
    render(<ToastSaglayici><Raporlar /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await screen.findByText("Rapor Oyuncu 001");
    expect(screen.queryByText("Rapor Oyuncu 101")).toBeNull();
    expect(screen.getByText("1–100 / 250 satır")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("Rapor Oyuncu 101")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("Rapor Oyuncu 250")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(window.okul.cikti.excelKaydet).toHaveBeenCalled());
    expect(window.okul.cikti.excelKaydet.mock.calls[0][0].satirlar).toHaveLength(250);
  });
});
