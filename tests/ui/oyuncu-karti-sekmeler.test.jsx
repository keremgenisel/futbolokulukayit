// @vitest-environment jsdom
// Karakterizasyon testi (refactor §3.4): oyuncu kartının sekmeleri bölünmeden önce bugünkü davranış sabitlenir.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

const oyuncu = {
  id: 7,
  ad_soyad: "Kerem Genişel",
  tc_no: "12345678901",
  uyruk: "tc",
  dogum_tarihi: "2015-01-01",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 3500,
  odeme_donemi: "1-10",
  kayit_tarihi: "2026-09-01",
  updated_at: "2026-09-01",
  yas_grubu_ad: "U11",
  notlar: "Sol ayak",
};
const aidatlar = Array.from({ length: 12 }, (_, i) => {
  const ay = i + 1;
  const durum = ay === 9 ? "odenmedi" : ay === 8 ? "kismi" : "odendi";
  return { id: 100 + ay, yil: 2026, ay, tutar: 3500, odenen: durum === "odendi" ? 3500 : durum === "kismi" ? 1000 : 0, durum };
});
const makbuzlar = [
  { id: 1, makbuz_no: "2026-0001", tarih: "2026-08-05", toplam: 3500, odeme_yontemi: "nakit", iptal: 0 },
  { id: 2, makbuz_no: "2026-0002", tarih: "2026-08-06", toplam: 100, odeme_yontemi: "nakit", iptal: 1, iptal_nedeni: "yanlış" },
];

function kur() {
  window.okul = {
    db: vi.fn(async (fn) => {
      if (fn === "getPlayer") return oyuncu;
      if (fn === "listGuardians")
        return [{ id: 1, tip: "baba", ad_soyad: "Murat Genişel", gsm: "05321112233", whatsapp_no: "", veli_mi: 1, mesaj_onayi: 1 }];
      if (fn === "listEmergency") return [{ id: 2, ad_soyad: "Ayşe Genişel", yakinlik: "Teyze", telefon: "05331112233" }];
      if (fn === "listDues") return aidatlar;
      if (fn === "listReceipts") return makbuzlar;
      if (fn === "playerAttendanceSon")
        return [
          { durum: "geldi", tarih: "2026-09-01", saat: "18:00" },
          { durum: "gelmedi", tarih: "2026-09-03", saat: "18:00" },
        ];
      if (fn === "attendanceSummary")
        return [
          { durum: "geldi", n: 5 },
          { durum: "gelmedi", n: 2 },
        ];
      if (fn === "sonMesajlar") return [{ id: 1, tur: "aidat", tarih: "2026-09-07 10:00:00", kullanici: "admin" }];
      return [];
    }),
    files: { dataUrl: vi.fn(async () => ""), addDocument: vi.fn(async () => ({ ok: true })), open: vi.fn() },
    app: { logo: async () => "" },
  };
}
const ac = () =>
  render(
    <ToastSaglayici>
      <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
    </ToastSaglayici>,
  );

describe("Oyuncu kartı sekmeleri", () => {
  beforeEach(kur);
  it("Bilgiler: kimlik, not, aidat ve son WhatsApp; durum değişimi updatePlayer'a gider", async () => {
    ac();
    expect(await screen.findByText("Sol ayak")).toBeInTheDocument();
    expect(screen.getByText("12345678901")).toBeInTheDocument();
    expect(screen.getByText("3.500 ₺")).toBeInTheDocument();
    expect(screen.getByText("07.09.2026 · aidat hatırlatma · admin")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Aktif"), { target: { value: "sakat" } });
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updatePlayer", 7, { durum: "sakat" }));
  });
  it("Ödemeler: borç rozeti, hatırlatma düğmesi, kısmi kalan, iptal makbuz, 'Tümünü göster' tam listeyi ister", async () => {
    ac();
    expect(await screen.findByText("1 borç")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ödemeler/ }));
    expect(await screen.findByRole("button", { name: "Aidat Hatırlat" })).not.toBeDisabled();
    expect(screen.getByText("Eylül 2026")).toBeInTheDocument();
    expect(screen.getByText(/kalan 2\.500/)).toBeInTheDocument();
    expect(screen.getByText(/iptal: yanlış/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Yazdır" })).toHaveLength(2);
    expect(screen.getByText("Son 12 dönem gösteriliyor")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Tümünü göster" })[0]);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("listDues", 7, null));
  });
  it("Yoklama: özet sayılar ve son kayıtlar", async () => {
    ac();
    fireEvent.click(await screen.findByRole("button", { name: "Yoklama" }));
    expect(await screen.findByText("01.09.2026")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("03.09.2026")).toBeInTheDocument();
  });
  it("Aile: veliler ve acil kişiler listelenir, veli WhatsApp düğmesi açık, acil kişi eklenir", async () => {
    ac();
    fireEvent.click(await screen.findByRole("button", { name: "Aile ve Acil Kişiler" }));
    expect(await screen.findByText("Murat Genişel")).toBeInTheDocument();
    expect(screen.getByText("Teyze")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Murat Genişel WhatsApp" })).not.toBeDisabled();
    const acilBaslik = screen.getByText("Acil Durumda Veli Dışında Ulaşılacak Kişiler").parentElement;
    fireEvent.change(within(acilBaslik).getAllByRole("textbox")[0], { target: { value: "Ali Veli" } });
    fireEvent.click(within(acilBaslik).getByRole("button", { name: "Ekle" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("addEmergency", 7, { ad_soyad: "Ali Veli", yakinlik: "", telefon: "" }),
    );
  });
});
