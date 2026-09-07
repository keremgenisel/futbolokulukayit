// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TakvimSeridi } from "../../src/components/TakvimSeridi.jsx";

afterEach(cleanup);
const kur = (ek = {}) => {
  const p = { secili: "2026-09-08", bugun: "2026-09-07", baslangic: "2026-08-31", onSec: vi.fn(), onBaslangic: vi.fn(),
    gunOzetleri: { "2026-09-02": [{ iptal: 0, oyuncu: 10, isaretli: 10 }, { iptal: 1, oyuncu: 10, isaretli: 0 }], "2026-09-08": [{ iptal: 0, oyuncu: 12, isaretli: 0 }] }, ...ek };
  render(<TakvimSeridi {...p} />); return p;
};

describe("Takvim şeridi", () => {
  it("14 gün gösterir, seçili gün basılı, bugün ve ay etiketleri doğru", () => {
    kur();
    const gunler = document.querySelectorAll("button[data-iso]");
    expect(gunler).toHaveLength(14);
    expect(gunler[0].dataset.iso).toBe("2026-08-31"); expect(gunler[13].dataset.iso).toBe("2026-09-13");
    expect(screen.getByRole("button", { name: /^8 EYL · 1 antrenman/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /7 EYL \(bugün\)/ })).toBeInTheDocument();
    expect(gunler[0].textContent).toContain("AĞU"); expect(gunler[1].textContent).toContain("EYL"); expect(gunler[2].textContent).not.toContain("EYL");
  });
  it("noktalar antrenman durumunu gösterir", () => {
    kur();
    const n = [...document.querySelector('button[data-iso="2026-09-02"]').querySelectorAll("[data-nokta]")].map((x) => x.dataset.nokta);
    expect(n).toEqual(["yesil", "kirmizi"]);
    expect(document.querySelector('button[data-iso="2026-09-08"] [data-nokta]').dataset.nokta).toBe("gri");
    expect(document.querySelector('button[data-iso="2026-09-03"] [data-nokta]')).toBeNull();
  });
  it("gün tıklama, oklar (7 gün), Bugün ve tarih girdisi", () => {
    const p = kur();
    fireEvent.click(document.querySelector('button[data-iso="2026-09-10"]'));
    expect(p.onSec).toHaveBeenCalledWith("2026-09-10");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki hafta" }));
    expect(p.onBaslangic).toHaveBeenCalledWith("2026-09-07");
    fireEvent.click(screen.getByRole("button", { name: "Önceki hafta" }));
    expect(p.onBaslangic).toHaveBeenCalledWith("2026-08-24");
    fireEvent.click(screen.getByRole("button", { name: "Bugün" }));
    expect(p.onSec).toHaveBeenCalledWith("2026-09-07");
    fireEvent.change(screen.getByLabelText("Tarihe git"), { target: { value: "2026-12-24" } });
    expect(p.onSec).toHaveBeenCalledWith("2026-12-24");
  });
  it("klavye: ← → gün değiştirir, Home bugüne döner", () => {
    const p = kur();
    const serit = screen.getByLabelText("Gün şeridi");
    fireEvent.keyDown(serit, { key: "ArrowRight" }); expect(p.onSec).toHaveBeenCalledWith("2026-09-09");
    fireEvent.keyDown(serit, { key: "ArrowLeft" }); expect(p.onSec).toHaveBeenCalledWith("2026-09-07");
    fireEvent.keyDown(serit, { key: "Home" }); expect(p.onBaslangic).toHaveBeenCalledWith("2026-08-31");
  });
  it("seçili gün şeridin dışına çıkınca şerit onu içerecek şekilde kayar", () => {
    const p = kur({ secili: "2026-10-20" });
    expect(p.onBaslangic).toHaveBeenCalledWith("2026-10-20");
    cleanup();
    const q = kur({ secili: "2026-08-01" });
    expect(q.onBaslangic).toHaveBeenCalledWith("2026-07-19");
  });
});
