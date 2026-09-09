// @vitest-environment jsdom
// Sayfalama sınır durumları ve sabit yükseklikli kaydırma kapları (plan §22): sayfa taşması, yeni Önizle'de ilk sayfa, oyuncu kartında
// makbuz/yoklama "Tümünü göster", Tahsilat bugünkü makbuzlar kabı + sayacı, WhatsApp penceresi "n alıcı" sayacı.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { Raporlar } from "../../src/components/Raporlar.jsx";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { Tahsilat } from "../../src/components/Tahsilat.jsx";
import { WhatsAppHatirlat } from "../../src/components/WhatsAppHatirlat.jsx";
import { aidatDegerleri } from "../../src/lib/whatsapp.js";

afterEach(cleanup);

const oyuncu = (i, ek = {}) => ({
  id: i,
  ad_soyad: `Oyuncu ${String(i).padStart(3, "0")}`,
  uyruk: "tc",
  dogum_tarihi: "2015-01-01",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 1,
  aidat_durum: "odenmedi",
  ...ek,
});

describe("Oyuncular: sayfa taşması", () => {
  it("3. sayfadayken liste küçülürse (silme) sunucunun döndürdüğü son sayfaya çekilir", async () => {
    let hepsi = Array.from({ length: 120 }, (_, i) => oyuncu(i + 1));
    window.okul = {
      db: vi.fn(async (fn, a) => {
        if (fn === "listAgeGroups") return [];
        if (fn === "getPlayer") return { ...oyuncu(a), odeme_donemi: "1-10", kayit_tarihi: "2026-09-01", updated_at: "2026-09-01" };
        if (fn === "playersPage") {
          const boy = a.sayfaBoyu,
            son = Math.max(1, Math.ceil(hepsi.length / boy)),
            s = Math.min(son, a.sayfa); // db.playersPage gibi: taşan sayfa son sayfaya çekilir
          return { liste: hepsi.slice((s - 1) * boy, s * boy), toplam: hepsi.length, sayfa: s, sayfaBoyu: boy };
        }
        if (fn === "getSetting") return "";
        return [];
      }),
      cikti: {},
      files: { dataUrl: vi.fn(async () => ""), open: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Oyuncular oturum={{ role: "admin" }} saltOkunur={false} />
      </ToastSaglayici>,
    );
    await screen.findByText("Oyuncu 001");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sonraki sayfa" }));
    await screen.findByText("101–120 / 120 oyuncu");
    await screen.findByText("Oyuncu 101"); // gecikmeli yükleme tamamlansın
    // Liste 60'a düşer (başka yerde silme); filtre değişmeden yeniden yükleme (oyuncu kartı kapanınca) 3. sayfayı ister,
    // sunucu 2. sayfayı döndürür, arayüz ona geçer
    hepsi = hepsi.slice(0, 60);
    fireEvent.click(screen.getByText("Oyuncu 101")); // kartı aç
    fireEvent.click((await screen.findAllByRole("button", { name: "Kapat" })).at(-1)); // kart başlığındaki Kapat → yukle() (sayfa hâlâ 3)
    await screen.findByText("51–60 / 60 oyuncu");
    expect(window.okul.db.mock.calls.some((c) => c[0] === "playersPage" && c[1].sayfa === 3)).toBe(true); // 3 istendi, 2 geldi
    expect(screen.getByRole("navigation", { name: "Sayfalama" })).toHaveTextContent("Sayfa 2 / 2");
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeDisabled();
  });
});

describe("Raporlar: yeni Önizle ilk sayfaya döner", () => {
  it("2. sayfadayken Önizle → 1–100 gösterilir", async () => {
    const l = Array.from({ length: 150 }, (_, i) => oyuncu(i + 1));
    window.okul = {
      db: vi.fn(async (fn) => (fn === "listAgeGroups" ? [] : fn === "listPlayersWithDue" ? l : null)),
      cikti: {},
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Raporlar />
      </ToastSaglayici>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await screen.findByText("1–100 / 150 satır");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("101–150 / 150 satır")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Önizle" }));
    await screen.findByText("1–100 / 150 satır");
    expect(screen.getByText("Oyuncu 001")).toBeInTheDocument();
  });
});

describe("Oyuncu kartı: makbuz ve yoklama sınırları", () => {
  it("12 makbuz / 40 yoklama sınırında 'Tümünü göster' tam listeyi ister; sınır altında satır yok", async () => {
    const makbuzlar = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      makbuz_no: `2026-${String(i + 1).padStart(4, "0")}`,
      tarih: "2026-08-05",
      toplam: 100,
      odeme_yontemi: "nakit",
      iptal: 0,
    }));
    const yoklama = Array.from({ length: 40 }, (_, i) => ({ durum: "geldi", tarih: `2026-0${1 + (i % 9)}-1${i % 10}`, saat: "18:00" }));
    window.okul = {
      db: vi.fn(async (fn, _id, a) => {
        if (fn === "getPlayer") return { ...oyuncu(7), odeme_donemi: "1-10", kayit_tarihi: "2026-09-01", updated_at: "2026-09-01" };
        if (fn === "listDues") return [{ id: 1, yil: 2026, ay: 9, tutar: 100, odenen: 100, durum: "odendi" }]; // 1 dönem: sınır satırı yok
        if (fn === "listReceipts") return a === null ? [...makbuzlar, { ...makbuzlar[0], id: 99, makbuz_no: "2025-0001" }] : makbuzlar;
        if (fn === "playerAttendanceSon") return yoklama;
        if (fn === "playerAttendance") return [...yoklama, { durum: "gelmedi", tarih: "2025-12-01", saat: "18:00" }];
        if (fn === "attendanceSummary") return [{ durum: "geldi", n: 40 }];
        return [];
      }),
      files: { dataUrl: vi.fn(async () => ""), addDocument: vi.fn(), open: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={7} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={vi.fn()} onMakbuzKes={vi.fn()} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Ödemeler/ }));
    expect(await screen.findByText("Son 12 makbuz gösteriliyor")).toBeInTheDocument();
    expect(screen.queryByText("Son 12 dönem gösteriliyor")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Tümünü göster" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Tümünü göster" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("listReceipts", 7, null));
    expect(await screen.findByText("2025-0001")).toBeInTheDocument();
    expect(screen.queryByText("Son 12 makbuz gösteriliyor")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Yoklama" }));
    expect(await screen.findByText("Son 40 yoklama gösteriliyor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tümünü göster" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("playerAttendance", 7, "1900-01-01", "2999-12-31"));
    expect(await screen.findByText("01.12.2025")).toBeInTheDocument();
    expect(screen.queryByText("Son 40 yoklama gösteriliyor")).toBeNull();
  });
});

describe("Tahsilat: Bugün Kesilen Makbuzlar", () => {
  it("30 makbuzun hepsi listelenir, sayaç '30 makbuz', tablo 460px kaydırmalı kapta ve başlık yapışık", async () => {
    const bugunku = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      makbuz_no: `2026-${String(i + 1).padStart(4, "0")}`,
      ad_soyad: `Makbuz Oyuncu ${i + 1}`,
      toplam: 100,
      odeme_yontemi: "nakit",
      tahsil_eden: "Y",
      pdf_yolu: "",
    }));
    window.okul = {
      db: vi.fn(async (fn) => (fn === "listReceiptsByDate" ? bugunku : fn === "getSetting" ? "" : [])),
      cikti: { yazdir: vi.fn() },
      files: { open: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} />
      </ToastSaglayici>,
    );
    await screen.findByText("Makbuz Oyuncu 30");
    expect(screen.getByText("30 makbuz")).toBeInTheDocument();
    const tablo = screen.getByText("Makbuz Oyuncu 1").closest("table");
    expect(within(tablo).getAllByRole("row")).toHaveLength(31); // başlık + 30
    expect(tablo.parentElement).toHaveStyle({ overflow: "auto", maxHeight: "460px" });
    expect(tablo.querySelector("thead")).toHaveStyle({ position: "sticky", top: "0px" });
  });
});

describe("WhatsApp toplu pencere: alıcı sayacı ve kaydırma kabı", () => {
  const alici = (k, ek = {}) => ({
    key: k,
    player_id: Number(k),
    guardian_id: 100 + Number(k),
    oyuncu_ad: `Oyuncu ${k}`,
    veli_ad: `Veli ${k}`,
    grup: "U11",
    numara: "0532 111 22 3" + (k % 10),
    onay: 1,
    mesaj_id: null,
    hatirlatma: 0,
    ek: { kalan: "100 ₺", gecikme: 1 },
    degerler: aidatDegerleri({
      veli_ad: `Veli ${k}`,
      ad_soyad: `Oyuncu ${k}`,
      yil: 2026,
      ay: 9,
      tutar: 100,
      kalan: 100,
      odeme_donemi: "1-10",
      yas_grubu_ad: "U11",
    }),
    ...ek,
  });
  it("60 alıcıda '60 alıcı · 2 numarasız/onaysız', hepsi listelenir, tablo kaydırmalı kapta", async () => {
    window.okul = {
      app: { whatsappAc: vi.fn(async () => ({ ok: true })) },
      db: vi.fn(async (fn, ...a) => (fn === "getSetting" ? (a[0] === "kulup_adi" ? "TEST" : "") : null)),
    };
    const alicilar = Array.from({ length: 60 }, (_, i) => alici(String(i + 1)));
    alicilar[3] = alici("4", { numara: "" });
    alicilar[7] = alici("8", { onay: 0 });
    render(
      <ToastSaglayici>
        <WhatsAppHatirlat
          tur="aidat"
          baslik="Borçlulara WhatsApp ile Hatırlat"
          altBaslik="Eylül 2026"
          alicilar={alicilar}
          kayit={{ yil: 2026, ay: 9 }}
          saltOkunur={false}
          onKapat={vi.fn()}
        />
      </ToastSaglayici>,
    );
    await screen.findByTestId("wa-onizleme");
    expect(screen.getByText("60 alıcı · 2 numarasız/onaysız")).toBeInTheDocument();
    const tablo = screen.getByText("Veli 60").closest("table");
    expect(within(tablo).getAllByRole("row")).toHaveLength(61);
    expect(tablo.parentElement).toHaveStyle({ overflow: "auto", maxHeight: "calc(100vh - 320px)" });
  });
  it("tek alıcı ve engel yoksa yalnız '1 alıcı'", async () => {
    window.okul = { app: { whatsappAc: vi.fn() }, db: vi.fn(async () => "") };
    render(
      <ToastSaglayici>
        <WhatsAppHatirlat
          tur="aidat"
          baslik="B"
          altBaslik="A"
          alicilar={[alici("1")]}
          kayit={{ yil: 2026, ay: 9 }}
          saltOkunur={false}
          onKapat={vi.fn()}
        />
      </ToastSaglayici>,
    );
    await screen.findByTestId("wa-onizleme");
    expect(screen.getByText("1 alıcı")).toBeInTheDocument();
  });
});
