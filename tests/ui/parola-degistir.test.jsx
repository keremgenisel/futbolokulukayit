// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ParolaDegistir } from "../../src/components/ParolaDegistir.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("Parola değiştir (inceleme #14, parola min 8)", () => {
  beforeEach(() => { window.okul = { auth: { changePassword: vi.fn(async () => ({ ok: true })) } }; });
  it("normal değişimde mevcut parola zorunlu ve köprüye gider; kısa parola reddedilir", async () => {
    render(<ToastSaglayici><ParolaDegistir oturum={{ username: "admin" }} onTamam={vi.fn()} onKapat={vi.fn()} /></ToastSaglayici>);
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "yeni-parola-9" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "yeni-parola-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mevcut parolanızı girin");
    fireEvent.change(screen.getByLabelText("Mevcut parola"), { target: { value: "eski-parola" } });
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "kisa7" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "kisa7" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("en az 8 karakter");
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "yeni-parola-9" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "yeni-parola-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.auth.changePassword).toHaveBeenCalledWith("admin", "yeni-parola-9", "eski-parola"));
  });
  it("zorunlu ilk değişimde mevcut parola sorulmaz", async () => {
    render(<ToastSaglayici><ParolaDegistir oturum={{ username: "admin" }} zorunlu onTamam={vi.fn()} /></ToastSaglayici>);
    expect(screen.queryByLabelText("Mevcut parola")).toBeNull();
    fireEvent.change(screen.getByLabelText("Yeni parola"), { target: { value: "ilk-parola-8" } });
    fireEvent.change(screen.getByLabelText("Yeni parola (tekrar)"), { target: { value: "ilk-parola-8" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(window.okul.auth.changePassword).toHaveBeenCalledWith("admin", "ilk-parola-8", undefined));
  });
});
