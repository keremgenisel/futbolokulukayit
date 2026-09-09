// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Tahsilat } from "../../src/components/Tahsilat.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Tahsilat: tek makbuzda birden fazla aidat ayı", () => {
  it("borçlu ay seçili gelir, ikinci ay eklenir, tutarlar ay bazlı; kaydet iki aidat satırı gönderir", async () => {
    const kalemler = [
      { id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 3500, aktif: 1 },
      { id: 2, kod: "forma", ad: "Forma", varsayilan_fiyat: 1200, aktif: 1 },
    ];
    const oyuncu = {
      id: 5,
      ad_soyad: "Kaan Yıldız",
      dogum_tarihi: "2015-11-02",
      yas_grubu_ad: "U11",
      ucret_tipi: "normal",
      aylik_aidat: 3500,
    };
    const t = new Date();
    const yil = t.getFullYear(),
      ay = t.getMonth() + 1;
    const sonraki = ay === 12 ? { yil: yil + 1, ay: 1 } : { yil, ay: ay + 1 };
    const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    window.okul = {
      db: vi.fn(async (fn, ...a) => {
        if (fn === "listFeeItems") return kalemler;
        if (fn === "getSetting") return "";
        if (fn === "listReceiptsByDate") return [];
        if (fn === "getPlayer") return oyuncu;
        if (fn === "listDues") return [{ id: 1, player_id: 5, yil, ay, tutar: 3500, durum: "odenmedi" }];
        if (fn === "createReceipt") return { id: 99, makbuz_no: "2026-0001" };
        if (fn === "getReceipt")
          return {
            id: 99,
            makbuz_no: "2026-0001",
            tarih: "2026-09-07",
            toplam: 7000,
            odeme_yontemi: "nakit",
            ad_soyad: "Kaan Yıldız",
            satirlar: [],
          };
        return [];
      }),
      cikti: { makbuzPdf: vi.fn(async () => ({ ok: true })), yazdir: vi.fn(async () => ({ ok: true })) },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} secilenOyuncuId={5} onSecildi={() => {}} />
      </ToastSaglayici>,
    );
    const buAy = await screen.findByRole("button", { name: `${AYLAR[ay - 1]} ${yil}` });
    expect(buAy).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(`Aidat · ${AYLAR[ay - 1]} ${yil}`).length).toBeGreaterThanOrEqual(1); // kalem satırı + özet
    fireEvent.click(screen.getByRole("button", { name: `${AYLAR[sonraki.ay - 1]} ${sonraki.yil}` }));
    expect(screen.getByText(`Aidat · ${AYLAR[ay - 1]} ${yil}, ${AYLAR[sonraki.ay - 1]} ${sonraki.yil}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`${AYLAR[sonraki.ay - 1]} ${sonraki.yil} aidat tutarı`)).toHaveValue("3.500");
    fireEvent.change(screen.getByLabelText(`${AYLAR[sonraki.ay - 1]} ${sonraki.yil} aidat tutarı`), { target: { value: "3000" } });
    expect(screen.getByText("TOPLAM").parentElement).toHaveTextContent("6.500 ₺");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() =>
      expect(window.okul.db).toHaveBeenCalledWith(
        "createReceipt",
        expect.objectContaining({
          player_id: 5,
          satirlar: [
            { fee_item_id: 1, tutar: 3500, aciklama: `${AYLAR[ay - 1]} ${yil}`, yil, ay },
            { fee_item_id: 1, tutar: 3000, aciklama: `${AYLAR[sonraki.ay - 1]} ${sonraki.yil}`, yil: sonraki.yil, ay: sonraki.ay },
          ],
        }),
      ),
    );
  });

  it("makbuz iptali neden ister; nedensiz iptal gönderilmez, nedenle cancelReceipt(id, neden) çağrılır", async () => {
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "listFeeItems") return [];
        if (fn === "getSetting") return "";
        if (fn === "listReceiptsByDate")
          return [
            {
              id: 7,
              makbuz_no: "2026-0007",
              ad_soyad: "Kaan Yıldız",
              toplam: 3500,
              odeme_yontemi: "nakit",
              tahsil_eden: "Y",
              pdf_yolu: "",
            },
          ];
        if (fn === "cancelReceipt") return { ok: true };
        return [];
      }),
      cikti: { yazdir: vi.fn() },
      files: { open: vi.fn() },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} />
      </ToastSaglayici>,
    );
    await screen.findByText("2026-0007");
    fireEvent.click(screen.getByRole("button", { name: /İptal/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "İptal Et" }));
    expect(window.okul.db).not.toHaveBeenCalledWith("cancelReceipt", expect.anything(), expect.anything());
    fireEvent.change(screen.getByLabelText("İptal nedeni"), { target: { value: "Yanlış oyuncu" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "İptal Et" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("cancelReceipt", 7, "Yanlış oyuncu"));
  });

  it("'Tahsil eden' kutusu: ayar doluysa ayar (kullanıcı adı olsa da), boşsa giriş yapan kullanıcı", async () => {
    window.okul = {
      db: vi.fn(async (fn, k) => (fn === "getSetting" && k === "tahsil_eden" ? "Şerif Çelik" : fn === "getSetting" ? "" : [])),
      cikti: { yazdir: vi.fn() },
      files: { open: vi.fn() },
    };
    const { unmount } = render(
      <ToastSaglayici>
        <Tahsilat oturum={{ username: "admin", ad_soyad: "Yönetici" }} />
      </ToastSaglayici>,
    );
    await waitFor(() => expect(screen.getByLabelText("Tahsil eden")).toHaveValue("Şerif Çelik"));
    unmount();
    window.okul.db = vi.fn(async () => "");
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ username: "admin", ad_soyad: "Yönetici" }} />
      </ToastSaglayici>,
    );
    await waitFor(() => expect(screen.getByLabelText("Tahsil eden")).toHaveValue("Yönetici"));
  });
});
