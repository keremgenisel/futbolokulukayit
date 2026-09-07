// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Yoklama } from "../../src/components/Yoklama.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { bugun } from "../../src/lib/api.js";

afterEach(cleanup);

describe("Yoklama ekranı (takvim şeridi)", () => {
  let antrenmanlar;
  beforeEach(() => {
    const t = bugun().iso;
    antrenmanlar = [{ id: 5, age_group_id: 1, tarih: t, saat: "17:00", saha: "Saha 1", iptal: 0, yas_grubu_ad: "U11", oyuncu: 2, isaretli: 0, geldi: 0 }];
    window.okul = { app: { logo: vi.fn(async () => "data:image/png;base64,LOGO") }, cikti: { yazdir: vi.fn(async () => ({ ok: true })), pdfKaydet: vi.fn(async () => ({ ok: true })) }, db: vi.fn(async (fn, ...args) => {
      if (fn === "listAgeGroups") return [{ id: 1, ad: "U11", aktif: 1 }];
      if (fn === "trainingCalendar") return antrenmanlar;
      if (fn === "listPlayersWithDue") return [{ id: 10, ad_soyad: "Ada Kaya", durum: "aktif", aidat_durum: "odendi" }, { id: 11, ad_soyad: "Barış Güneş", durum: "aktif", aidat_durum: "odenmedi" }];
      if (fn === "listAttendance") return [];
      if (fn === "setAttendance") { antrenmanlar[0].isaretli += 1; return {}; }
      if (fn === "createTraining") { const y = { id: 6, ...args[0], iptal: 0, yas_grubu_ad: "U11", oyuncu: 2, isaretli: 0, geldi: 0 }; antrenmanlar.push(y); return y; }
      throw new Error("beklenmeyen çağrı " + fn);
    }) };
  });
  const kur = () => render(<ToastSaglayici><Yoklama saltOkunur={false} /></ToastSaglayici>);

  it("bugünün antrenmanı kart olarak gelir; seçince oyuncu listesi ve işaretleme çalışır, kart sayacı güncellenir", async () => {
    kur();
    const kart = await screen.findByRole("button", { name: /U11 · 17:00/ });
    expect(kart).toHaveTextContent("0/2 işaretli");
    fireEvent.click(kart);
    await screen.findByText("Ada Kaya");
    expect(screen.getByText("Barış Güneş").parentElement).toHaveTextContent("Aidat");
    const geldi = screen.getAllByRole("button", { name: "Geldi" })[0];
    fireEvent.click(geldi);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("setAttendance", 5, 10, "geldi"));
    await waitFor(() => expect(screen.getByRole("button", { name: /U11 · 17:00/ })).toHaveTextContent("1/2 işaretli"));
  });

  it("başka güne geçince 'antrenman yok' görünür; satır içi formla antrenman eklenir ve seçili gelir", async () => {
    kur();
    await screen.findByRole("button", { name: /U11 · 17:00/ });
    fireEvent.keyDown(screen.getByLabelText("Gün şeridi"), { key: "ArrowRight" });
    await screen.findByText(/Bu tarihte antrenman yok/);
    fireEvent.click(screen.getByRole("button", { name: "Antrenman Ekle" }));
    fireEvent.change(screen.getByLabelText("Yaş grubu"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Saat"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("createTraining", expect.objectContaining({ age_group_id: 1, saat: "18:30" })));
    const yeni = await screen.findByRole("button", { name: /U11 · 18:30/ });
    await waitFor(() => expect(yeni).toHaveAttribute("aria-pressed", "true"));
  });

  it("salt okunur modda ekleme düğmesi yok", async () => {
    render(<ToastSaglayici><Yoklama saltOkunur /></ToastSaglayici>);
    await screen.findByRole("button", { name: /U11 · 17:00/ });
    expect(screen.queryByRole("button", { name: "Antrenman Ekle" })).toBeNull();
  });

  it("Formu Yazdır: seçili antrenmanın grubu, tarihi ve oyuncuları ile A4 form yazdırılır; işaretli olan dolu, kalanlar boş", async () => {
    kur();
    fireEvent.click(await screen.findByRole("button", { name: /U11 · 17:00/ }));
    await screen.findByText("Ada Kaya");
    fireEvent.click(screen.getAllByRole("button", { name: "Geldi" })[0]); // Ada geldi
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("setAttendance", 5, 10, "geldi"));
    fireEvent.click(screen.getByRole("button", { name: "Formu Yazdır" }));
    await waitFor(() => expect(window.okul.cikti.yazdir).toHaveBeenCalledTimes(1));
    const html = window.okul.cikti.yazdir.mock.calls[0][0];
    expect(html).toContain("YOKLAMA FORMU"); expect(html).toContain('<span class="grup">U11</span>'); expect(html).toContain("17:00"); expect(html).toContain("Saha 1");
    expect(html).toContain('src="data:image/png;base64,LOGO"');
    const satir = (ad) => html.split("<tr>").find((s) => s.includes(ad));
    expect(satir("Ada Kaya")).toMatch(/<div class="kutu dolu">/); // programda geldi → dolu
    expect(satir("Barış Güneş")).not.toContain("kutu dolu");       // işaretsiz → üç boş kutu
    expect(html.toLowerCase()).not.toMatch(/aidat|borç/);          // borç bilgisi forma girmez
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(window.okul.cikti.pdfKaydet).toHaveBeenCalledWith(expect.stringContaining("YOKLAMA FORMU"), `yoklama-U11-${bugun().iso}.pdf`, false));
  });

  it("yazıcı yoksa Formu Yazdır sessiz kalmaz: uyarı verir ve formu PDF olarak açar; iptalde PDF açılmaz", async () => {
    window.okul.cikti.yazdir = vi.fn(async () => ({ ok: false, hata: "No printers available on the network" }));
    window.okul.cikti.pdfAc = vi.fn(async () => ({ ok: true, yol: "/tmp/x.pdf" }));
    kur();
    fireEvent.click(await screen.findByRole("button", { name: /U11 · 17:00/ }));
    await screen.findByText("Ada Kaya");
    fireEvent.click(screen.getByRole("button", { name: "Formu Yazdır" }));
    await waitFor(() => expect(window.okul.cikti.pdfAc).toHaveBeenCalledWith(expect.stringContaining("YOKLAMA FORMU"), `yoklama-U11-${bugun().iso}`, false));
    expect(await screen.findByText(/tanımlı yazıcı yok.*PDF olarak açıldı/)).toBeInTheDocument();
    window.okul.cikti.yazdir = vi.fn(async () => ({ ok: false, hata: "Print job canceled" }));
    window.okul.cikti.pdfAc.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Formu Yazdır" }));
    expect(await screen.findByText(/Yazdırma iptal edildi/)).toBeInTheDocument();
    expect(window.okul.cikti.pdfAc).not.toHaveBeenCalled();
  });

  it("Düzenle: saat/saha değişince güncellenir, 'Velilere bildirilsin mi?' sorulur, Evet → grubun velileriyle bildirim penceresi; kartta rozet", async () => {
    let veliler = [{ player_id: 10, ad_soyad: "Ada Kaya", guardian_id: 50, veli_ad: "Selin Kaya", veli_wa: "05421234567", veli_onay: 1, mesaj_id: null }, { player_id: 11, ad_soyad: "Barış Güneş", guardian_id: 51, veli_ad: "Hakan Güneş", veli_wa: "", veli_onay: 1, mesaj_id: null }];
    window.okul.app = { whatsappAc: vi.fn(async () => ({ ok: true })) };
    const eskiDb = window.okul.db.getMockImplementation();
    window.okul.db.mockImplementation(async (fn, ...args) => {
      if (fn === "updateTraining") { Object.assign(antrenmanlar[0], { saat: args[1].saat, saha: args[1].saha, bildirim_gerekli: 1, degisiklik_notu: JSON.stringify({ eskiTarih: antrenmanlar[0].tarih, eskiSaat: "17:00" }) }); return { ...antrenmanlar[0], degisti: true }; }
      if (fn === "antrenmanVelileri") return veliler;
      if (fn === "mesajKaydet") { veliler = veliler.map((v) => (v.player_id === args[0].player_id ? { ...v, mesaj_id: 9 } : v)); antrenmanlar[0].bildirilen = 1; return { id: 9 }; }
      if (fn === "bildirimGerekliAyarla") { antrenmanlar[0].bildirim_gerekli = args[1]; return {}; }
      if (fn === "getSetting") return "";
      return eskiDb(fn, ...args);
    });
    kur();
    fireEvent.click(await screen.findByRole("button", { name: /U11 · 17:00/ }));
    await screen.findByText("Ada Kaya");
    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByLabelText("Antrenman saati"), { target: { value: "18:30" } });
    fireEvent.change(screen.getByLabelText("Antrenman sahası"), { target: { value: "Saha 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("updateTraining", 5, { tarih: bugun().iso, saat: "18:30", saha: "Saha 2" }));
    await screen.findByText(/velilerine WhatsApp ile değişiklik bildirilsin mi\?/);
    const soru = screen.getByRole("dialog");
    fireEvent.click(within(soru).getByRole("button", { name: "Evet" }));
    await screen.findByText("Antrenman Değişikliği — Velilere Bildir");
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText("Veli numarası yok")).toBeInTheDocument(); // Barış'ın velisinde numara yok
    expect(within(dlg).getByTestId("wa-onizleme")).toHaveTextContent("17:00 antrenmanı");
    expect(within(dlg).getByTestId("wa-onizleme")).toHaveTextContent("18:30 saatine alınmıştır (Saha 2)");
    fireEvent.click(within(dlg).getByRole("button", { name: "Selin Kaya WhatsApp'ta aç" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("mesajKaydet", expect.objectContaining({ player_id: 10, guardian_id: 50, tur: "degisiklik", training_id: 5 })));
    fireEvent.click(within(dlg).getByRole("button", { name: "Kapat" }));
    // Tek uygun veliye açıldı → bayrak iner
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("bildirimGerekliAyarla", 5, 0));
  });

  it("İptal Et sonrası bildirim sorusu; Hayır denirse kartta 'Velilere bildirilmedi' ve başlıkta 'Velilere Bildir'", async () => {
    const eskiDb = window.okul.db.getMockImplementation();
    window.okul.db.mockImplementation(async (fn, ...args) => {
      if (fn === "cancelTraining") { Object.assign(antrenmanlar[0], { iptal: 1, bildirim_gerekli: 1, bildirilen: 0 }); return {}; }
      return eskiDb(fn, ...args);
    });
    kur();
    fireEvent.click(await screen.findByRole("button", { name: /U11 · 17:00/ }));
    await screen.findByText("Ada Kaya");
    fireEvent.click(screen.getByRole("button", { name: "İptal Et" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Evet" }));
    await screen.findByText(/iptal bildirilsin mi\?/);
    const soru = screen.getByRole("dialog");
    fireEvent.click(within(soru).getByRole("button", { name: "Vazgeç" }));
    expect(await screen.findByText("Velilere bildirilmedi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /U11 · 17:00/ }));
    expect(await screen.findByRole("button", { name: "Velilere Bildir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Düzenle" })).toBeNull(); // iptal edilmiş antrenman düzenlenmez
  });
});
