// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Yoklama } from "../../src/components/Yoklama.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { bugun } from "../../src/lib/api.js";

afterEach(cleanup);

describe("Yoklama ekranı (takvim şeridi)", () => {
  let antrenmanlar;
  beforeEach(() => {
    const t = bugun().iso;
    antrenmanlar = [{ id: 5, age_group_id: 1, tarih: t, saat: "17:00", saha: "Saha 1", iptal: 0, yas_grubu_ad: "U11", oyuncu: 2, isaretli: 0, geldi: 0 }];
    window.okul = { db: vi.fn(async (fn, ...args) => {
      if (fn === "listAgeGroups") return [{ id: 1, ad: "U11", aktif: 1 }];
      if (fn === "trainingCalendar") return antrenmanlar;
      if (fn === "listPlayersWithDue") return [{ id: 10, ad_soyad: "Ada Kaya", durum: "aktif", aidat_durum: "odendi" }, { id: 11, ad_soyad: "Barış Güneş", durum: "aktif", aidat_durum: "odenmedi" }];
      if (fn === "listAttendance") return [];
      if (fn === "setAttendance") { antrenmanlar[0].isaretli += 1; return {}; }
      if (fn === "createTraining") { const y = { id: 6, ...args[0], iptal: 0, yas_grubu_ad: "U11", oyuncu: 2, isaretli: 0, geldi: 0 }; antrenmanlar.push(y); return y; }
      throw new Error("beklenmeyen çağrı " + fn);
    }) };
  });
  const kur = () => render(<ToastSaglayici><Yoklama saltOkunur={false} /></ToastSaglayici>);

  it("bugünün antrenmanı kart olarak gelir; seçince oyuncu listesi ve işaretleme çalışır, kart sayacı güncellenir", async () => {
    kur();
    const kart = await screen.findByRole("button", { name: /U11 · 17:00/ });
    expect(kart).toHaveTextContent("0/2 işaretli");
    fireEvent.click(kart);
    await screen.findByText("Ada Kaya");
    expect(screen.getByText("Barış Güneş").parentElement).toHaveTextContent("Aidat");
    const geldi = screen.getAllByRole("button", { name: "Geldi" })[0];
    fireEvent.click(geldi);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("setAttendance", 5, 10, "geldi"));
    await waitFor(() => expect(screen.getByRole("button", { name: /U11 · 17:00/ })).toHaveTextContent("1/2 işaretli"));
  });

  it("başka güne geçince 'antrenman yok' görünür; satır içi formla antrenman eklenir ve seçili gelir", async () => {
    kur();
    await screen.findByRole("button", { name: /U11 · 17:00/ });
    fireEvent.keyDown(screen.getByLabelText("Gün şeridi"), { key: "ArrowRight" });
    await screen.findByText(/Bu tarihte antrenman yok/);
    fireEvent.click(screen.getByRole("button", { name: "Antrenman Ekle" }));
    fireEvent.change(screen.getByLabelText("Yaş grubu"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Saat"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("createTraining", expect.objectContaining({ age_group_id: 1, saat: "18:30" })));
    const yeni = await screen.findByRole("button", { name: /U11 · 18:30/ });
    await waitFor(() => expect(yeni).toHaveAttribute("aria-pressed", "true"));
  });

  it("salt okunur modda ekleme düğmesi yok", async () => {
    render(<ToastSaglayici><Yoklama saltOkunur /></ToastSaglayici>);
    await screen.findByRole("button", { name: /U11 · 17:00/ });
    expect(screen.queryByRole("button", { name: "Antrenman Ekle" })).toBeNull();
  });
});
