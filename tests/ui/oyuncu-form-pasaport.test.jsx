// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OyuncuForm } from "../../src/components/OyuncuForm.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Oyuncu formu: yabancı uyruklu / pasaport", () => {
  beforeEach(() => {
    window.okul = { db: vi.fn(async (fn) => {
      if (fn === "aidatAyarlari") return { taban: 0, indirimler: {} };
      if (fn === "createPlayer") return { id: 9 };
      throw new Error("beklenmeyen " + fn);
    }) };
  });
  const kur = () => render(<ToastSaglayici><OyuncuForm gruplar={[]} onKaydedildi={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);

  it("uyruk yabancı seçilince TC alanı yerine pasaport alanı gelir ve zorunludur", async () => {
    kur();
    expect(screen.getByLabelText("TC Kimlik No")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Uyruk"), { target: { value: "yabanci" } });
    expect(screen.queryByLabelText("TC Kimlik No")).toBeNull();
    fireEvent.change(screen.getByLabelText("Adı Soyadı *"), { target: { value: "Ivan Petrov" } });
    fireEvent.change(screen.getByLabelText("Doğum Tarihi *"), { target: { value: "2014-02-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Oyuncuyu Kaydet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("pasaport no zorunlu");
    expect(window.okul.db).not.toHaveBeenCalledWith("createPlayer", expect.anything());
    fireEvent.change(screen.getByLabelText("Pasaport No"), { target: { value: " u 1234567 " } });
    fireEvent.click(screen.getByRole("button", { name: "Oyuncuyu Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("createPlayer", expect.objectContaining({ uyruk: "yabanci", pasaport_no: "U1234567", tc_no: null })));
  });

  it("T.C. vatandaşında TC isteğe bağlı kalır, 11 hane kuralı sürer, pasaport boş gider", async () => {
    kur();
    fireEvent.change(screen.getByLabelText("Adı Soyadı *"), { target: { value: "Ada Kaya" } });
    fireEvent.change(screen.getByLabelText("Doğum Tarihi *"), { target: { value: "2015-01-01" } });
    fireEvent.change(screen.getByLabelText("TC Kimlik No"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Oyuncuyu Kaydet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("11 haneli");
    fireEvent.change(screen.getByLabelText("TC Kimlik No"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Oyuncuyu Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("createPlayer", expect.objectContaining({ uyruk: "tc", tc_no: null, pasaport_no: null })));
  });
});
