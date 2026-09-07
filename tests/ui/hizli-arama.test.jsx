// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { HizliArama } from "../../src/components/HizliArama.jsx";

afterEach(cleanup);

describe("Hızlı arama (Ctrl+K)", () => {
  it("yazınca arar, ok tuşlarıyla seçer, Enter kartı açar, Makbuz düğmesi tahsilata götürür, Esc kapatır", async () => {
    window.okul = { db: vi.fn(async (fn, a) => (fn === "listPlayersWithDue" && a.q ? [
      { id: 1, ad_soyad: "Kerem Yılmaz", uyruk: "tc", tc_no: "10000000001", yas_grubu_ad: "U12", durum: "aktif", aidat_durum: "odendi" },
      { id: 2, ad_soyad: "Kaan Yıldız", uyruk: "tc", tc_no: "10000000002", yas_grubu_ad: "U11", durum: "aktif", aidat_durum: "odenmedi" },
    ] : [])) };
    const onKapat = vi.fn(), onOyuncu = vi.fn(), onMakbuz = vi.fn();
    render(<HizliArama acik onKapat={onKapat} onOyuncu={onOyuncu} onMakbuz={onMakbuz} />);
    const g = screen.getByLabelText("Oyuncu ara");
    fireEvent.change(g, { target: { value: "K" } });
    await screen.findByText("Kerem Yılmaz");
    expect(screen.getByText("TC 10000000002")).toBeInTheDocument();
    fireEvent.keyDown(g, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(g, { key: "Enter" });
    expect(onOyuncu).toHaveBeenCalledWith(2);
    expect(onKapat).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Kerem Yılmaz makbuz"));
    expect(onMakbuz).toHaveBeenCalledWith(1);
    fireEvent.keyDown(g, { key: "Escape" });
    expect(onKapat).toHaveBeenCalledTimes(3);
  });
  it("kapalıyken hiçbir şey çizmez; sonuç yoksa mesaj", async () => {
    window.okul = { db: vi.fn(async () => []) };
    const { container, rerender } = render(<HizliArama acik={false} onKapat={vi.fn()} onOyuncu={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HizliArama acik onKapat={vi.fn()} onOyuncu={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Oyuncu ara"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText("Oyuncu bulunamadı.")).toBeInTheDocument());
  });
});
