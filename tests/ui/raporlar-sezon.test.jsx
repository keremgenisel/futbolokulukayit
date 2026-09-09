// @vitest-environment jsdom
// Raporlar: Sezon + Ay (Tümü) süzgeci dört raporda (plan §17.5, §19); yıl sezon + aydan türetilir.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Raporlar } from "../../src/components/Raporlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

const rapor = (ad) => fireEvent.click(screen.getByRole("button", { name: new RegExp(ad) }));
const onizle = () => fireEvent.click(screen.getByRole("button", { name: "Önizle" }));

describe("Raporlar sezon + ay filtresi", () => {
  beforeEach(() => {
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "sezonDurumu") return { aktifSezon: "2027-2028", baslangicAyi: 9, sonGecis: null, adaySayisi: 0 };
        if (fn === "sezonListesi") return ["2027-2028", "2026-2027"];
        if (
          fn === "listPlayersWithDue" ||
          fn === "listUnpaid" ||
          fn === "listUnpaidSezon" ||
          fn === "attendanceReport" ||
          fn === "saglikRaporuListesi"
        )
          return [];
        if (fn === "sezonAidatOzeti") return {};
        return null;
      }),
      cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) },
      app: { logo: async () => "" },
    };
  });
  const ac = () =>
    render(
      <ToastSaglayici>
        <Raporlar />
      </ToastSaglayici>,
    );

  it("oyuncu listesi: sezon aktif gelir; ay listesi sezon sırasında ve 'Tümü' var; Eylül → 2027, Ocak → 2028; eski sezon seçilebilir", async () => {
    ac();
    const sezon = await screen.findByLabelText("Sezon");
    await waitFor(() => expect(sezon).toHaveValue("2027-2028"));
    expect([...sezon.options].map((o) => o.value)).toEqual(["2027-2028", "2026-2027"]);
    const ay = screen.getByLabelText("Ay");
    expect([...ay.options].map((o) => o.textContent).slice(0, 3)).toEqual(["Tümü", "Eylül 2027", "Ekim 2027"]);
    expect([...ay.options].at(-1).textContent).toBe("Ağustos 2028");
    fireEvent.change(ay, { target: { value: "9" } });
    onizle();
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2027, ay: 9, yas_grubu_id: null, sezon: "2027-2028" }),
    );
    expect(await screen.findByText("Eylül 2027 · 2027-2028 sezonu")).toBeInTheDocument();
    fireEvent.change(ay, { target: { value: "1" } });
    onizle();
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2028, ay: 1, yas_grubu_id: null, sezon: "2027-2028" }),
    );
    fireEvent.change(sezon, { target: { value: "2026-2027" } });
    onizle();
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("listPlayersWithDue", { yil: 2027, ay: 1, yas_grubu_id: null, sezon: "2026-2027" }),
    );
  });

  it("Ay: Tümü — oyuncu listesi sezon özeti ister, borçlu listesi sezon borçlularını ister", async () => {
    ac();
    await waitFor(() => expect(screen.getByLabelText("Sezon")).toHaveValue("2027-2028"));
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("sezonAidatOzeti", "2027-2028", 9));
    expect(await screen.findByText("2027-2028 sezonu (tüm aylar)")).toBeInTheDocument();
    rapor("Borçlu Listesi");
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("listUnpaidSezon", "2027-2028", 9));
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "10" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("listUnpaid", 2027, 10, "2027-2028"));
  });

  it("yoklama özeti: sezon + ay varsayılan (Tümü → sezon aralığı, ay → o ay), tarih aralığı seçeneği duruyor", async () => {
    ac();
    await waitFor(() => expect(screen.getByLabelText("Sezon")).toHaveValue("2027-2028"));
    rapor("Yoklama Özeti");
    expect(screen.getByLabelText("Dönem seçimi")).toHaveValue("sezon");
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("attendanceReport", "2027-09-01", "2028-08-31", null, "2027-2028"));
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "10" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("attendanceReport", "2027-10-01", "2027-10-31", null, "2027-2028"));
    fireEvent.change(screen.getByLabelText("Dönem seçimi"), { target: { value: "tarih" } });
    expect(screen.queryByLabelText("Sezon")).toBeNull();
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("attendanceReport", expect.any(String), expect.any(String), null));
  });

  it("sağlık raporu: Tümü → bugün, ay → ayın son günü; sezon oyuncu kümesi", async () => {
    ac();
    await waitFor(() => expect(screen.getByLabelText("Sezon")).toHaveValue("2027-2028"));
    rapor("Sağlık Raporu Durumu");
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "" } });
    onizle();
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith(
        "saglikRaporuListesi",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        null,
        30,
        "2027-2028",
      ),
    );
    fireEvent.change(screen.getByLabelText("Ay"), { target: { value: "10" } });
    onizle();
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("saglikRaporuListesi", "2027-10-31", null, 30, "2027-2028"));
    expect(await screen.findByText(/31\.10\.2027 itibarıyla · 2027-2028 sezonu/)).toBeInTheDocument();
  });
});
