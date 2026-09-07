// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { YasGruplari } from "../../src/components/YasGruplari.jsx";
import { Yoklama } from "../../src/components/Yoklama.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { bugun } from "../../src/lib/api.js";
import { haftaBasi } from "../../src/lib/takvim.js";

afterEach(cleanup);

describe("Yaş grupları: haftalık program", () => {
  it("özet görünür; düzenlemede gün saati girilip kaydedilince program gönderilir", async () => {
    const gruplar = [{ id: 1, ad: "U11", sezon: "2026-2027", sira: 1, aktif: 1, program: '[{"gun":1,"saat":"17:00","saha":"Saha 1"}]' }];
    window.okul = { db: vi.fn(async (fn) => (fn === "listAgeGroups" ? gruplar : fn === "listPlayers" ? [] : fn === "updateAgeGroup" ? {} : null)) };
    render(<ToastSaglayici><YasGruplari saltOkunur={false} /></ToastSaglayici>);
    await screen.findByText("Pzt 17:00");
    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    expect(screen.getByLabelText("Pazartesi saati")).toHaveValue("17:00");
    fireEvent.change(screen.getByLabelText("Çarşamba saati"), { target: { value: "18:30" } });
    fireEvent.change(screen.getByLabelText("Çarşamba sahası"), { target: { value: "Saha 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updateAgeGroup", 1, expect.objectContaining({ program: [{ gun: 1, saat: "17:00", saha: "Saha 1" }, { gun: 3, saat: "18:30", saha: "Saha 2" }] })));
  });
});

describe("Yoklama: haftayı programdan doldur", () => {
  it("düğme haftanın pazartesisiyle çağrı yapar ve sonucu bildirir", async () => {
    const t = bugun().iso;
    window.okul = { db: vi.fn(async (fn) => {
      if (fn === "listAgeGroups") return [{ id: 1, ad: "U11", aktif: 1 }];
      if (fn === "trainingCalendar") return [];
      if (fn === "haftayiProgramdanDoldur") return { ok: true, eklenen: 2, atlanan: 1, programsiz: 0 };
      return [];
    }) };
    render(<ToastSaglayici><Yoklama saltOkunur={false} /></ToastSaglayici>);
    fireEvent.click(await screen.findByRole("button", { name: "Haftayı Programdan Doldur" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("haftayiProgramdanDoldur", haftaBasi(t)));
    await screen.findByText("2 antrenman eklendi, 1 zaten vardı");
  });
});
