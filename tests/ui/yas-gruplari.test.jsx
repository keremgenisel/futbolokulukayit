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
        if (fn === "listAgeGroups")
          return gruplar.filter((g) => !args[0]?.sezon || g.sezon === args[0].sezon || (g.sezonlar || []).includes(args[0].sezon));
        if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9, sonGecis: null, adaySayisi: 1 };
        if (fn === "sezonListesi") return ["2026-2027", "2025-2026"];
        if (fn === "listPlayers")
          return [
            { id: 9, yas_grubu_id: 1, durum: "aktif" },
            { id: 10, yas_grubu_id: 1, durum: "ayrildi" },
          ];
        if (fn === "createAgeGroup") {
          gruplar = [...gruplar, { id: 2, ...args[0], aktif: 1, sezonlar: [args[0].sezon] }];
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
    // Eklenen grup sonraki sezon için: süzgeç o sezona geçer, grup "(gelecek)" notuyla görünür (plan §21)
    await waitFor(() => expect(screen.getByLabelText("Sezon süzgeci")).toHaveValue("2027-2028"));
    expect(await screen.findByText("(gelecek)")).toBeInTheDocument();
  });

  it("düzenlemede eski elle girilmiş sezon üçüncü seçenek olarak korunur", async () => {
    gruplar = [{ id: 1, ad: "U11", sezon: "2026", sira: 1, aktif: 1 }]; // eski biçimli sezon: süzgeçte kendi seçeneğiyle bulunur
    window.okul.db.mockImplementation(async (fn, ...args) => {
      if (fn === "listAgeGroups") return gruplar.filter((g) => g.sezon === args[0].sezon);
      if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9, sonGecis: null, adaySayisi: 1 };
      if (fn === "sezonListesi") return ["2026-2027", "2026"];
      return [];
    });
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByLabelText("Sezon süzgeci"));
    fireEvent.change(screen.getByLabelText("Sezon süzgeci"), { target: { value: "2026" } });
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

  it("sezon süzgeci (plan §21): aktif sezon seçili, 'Tüm sezonlar' yok; eski sezonda da yalnız aktifler, pasifler onay kutusuyla", async () => {
    gruplar = [
      { id: 1, ad: "U11", sezon: "2026-2027", sira: 1, aktif: 1, sezonlar: ["2025-2026", "2026-2027"] },
      { id: 2, ad: "U15", sezon: "2025-2026", sira: 2, aktif: 0, sezonlar: ["2025-2026"] },
      { id: 3, ad: "U9", sezon: "2026-2027", sira: 3, aktif: 1, sezonlar: ["2026-2027"] },
    ];
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("U11"));
    const kutu = screen.getByLabelText("Sezon süzgeci");
    await waitFor(() => expect(kutu).toHaveValue("2026-2027"));
    expect([...kutu.options].map((o) => o.textContent)).toEqual(["2026-2027 (aktif sezon)", "2025-2026"]);
    expect(screen.queryByText("Tüm sezonlar")).toBeNull();
    expect(screen.getByText("U9")).toBeInTheDocument();
    expect(screen.queryByText("U15")).toBeNull(); // 2025-2026 grubu bu sezonda yok
    fireEvent.change(kutu, { target: { value: "2025-2026" } });
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("listAgeGroups", { sezon: "2025-2026" }));
    await waitFor(() => expect(screen.queryByText("U9")).toBeNull());
    expect(screen.getByText("U11")).toBeInTheDocument(); // o sezonda da vardı, aktif
    expect(screen.queryByText("U15")).toBeNull(); // pasif: eski sezonda da varsayılan gizli
    fireEvent.click(screen.getByLabelText(/Pasif grupları da göster \(1\)/));
    expect(await screen.findByText("U15")).toBeInTheDocument();
    expect(screen.getByText(/2 grup/)).toBeInTheDocument();
    expect(window.okul.db).not.toHaveBeenCalledWith("listAgeGroups", { sezon: null });
  });

  it("program editörü (plan §37): başlangıç/bitiş/saha, süre gösterimi, hatalı bitişte Kaydet kapalı; kayıtta bitiş gider, listede aralık", async () => {
    gruplar = [
      { id: 1, ad: "U11", sezon: "2026-2027", sira: 1, aktif: 1, program: JSON.stringify([{ gun: 1, saat: "17:00", saha: "Saha 1" }]) },
    ];
    let yazilan = null;
    const orijinal = window.okul.db;
    window.okul.db = vi.fn(async (fn, ...args) => {
      if (fn === "updateAgeGroup") {
        yazilan = args[1];
        gruplar = gruplar.map((g) => (g.id === args[0] ? { ...g, ...args[1], program: JSON.stringify(args[1].program) } : g));
        return { ok: true, antrenmanGuncellenen: 2 }; // 13.09.2026: programdan açılmış gelecek antrenmanlar eşitlenir
      }
      return orijinal(fn, ...args);
    });
    render(
      <ToastSaglayici>
        <YasGruplari />
      </ToastSaglayici>,
    );
    await screen.findByText("Pzt 17:00");
    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    expect(screen.getByLabelText("Pazartesi saati")).toHaveValue("17:00");
    fireEvent.change(screen.getByLabelText("Pazartesi bitişi"), { target: { value: "16:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Bitiş başlangıçtan sonra olmalı");
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Pazartesi bitişi"), { target: { value: "18:30" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("90 dk")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Çarşamba saati"), { target: { value: "18:00" } }); // bitişsiz gün de geçerli
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(yazilan).not.toBeNull());
    await screen.findByText("Kaydedildi · 2 antrenman yeni programa göre güncellendi (saha/saat)");
    expect(yazilan.program).toEqual([
      { gun: 1, saat: "17:00", bitis: "18:30", saha: "Saha 1" },
      { gun: 3, saat: "18:00", bitis: "", saha: "" },
    ]);
    await screen.findByText("Pzt 17:00–18:30 · Çar 18:00");
  });
});
