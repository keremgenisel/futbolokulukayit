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

  it("Uzun Dönem Seç: ödenmiş aylar aralıktan atlanır, kalanı 0 olan ay listeye girmez (10.09.2026 hatası)", async () => {
    const kalemler = [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 5000, aktif: 1 }];
    const oyuncu = { id: 7, ad_soyad: "Kerem Genisel", dogum_tarihi: "2018-12-13", ucret_tipi: "normal", aylik_aidat: 5000 };
    // Eylül–Kasım 2026 ödenmiş, Aralık 2026 borç; modal 6 ay seçse de yalnız ödenmemişler kalmalı.
    const dues = [
      { id: 1, player_id: 7, yil: 2026, ay: 9, tutar: 5000, odenen: 5000, durum: "odendi" },
      { id: 2, player_id: 7, yil: 2026, ay: 10, tutar: 5000, odenen: 5000, durum: "odendi" },
      { id: 3, player_id: 7, yil: 2026, ay: 11, tutar: 5000, odenen: 5000, durum: "odendi" },
      { id: 4, player_id: 7, yil: 2026, ay: 12, tutar: 5000, odenen: 0, durum: "odenmedi" },
    ];
    window.okul = {
      db: vi.fn(async (fn, ...a) => {
        if (fn === "listFeeItems") return kalemler;
        if (fn === "getSetting") return "";
        if (fn === "listReceiptsByDate") return [];
        if (fn === "sezonDurumu") return { aktifSezon: "2026-2027" };
        if (fn === "getPlayer") return oyuncu;
        if (fn === "listDues") return [...dues].sort((x, y) => y.yil - x.yil || y.ay - x.ay);
        if (fn === "ensureMonthlyDuesAraligi") {
          for (const d of a[1])
            if (!dues.some((x) => x.yil === d.yil && x.ay === d.ay))
              dues.push({ id: dues.length + 1, player_id: 7, yil: d.yil, ay: d.ay, tutar: 5000, odenen: 0, durum: "odenmedi" });
          return a[1].map((d) => dues.find((x) => x.yil === d.yil && x.ay === d.ay));
        }
        return [];
      }),
      cikti: { yazdir: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} secilenOyuncuId={7} onSecildi={() => {}} />
      </ToastSaglayici>,
    );
    fireEvent.click(await screen.findByText("Uzun Dönem Seç"));
    const dlg = await screen.findByRole("dialog", { name: "Uzun Dönem Seç" });
    // Varsayılan başlangıç en eski borç (Aralık 2026); aralığı elle Eylül 2026'dan başlatıp ödenmişleri kapsat
    fireEvent.change(within(dlg).getByLabelText("Başlangıç ayı"), { target: { value: "2026-9" } });
    fireEvent.change(within(dlg).getByLabelText("Bitiş ayı"), { target: { value: "2027-2" } });
    expect(dlg).toHaveTextContent("3 ay seçilecek: Aralık 2026 – Şubat 2027");
    expect(dlg).toHaveTextContent("3 ay zaten ödenmiş, atlandı");
    expect(dlg).toHaveTextContent("15.000 ₺");
    fireEvent.click(within(dlg).getByRole("button", { name: "Uygula" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Uzun Dönem Seç" })).not.toBeInTheDocument());
    expect(screen.queryByLabelText("Eylül 2026 aidat tutarı")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kasım 2026 aidat tutarı")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Aralık 2026 aidat tutarı")).toHaveValue("5.000");
    expect(screen.getByLabelText("Şubat 2027 aidat tutarı")).toHaveValue("5.000");
    expect(screen.getByText("TOPLAM").parentElement).toHaveTextContent("15.000 ₺");
    // Aralık tamamen ödenmiş olsaydı: aralıkta hiç ay kalmaz, Uygula kapalı
  });

  it("bu ay peşin ödenmişse seçili gelen ay bir sonraki ödenmemiş ay; piller ödenmiş ayları atlar", async () => {
    const t = new Date();
    const yil = t.getFullYear(),
      ay = t.getMonth() + 1;
    const ekle = (n) => {
      const x = yil * 12 + (ay - 1) + n;
      return { yil: Math.floor(x / 12), ay: (x % 12) + 1 };
    };
    const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const ad = (d) => `${AYLAR[d.ay - 1]} ${d.yil}`;
    const dues = [0, 1].map((n) => ({ id: n + 1, player_id: 9, ...ekle(n), tutar: 5000, odenen: 5000, durum: "odendi" }));
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "listFeeItems") return [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 5000, aktif: 1 }];
        if (fn === "getSetting") return "";
        if (fn === "getPlayer") return { id: 9, ad_soyad: "Peşin Ödeyen", ucret_tipi: "normal", aylik_aidat: 5000 };
        if (fn === "listDues") return dues;
        return [];
      }),
      cikti: { yazdir: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} secilenOyuncuId={9} onSecildi={() => {}} />
      </ToastSaglayici>,
    );
    const secili = await screen.findByRole("button", { pressed: true });
    expect(secili).toHaveAccessibleName(ad(ekle(2))); // bu ay ve sonraki ödenmiş → 3. ay
    expect(screen.queryByRole("button", { name: ad(ekle(0)) })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: false }).filter((b) => /\d{4}$/.test(b.getAttribute("aria-label") || "")).length).toBe(
      2,
    );
    expect(screen.getByLabelText(`${ad(ekle(2))} aidat tutarı`)).toHaveValue("5.000");
  });

  it("iptalle geri açılan gelecek aylar borç değil: yalnız vadesi gelmiş ay kırmızı, ileri aylar sade ve en fazla 3 (10.09.2026)", async () => {
    const t = new Date();
    const yil = t.getFullYear(),
      ay = t.getMonth() + 1;
    const ekle = (n) => {
      const x = yil * 12 + (ay - 1) + n;
      return { yil: Math.floor(x / 12), ay: (x % 12) + 1 };
    };
    const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const ad = (d) => `${AYLAR[d.ay - 1]} ${d.yil}`;
    // Geçen ay + bu ay borç; iptal edilen 12 aylık makbuzdan kalan 10 gelecek ay "odenmedi" satırı
    const dues = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => ({
      id: i + 1,
      player_id: 3,
      ...ekle(n),
      tutar: 5000,
      odenen: 0,
      durum: "odenmedi",
    }));
    window.okul = {
      db: vi.fn(async (fn) => {
        if (fn === "listFeeItems") return [{ id: 1, kod: "aidat", ad: "Aidat", varsayilan_fiyat: 5000, aktif: 1 }];
        if (fn === "getSetting") return "";
        if (fn === "getPlayer") return { id: 3, ad_soyad: "İptal Sonrası", ucret_tipi: "normal", aylik_aidat: 5000 };
        if (fn === "listDues") return [...dues].reverse();
        return [];
      }),
      cikti: { yazdir: vi.fn() },
      app: { logo: async () => "" },
    };
    render(
      <ToastSaglayici>
        <Tahsilat oturum={{ ad_soyad: "Yönetici" }} saltOkunur={false} secilenOyuncuId={3} onSecildi={() => {}} />
      </ToastSaglayici>,
    );
    const secili = await screen.findByRole("button", { pressed: true });
    expect(secili).toHaveAccessibleName(ad(ekle(-1))); // en eski borç
    const piller = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(piller.map((b) => b.getAttribute("aria-label"))).toEqual([ad(ekle(-1)), ad(ekle(0)), ad(ekle(1)), ad(ekle(2)), ad(ekle(3))]);
    expect(piller.filter((b) => b.textContent.includes("ödenmedi")).length).toBe(2); // geçen ay + bu ay
    expect(piller[2].textContent).toBe(ad(ekle(1))); // gelecek ay sade
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
