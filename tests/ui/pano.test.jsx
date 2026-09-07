// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { Pano } from "../../src/components/Pano.jsx";

afterEach(cleanup);

describe("Pano — tesise giriş kontrolü", () => {
  beforeEach(() => {
    window.okul = { db: vi.fn(async (fn, arg) => {
      if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 1, antrenmanlar: [], bugunTahsilat: 0 };
      if (fn === "listUnpaid") return [{ id: 5, player_id: 2, ad_soyad: "Kaan Yıldız", yas_grubu_ad: "U11", odeme_donemi: "1-10", yil: 2026, ay: 9, tutar: 3500 }];
      if (fn === "listPlayersWithDue" && arg?.q) return [
        { id: 1, ad_soyad: "Kerem Yılmaz", durum: "aktif", yas_grubu_ad: "U12", aidat_durum: "odendi" },
        { id: 2, ad_soyad: "Kaan Yıldız", durum: "aktif", yas_grubu_ad: "U11", aidat_durum: "odenmedi" },
        { id: 3, ad_soyad: "Deniz Koç", durum: "dondurma", yas_grubu_ad: "U10", aidat_durum: null },
      ];
      return [];
    }) };
  });

  it("ödeyen girebilir, ödemeyen aidat borcu, dondurmadaki giremez", async () => {
    render(<ToastSaglayici><Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} /></ToastSaglayici>);
    await waitFor(() => screen.getByText("Tesise Giriş Kontrolü"));
    fireEvent.change(screen.getByLabelText("Tesise giriş araması"), { target: { value: "K" } });
    await waitFor(() => expect(screen.getByText("Kerem Yılmaz")).toBeInTheDocument());
    expect(screen.getByText("GİREBİLİR")).toBeInTheDocument();
    expect(screen.getByText("AİDAT BORCU")).toBeInTheDocument();
    expect(screen.getByText("GİREMEZ")).toBeInTheDocument();
  });

  it("borçlu listesinden Makbuz düğmesi oyuncuyla tahsilata gider", async () => {
    const onMakbuzKes = vi.fn();
    render(<ToastSaglayici><Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={onMakbuzKes} /></ToastSaglayici>);
    await waitFor(() => screen.getByText("Kaan Yıldız"));
    fireEvent.click(screen.getByRole("button", { name: "Makbuz" }));
    expect(onMakbuzKes).toHaveBeenCalledWith(2);
  });

  it("salt okunur modda makbuz ve yeni oyuncu düğmeleri yok", async () => {
    render(<ToastSaglayici><Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} saltOkunur /></ToastSaglayici>);
    await waitFor(() => screen.getByText("Kaan Yıldız"));
    expect(screen.queryByRole("button", { name: "Makbuz Kes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Makbuz" })).toBeNull();
  });

  it("sağlık raporu uyarıları: kart ve sayaç; satır tıklanınca oyuncu kartı", async () => {
    window.okul.db.mockImplementation(async (fn) => {
      if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 1, antrenmanlar: [], bugunTahsilat: 0 };
      if (fn === "saglikRaporuDurumu") return { toplam: 3, doldu: 1, dolacak: 1, yok: 0, uyarilar: [
        { player_id: 2, ad_soyad: "Kaan Yıldız", yas_grubu_ad: "U11", gecerlilik: "2020-01-01", durum: "doldu" },
        { player_id: 3, ad_soyad: "Ela Demir", yas_grubu_ad: "U11", gecerlilik: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), durum: "dolacak" }] };
      return [];
    });
    const onOyuncu = vi.fn();
    render(<ToastSaglayici><Pano onOyuncu={onOyuncu} onSekme={() => {}} onMakbuzKes={() => {}} /></ToastSaglayici>);
    await screen.findByText("Sağlık Raporu Uyarıları");
    expect(screen.getByText("1 doldu · 1 dolacak · 0 yok")).toBeInTheDocument();
    expect(screen.getByText(/Süresi doldu/)).toBeInTheDocument();
    expect(screen.getByText("5 gün kaldı")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Kaan Yıldız"));
    expect(onOyuncu).toHaveBeenCalledWith(2);
  });
});
