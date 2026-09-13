// @vitest-environment jsdom
// Tahsilat › Kesilen Makbuzlar sekmesi (13.09.2026): sekmeler, süzgeçler makbuzListesi'ne gider, Yazdır, İptal (nedenli → liste
// yenilenir), oyuncu bağlantısı, salt okunurda İptal yok, silme düğmesi YOK (mali belge).
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Tahsilat } from "../../src/components/Tahsilat.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);
const MAKBUZLAR = [
  {
    id: 1,
    makbuz_no: "2026-0001",
    player_id: 5,
    tarih: "2026-09-05",
    toplam: 3500,
    odeme_yontemi: "nakit",
    tahsil_eden: "Şerif",
    iptal: 0,
    ad_soyad: "Kaan Yıldız",
  },
  {
    id: 2,
    makbuz_no: "2026-0002",
    player_id: 6,
    tarih: "2026-09-06",
    toplam: 1000,
    odeme_yontemi: "havale",
    tahsil_eden: "",
    iptal: 1,
    iptal_nedeni: "Yanlış oyuncu",
    iptal_eden: "Şerif",
    ad_soyad: "Silinmiş Oyuncu #6",
  },
];
function kopru({ saltOkunur = false } = {}) {
  const db = vi.fn(async (fn, a) => {
    if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9 };
    if (fn === "sezonListesi") return ["2026-2027", "2025-2026"];
    if (fn === "listFeeItems" || fn === "listReceiptsByDate") return [];
    if (fn === "getSetting") return "";
    if (fn === "makbuzListesi") {
      const l = MAKBUZLAR.filter((m) => (a?.iptalDahil ? true : !m.iptal)).filter(
        (m) => !a?.q || m.ad_soyad.toLocaleLowerCase("tr-TR").includes(String(a.q).toLocaleLowerCase("tr-TR")),
      );
      return {
        liste: l,
        toplam: l.length,
        sayfa: 1,
        sayfaBoyu: 50,
        toplamTutar: l.filter((m) => !m.iptal).reduce((s, m) => s + m.toplam, 0),
      };
    }
    if (fn === "cancelReceipt") return { ok: true };
    if (fn === "getReceipt") return { ...MAKBUZLAR[0], satirlar: [] };
    return [];
  });
  const yazdir = vi.fn(async () => ({ ok: true }));
  window.okul = {
    db,
    cikti: { yazdir, makbuzPdf: vi.fn(async () => ({ ok: true })) },
    app: { marka: vi.fn(async () => ({ logo: "", kulupAdi: "K" })) },
  };
  const onOyuncu = vi.fn();
  render(
    <ToastSaglayici>
      <Tahsilat oturum={{ ad_soyad: "Şerif" }} saltOkunur={saltOkunur} onOyuncu={onOyuncu} onSecildi={() => {}} />
    </ToastSaglayici>,
  );
  return { db, yazdir, onOyuncu };
}
const sekmeAc = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Kesilen Makbuzlar" }));
  await screen.findByText("2026-0001");
};

describe("Tahsilat › Kesilen Makbuzlar", () => {
  it("sekme açılınca aktif sezonun geçerli makbuzları listelenir; iptal edilenler kutuyla gelir; arama süzer; silme düğmesi yok", async () => {
    const { db } = kopru();
    expect(screen.getByRole("button", { name: "Tahsilat" })).toBeInTheDocument();
    await sekmeAc();
    await waitFor(() =>
      expect(db).toHaveBeenCalledWith("makbuzListesi", expect.objectContaining({ sezon: "2026-2027", iptalDahil: false, sayfa: 1 })),
    );
    expect(screen.getByTestId("makbuz-sayac")).toHaveTextContent("1 makbuz · 3.500 ₺");
    expect(screen.queryByText("2026-0002")).toBeNull();
    fireEvent.click(screen.getByLabelText("İptal edilenleri de göster"));
    await screen.findByText("2026-0002");
    expect(screen.getByText("İptal: Yanlış oyuncu")).toBeInTheDocument();
    expect(screen.getByText("Silinmiş Oyuncu #6")).toBeInTheDocument(); // damgalı ad
    expect(screen.queryByRole("button", { name: /^Sil$/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Makbuz ara"), { target: { value: "kaan" } });
    await waitFor(() => expect(db).toHaveBeenCalledWith("makbuzListesi", expect.objectContaining({ q: "kaan" })));
    await waitFor(() => expect(screen.queryByText("2026-0002")).toBeNull());
    fireEvent.change(screen.getByLabelText("Makbuz sezonu"), { target: { value: "" } });
    await waitFor(() => expect(db).toHaveBeenCalledWith("makbuzListesi", expect.objectContaining({ sezon: null })));
  });
  it("Yazdır makbuzu yazdırır; oyuncu adı oyuncu kartını açar; İptal nedenle cancelReceipt çağırır ve liste yenilenir", async () => {
    const { db, yazdir, onOyuncu } = kopru();
    await sekmeAc();
    const satir = screen.getByText("2026-0001").closest("tr");
    fireEvent.click(within(satir).getByRole("button", { name: "Yazdır" }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    fireEvent.click(within(satir).getByRole("button", { name: "Kaan Yıldız" }));
    expect(onOyuncu).toHaveBeenCalledWith(5);
    const once = db.mock.calls.filter((c) => c[0] === "makbuzListesi").length;
    fireEvent.click(within(satir).getByRole("button", { name: "İptal" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByRole("textbox"), { target: { value: "Yanlış tutar" } });
    fireEvent.click(within(dlg).getByRole("button", { name: /İptal Et/ }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("cancelReceipt", 1, "Yanlış tutar"));
    await waitFor(() => expect(db.mock.calls.filter((c) => c[0] === "makbuzListesi").length).toBeGreaterThan(once));
  });
  it("salt okunurda sekme açılır, Yazdır var, İptal yok", async () => {
    kopru({ saltOkunur: true });
    await sekmeAc();
    const satir = screen.getByText("2026-0001").closest("tr");
    expect(within(satir).getByRole("button", { name: "Yazdır" })).toBeInTheDocument();
    expect(within(satir).queryByRole("button", { name: "İptal" })).toBeNull();
  });
});
