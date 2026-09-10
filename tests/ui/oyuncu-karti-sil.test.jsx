// @vitest-environment jsdom
// Oyuncu kartı "Sil" (plan §31): makbuz kesilmiş oyuncu silinmez (receipts ON DELETE RESTRICT) — kart bunun yerine kişisel
// verileri silmeyi (files.oyuncuKisiselVeriSil; makbuzlar kalır) onaylatır; makbuzsuz oyuncuda gerçek silme (deletePlayer) çıkar.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

const oyuncu = {
  id: 7,
  ad_soyad: "Kerem Genişel",
  uyruk: "tc",
  dogum_tarihi: "2015-01-01",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 3500,
  odeme_donemi: "1-10",
  kayit_tarihi: "2026-09-01",
  updated_at: "2026-09-01",
  yas_grubu_ad: "U11",
};

function kur(makbuzlar) {
  const dbMock = vi.fn(async (fn) => {
    if (fn === "getPlayer") return oyuncu;
    if (fn === "listReceipts") return makbuzlar;
    if (fn === "deletePlayer") return { ok: true };
    return [];
  });
  const kisiselSil = vi.fn(async () => ({ ok: true, makbuz: makbuzlar.length }));
  window.okul = {
    db: dbMock,
    files: { dataUrl: vi.fn(async () => ""), oyuncuKisiselVeriSil: kisiselSil },
    app: { logo: async () => "" },
  };
  const onKapat = vi.fn();
  render(
    <ToastSaglayici>
      <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={onKapat} onMakbuzKes={vi.fn()} />
    </ToastSaglayici>,
  );
  return { dbMock, kisiselSil, onKapat };
}
const makbuzlu = [
  { id: 1, makbuz_no: "2026-0001", tarih: "2026-08-05", toplam: 3500, odeme_yontemi: "nakit", iptal: 0 },
  { id: 2, makbuz_no: "2026-0002", tarih: "2026-08-06", toplam: 100, odeme_yontemi: "nakit", iptal: 1, iptal_nedeni: "yanlış" },
];

describe("Oyuncu kartı — Sil", () => {
  it("makbuzlu oyuncuda kişisel veri silme onayı: makbuz sayısı, korunanlar/silinenler, anonim ad; Evet → files.oyuncuKisiselVeriSil, kart kapanır", async () => {
    const { dbMock, kisiselSil, onKapat } = kur(makbuzlu);
    fireEvent.click(await screen.findByRole("button", { name: "Sil" }));
    const mesaj = screen.getByText(/2 makbuz kesilmiş/);
    expect(mesaj.textContent).toContain("Makbuzlar adı, tutarı ve numarasıyla olduğu gibi korunur");
    expect(mesaj.textContent).toContain("kişisel verileri");
    expect(mesaj.textContent).toContain('"Silinmiş Oyuncu #7"');
    expect(mesaj.textContent).toContain("geri alınamaz");
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(kisiselSil).toHaveBeenCalledWith(7));
    expect(dbMock).not.toHaveBeenCalledWith("deletePlayer", expect.anything());
    expect(onKapat).toHaveBeenCalled();
    expect(await screen.findByText("Oyuncunun kişisel verileri silindi; makbuzlar korundu")).toBeInTheDocument();
  });

  it("makbuzsuz oyuncuda gerçek silme onayı; Evet → deletePlayer, kişisel veri silme çağrılmaz, kart kapanır", async () => {
    const { dbMock, kisiselSil, onKapat } = kur([]);
    fireEvent.click(await screen.findByRole("button", { name: "Sil" }));
    expect(screen.getByText(/tüm belgeleri, aidat ve yoklama kayıtlarıyla silinecek/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(dbMock).toHaveBeenCalledWith("deletePlayer", 7));
    expect(kisiselSil).not.toHaveBeenCalled();
    expect(onKapat).toHaveBeenCalled();
  });

  it("Vazgeç hiçbir şey yazmaz", async () => {
    const { dbMock, kisiselSil } = kur(makbuzlu);
    fireEvent.click(await screen.findByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(kisiselSil).not.toHaveBeenCalled();
    expect(dbMock).not.toHaveBeenCalledWith("deletePlayer", expect.anything());
  });

  it("hata toast'a düşer (ör. yönetici değil)", async () => {
    const { kisiselSil, onKapat } = kur(makbuzlu);
    kisiselSil.mockRejectedValueOnce(new Error("Yönetici yetkisi gerekli"));
    fireEvent.click(await screen.findByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    expect(await screen.findByText(/Yönetici yetkisi gerekli/)).toBeInTheDocument();
    expect(onKapat).not.toHaveBeenCalled();
  });
});
