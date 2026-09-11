// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { Pano } from "../../src/components/Pano.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { guncelSezon } from "../../src/lib/sezon.js";

afterEach(cleanup);

const gruplar = [
  { id: 1, ad: "U11", aktif: 1 },
  { id: 2, ad: "U12", aktif: 1 },
];
const adaylar = [
  { id: 10, ad_soyad: "Ada Kaya", durum: "aktif", yas_grubu_id: 1, yas_grubu_ad: "U11", borc_adet: 0, borc_tutar: 0 },
  { id: 11, ad_soyad: "Barış Güneş", durum: "aktif", yas_grubu_id: 1, yas_grubu_ad: "U11", borc_adet: 2, borc_tutar: 7000 },
  { id: 12, ad_soyad: "Cem Polat", durum: "deneme", yas_grubu_id: 2, yas_grubu_ad: "U12", borc_adet: 0, borc_tutar: 0 },
];

describe("Ayarlar > Yeni Sezon sihirbazı", () => {
  it("yenileyenler işaretlenir, üst grup önerilir, geçiş tek çağrıyla yapılır", async () => {
    let durum = { aktifSezon: "2026-2027", baslangicAyi: 9, sonGecis: null, adaySayisi: 3 };
    window.okul = {
      db: vi.fn(async (fn, a) => {
        if (fn === "sezonDurumu") return durum;
        if (fn === "listAgeGroups") return gruplar;
        if (fn === "sezonAdayListesi") return adaylar;
        if (fn === "yeniSezonaGec") {
          durum = { ...durum, aktifSezon: a.sezon, sonGecis: "2027-09-01T10:00:00Z" };
          return {
            ok: true,
            sezon: a.sezon,
            yenilenen: a.yenileyenler.length,
            pasif: 3 - a.yenileyenler.length,
            grupDegisen: 1,
            borcSilinen: a.eskiBorcSil ? 2 : 0,
          };
        }
        if (fn === "getSetting") return "";
        if (fn === "listUsers") return [];
        return null;
      }),
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    expect(await screen.findByLabelText("Geçilecek sezon")).toHaveValue("2027-2028");
    expect(screen.getByTestId("sezon-ozet")).toHaveTextContent("0 oyuncu 2027-2028 sezonuna geçecek · 3 oyuncu pasife alınacak");
    fireEvent.click(screen.getByLabelText("Ada Kaya yeniledi"));
    fireEvent.click(screen.getByLabelText("Cem Polat yeniledi"));
    expect(screen.getByLabelText("Ada Kaya yeni grup")).toHaveValue("2"); // U11 → U12 önerisi
    expect(screen.getByLabelText("Cem Polat yeni grup")).toHaveValue("2"); // U13 yok → U12 kalır
    expect(screen.getByTestId("sezon-ozet")).toHaveTextContent("2 oyuncu 2027-2028 sezonuna geçecek · 1 oyuncu pasife alınacak");
    fireEvent.click(screen.getByLabelText(/ödenmemiş eski aidatını/));
    fireEvent.click(screen.getByRole("button", { name: "Yeni Sezona Geç" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("2027-2028 sezonuna geçilsin mi");
    fireEvent.click(within(dlg).getByRole("button", { name: "Evet" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("yeniSezonaGec", {
        sezon: "2027-2028",
        baslangic: "",
        bitis: "",
        eskiBorcSil: true,
        yenileyenler: [
          { id: 10, yas_grubu_id: 2 },
          { id: 12, yas_grubu_id: 2 },
        ],
      }),
    );
    await screen.findByText(/2027-2028 sezonuna geçildi\./);
    expect(screen.getByText(/2027-2028 sezonuna geçildi\./).closest("div")).toHaveTextContent(
      "2 oyuncu yeniledi (1 üst gruba taşındı), 1 oyuncu pasife alındı, 2 eski aidat kaydı silindi",
    ); // toast da role=status taşır
  });

  it("yaş grubu filtresi ve arama listeyi daraltır; 'Görünenleri işaretle' yalnız görünenleri işaretler, özet tüm listeyi sayar", async () => {
    window.okul = {
      db: vi.fn(async (fn) =>
        fn === "sezonDurumu"
          ? { aktifSezon: "2026-2027", baslangicAyi: 9, sonGecis: null, adaySayisi: 3 }
          : fn === "listAgeGroups"
            ? gruplar
            : fn === "sezonAdayListesi"
              ? adaylar
              : fn === "listUsers"
                ? []
                : null,
      ),
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    await screen.findByLabelText("Ada Kaya yeniledi");
    fireEvent.change(screen.getByLabelText("Yaş grubu filtresi"), { target: { value: "1" } });
    expect(screen.queryByLabelText("Cem Polat yeniledi")).toBeNull();
    expect(screen.getByText(/2 \/ 3 oyuncu gösteriliyor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Görünenleri yeniledi işaretle" }));
    expect(screen.getByTestId("sezon-ozet")).toHaveTextContent("2 oyuncu 2027-2028 sezonuna geçecek · 1 oyuncu pasife alınacak");
    fireEvent.change(screen.getByLabelText("Yaş grubu filtresi"), { target: { value: "" } });
    expect(screen.getByLabelText("Cem Polat yeniledi")).not.toBeChecked(); // filtre dışındaki dokunulmadı
    expect(screen.getByLabelText("Ada Kaya yeniledi")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Oyuncu ara"), { target: { value: "cem" } });
    expect(screen.queryByLabelText("Ada Kaya yeniledi")).toBeNull();
    expect(screen.getByLabelText("Cem Polat yeniledi")).toBeInTheDocument();
    // Türkçe duyarsız: "baris" ve "BARIŞ" Barış Güneş'i, "gunes" soyadı bulur
    fireEvent.change(screen.getByLabelText("Oyuncu ara"), { target: { value: "baris" } });
    expect(screen.getByLabelText("Barış Güneş yeniledi")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Oyuncu ara"), { target: { value: "GUNES" } });
    expect(screen.getByLabelText("Barış Güneş yeniledi")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cem Polat yeniledi")).toBeNull();
    fireEvent.change(screen.getByLabelText("Oyuncu ara"), { target: { value: "yok böyle" } });
    expect(screen.getByText("Filtreye uyan oyuncu yok.")).toBeInTheDocument();
    expect(screen.getByTestId("sezon-ozet")).toHaveTextContent("2 oyuncu 2027-2028 sezonuna geçecek"); // özet değişmedi
  });

  it("geçersiz sezon adıyla geçiş başlatılmaz; kullanıcı rolü bölümü göremez", async () => {
    window.okul = {
      db: vi.fn(async (fn) =>
        fn === "sezonDurumu"
          ? { aktifSezon: "", baslangicAyi: 9, sonGecis: null, adaySayisi: 1 }
          : fn === "listAgeGroups"
            ? gruplar
            : fn === "sezonAdayListesi"
              ? adaylar.slice(0, 1)
              : fn === "listUsers"
                ? []
                : null,
      ),
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    const sz = await screen.findByLabelText("Geçilecek sezon");
    fireEvent.change(sz, { target: { value: "2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Yeni Sezona Geç" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.okul.db).not.toHaveBeenCalledWith("yeniSezonaGec", expect.anything());
    cleanup();
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "hoca", role: "kullanici" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    expect(await screen.findByText(/yalnız yöneticiler/)).toBeInTheDocument();
  });
});

describe("Pano: sezon sonu hatırlatması", () => {
  const kur = (aktifSezon) => {
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "panoOzet") return { aktif: 1, grup: 1, odeyen: 0, borclu: 0, antrenmanlar: [], bugunTahsilat: 0 };
        if (fn === "listUnpaid") return [];
        if (fn === "sezonDurumu") return { aktifSezon, baslangicAyi: 1, sonGecis: null, adaySayisi: 1 }; // başlangıç Ocak → bugünün sezonu = yıl
        return [];
      }),
    };
  };
  it("aktif sezon eskiyse uyarı ve Yeni Sezona Geç düğmesi; güncelse uyarı yok", async () => {
    const onSezon = vi.fn();
    kur("2000-2001");
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} onSezon={onSezon} />
      </ToastSaglayici>,
    );
    const uyari = await screen.findByRole("alert");
    expect(uyari).toHaveTextContent("2000-2001 sezonu bitti");
    fireEvent.click(within(uyari).getByRole("button", { name: "Yeni Sezona Geç" }));
    expect(onSezon).toHaveBeenCalled();
    cleanup();
    const yil = new Date().getFullYear();
    kur(`${yil}-${yil + 1}`);
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} onSezon={onSezon} />
      </ToastSaglayici>,
    );
    await screen.findByText("Tesise Giriş Kontrolü");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Sezon tarihleri (plan §37)", () => {
  const durumTarihli = {
    aktifSezon: "2026-2027",
    baslangicAyi: 9,
    sonGecis: null,
    adaySayisi: 0,
    tarihler: { sezon: "2026-2027", baslangic: "2026-09-01", bitis: "2027-06-30", kayitli: true },
  };
  const okul = (ek = {}) => ({
    db: vi.fn(async (fn, ...a) => {
      if (fn === "sezonDurumu") return durumTarihli;
      if (fn === "listAgeGroups") return gruplar;
      if (fn === "sezonAdayListesi") return adaylar;
      if (fn === "sezonTarihKaydet") return { ok: true };
      if (fn === "yeniSezonaGec") return { ok: true, sezon: a[0].sezon, yenilenen: 0, pasif: 0, grupDegisen: 0, borcSilinen: 0 };
      if (fn === "getSetting") return "";
      if (fn === "listUsers") return [];
      return null;
    }),
    app: { version: async () => "0.1.0" },
    lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
    mod: { oku: async () => ({ mode: "yerel" }) },
    ...ek,
  });

  it("Ayarlar > Sezon: tarihler görünür, düzenlenip kaydedilir; bitiş başlangıçtan önceyse kaydedilmez", async () => {
    window.okul = okul();
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    expect(await screen.findByLabelText("Sezon başlangıcı")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Sezon bitişi")).toHaveValue("2027-06-30");
    expect(screen.getByText(/1 Eyl – 30 Haz/)).toBeInTheDocument();
    const kaydet = screen.getByRole("button", { name: "Tarihleri Kaydet" });
    expect(kaydet).toBeDisabled(); // değişiklik yok
    fireEvent.change(screen.getByLabelText("Sezon bitişi"), { target: { value: "2026-08-01" } });
    fireEvent.click(kaydet);
    expect(await screen.findByText("Bitiş başlangıçtan sonra olmalı")).toBeInTheDocument();
    expect(window.okul.db).not.toHaveBeenCalledWith("sezonTarihKaydet", expect.anything(), expect.anything(), expect.anything());
    fireEvent.change(screen.getByLabelText("Sezon bitişi"), { target: { value: "2027-08-31" } });
    fireEvent.click(kaydet);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("sezonTarihKaydet", "2026-2027", "2026-09-01", "2027-08-31"));
    expect(await screen.findByText("Sezon tarihleri kaydedildi")).toBeInTheDocument();
  });

  it("Yeni sezona geçiş: tarihler bir yıl kaydırılmış önerilir ve yeniSezonaGec'e gider", async () => {
    window.okul = okul();
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="sezon" />
      </ToastSaglayici>,
    );
    expect(await screen.findByLabelText("Yeni sezon başlangıcı")).toHaveValue("2027-09-01");
    expect(screen.getByLabelText("Yeni sezon bitişi")).toHaveValue("2028-06-30");
    fireEvent.change(screen.getByLabelText("Yeni sezon bitişi"), { target: { value: "2028-07-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Yeni Sezona Geç" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Evet" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith(
        "yeniSezonaGec",
        expect.objectContaining({ sezon: "2027-2028", baslangic: "2027-09-01", bitis: "2028-07-15" }),
      ),
    );
  });

  it("Pano: sezon satırı kalan günü gösterir; bitişe 30 gün kala hatırlatma şeridi çıkar", async () => {
    // Bugünün tarihine göre bitiş: 20 gün sonra
    const bugun = new Date();
    const ekle = (g) => {
      const d = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() + g);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const sezonEtiketi = guncelSezon(ekle(0), 9); // bugünün sezonu → "sezon bitti" şeridi çıkmaz
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "panoOzet") return { aktif: 0, grup: 0, odeyen: 0, borclu: 0, antrenmanlar: [], bugunTahsilat: 0 };
        if (fn === "sezonDurumu")
          return {
            aktifSezon: sezonEtiketi,
            baslangicAyi: 9,
            sonGecis: null,
            adaySayisi: 0,
            tarihler: { sezon: sezonEtiketi, baslangic: ekle(-300), bitis: ekle(20), kayitli: true },
          };
        return [];
      }),
    };
    const onSezon = vi.fn();
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} onSezon={onSezon} />
      </ToastSaglayici>,
    );
    await waitFor(() => expect(screen.getByText("20 gün kaldı")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(`${sezonEtiketi} sezonu 20 gün sonra bitiyor`);
    fireEvent.click(screen.getByRole("button", { name: "Sezon Ayarları" }));
    expect(onSezon).toHaveBeenCalled();
  });
});
