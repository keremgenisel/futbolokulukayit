// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { Pano } from "../../src/components/Pano.jsx";

afterEach(cleanup);

describe("Pano — tesise giriş kontrolü", () => {
  beforeEach(() => {
    window.okul = {
      db: vi.fn(async (fn, arg) => {
        if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 1, antrenmanlar: [], bugunTahsilat: 0 };
        if (fn === "listUnpaid")
          return [
            {
              id: 5,
              player_id: 2,
              ad_soyad: "Kaan Yıldız",
              yas_grubu_ad: "U11",
              odeme_donemi: "1-10",
              yil: 2026,
              ay: 9,
              tutar: 3500,
              veli_tel: "05321112233",
              veli_ad: "Ayşe Yıldız",
            },
          ];
        if (fn === "listPlayersWithDue" && arg?.q)
          return [
            { id: 1, ad_soyad: "Kerem Yılmaz", durum: "aktif", yas_grubu_ad: "U12", aidat_durum: "odendi" },
            { id: 2, ad_soyad: "Kaan Yıldız", durum: "aktif", yas_grubu_ad: "U11", aidat_durum: "odenmedi" },
            { id: 3, ad_soyad: "Deniz Koç", durum: "dondurma", yas_grubu_ad: "U10", aidat_durum: null },
          ];
        return [];
      }),
    };
  });

  it("ödeyen girebilir, ödemeyen aidat borcu, dondurmadaki giremez", async () => {
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("Tesise Giriş Kontrolü"));
    fireEvent.change(screen.getByLabelText("Tesise giriş araması"), { target: { value: "K" } });
    await waitFor(() => expect(screen.getByText("Kerem Yılmaz")).toBeInTheDocument());
    expect(screen.getByText("GİREBİLİR")).toBeInTheDocument();
    expect(screen.getByText("AİDAT BORCU")).toBeInTheDocument();
    expect(screen.getByText("GİREMEZ")).toBeInTheDocument();
  });

  it("borçlu listesinden Makbuz düğmesi oyuncuyla tahsilata gider", async () => {
    const onMakbuzKes = vi.fn();
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={onMakbuzKes} />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("Kaan Yıldız"));
    fireEvent.click(screen.getByRole("button", { name: "Makbuz" }));
    expect(onMakbuzKes).toHaveBeenCalledWith(2);
  });

  it("salt okunur modda makbuz ve yeni oyuncu düğmeleri yok", async () => {
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} saltOkunur />
      </ToastSaglayici>,
    );
    await waitFor(() => screen.getByText("Kaan Yıldız"));
    expect(screen.queryByRole("button", { name: "Makbuz Kes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Makbuz" })).toBeNull();
  });

  it("sağlık raporu uyarıları: kart ve sayaç; satır tıklanınca oyuncu kartı", async () => {
    window.okul.db.mockImplementation(async (fn) => {
      if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 1, antrenmanlar: [], bugunTahsilat: 0 };
      if (fn === "saglikRaporuDurumu")
        return {
          toplam: 3,
          doldu: 1,
          dolacak: 1,
          yok: 0,
          uyarilar: [
            { player_id: 2, ad_soyad: "Kaan Yıldız", yas_grubu_ad: "U11", gecerlilik: "2020-01-01", durum: "doldu" },
            {
              player_id: 3,
              ad_soyad: "Ela Demir",
              yas_grubu_ad: "U11",
              gecerlilik: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
              durum: "dolacak",
            },
          ],
        };
      return [];
    });
    const onOyuncu = vi.fn();
    render(
      <ToastSaglayici>
        <Pano onOyuncu={onOyuncu} onSekme={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    await screen.findByText("Sağlık Raporu Uyarıları");
    expect(screen.getByText("1 doldu · 1 dolacak · 0 yok")).toBeInTheDocument();
    expect(screen.getByText(/Süresi doldu/)).toBeInTheDocument();
    expect(screen.getByText("5 gün kaldı")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Kaan Yıldız"));
    expect(onOyuncu).toHaveBeenCalledWith(2);
  });

  it("sağlık uyarıları en acil önce sıralı; ilk 8 satır; 'Tümü (n)' Oyuncular ekranını sağlık filtresiyle açar", async () => {
    const uyarilar = Array.from({ length: 11 }, (_, i) => ({
      player_id: 100 + i,
      ad_soyad: `Oyuncu ${String(i).padStart(2, "0")}`,
      yas_grubu_ad: "U11",
      gecerlilik: null,
      durum: "yok",
    }));
    uyarilar.push({ player_id: 200, ad_soyad: "Acil Dolmuş", yas_grubu_ad: "U12", gecerlilik: "2020-01-01", durum: "doldu" });
    window.okul.db.mockImplementation(async (fn) => {
      if (fn === "panoOzet") return { aktif: 12, grup: 2, odeyen: 1, borclu: 0, antrenmanlar: [], bugunTahsilat: 0 };
      if (fn === "saglikRaporuDurumu") return { toplam: 12, doldu: 1, dolacak: 0, yok: 11, uyarilar };
      return [];
    });
    const onSekme = vi.fn();
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={onSekme} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    await screen.findByText("Sağlık Raporu Uyarıları");
    expect(screen.getByText("(12)")).toBeInTheDocument();
    const satirlar = () => screen.getAllByRole("row").filter((r) => /Oyuncu \d\d|Acil Dolmuş/.test(r.textContent));
    expect(satirlar()).toHaveLength(8);
    expect(satirlar()[0]).toHaveTextContent("Acil Dolmuş"); // "yok" olanlar listede önce gelse de dolmuş rapor başa alınır
    expect(screen.queryByText("Oyuncu 10")).toBeNull();
    const tumu = screen.getAllByRole("link", { name: "Tümü (12)" });
    expect(tumu).toHaveLength(1);
    fireEvent.click(tumu[0]);
    expect(onSekme).toHaveBeenCalledWith("oyuncular", "saglik");
  });

  it("borçlu listesinde veli telefonu görünür ve tıklayınca kopyalanır", async () => {
    const yaz = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText: yaz } });
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    const tel = await screen.findByRole("button", { name: "05321112233 kopyala" });
    fireEvent.click(tel);
    await waitFor(() => expect(yaz).toHaveBeenCalledWith("05321112233"));
    expect(await screen.findByText("Ayşe Yıldız 05321112233 kopyalandı")).toBeInTheDocument();
  });
});

// Karakterizasyon (refactor 2. tur §9, 11.09.2026): Pano'nun antrenman kartı rozetleri, WhatsApp hatırlatma düğmeleri ve bağlantılar.
describe("Pano — bugünkü antrenmanlar ve borçlu eylemleri (karakterizasyon)", () => {
  const borclular = [
    {
      id: 5,
      player_id: 2,
      ad_soyad: "Kaan Yıldız",
      yas_grubu_ad: "U11",
      odeme_donemi: "1-10",
      yil: 2026,
      ay: 9,
      tutar: 3500,
      veli_tel: "05321112233",
      veli_ad: "Ayşe Yıldız",
      veli_id: 7,
      veli_onay: 1,
    },
    {
      id: 6,
      player_id: 3,
      ad_soyad: "Deniz Koç",
      yas_grubu_ad: "U10",
      odeme_donemi: "1-10",
      yil: 2026,
      ay: 9,
      tutar: 3500,
      veli_tel: "05329998877",
      veli_ad: "Can Koç",
      veli_id: 8,
      veli_onay: 0,
    },
  ];
  const antrenmanlar = [
    { id: 1, saat: "17:00", saha: "Saha 1", yas_grubu_ad: "U11", oyuncu: 10, isaretli: 10, geldi: 9, iptal: 0 },
    { id: 2, saat: "18:00", saha: "", yas_grubu_ad: "U12", oyuncu: 8, isaretli: 3, geldi: 3, iptal: 0 },
    { id: 3, saat: "19:00", saha: "Saha 2", yas_grubu_ad: "U13", oyuncu: 6, isaretli: 0, geldi: 0, iptal: 0 },
    { id: 4, saat: "", saha: "", yas_grubu_ad: "U14", oyuncu: 5, isaretli: 0, geldi: 0, iptal: 1 },
  ];
  const kur = (saltOkunur = false) => {
    const onSekme = vi.fn();
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 2, antrenmanlar, bugunTahsilat: 0 };
        if (fn === "listUnpaid") return borclular;
        if (fn === "getSetting") return "";
        return [];
      }),
    };
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={onSekme} onMakbuzKes={() => {}} saltOkunur={saltOkunur} />
      </ToastSaglayici>,
    );
    return onSekme;
  };

  it("antrenman kartları: saat/saha/oyuncu metni ve durum rozeti (alındı / devam / bekliyor / iptal); 'Yoklama' bağlantısı sekmeye gider", async () => {
    const onSekme = kur();
    await screen.findByText("U11 · Saha 1");
    expect(screen.getByText("10 oyuncu · 9 geldi")).toBeInTheDocument();
    expect(screen.getByText("Yoklama alındı")).toBeInTheDocument();
    expect(screen.getByText("Devam ediyor")).toBeInTheDocument();
    expect(screen.getByText("Yoklama bekliyor")).toBeInTheDocument();
    expect(screen.getByText("İptal")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1); // saatsiz antrenman
    fireEvent.click(screen.getByRole("link", { name: "Yoklama" }));
    expect(onSekme).toHaveBeenCalledWith("yoklama");
  });

  it("borçlular: 'Tümü (n)' Oyuncular'ı borçlu filtresiyle açar; 'Borçlulara Hatırlat' toplu WhatsApp penceresini açar", async () => {
    const onSekme = kur();
    await screen.findByText("Kaan Yıldız");
    fireEvent.click(screen.getByRole("link", { name: "Tümü (2)" }));
    expect(onSekme).toHaveBeenCalledWith("oyuncular", "borclu");
    fireEvent.click(screen.getByRole("button", { name: "Borçlulara Hatırlat" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("Borçlulara WhatsApp ile Hatırlat");
    expect(dlg).toHaveTextContent("2 borçlu");
  });

  it("satır WhatsApp düğmesi: onaylı veli açık, onaysız veli kapalı ve nedeni başlıkta; tıklayınca tek alıcılı pencere", async () => {
    kur();
    await screen.findByText("Kaan Yıldız");
    const acik = screen.getByRole("button", { name: "Kaan Yıldız WhatsApp" });
    const kapali = screen.getByRole("button", { name: "Deniz Koç WhatsApp" });
    expect(acik).toBeEnabled();
    expect(kapali).toBeDisabled();
    expect(kapali).toHaveAttribute("title", "Mesaj onayı yok");
    fireEvent.click(acik);
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("WhatsApp ile Aidat Hatırlat");
    expect(dlg).toHaveTextContent("Ayşe Yıldız");
    expect(dlg).not.toHaveTextContent("Can Koç");
  });

  it("salt okunur: satırda Makbuz düğmesi yok ama WhatsApp düğmesi ve Hatırlat duruyor", async () => {
    kur(true);
    await screen.findByText("Kaan Yıldız");
    expect(screen.queryByRole("button", { name: "Makbuz" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kaan Yıldız WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borçlulara Hatırlat" })).toBeInTheDocument();
  });
});
