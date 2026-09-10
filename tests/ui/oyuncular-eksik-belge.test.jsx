// @vitest-environment jsdom
// Oyuncular listesi: zorunlu belgesi ("Diğer" hariç) eksik oyuncuda "Eksik belge (N)" pili, tam olanda pil yok (10.09.2026)
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

const oyuncu = (id, ad, belge_tipleri) => ({
  id,
  ad_soyad: ad,
  dogum_tarihi: "2015-01-01",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 3500,
  aidat_durum: "odendi",
  saglik_adet: 1,
  saglik_gecerlilik: "2099-01-01",
  belge_tipleri,
  sezon: "2026-2027",
});

describe("Oyuncular: eksik belge pili", () => {
  it("eksikler sayılır ve başlıkta listelenir; 'diger' zorunlu değil; tam belgede pil yok", async () => {
    const liste = [
      oyuncu(1, "Tam Belge", "saglik,foto,sporcu_kimlik,veli_kimlik,kayit_formu"),
      oyuncu(2, "Yarim Belge", "saglik,foto,diger"),
      oyuncu(3, "Bos Belge", null),
    ];
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "playersPage") return { liste, toplam: 3, sayfa: 1, sayfaBoyu: 50 };
        if (fn === "sezonDurumu") return { aktifSezon: "2026-2027" };
        if (fn === "sezonListesi") return ["2026-2027"];
        if (fn === "listAgeGroups") return [];
        if (fn === "listFeeTypes") return [];
        return [];
      }),
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Oyuncular oturum={{ role: "admin" }} saltOkunur={false} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    expect(await screen.findByText("Tam Belge")).toBeInTheDocument();
    const piller = screen.getAllByText(/^Eksik belge \(\d\)$/);
    expect(piller.map((p) => p.textContent)).toEqual(["Eksik belge (3)", "Eksik belge (5)"]);
    expect(screen.getByLabelText("Eksik belge: Sporcu kimlik fotokopisi, Veli kimlik fotokopisi, İmzalı kayıt formu")).toBeInTheDocument();
    expect(screen.getByText("Tam Belge").closest("tr").textContent).not.toMatch(/Eksik belge/);
    // Filtre düğmesi: sağlık filtresinin yanında; tıklayınca playersPage eksikBelge:true ile çağrılır, tekrar tıklayınca kalkar
    const dugme = screen.getByRole("button", { name: "Eksik belgesi olanlar" });
    fireEvent.click(dugme);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("playersPage", expect.objectContaining({ eksikBelge: true })));
    fireEvent.click(screen.getByRole("button", { name: "✕ Eksik belgesi olanlar" }));
    await waitFor(() =>
      expect(window.okul.db.mock.calls.filter((c) => c[0] === "playersPage").at(-1)[1]).toMatchObject({ eksikBelge: false }),
    );
  });
});
