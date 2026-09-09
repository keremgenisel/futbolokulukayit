// @vitest-environment jsdom
// Raporlar: aylık raporlarda yıl yerine sezon (plan §17.5); yıl sezon + aydan türetilir, oyuncu listesi sezonu süzer.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Raporlar } from "../../src/components/Raporlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Raporlar sezon filtresi", () => {
  beforeEach(() => {
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "sezonDurumu") return { aktifSezon: "2027-2028", baslangicAyi: 9, sonGecis: null, adaySayisi: 0 };
        if (fn === "sezonListesi") return ["2027-2028", "2026-2027"];
        if (fn === "listPlayersWithDue") return [];
        if (fn === "listUnpaid") return [];
        return null;
      }),
      cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) },
      app: { logo: async () => "" },
    };
  });
  it("sezon kutusu aktif sezonla gelir; Eylül → 2027, Ocak → 2028; eski sezon seçilebilir", async () => {
    render(
      <ToastSaglayici>
        <Raporlar />
      </ToastSaglayici>,
    );
    const sezon = await screen.findByLabelText("Sezon");
    await waitFor(() => expect(sezon).toHaveValue("2027-2028"));
    expect([...sezon.options].map((o) => o.value)).toEqual(["2027-2028", "2026-2027"]);
    const ay = screen.getByLabelText("Ay");
    fireEvent.change(ay, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2027, ay: 9, yas_grubu_id: null, sezon: "2027-2028" }),
    );
    expect(await screen.findByText("Eylül 2027 · 2027-2028 sezonu")).toBeInTheDocument();
    fireEvent.change(ay, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2028, ay: 1, yas_grubu_id: null, sezon: "2027-2028" }),
    );
    fireEvent.change(sezon, { target: { value: "2026-2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2027, ay: 1, yas_grubu_id: null, sezon: "2026-2027" }),
    );
  });
});
