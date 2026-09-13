// @vitest-environment jsdom
// Ay bazında aidat muafiyeti (plan §42): Ödemeler'de "Muaf yap" → pencere → aidatMuafYap; muaf satırda neden ve "Muafiyeti kaldır";
// "Muaf ay ekle" yıl/ay seçer; durum Dondurma'ya geçince açık ay için soru (Evet → muaf, Vazgeç → kalır); salt okunurda düğme yok.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);
const simdi = new Date();
const YIL = simdi.getFullYear(),
  AY = simdi.getMonth() + 1;
const oyuncu = {
  id: 7,
  ad_soyad: "Kaan Yıldız",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 3500,
  odeme_donemi: "1-10",
  kayit_tarihi: "2026-09-01",
  foto_yolu: "",
  dogum_tarihi: "2015-01-01",
};
function kur({ saltOkunur = false, aidatlar } = {}) {
  const dues = aidatlar || [
    { id: 1, player_id: 7, yil: YIL, ay: AY, tutar: 3500, odenen: 0, durum: "odenmedi", vade_gecti: 1 },
    {
      id: 2,
      player_id: 7,
      yil: 2026,
      ay: 1,
      tutar: 3500,
      odenen: 0,
      durum: "muaf",
      muaf_neden: "dondurma",
      muaf_notu: "askerlik",
      muaf_eden: "Şerif",
    },
    { id: 3, player_id: 7, yil: 2025, ay: 12, tutar: 3500, odenen: 1000, durum: "kismi", vade_gecti: 1 },
  ];
  const db = vi.fn(async (fn, ...a) => {
    if (fn === "getPlayer") return oyuncu;
    if (fn === "listDues") return dues;
    if (fn === "getDue") return dues.find((d) => d.yil === a[1] && d.ay === a[2]) || null;
    if (fn === "aidatMuafYap" || fn === "aidatMuafKaldir" || fn === "updatePlayer") return { ok: true };
    if (
      fn === "listGuardians" ||
      fn === "listEmergency" ||
      fn === "listDocuments" ||
      fn === "listReceipts" ||
      fn === "sonMesajlar" ||
      fn === "kartBasimlari"
    )
      return [];
    if (fn === "playerAttendanceSon") return [];
    if (fn === "attendanceSummary") return {};
    return [];
  });
  window.okul = {
    db,
    files: { dataUrl: vi.fn(async () => "") },
    app: { marka: vi.fn(async () => ({})) },
    cikti: { yazdir: vi.fn(async () => ({ ok: true })) },
  };
  render(
    <ToastSaglayici>
      <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={saltOkunur} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
    </ToastSaglayici>,
  );
  return db;
}
const odemelerAc = async () => {
  await screen.findAllByText("Kaan Yıldız");
  fireEvent.click(screen.getByRole("button", { name: /Ödemeler/ }));
  await screen.findByText("Aylık Aidat");
};

describe("aidat muafiyeti (plan §42)", () => {
  it("ödenmemiş ayda 'Muaf Yap' → pencere → neden/not → aidatMuafYap; kısmi ayda düğme yok; muaf satırda neden ve 'Muafiyeti Kaldır'", async () => {
    const db = kur();
    await odemelerAc();
    const satirlar = screen.getAllByRole("row");
    const acik = satirlar.find((r) => r.textContent.includes("Ödenmedi"));
    const kismi = satirlar.find((r) => r.textContent.includes("kalan"));
    const muaf = satirlar.find((r) => r.textContent.includes("Dondurma"));
    expect(within(kismi).queryByRole("button", { name: "Muaf Yap" })).toBeNull();
    expect(muaf).toHaveTextContent("· Dondurma: askerlik");
    fireEvent.click(within(acik).getByRole("button", { name: "Muaf Yap" }));
    const dlg = await screen.findByRole("dialog", { name: "Aidat Muafiyeti" });
    fireEvent.change(within(dlg).getByLabelText("Muafiyet nedeni"), { target: { value: "sakatlik" } });
    fireEvent.change(within(dlg).getByLabelText("Muafiyet notu"), { target: { value: "rapor var" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Muaf Yap" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("aidatMuafYap", 7, YIL, AY, { neden: "sakatlik", not: "rapor var" }));
    await screen.findByText(/muaf yapıldı/);
    fireEvent.click(within(muaf).getByRole("button", { name: "Muafiyeti Kaldır" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("aidatMuafKaldir", 7, 2026, 1));
  });
  it("'Muaf Ay Ekle': yıl/ay seçilir (varsayılan bu ay), neden dondurma", async () => {
    const db = kur();
    await odemelerAc();
    fireEvent.click(screen.getByRole("button", { name: "Muaf Ay Ekle" }));
    const dlg = await screen.findByRole("dialog", { name: "Aidat Muafiyeti" });
    fireEvent.change(within(dlg).getByLabelText("Muaf yılı"), { target: { value: String(YIL - 1) } });
    fireEvent.change(within(dlg).getByLabelText("Muaf ayı"), { target: { value: "11" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Muaf Yap" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("aidatMuafYap", 7, YIL - 1, 11, { neden: "dondurma", not: "" }));
  });
  it("durum Dondurma'ya geçince açık ay için soru: Evet → muaf (neden dondurma); Vazgeç → dokunmaz; Sakat'a geçişte soru yok", async () => {
    const db = kur();
    await screen.findAllByText("Kaan Yıldız");
    fireEvent.change(screen.getByDisplayValue("Aktif"), { target: { value: "dondurma" } });
    await waitFor(() => expect(db).toHaveBeenCalledWith("updatePlayer", 7, { durum: "dondurma" }));
    const soru = await screen.findByRole("dialog", { name: "Onay" });
    expect(soru).toHaveTextContent("bu ay muaf yapılsın mı?");
    fireEvent.click(within(soru).getByRole("button", { name: "Vazgeç" }));
    expect(db).not.toHaveBeenCalledWith("aidatMuafYap", expect.anything(), expect.anything(), expect.anything(), expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Onay" })).toBeNull());
    fireEvent.change(screen.getByDisplayValue("Aktif"), { target: { value: "pasif" } });
    const soru2 = await screen.findByRole("dialog", { name: "Onay" });
    fireEvent.click(within(soru2).getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("aidatMuafYap", 7, YIL, AY, { neden: "diger", not: "Durum: Pasif" }));
    fireEvent.change(screen.getByDisplayValue("Aktif"), { target: { value: "sakat" } });
    await waitFor(() => expect(db).toHaveBeenCalledWith("updatePlayer", 7, { durum: "sakat" }));
    expect(screen.queryByRole("dialog", { name: "Onay" })).toBeNull();
  });
  it("bu ay ödenmişse durum değişiminde soru çıkmaz; salt okunurda muaf düğmeleri yok", async () => {
    const db = kur({ aidatlar: [{ id: 1, player_id: 7, yil: YIL, ay: AY, tutar: 3500, odenen: 3500, durum: "odendi" }] });
    await screen.findAllByText("Kaan Yıldız");
    fireEvent.change(screen.getByDisplayValue("Aktif"), { target: { value: "dondurma" } });
    await waitFor(() => expect(db).toHaveBeenCalledWith("updatePlayer", 7, { durum: "dondurma" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog", { name: "Onay" })).toBeNull();
    cleanup();
    kur({ saltOkunur: true });
    await odemelerAc();
    expect(screen.queryByRole("button", { name: "Muaf Yap" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Muaf Ay Ekle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Muafiyeti Kaldır" })).toBeNull();
  });
});
