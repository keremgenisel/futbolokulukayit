// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Giris } from "../../src/components/Giris.jsx";

afterEach(cleanup);

describe("Giriş ekranı", () => {
  beforeEach(() => {
    window.okul = { auth: { login: vi.fn() } };
  });

  it("hatalı parolada hata mesajı gösterir, oturum açmaz", async () => {
    window.okul.auth.login.mockResolvedValue({ ok: false, error: "Kullanıcı adı veya parola hatalı" });
    const onGiris = vi.fn();
    render(<Giris onGiris={onGiris} />);
    fireEvent.change(screen.getByLabelText("Kullanıcı adı"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Parola"), { target: { value: "yanlis" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş Yap" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("parola hatalı"));
    expect(onGiris).not.toHaveBeenCalled();
  });

  it("başarılı girişte kullanıcıyı üst bileşene iletir", async () => {
    const user = { username: "admin", ad_soyad: "Yönetici", role: "admin", must_change_password: true };
    window.okul.auth.login.mockResolvedValue({ ok: true, user });
    const onGiris = vi.fn();
    render(<Giris onGiris={onGiris} />);
    fireEvent.change(screen.getByLabelText("Kullanıcı adı"), { target: { value: " admin " } });
    fireEvent.change(screen.getByLabelText("Parola"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş Yap" }));
    await waitFor(() => expect(onGiris).toHaveBeenCalledWith(user));
    expect(window.okul.auth.login).toHaveBeenCalledWith("admin", "admin");
  });
});
