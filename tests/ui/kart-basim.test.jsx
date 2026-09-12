// @vitest-environment jsdom
// Giriş Kartları penceresi (plan §40.7): Oyuncular › Kartları Yazdır pencereyi açar; süzgeç (Kart: Basılmamış varsayılan),
// tümünü seç, sayaç/sayfa, Yazdır pasif/aktif, basım kaydı, salt okunur, sarı not; oyuncu kartında tek basım kaydı ve "Basılmadı say".
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);
const satir = (id, ad, ek = {}) => ({
  id,
  ad_soyad: ad,
  durum: "aktif",
  dogum_tarihi: "2015-01-01",
  foto_yolu: "",
  yas_grubu_ad: "U11",
  basim_sayisi: 0,
  son_basim: null,
  veli_ad: "Veli " + ad,
  veli_tel: "05321112233",
  ...ek,
});
const TUMU = [
  satir(1, "Kerem Yılmaz", { basim_sayisi: 1, son_basim: "2026-09-12 10:00:00" }),
  satir(2, "Ela Demir"),
  satir(3, "Kaan Yıldız", { basim_sayisi: 2, son_basim: "2026-09-12 11:00:00" }),
  satir(4, "Mert Aksoy"),
];
function kopru({ basimlar = [] } = {}) {
  let kayitlar = [...basimlar];
  const db = vi.fn(async (fn, a, b, c) => {
    if (fn === "getSetting") return "";
    if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9 };
    if (fn === "listAgeGroups") return [{ id: 7, ad: "U11" }];
    if (fn === "sezonListesi") return ["2026-2027", "2025-2026"];
    if (fn === "playersPage") return { liste: [], toplam: 0, sayfa: 1, sayfaBoyu: 50 };
    if (fn === "kartBasimListesi") {
      const k = a?.kart;
      return TUMU.filter((o) => (k === "basilmamis" ? !o.basim_sayisi : k === "basilmis" ? o.basim_sayisi > 0 : true));
    }
    if (fn === "kartBasimKaydet") {
      for (const id of a)
        kayitlar.unshift({
          id: 100 + kayitlar.length,
          player_id: id,
          sezon: b,
          tur: c,
          basim_zamani: "2026-09-12 12:00:00",
          kullanici: "Şerif Çelik",
        });
      return { ok: true, adet: a.length };
    }
    if (fn === "kartBasimlari") return [...kayitlar];
    if (fn === "kartBasimSil") {
      kayitlar = kayitlar.filter((k) => k.id !== a);
      return { ok: true };
    }
    if (fn === "getPlayer")
      return { ...satir(3, "Kaan Yıldız"), ucret_tipi: "normal", aylik_aidat: 3500, odeme_donemi: "1-10", kayit_tarihi: "2026-09-01" };
    if (fn === "listGuardians")
      return [{ id: 1, ad_soyad: "Ayşe Yıldız", gsm: "05321112233", whatsapp_no: "", veli_mi: 1, mesaj_onayi: 1 }];
    return [];
  });
  const yazdir = vi.fn(async () => ({ ok: true }));
  window.okul = {
    db,
    files: { dataUrl: vi.fn(async () => ""), open: vi.fn() },
    app: { marka: vi.fn(async () => ({ logo: "", kulupAdi: "Eyüpspor Kulübü", tema: { ana: "#5b2d8e", vurgu: "#f5d000" } })) },
    cikti: { yazdir, pdfAc: vi.fn(async () => ({ ok: true })), excelKaydet: vi.fn(), pdfKaydet: vi.fn() },
  };
  return { db, yazdir };
}
const pencereAc = async (saltOkunur = false) => {
  render(
    <ToastSaglayici>
      <Oyuncular oturum={{ role: "admin" }} saltOkunur={saltOkunur} />
    </ToastSaglayici>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Kartları Yazdır/ }));
  const d = await screen.findByRole("dialog");
  await within(d).findByText("Giriş Kartları");
  return d;
};

describe("Giriş Kartları penceresi", () => {
  it("Kartları Yazdır pencereyi açar; varsayılan süzgeç Basılmamış; Yazdır seçim yokken pasif", async () => {
    const { yazdir } = kopru();
    const d = await pencereAc();
    expect(within(d).getByLabelText("Kart süzgeci")).toHaveValue("basilmamis");
    await within(d).findByText("Ela Demir");
    expect(within(d).queryByText("Kerem Yılmaz")).toBeNull(); // basılmış olan listede değil
    expect(within(d).getByTestId("kart-sayac")).toHaveTextContent("2 oyuncu");
    expect(within(d).getByText("0 oyuncu seçildi")).toBeInTheDocument();
    const yazdirB = within(d).getByRole("button", { name: /^Yazdır/ });
    expect(yazdirB).toBeDisabled();
    fireEvent.click(yazdirB);
    expect(yazdir).not.toHaveBeenCalled();
  });
  it("başlıktaki kutu tümünü seçer; Yazdır (2) toplu HTML basar, kayıt düşer, seçim temizlenir, liste yenilenir", async () => {
    const { db, yazdir } = kopru();
    const d = await pencereAc();
    await within(d).findByText("Ela Demir");
    fireEvent.click(within(d).getByLabelText("Süzgeçtekilerin tümünü seç"));
    expect(within(d).getByText("2 oyuncu seçildi")).toBeInTheDocument();
    expect(within(d).getByText(/2 sayfa \(ön \+ arka\)/)).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: "Yazdır (2)" }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    const html = String(yazdir.mock.calls[0][0]);
    expect(html).toContain('class="sayfa toplu"');
    expect(html).toContain("Ela Demir");
    expect(html).toContain("Mert Aksoy");
    expect(html).toContain("Veli Ela Demir"); // veli listeden (ek IPC yok)
    await waitFor(() => expect(db).toHaveBeenCalledWith("kartBasimKaydet", [2, 4], "2026-2027", "toplu"));
    expect(db).not.toHaveBeenCalledWith("listGuardians", expect.anything());
    await screen.findByText(/2 kart, 2 sayfa \(ön \+ arka\) basıma gönderildi/);
    await waitFor(() => expect(within(d).getByText("0 oyuncu seçildi")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // pencere açık kalır
  });
  it("Kart: Tümü'de basılmış biri seçilince sarı not; tek satır seçimi ve Temizle", async () => {
    kopru();
    const d = await pencereAc();
    fireEvent.change(within(d).getByLabelText("Kart süzgeci"), { target: { value: "tumu" } });
    await within(d).findByText("Kerem Yılmaz");
    expect(within(d).getByText("12.09.2026")).toBeInTheDocument();
    expect(within(d).getByText("2. basım · 12.09.2026")).toBeInTheDocument();
    fireEvent.click(within(d).getByLabelText("Seç: Kaan Yıldız"));
    fireEvent.click(within(d).getByLabelText("Seç: Ela Demir"));
    expect(within(d).getByText("2 oyuncu seçildi")).toBeInTheDocument();
    expect(within(d).getByText("1'i daha önce basılmış (Kaan Y.)")).toBeInTheDocument();
    // süzgeç Basılmamış'a dönünce Kaan listede değil ama seçili kalır
    fireEvent.change(within(d).getByLabelText("Kart süzgeci"), { target: { value: "basilmamis" } });
    await waitFor(() => expect(within(d).queryByText("Kaan Yıldız")).toBeNull());
    expect(within(d).getByText(/1'i şu an listede değil/)).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: "Temizle" }));
    expect(within(d).getByText("0 oyuncu seçildi")).toBeInTheDocument();
  });
  it("salt okunur lisansta basım çalışır ama kayıt yazılmaz", async () => {
    const { db, yazdir } = kopru();
    const d = await pencereAc(true);
    await within(d).findByText("Ela Demir");
    fireEvent.click(within(d).getByLabelText("Seç: Ela Demir"));
    fireEvent.click(within(d).getByRole("button", { name: "Yazdır (1)" }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    await screen.findByText(/basım kaydı tutulmadı/);
    expect(db).not.toHaveBeenCalledWith("kartBasimKaydet", expect.anything(), expect.anything(), expect.anything());
  });
});

describe("Oyuncu kartı › basım kaydı", () => {
  it("Giriş Kartı basınca tek kayıt düşer ve şerit görünür; yönetici 'Basılmadı say' ile son kaydı siler", async () => {
    const { db, yazdir } = kopru();
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={3} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    await screen.findByRole("button", { name: /Giriş Kartı/ });
    expect(screen.queryByTestId("kart-basim-seridi")).toBeNull(); // kayıt yokken şerit yok
    fireEvent.click(screen.getByRole("button", { name: /Giriş Kartı/ }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(db).toHaveBeenCalledWith("kartBasimKaydet", [3], "2026-2027", "tek"));
    const serit = await screen.findByTestId("kart-basim-seridi");
    expect(serit).toHaveTextContent("12.09.2026 (tek, Şerif Çelik)");
    fireEvent.click(within(serit).getByRole("button", { name: "Basılmadı say" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("kartBasimSil", 100));
    await waitFor(() => expect(screen.queryByTestId("kart-basim-seridi")).toBeNull());
  });
  it("kullanıcı rolünde 'Basılmadı say' yok; salt okunurda basım kaydı yazılmaz", async () => {
    const { db, yazdir } = kopru({
      basimlar: [{ id: 5, player_id: 3, sezon: "2026-2027", tur: "toplu", basim_zamani: "2026-09-11 09:00:00", kullanici: "" }],
    });
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={3} oturum={{ role: "kullanici" }} gruplar={[]} saltOkunur onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    const serit = await screen.findByTestId("kart-basim-seridi");
    expect(serit).toHaveTextContent("11.09.2026 (toplu)");
    expect(within(serit).queryByRole("button", { name: "Basılmadı say" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Giriş Kartı/ }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    expect(db).not.toHaveBeenCalledWith("kartBasimKaydet", expect.anything(), expect.anything(), expect.anything());
  });
});
