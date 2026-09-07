// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Sayfalama, ToastSaglayici } from "../../src/components/ui.jsx";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { Raporlar } from "../../src/components/Raporlar.jsx";

afterEach(cleanup);

describe("Sayfalama bileşeni", () => {
  it("tek sayfada çizilmez; çok sayfada aralık, sayfa ve düğmeler doğru", () => {
    const { container } = render(<Sayfalama sayfa={1} toplam={40} sayfaBoyu={50} onSayfa={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    const onSayfa = vi.fn();
    render(<Sayfalama sayfa={2} toplam={312} sayfaBoyu={50} onSayfa={onSayfa} birim="oyuncu" />);
    expect(screen.getByText("51–100 / 312 oyuncu")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sayfalama" })).toHaveTextContent("Sayfa 2 / 7");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" })); expect(onSayfa).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Önceki sayfa" })); expect(onSayfa).toHaveBeenCalledWith(1);
    cleanup();
    render(<Sayfalama sayfa={7} toplam={312} sayfaBoyu={50} onSayfa={onSayfa} />);
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeDisabled();
    expect(screen.getByText("301–312 / 312 kayıt")).toBeInTheDocument();
  });
});

describe("Oyuncular: sayfalı liste", () => {
  it("ilk 50 gösterilir, sonraki sayfaya geçilir, filtre değişince 1. sayfaya dönülür, dışa aktarım tam listeyi alır", async () => {
    const hepsi = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, ad_soyad: `Oyuncu ${String(i + 1).padStart(3, "0")}`, uyruk: "tc", tc_no: null, dogum_tarihi: "2015-01-01", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 1, aidat_durum: "odendi" }));
    const cagrilar = [];
    window.okul = {
      db: vi.fn(async (fn, a) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "playersPage") { cagrilar.push(a); const boy = a.sayfaBoyu, s = a.sayfa; const f = a.q ? hepsi.filter((o) => o.ad_soyad.includes(a.q)) : hepsi; return { liste: f.slice((s - 1) * boy, s * boy), toplam: f.length, sayfa: s, sayfaBoyu: boy }; }
        if (fn === "listPlayersWithDue") return hepsi;
        return null;
      }),
      cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) }, app: { logo: async () => "" },
    };
    render(<ToastSaglayici><Oyuncular oturum={{ role: "admin" }} saltOkunur={false} /></ToastSaglayici>);
    await screen.findByText("Oyuncu 001");
    expect(screen.queryByText("Oyuncu 051")).toBeNull();
    expect(screen.getByText("120 oyuncu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    await screen.findByText("Oyuncu 051");
    expect(screen.queryByText("Oyuncu 001")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Ad, soyad/), { target: { value: "Oyuncu 11" } });
    await waitFor(() => expect(screen.getByText("10 oyuncu")).toBeInTheDocument());
    expect(cagrilar.at(-1)).toMatchObject({ q: "Oyuncu 11", sayfa: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(window.okul.cikti.excelKaydet).toHaveBeenCalled());
    expect(window.okul.cikti.excelKaydet.mock.calls[0][0].satirlar).toHaveLength(120);
  });
});

describe("Raporlar: önizleme sayfalı", () => {
  it("250 satırlık rapor önizlemede 100'er gösterilir, Excel tamamını alır", async () => {
    const l = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, ad_soyad: `Rapor Oyuncu ${String(i + 1).padStart(3, "0")}`, uyruk: "tc", dogum_tarihi: "2015-01-01", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 1, aidat_durum: "odendi" }));
    window.okul = { db: vi.fn(async (fn) => (fn === "listAgeGroups" ? [] : fn === "listPlayersWithDue" ? l : null)), cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) }, app: { logo: async () => "" } };
    render(<ToastSaglayici><Raporlar /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await screen.findByText("Rapor Oyuncu 001");
    expect(screen.queryByText("Rapor Oyuncu 101")).toBeNull();
    expect(screen.getByText("1–100 / 250 satır")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("Rapor Oyuncu 101")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("Rapor Oyuncu 250")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(window.okul.cikti.excelKaydet).toHaveBeenCalled());
    expect(window.okul.cikti.excelKaydet.mock.calls[0][0].satirlar).toHaveLength(250);
  });

  it("Sağlık Raporu Durumu raporu: bugüne göre, grup filtresi, en acil önce, özet satırı", async () => {
    const l = [
      { player_id: 1, ad_soyad: "Ada Kaya", yas_grubu_ad: "U11", veli_tel: "05321112233", gecerlilik: "2026-08-01", durum: "doldu", kalanGun: -37 },
      { player_id: 2, ad_soyad: "Barış Güneş", yas_grubu_ad: "U11", veli_tel: "", gecerlilik: "2026-09-20", durum: "dolacak", kalanGun: 13 },
      { player_id: 3, ad_soyad: "Cem Polat", yas_grubu_ad: "U12", veli_tel: "", gecerlilik: null, durum: "yok", kalanGun: null },
      { player_id: 4, ad_soyad: "Deniz Aksoy", yas_grubu_ad: "U12", veli_tel: "", gecerlilik: "2027-05-05", durum: "gecerli", kalanGun: 240 },
    ];
    window.okul = { db: vi.fn(async (fn, ...a) => (fn === "listAgeGroups" ? [{ id: 1, ad: "U11" }, { id: 2, ad: "U12" }] : fn === "saglikRaporuListesi" ? l.filter((x) => !a[1] || (a[1] === 1 ? x.yas_grubu_ad === "U11" : x.yas_grubu_ad === "U12")) : null)), cikti: { excelKaydet: vi.fn(async () => ({ ok: true })) }, app: { logo: async () => "" } };
    render(<ToastSaglayici><Raporlar /></ToastSaglayici>);
    fireEvent.click(await screen.findByText("Sağlık Raporu Durumu"));
    expect(screen.getByText(/Bugünün tarihine göre hesaplanır/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await screen.findByText("Süresi doldu");
    expect(window.okul.db).toHaveBeenCalledWith("saglikRaporuListesi", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), null);
    const satirlar = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(satirlar[0]).toContain("Ada Kaya"); expect(satirlar[0]).toContain("01.08.2026"); expect(satirlar[0]).toContain("-37");
    expect(satirlar[3]).toContain("Deniz Aksoy"); expect(satirlar[3]).toContain("Geçerli");
    expect(screen.getByText(/1 doldu · 1 dolacak · 1 yok · 1 geçerli/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Yaş grubu"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("saglikRaporuListesi", expect.any(String), 2));
    await waitFor(() => expect(screen.queryByText("Ada Kaya")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(window.okul.cikti.excelKaydet).toHaveBeenCalledWith(expect.objectContaining({ sayfa: "Sağlık Raporu Durumu" }), expect.any(String)));
  });
});
