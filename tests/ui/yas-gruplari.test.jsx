// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { YasGruplari } from "../../src/components/YasGruplari.jsx";

afterEach(cleanup);

describe("Yaş Grupları ekranı", () => {
  let gruplar;
  beforeEach(() => {
    gruplar = [{ id: 1, ad: "U11", sezon: "2026-2027", sira: 1, aktif: 1 }];
    window.okul = {
      db: vi.fn(async (fn, ...args) => {
        if (fn === "listAgeGroups") return gruplar;
        if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9, sonGecis: null, adaySayisi: 1 };
        if (fn === "listPlayers")
          return [
            { id: 9, yas_grubu_id: 1, durum: "aktif" },
            { id: 10, yas_grubu_id: 1, durum: "ayrildi" },
          ];
        if (fn === "createAgeGroup") {
          gruplar = [...gruplar, { id: 2, ...args[0], aktif: 1 }];
          return gruplar[1];
        }
        if (fn === "deleteAgeGroup") return { error: "Bu grupta 1 oyuncu var, önce oyuncuları taşıyın" };
        return null;
      }),
    };
  });

  it("grupları ve yalnız aktif oyuncu sayısını listeler", async () => {
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => expect(screen.getByText("U11")).toBeInTheDocument());
    // 2 oyuncudan biri ayrıldı → 1 aktif
    expect(screen.getAllByRole("cell").map((c) => c.textContent)).toContain("1");
  });

  it("yeni grup ekler", async () => {
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    fireEvent.change(screen.getByPlaceholderText("U11"), { target: { value: "U12" } });
    fireEvent.click(screen.getByRole("button", { name: "Grup Ekle" }));
    await waitFor(() => expect(screen.getByText("U12")).toBeInTheDocument());
    expect(window.okul.db).toHaveBeenCalledWith("createAgeGroup", expect.objectContaining({ ad: "U12", sezon: "2026-2027" }));
  });

  it("sezon kutusu aktif sezonla dolu gelir; yalnız aktif/sonraki seçilebilir; ekle sonrası yine aktif sezon (plan §15)", async () => {
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    const kutu = await screen.findByLabelText("Sezon");
    await waitFor(() => expect(kutu).toHaveValue("2026-2027"));
    expect([...kutu.options].map((o) => o.value)).toEqual(["2026-2027", "2027-2028"]);
    fireEvent.change(kutu, { target: { value: "2027-2028" } });
    fireEvent.change(screen.getByPlaceholderText("U11"), { target: { value: "U12" } });
    fireEvent.click(screen.getByRole("button", { name: "Grup Ekle" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("createAgeGroup", expect.objectContaining({ ad: "U12", sezon: "2027-2028" })),
    );
    expect(screen.getByLabelText("Sezon")).toHaveValue("2026-2027"); // aktif sezona döndü
    expect(screen.getByText("(gelecek)")).toBeInTheDocument(); // U12 2027-2028 listede işaretli
  });

  it("düzenlemede eski elle girilmiş sezon üçüncü seçenek olarak korunur", async () => {
    gruplar = [{ id: 1, ad: "U11", sezon: "2026", sira: 1, aktif: 1 }];
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("(eski)"));
    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    const kutu = screen.getAllByLabelText("Sezon").at(-1);
    expect(kutu).toHaveValue("2026");
    expect([...kutu.options].map((o) => o.value)).toEqual(["2026-2027", "2027-2028", "2026"]);
  });

  it("oyuncusu olan grubu silmeye çalışınca hatayı gösterir", async () => {
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("önce oyuncuları taşıyın"));
  });

  it("salt okunur modda ekleme ve silme düğmeleri görünmez", async () => {
    render(
      <ToastSaglayici>
        <YasGruplari saltOkunur />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    expect(screen.queryByRole("button", { name: "Grup Ekle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sil" })).toBeNull();
  });

  it("varsayılan yalnız aktif gruplar; 'Pasif grupları da göster' ile pasifler gelir; rozet tıklayınca durum değişir (plan §17.1)", async () => {
    gruplar = [
      { id: 1, ad: "U11", sezon: "2026-2027", sira: 1, aktif: 1 },
      { id: 2, ad: "U15", sezon: "2025-2026", sira: 2, aktif: 0 },
    ];
    window.okul.db.mockImplementation(async (fn, ...args) => {
      if (fn === "listAgeGroups") return gruplar;
      if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9 };
      if (fn === "updateAgeGroup") {
        gruplar = gruplar.map((g) => (g.id === args[0] ? { ...g, ...args[1] } : g));
        return {};
      }
      return [];
    });
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    expect(screen.queryByText("U15")).toBeNull(); // pasif gizli, oyuncusu olmayan aktif grup görünür
    fireEvent.click(screen.getByLabelText(/Pasif grupları da göster/));
    expect(await screen.findByText("U15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "U15 durum: Pasif" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updateAgeGroup", 2, { aktif: 1 }));
    expect(await screen.findByRole("button", { name: "U15 durum: Aktif" })).toBeInTheDocument();
  });
});
