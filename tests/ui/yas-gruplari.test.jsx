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
    window.okul = { db: vi.fn(async (fn, ...args) => {
      if (fn === "listAgeGroups") return gruplar;
      if (fn === "listPlayers") return [{ id: 9, yas_grubu_id: 1, durum: "aktif" }, { id: 10, yas_grubu_id: 1, durum: "ayrildi" }];
      if (fn === "createAgeGroup") { gruplar = [...gruplar, { id: 2, ...args[0], aktif: 1 }]; return gruplar[1]; }
      if (fn === "deleteAgeGroup") return { error: "Bu grupta 1 oyuncu var, önce oyuncuları taşıyın" };
      return null;
    }) };
  });

  it("grupları ve yalnız aktif oyuncu sayısını listeler", async () => {
    render(<ToastSaglayici><YasGruplari /></ToastSaglayici>);
    await waitFor(() => expect(screen.getByText("U11")).toBeInTheDocument());
    // 2 oyuncudan biri ayrıldı → 1 aktif
    expect(screen.getAllByRole("cell").map((c) => c.textContent)).toContain("1");
  });

  it("yeni grup ekler", async () => {
    render(<ToastSaglayici><YasGruplari /></ToastSaglayici>);
    await waitFor(() => screen.getByText("U11"));
    fireEvent.change(screen.getByPlaceholderText("U11"), { target: { value: "U12" } });
    fireEvent.click(screen.getByRole("button", { name: "Grup Ekle" }));
    await waitFor(() => expect(screen.getByText("U12")).toBeInTheDocument());
    expect(window.okul.db).toHaveBeenCalledWith("createAgeGroup", expect.objectContaining({ ad: "U12" }));
  });

  it("oyuncusu olan grubu silmeye çalışınca hatayı gösterir", async () => {
    render(<ToastSaglayici><YasGruplari /></ToastSaglayici>);
    await waitFor(() => screen.getByText("U11"));
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("önce oyuncuları taşıyın"));
  });

  it("salt okunur modda ekleme ve silme düğmeleri görünmez", async () => {
    render(<ToastSaglayici><YasGruplari saltOkunur /></ToastSaglayici>);
    await waitFor(() => screen.getByText("U11"));
    expect(screen.queryByRole("button", { name: "Grup Ekle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sil" })).toBeNull();
  });
});
