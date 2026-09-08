// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { WhatsAppHatirlat } from "../../src/components/WhatsAppHatirlat.jsx";
import { Pano } from "../../src/components/Pano.jsx";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { aidatDegerleri } from "../../src/lib/whatsapp.js";

afterEach(cleanup);

const alici = (k, ek = {}) => ({
  key: k,
  player_id: Number(k),
  guardian_id: 100 + Number(k),
  oyuncu_ad: `Oyuncu ${k}`,
  veli_ad: `Veli ${k}`,
  grup: "U11",
  numara: "0532 111 22 3" + k,
  onay: 1,
  mesaj_id: null,
  hatirlatma: 0,
  ek: { kalan: "3.500 ₺", gecikme: 12 },
  degerler: aidatDegerleri({
    veli_ad: `Veli ${k}`,
    ad_soyad: `Oyuncu ${k}`,
    yil: 2026,
    ay: 9,
    tutar: 3500,
    kalan: 3500,
    odeme_donemi: "1-10",
    yas_grubu_ad: "U11",
  }),
  ...ek,
});

describe("WhatsApp toplu hatırlatma penceresi", () => {
  let kayitlar;
  beforeEach(() => {
    kayitlar = [];
    window.okul = {
      app: { whatsappAc: vi.fn(async () => ({ ok: true })) },
      db: vi.fn(async (fn, ...a) => {
        if (fn === "getSetting") return a[0] === "kulup_adi" ? "TEST KULÜBÜ" : "";
        if (fn === "mesajKaydet") {
          const id = kayitlar.length + 1;
          kayitlar.push({ id, ...a[0] });
          return { id };
        }
        if (fn === "mesajSil") {
          kayitlar = kayitlar.filter((m) => m.id !== a[0]);
          return {};
        }
        return null;
      }),
    };
  });
  const kur = (alicilar, ek = {}) =>
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
          {...ek}
        />
      </ToastSaglayici>,
    );

  it("uygun veliye WhatsApp'ta Aç: wa numarası + doldurulmuş şablonla köprü çağrılır, kayıt yazılır, satır Hatırlatıldı olur; Geri al siler", async () => {
    kur([alici("1"), alici("2")]);
    await screen.findByTestId("wa-onizleme");
    expect(screen.getByTestId("wa-onizleme")).toHaveTextContent("Sayın Veli 1, Oyuncu 1 için Eylül 2026 aidatı (3.500 ₺)");
    expect(screen.getByTestId("wa-onizleme")).toHaveTextContent("TEST KULÜBÜ"); // kulüp adı ayardan
    expect(screen.getByTestId("wa-sayac")).toHaveTextContent("0 / 2 hatırlatıldı");
    fireEvent.click(screen.getByRole("button", { name: "Veli 1 WhatsApp'ta aç" }));
    await waitFor(() =>
      expect(window.okul.app.whatsappAc).toHaveBeenCalledWith(
        "905321112231",
        expect.stringContaining("Sayın Veli 1, Oyuncu 1 için Eylül 2026 aidatı (3.500 ₺)"),
      ),
    );
    await waitFor(() => expect(kayitlar).toHaveLength(1));
    expect(kayitlar[0]).toMatchObject({ player_id: 1, guardian_id: 101, tur: "aidat", yil: 2026, ay: 9 });
    expect(await screen.findByText("Hatırlatıldı")).toBeInTheDocument();
    expect(screen.getByTestId("wa-sayac")).toHaveTextContent("1 / 2 hatırlatıldı");
    expect(screen.getByTestId("wa-onizleme")).toHaveTextContent("Veli 2"); // önizleme sıradakine geçti
    fireEvent.click(screen.getByRole("button", { name: "Geri al" }));
    await waitFor(() => expect(kayitlar).toHaveLength(0));
    expect(screen.queryByText("Hatırlatıldı")).toBeNull();
  });

  it("numarasız ve onaysız satır kapalı ve nedeni yazılı; Sıradakini Aç ilk uygun veliyi açar; alt çubuk engel sayısını söyler", async () => {
    kur([alici("1", { numara: "" }), alici("2", { onay: 0 }), alici("3")]);
    await screen.findByTestId("wa-onizleme");
    expect(screen.getByText("Veli numarası yok")).toBeInTheDocument();
    expect(screen.getByText("Mesaj onayı yok")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Veli 1 WhatsApp'ta aç" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Veli 2 WhatsApp'ta aç" })).toBeDisabled();
    expect(screen.getByText(/2 veliye açılamaz: 1 veli numarası yok, 1 mesaj onayı yok/)).toBeInTheDocument();
    expect(screen.queryByTestId("wa-sayac")).toBeNull(); // tek uygun alıcıda sayaç yok
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp'ta Aç" }));
    await waitFor(() => expect(window.okul.app.whatsappAc).toHaveBeenCalledWith("905321112233", expect.any(String)));
  });

  it("köprü hata dönerse kayıt yazılmaz ve hata gösterilir; salt okunurda bağlantı açılır ama kayıt tutulmaz", async () => {
    window.okul.app.whatsappAc = vi.fn(async () => ({ error: "WhatsApp açılamadı: yok" }));
    const { unmount } = kur([alici("1")]);
    await screen.findByTestId("wa-onizleme");
    fireEvent.click(screen.getByRole("button", { name: "Veli 1 WhatsApp'ta aç" }));
    expect(await screen.findByText("WhatsApp açılamadı: yok")).toBeInTheDocument();
    expect(kayitlar).toHaveLength(0);
    unmount();
    window.okul.app.whatsappAc = vi.fn(async () => ({ ok: true }));
    kur([alici("1")], { saltOkunur: true });
    await screen.findByTestId("wa-onizleme");
    fireEvent.click(screen.getByRole("button", { name: "Veli 1 WhatsApp'ta aç" }));
    await waitFor(() => expect(window.okul.app.whatsappAc).toHaveBeenCalled());
    expect(await screen.findByText("Hatırlatıldı")).toBeInTheDocument();
    expect(window.okul.db).not.toHaveBeenCalledWith("mesajKaydet", expect.anything());
  });

  it("düzenlenebilir modda (genel mesaj) metin değiştirilip o metinle açılır; bu ay ikinci hatırlatma uyarısı", async () => {
    render(
      <ToastSaglayici>
        <WhatsAppHatirlat
          tur="genel"
          baslik="WhatsApp Mesajı"
          alicilar={[alici("1", { hatirlatma: 1 })]}
          duzenlenebilir
          saltOkunur={false}
          onKapat={vi.fn()}
        />
      </ToastSaglayici>,
    );
    const ta = await screen.findByLabelText("Mesaj metni");
    expect(ta).toHaveValue("Sayın Veli 1, Oyuncu 1 hakkında:");
    expect(screen.getByText("bu ay 2. kez")).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: "Merhaba, yarın forma dağıtımı var." } });
    fireEvent.click(screen.getByRole("button", { name: "Veli 1 WhatsApp'ta aç" }));
    await waitFor(() => expect(window.okul.app.whatsappAc).toHaveBeenCalledWith("905321112231", "Merhaba, yarın forma dağıtımı var."));
    expect(kayitlar[0]).toMatchObject({ tur: "genel", metin: "Merhaba, yarın forma dağıtımı var." });
  });
});

describe("WhatsApp bildirim penceresi — veli grubuna tek mesaj", () => {
  it("Veli Grubuna Gönder: numarasız bağlantı 'Sayın Veliler' metniyle açılır, kayıt düşer, blok yeşile döner; tek tek liste kalır", async () => {
    window.okul = {
      app: { whatsappAc: vi.fn(async () => ({ ok: true })) },
      db: vi.fn(async (fn, ...a) => {
        if (fn === "getSetting") return a[0] === "kulup_adi" ? "TEST KULÜBÜ" : "";
        if (fn === "grupBildirimKaydet") return { ok: true };
        if (fn === "grupBildirimSil" || fn === "mesajKaydet" || fn === "mesajSil") return fn === "mesajKaydet" ? { id: 77 } : {};
        return null;
      }),
    };
    const { antrenmanDegerleri } = await import("../../src/lib/whatsapp.js");
    const t = {
      tarih: "2026-09-08",
      saat: "18:30",
      saha: "Saha 2",
      yas_grubu_ad: "U11",
      degisiklik_notu: JSON.stringify({ eskiTarih: "2026-09-07", eskiSaat: "17:00" }),
    };
    const al = [
      {
        key: "1",
        player_id: 1,
        guardian_id: 5,
        oyuncu_ad: "Kaan",
        veli_ad: "Ayşe",
        grup: "U11",
        numara: "05321112233",
        onay: 1,
        degerler: antrenmanDegerleri(t, { veli_ad: "Ayşe", ad_soyad: "Kaan" }),
      },
    ];
    render(
      <ToastSaglayici>
        <WhatsAppHatirlat
          tur="degisiklik"
          baslik="Bildir"
          alicilar={al}
          kayit={{ training_id: 5 }}
          grup={{ ad: "U11", training_id: 5, gonderildi: false }}
          saltOkunur={false}
          onKapat={vi.fn()}
        />
      </ToastSaglayici>,
    );
    const blok = await screen.findByTestId("wa-grup");
    expect(blok).toHaveTextContent("U11 veli WhatsApp grubuna tek mesaj");
    fireEvent.click(within(blok).getByRole("button", { name: "Veli Grubuna Gönder" }));
    await waitFor(() =>
      expect(window.okul.app.whatsappAc).toHaveBeenCalledWith(
        "",
        "Sayın Veliler, U11 grubunun 7 Eylül 2026 Pazartesi 17:00 antrenmanı 8 Eylül 2026 Salı 18:30 saatine alınmıştır (Saha 2).\nTEST KULÜBÜ",
      ),
    );
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("grupBildirimKaydet", 5));
    expect(await within(blok).findByText("Gruba gönderildi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ayşe WhatsApp'ta aç" })).toBeInTheDocument(); // tek tek liste hâlâ var
    expect(screen.getByTestId("wa-onizleme")).toHaveTextContent("Sayın Ayşe,"); // tek tek önizleme kişiye özel kalır
    // Geri al: toplu
    fireEvent.click(within(blok).getByRole("button", { name: "Grup gönderimini geri al" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("grupBildirimSil", 5));
    expect(within(blok).getByRole("button", { name: "Veli Grubuna Gönder" })).toBeInTheDocument();
    // Geri al: tek tek (bildirim türünde de)
    fireEvent.click(screen.getByRole("button", { name: "Ayşe WhatsApp'ta aç" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("mesajKaydet", expect.objectContaining({ tur: "degisiklik", training_id: 5 })),
    );
    expect(await screen.findByText("Bildirildi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Geri al" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("mesajSil", 77));
    expect(screen.queryByText("Bildirildi")).toBeNull();
    expect(screen.getByRole("button", { name: "Ayşe WhatsApp'ta aç" })).toBeInTheDocument();
  });
});

describe("Pano — WhatsApp hatırlatma girişleri", () => {
  beforeEach(() => {
    window.okul = {
      app: { whatsappAc: vi.fn(async () => ({ ok: true })) },
      db: vi.fn(async (fn, ...a) => {
        if (fn === "panoOzet") return { aktif: 3, grup: 2, odeyen: 1, borclu: 2, antrenmanlar: [], bugunTahsilat: 0 };
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
              veli_id: 7,
              veli_wa: "05321112233",
              veli_onay: 1,
              hatirlatma: 1,
              son_hatirlatma: "2026-09-05 10:00:00",
            },
            {
              id: 6,
              player_id: 3,
              ad_soyad: "Cem Polat",
              yas_grubu_ad: "U12",
              odeme_donemi: "1-10",
              yil: 2026,
              ay: 9,
              tutar: 3500,
              veli_tel: "05329998877",
              veli_ad: "Ali Polat",
              veli_id: 8,
              veli_wa: "05329998877",
              veli_onay: 0,
              hatirlatma: 0,
            },
          ];
        if (fn === "getSetting") return "";
        if (fn === "mesajKaydet") return { id: 1 };
        return [];
      }),
    };
  });
  it("satır düğmesi onaysız velide kapalı; 'Borçlulara Hatırlat' toplu pencereyi açar, hatırlatılan tarih satırda görünür", async () => {
    render(
      <ToastSaglayici>
        <Pano onOyuncu={() => {}} onSekme={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    await screen.findByText("Kaan Yıldız");
    expect(screen.getByText("hatırlatıldı 05.09.2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kaan Yıldız WhatsApp" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cem Polat WhatsApp" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Borçlulara Hatırlat" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent("Borçlulara WhatsApp ile Hatırlat");
    expect(within(dlg).getByText("Mesaj onayı yok")).toBeInTheDocument();
    expect(within(dlg).getByText("bu ay 2. kez")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Ayşe Yıldız WhatsApp'ta aç" }));
    await waitFor(() =>
      expect(window.okul.app.whatsappAc).toHaveBeenCalledWith(
        "905321112233",
        expect.stringContaining("Kaan Yıldız için Eylül 2026 aidatı (3.500 ₺)"),
      ),
    );
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith(
        "mesajKaydet",
        expect.objectContaining({ player_id: 2, guardian_id: 7, tur: "aidat", yil: 2026, ay: 9 }),
      ),
    );
  });
});

describe("Ayarlar > WhatsApp Mesajları", () => {
  beforeEach(() => {
    const ayarlar = {};
    window.okul = {
      db: vi.fn(async (fn, ...a) => {
        if (fn === "getSetting") return ayarlar[a[0]] || "";
        if (fn === "setSetting") {
          ayarlar[a[0]] = a[1];
          return {};
        }
        if (fn === "listUsers") return [];
        return null;
      }),
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
  });
  it("şablon düzenlenince önizleme örnek oyuncuyla güncellenir, tek Kaydet ayara yazar, 'Varsayılan metne dön' geri alır", async () => {
    render(
      <ToastSaglayici>
        <Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} baslangicBolum="whatsapp" />
      </ToastSaglayici>,
    );
    const ta = await screen.findByLabelText("Aidat hatırlatma");
    expect(screen.getByTestId("wa-ayar-onizleme")).toHaveTextContent("Sayın Murat Yıldız, Kaan Yıldız için Eylül 2026 aidatı (3.500 ₺)");
    fireEvent.change(ta, { target: { value: "Merhaba {veli}, {oyuncu} {ay} aidatı: {kalan}" } });
    expect(screen.getByTestId("wa-ayar-onizleme")).toHaveTextContent("Merhaba Murat Yıldız, Kaan Yıldız Eylül 2026 aidatı: 3.500 ₺");
    expect(screen.getByText(/1 şablon kaydedilmedi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith("setSetting", "wa_sablon_aidat", "Merhaba {veli}, {oyuncu} {ay} aidatı: {kalan}"),
    );
    await waitFor(() => expect(screen.queryByText(/şablon kaydedilmedi/)).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Varsayılan metne dön" }));
    expect(screen.getByLabelText("Aidat hatırlatma").value).toContain("henüz ödenmemiştir");
    fireEvent.focus(screen.getByLabelText("Antrenman değişikliği"));
    expect(screen.getByTestId("wa-ayar-onizleme")).toHaveTextContent(
      "7 Eylül 2026 Pazartesi 17:00 antrenmanı 8 Eylül 2026 Salı 18:30 saatine alınmıştır (Saha 2)",
    );
  });
});
