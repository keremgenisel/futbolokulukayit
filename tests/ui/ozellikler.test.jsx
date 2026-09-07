// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Giris } from "../../src/components/Giris.jsx";
import { Ayarlar } from "../../src/components/Ayarlar.jsx";
import { ToastSaglayici } from "../../src/components/ui.jsx";
import { COKLU_PC_ACIK } from "../../src/lib/ozellikler.js";

afterEach(cleanup);

describe("Çoklu PC bayrağı kapalıyken", () => {
  it("bayrak kapalı (müşteri talebi yok)", () => { expect(COKLU_PC_ACIK).toBe(false); });
  it("giriş ekranında sunucuya bağlan bağlantısı yok", () => {
    window.okul = { auth: { login: vi.fn() }, mod: { istemciBaglan: vi.fn() } };
    render(<Giris onGiris={vi.fn()} mod={{ mode: "yerel" }} />);
    expect(screen.queryByText(/sunucuya bağlan/i)).toBeNull();
    expect(screen.queryByLabelText("Sunucu adresi")).toBeNull();
    expect(screen.getByRole("button", { name: "Parolamı unuttum" })).toBeInTheDocument();
  });
  it("ayarlar menüsünde Sunucu / Çoklu PC bölümü yok", async () => {
    window.okul = { db: vi.fn(async () => null), app: { version: async () => "0.1.0" }, lisans: { durum: async () => ({ ok: true, durum: { mod: "deneme" } }) }, mod: { oku: async () => ({ mode: "yerel" }) } };
    render(<ToastSaglayici><Ayarlar oturum={{ username: "admin", role: "admin" }} saltOkunur={false} /></ToastSaglayici>);
    expect(screen.queryByRole("button", { name: /Sunucu \/ Çoklu PC/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Yedekleme/ })).toBeInTheDocument();
  });
});
