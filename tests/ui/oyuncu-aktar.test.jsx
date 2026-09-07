// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OyuncuAktar } from "../../src/components/OyuncuAktar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Excel'den oyuncu aktarımı penceresi", () => {
  it("önizleme hata/uyarı/yeni grup gösterir; aktar düğmesi geçerli kayıtları gönderir; sonuç görünür", async () => {
    const onizle = { ok: true, dosya: "/tmp/liste.xlsx",
      kayitlar: [{ satir: 2, ad_soyad: "Kaan Yıldız", tc_no: "12345678901", dogum_tarihi: "2015-11-02", yas_grubu_id: 1, durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500, veli: { ad_soyad: "Ayşe", gsm: "05321112233" } }, { satir: 3, ad_soyad: "Ivan Petrov", pasaport_no: "U1234567", uyruk: "yabanci", dogum_tarihi: "2014-02-02", yeni_grup: "U13", durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500 }],
      hatalar: [{ satir: 4, mesaj: "Tarihsiz: doğum tarihi okunamadı" }], uyarilar: [{ satir: 5, mesaj: "Zaten Var: bu TC zaten kayıtlı, atlandı" }], yeniGruplar: ["U13"] };
    window.okul = { aktar: { sablon: vi.fn(async () => ({ ok: true })), onizle: vi.fn(async () => onizle), uygula: vi.fn(async (k) => ({ ok: true, eklenen: k.length, yeniGrup: 1 })) } };
    const onAktarildi = vi.fn();
    render(<ToastSaglayici><OyuncuAktar onKapat={vi.fn()} onAktarildi={onAktarildi} /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Şablon İndir" }));
    await waitFor(() => expect(window.okul.aktar.sablon).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Excel Dosyası Seç" }));
    await screen.findByText("2 aktarılacak");
    expect(screen.getByText("1 hatalı satır")).toBeInTheDocument();
    expect(screen.getByText("1 uyarı")).toBeInTheDocument();
    expect(screen.getByText("Yeni grup: U13")).toBeInTheDocument();
    expect(screen.getByText(/Satır 4: Tarihsiz/)).toHaveTextContent("aktarılmayacak");
    expect(screen.getByText("P: U1234567")).toBeInTheDocument();
    expect(screen.getByText("Ayşe · 05321112233")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 Oyuncuyu Aktar" }));
    await waitFor(() => expect(window.okul.aktar.uygula).toHaveBeenCalledWith(onizle.kayitlar));
    await screen.findByText(/2 oyuncu aktarıldı\./);
    expect(onAktarildi).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Oyuncuyu Aktar/ })).toBeNull();
  });
  it("hiç geçerli satır yoksa aktar düğmesi kapalı", async () => {
    window.okul = { aktar: { sablon: vi.fn(), onizle: vi.fn(async () => ({ ok: true, dosya: "x.xlsx", kayitlar: [], hatalar: [{ satir: 1, mesaj: 'Başlık satırında "ad soyad" sütunu bulunamadı' }], uyarilar: [], yeniGruplar: [] })), uygula: vi.fn() } };
    render(<ToastSaglayici><OyuncuAktar onKapat={vi.fn()} /></ToastSaglayici>);
    fireEvent.click(screen.getByRole("button", { name: "Excel Dosyası Seç" }));
    await screen.findByText("Aktarılacak geçerli satır yok.");
    expect(screen.getByRole("button", { name: "0 Oyuncuyu Aktar" })).toBeDisabled();
  });
});
