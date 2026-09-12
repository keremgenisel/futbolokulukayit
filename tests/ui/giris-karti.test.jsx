// @vitest-environment jsdom
// Giriş kartı (plan §40): Ayarlar > Giriş Kartı bölümü (Kulüp ve Makbuz'un altında, ayrı) (alanlar + QR anahtarı tek Kaydet ile), oyuncu kartından tek yazdırma,
// Oyuncular'dan toplu yazdırma.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { GirisKartiAyar } from "../../src/components/ayarlar/GirisKartiAyar.jsx";
import { KulupAyar } from "../../src/components/ayarlar/KulupAyar.jsx";
import { OyuncuKarti } from "../../src/components/OyuncuKarti.jsx";
import { Oyuncular } from "../../src/components/Oyuncular.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);
const oyuncu = {
  id: 123,
  ad_soyad: "Kaan Yıldız",
  dogum_tarihi: "2015-11-02",
  yas_grubu_ad: "U11",
  durum: "aktif",
  ucret_tipi: "normal",
  aylik_aidat: 3500,
  odeme_donemi: "1-10",
  kayit_tarihi: "2026-09-01",
  foto_yolu: "",
};
const veli = [{ id: 1, tip: "anne", ad_soyad: "Ayşe Yıldız", gsm: "05321112233", whatsapp_no: "", veli_mi: 1, mesaj_onayi: 1 }];

function kopru(ayarlar = {}, ek = {}) {
  const db = vi.fn(async (fn, k, v) => {
    if (fn === "getSetting") return ayarlar[k] || "";
    if (fn === "setSetting") {
      ayarlar[k] = v;
      return { ok: true };
    }
    if (fn === "getPlayer") return oyuncu;
    if (fn === "listGuardians") return veli;
    if (fn === "sezonDurumu") return { aktifSezon: "2026-2027", baslangicAyi: 9 };
    if (fn === "listAgeGroups" || fn === "sezonListesi") return [];
    if (fn === "listPlayersWithDue") return [oyuncu, { ...oyuncu, id: 124, ad_soyad: "Deniz Koç" }];
    if (fn === "playersPage") return { liste: [oyuncu], toplam: 1, sayfa: 1, sayfaBoyu: 50 };
    return [];
  });
  const yazdir = vi.fn(async () => ({ ok: true }));
  window.okul = {
    db,
    files: { dataUrl: vi.fn(async () => ""), kulupLogoSec: vi.fn(), kulupLogoSil: vi.fn(), open: vi.fn() },
    app: { marka: vi.fn(async () => ({ logo: "", kulupAdi: "Eyüpspor Kulübü", tema: { ana: "#5b2d8e", vurgu: "#f5d000" } })) },
    cikti: { yazdir, pdfAc: vi.fn(async () => ({ ok: true })), excelKaydet: vi.fn(), pdfKaydet: vi.fn() },
    ...ek,
  };
  return { db, yazdir, ayarlar };
}

describe("Ayarlar > Giriş Kartı", () => {
  it("adres/telefon/kural alanları ve QR anahtarı tek Kaydet ile yazılır; önizleme çerçevesi var", async () => {
    const { db } = kopru({ kulup_adi: "Eyüpspor Kulübü" });
    render(
      <ToastSaglayici>
        <GirisKartiAyar saltOkunur={false} admin onKirli={vi.fn()} />
      </ToastSaglayici>,
    );
    await screen.findByTitle("Giriş kartı önizlemesi");
    expect(screen.getByRole("heading", { name: "Giriş Kartı" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kulüp adresi"), { target: { value: "Eyüp / İstanbul" } });
    fireEvent.change(screen.getByLabelText("4. kural"), { target: { value: "Kartınızı yanınızda bulundurunuz." } });
    const qr = screen.getByLabelText("Kartta giriş kodu bas");
    expect(qr).not.toBeChecked(); // kulüpte okuyucu yok → varsayılan kapalı
    fireEvent.click(qr);
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(db).toHaveBeenCalledWith("setSetting", "kart_qr", "1"));
    expect(db).toHaveBeenCalledWith("setSetting", "kulup_adres", "Eyüp / İstanbul");
    expect(db).toHaveBeenCalledWith("setSetting", "kart_kural_4", "Kartınızı yanınızda bulundurunuz.");
    expect(screen.getByTitle("Giriş kartı önizlemesi")).toHaveAttribute("srcdoc", expect.stringContaining("Kaan Yıldız"));
    expect(screen.getByTitle("Giriş kartı önizlemesi")).toHaveAttribute("srcdoc", expect.stringContaining("Eyüpspor Kulübü")); // kulüp adı Kulüp ayarından
  });
  it("Kulüp ve Makbuz bölümünde kart alanları artık yok", async () => {
    kopru({});
    render(
      <ToastSaglayici>
        <KulupAyar saltOkunur={false} admin onKirli={vi.fn()} onMarkaDegisti={vi.fn()} />
      </ToastSaglayici>,
    );
    await screen.findByLabelText("Kulüp adı");
    expect(screen.queryByTitle("Giriş kartı önizlemesi")).toBeNull();
    expect(screen.queryByLabelText("Kulüp adresi")).toBeNull();
  });
});

describe("Oyuncu kartı › Giriş Kartı", () => {
  it("düğme ön+arka yüzü A4 yatay yazdırır; QR kapalıyken kod yok, açıkken QR ve barkod SVG'leri var", async () => {
    const { yazdir } = kopru({});
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={123} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Giriş Kartı/ }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    const html = String(yazdir.mock.calls[0][0]);
    expect(html).toContain("OYUNCU GİRİŞ KARTI");
    expect(html).toContain("Kaan Yıldız");
    expect(html).toContain("Ayşe Yıldız");
    expect(html).toContain("2026 0123");
    expect(html).toContain('class="sayfa tek"');
    expect(html).not.toContain("GİRİŞ KODU");
    cleanup();
    const k2 = kopru({ kart_qr: "1" });
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={123} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Giriş Kartı/ }));
    await waitFor(() => expect(k2.yazdir).toHaveBeenCalledTimes(1));
    const h2 = String(k2.yazdir.mock.calls[0][0]);
    expect(h2).toContain("GİRİŞ KODU");
    expect(h2).toContain('class="cubuk"');
    expect((h2.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it("düğme mor başlıkta okunur: zemin beyaz değil, yazı başlık rengi (beyaz üstüne beyaz hatası)", async () => {
    kopru({});
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={123} oturum={{ role: "admin" }} gruplar={[]} saltOkunur={false} onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    const b = await screen.findByRole("button", { name: /Giriş Kartı/ });
    expect(b.style.background).not.toMatch(/^(#fff|white|rgb\(255, 255, 255\))$/);
    expect(b.style.background).toContain("rgba(255, 255, 255, 0.14)");
    expect(b.style.color).toBe("var(--ana-ustu)");
  });
  it("salt okunurda da yazdırılabilir (yazma değil)", async () => {
    const { yazdir } = kopru({});
    render(
      <ToastSaglayici>
        <OyuncuKarti oyuncuId={123} oturum={{ role: "kullanici" }} gruplar={[]} saltOkunur onKapat={() => {}} onMakbuzKes={() => {}} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Giriş Kartı/ }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
  });
});

describe("Oyuncular › Kartları Yazdır", () => {
  it("süzgeçteki oyuncuların kartları toplu düzende; toast sayfa sayısını söyler", async () => {
    const { yazdir } = kopru({});
    render(
      <ToastSaglayici>
        <Oyuncular oturum={{ role: "admin" }} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Kartları Yazdır/ }));
    await waitFor(() => expect(yazdir).toHaveBeenCalledTimes(1));
    const html = String(yazdir.mock.calls[0][0]);
    expect(html).toContain('class="sayfa toplu"');
    expect(html).toContain("Kaan Yıldız");
    expect(html).toContain("Deniz Koç");
    await screen.findByText("2 kart, 2 sayfa (ön + arka)");
  });
});
