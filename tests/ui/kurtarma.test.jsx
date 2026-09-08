// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { Giris } from "../../src/components/Giris.jsx";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Giriş ekranı: Parolamı unuttum", () => {
  beforeEach(() => {
    localStorage.clear();
    window.okul = { auth: { login: vi.fn(), kurtarmaSifirla: vi.fn() } };
  });

  it("kurtarma koduyla parola sıfırlanır, girişe dönülür ve kullanıcı adı dolu gelir", async () => {
    window.okul.auth.kurtarmaSifirla.mockResolvedValue({ ok: true, kalan: 2 });
    render(<Giris onGiris={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Parolamı unuttum" }));
    fireEvent.change(screen.getByLabelText("Kullanıcı adı"), { target: { value: "hoca" } });
    fireEvent.change(screen.getByLabelText("Kurtarma kodu"), { target: { value: "abcd-2345" } });
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "yeni-parola-1" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "yeni-parola-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Parolayı Sıfırla" }));
    await waitFor(() => expect(window.okul.auth.kurtarmaSifirla).toHaveBeenCalledWith("hoca", "ABCD-2345", "yeni-parola-1"));
    await screen.findByRole("button", { name: "Giriş Yap" });
    expect(screen.getByLabelText("Kullanıcı adı")).toHaveValue("hoca");
    expect(screen.getByRole("status")).toHaveTextContent("2 kurtarma kodunuz kaldı");
  });

  it("parolalar uyuşmazsa ve kod yanlışsa hata gösterir, girişe dönmez", async () => {
    window.okul.auth.kurtarmaSifirla.mockResolvedValue({ ok: false, error: "Kullanıcı adı veya kurtarma kodu hatalı" });
    render(<Giris onGiris={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Parolamı unuttum" }));
    fireEvent.change(screen.getByLabelText("Kullanıcı adı"), { target: { value: "hoca" } });
    fireEvent.change(screen.getByLabelText("Kurtarma kodu"), { target: { value: "ZZZZ-ZZZZ" } });
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "yeni-parola-1" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "farkli" } });
    fireEvent.click(screen.getByRole("button", { name: "Parolayı Sıfırla" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Parolalar aynı değil");
    expect(window.okul.auth.kurtarmaSifirla).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "yeni-parola-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Parolayı Sıfırla" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("kurtarma kodu hatalı"));
    expect(screen.getByRole("button", { name: "Parolayı Sıfırla" })).toBeInTheDocument();
  });
});

describe("Ayarlar > Kullanıcılar: silme ve kurtarma kodları", () => {
  let liste;
  const kur = (oturum) => {
    window.okul = {
      db: vi.fn(async (fn, ...a) => {
        if (fn === "listUsers") return liste;
        if (fn === "deleteUser") {
          liste = liste.filter((u) => u.id !== a[0]);
          return { ok: true };
        }
        if (fn === "getSetting") return "";
        if (fn === "listFeeItems") return [];
        return null;
      }),
      auth: {
        kurtarmaUret: vi.fn(async (id) => {
          liste = liste.map((u) => (u.id === id ? { ...u, kurtarma_kodu: 8 } : u));
          return {
            ok: true,
            kodlar: ["AAAA-1111", "BBBB-2222", "CCCC-3333", "DDDD-4444", "EEEE-5555", "FFFF-6666", "GGGG-7777", "HHHH-8888"],
          };
        }),
      },
      cikti: { yazdir: vi.fn(async () => ({ ok: true })) },
      app: { version: async () => "0.1.0" },
      lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) },
      mod: { oku: async () => ({ mode: "yerel" }) },
    };
    render(
      <ToastSaglayici>
        <Ayarlar oturum={oturum} saltOkunur={false} baslangicBolum="kullanici" />
      </ToastSaglayici>,
    );
  };
  beforeEach(() => {
    liste = [
      { id: 1, username: "admin", ad_soyad: "Yönetici", role: "admin", is_active: 1, kurtarma_kodu: 0 },
      { id: 2, username: "hoca", ad_soyad: "Hoca", role: "admin", is_active: 1, kurtarma_kodu: 0 },
    ];
  });

  it("yeni yönetici ilk admin'i silebilir; kendi satırında Sil yok", async () => {
    kur({ username: "hoca", role: "admin" });
    const silDugmesi = await screen.findByRole("button", { name: "admin kullanıcısını sil" });
    expect(screen.queryByRole("button", { name: "hoca kullanıcısını sil" })).toBeNull();
    fireEvent.click(silDugmesi);
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledWith("deleteUser", 1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "admin kullanıcısını sil" })).toBeNull());
  });

  it("Hesabım'dan kurtarma kodları üretilir, bir kez gösterilir, sayaç güncellenir", async () => {
    kur({ username: "hoca", role: "admin" });
    expect(await screen.findByText("Kurtarma kodu yok")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kurtarma Kodları Üret" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("AAAA-1111")).toBeInTheDocument();
    expect(within(dlg).getAllByText(/^[A-Z]{4}-\d{4}$/)).toHaveLength(8);
    expect(window.okul.auth.kurtarmaUret).toHaveBeenCalledWith(2);
    fireEvent.click(within(dlg).getByRole("button", { name: "Yazdır" }));
    await waitFor(() => expect(window.okul.cikti.yazdir).toHaveBeenCalled());
    expect(window.okul.cikti.yazdir.mock.calls[0][0]).toContain("AAAA-1111");
    fireEvent.click(within(dlg).getByRole("button", { name: "Kaydettim, Kapat" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText("8 kurtarma kodu");
    expect(screen.getByRole("button", { name: "Kurtarma Kodlarını Yenile" })).toBeInTheDocument();
  });
});
