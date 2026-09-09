// @vitest-environment jsdom
// Oyuncular: sezon filtresi (plan §18) — varsayılan aktif sezon, "Tüm sezonlar", eski sezon; arama üst satırda solda.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Oyuncular sezon filtresi", () => {
  let cagrilar;
  beforeEach(() => {
    cagrilar = [];
    const hepsi = [
      {
        id: 1,
        ad_soyad: "Yeni Sezon Oyuncusu",
        sezon: "2027-2028",
        uyruk: "tc",
        dogum_tarihi: "2015-01-01",
        durum: "aktif",
        ucret_tipi: "normal",
        aylik_aidat: 1,
      },
      {
        id: 2,
        ad_soyad: "Eski Sezon Oyuncusu",
        sezon: "2026-2027",
        uyruk: "tc",
        dogum_tarihi: "2014-01-01",
        durum: "pasif",
        ucret_tipi: "normal",
        aylik_aidat: 1,
      },
    ];
    window.okul = {
      db: vi.fn(async (fn, a) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "sezonDurumu") return { aktifSezon: "2027-2028", baslangicAyi: 9, sonGecis: null, adaySayisi: 1 };
        if (fn === "sezonListesi") return ["2027-2028", "2026-2027"];
        if (fn === "playersPage") {
          cagrilar.push(a);
          const f = hepsi.filter(
            (o) => (!a.sezon || o.sezon === a.sezon) && (a.durum !== "aktifler" || ["aktif", "deneme", "sakat"].includes(o.durum)),
          );
          return { liste: f, toplam: f.length, sayfa: 1, sayfaBoyu: 50 };
        }
        return null;
      }),
      cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) },
      app: { logo: async () => "" },
    };
  });
  const ac = () =>
    render(
      <ToastSaglayici>
        <Oyuncular oturum={{ role: "admin" }} />
      </ToastSaglayici>,
    );

  it("varsayılan aktif sezon: yalnız o sezonun oyuncuları; sezon kutusu ilk filtre, arama üst satırda", async () => {
    ac();
    expect(await screen.findByText("Yeni Sezon Oyuncusu")).toBeInTheDocument();
    await waitFor(() => expect(cagrilar.at(-1)).toMatchObject({ sezon: "2027-2028" }));
    expect(screen.queryByText("Eski Sezon Oyuncusu")).toBeNull();
    const sezon = screen.getByLabelText("Sezon");
    expect(sezon).toHaveValue("2027-2028");
    expect([...sezon.options].map((o) => o.textContent)).toEqual(["Tüm sezonlar", "2027-2028 (aktif sezon)", "2026-2027"]);
    // Sezon kutusu filtre kartında Yaş grubu'ndan önce; arama kutusu ise İçe Aktar ile aynı üst satırda
    expect(sezon.compareDocumentPosition(screen.getByLabelText("Yaş grubu")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const ara = screen.getByLabelText("Ara");
    expect(ara.closest("div").parentElement).toBe(screen.getByRole("button", { name: "İçe Aktar" }).parentElement);
    expect(ara.compareDocumentPosition(screen.getByRole("button", { name: "İçe Aktar" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("eski sezon seçilince o sezonun (pasif) oyuncuları; 'Tüm sezonlar' sezon süzgecini kaldırır", async () => {
    ac();
    await screen.findByText("Yeni Sezon Oyuncusu");
    fireEvent.change(screen.getByLabelText("Sezon"), { target: { value: "2026-2027" } });
    // Geçmiş sezon seçilince durum süzgeci kendiliğinden "Tüm durumlar" olur (o sezonun oyuncuları bugün pasif olabilir)
    expect(screen.getByLabelText("Durum")).toHaveValue("");
    expect(await screen.findByText("Eski Sezon Oyuncusu")).toBeInTheDocument();
    await waitFor(() => expect(cagrilar.at(-1)).toMatchObject({ sezon: "2026-2027", durum: null }));
    fireEvent.change(screen.getByLabelText("Sezon"), { target: { value: "2027-2028" } });
    expect(screen.getByLabelText("Durum")).toHaveValue("aktifler"); // aktif sezona dönünce sahadakiler
    fireEvent.change(screen.getByLabelText("Sezon"), { target: { value: "" } });
    await waitFor(() => expect(cagrilar.at(-1)).toMatchObject({ sezon: null }));
    expect(await screen.findByText("Yeni Sezon Oyuncusu")).toBeInTheDocument();
    expect(screen.getByText("Eski Sezon Oyuncusu")).toBeInTheDocument();
  });
});
