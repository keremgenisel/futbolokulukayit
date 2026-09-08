// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { SifresizUyari } from "../../src/components/SifresizUyari.jsx";

afterEach(cleanup);

describe("Şifresiz veritabanı uyarısı (inceleme #7)", () => {
  it("şifreleme yoksa yöneticiye kırmızı şerit; şifreliyse ve kullanıcı rolünde yok", async () => {
    window.okul = { db: vi.fn(async (fn) => (fn === "isEncrypted" ? false : null)) };
    const { unmount } = render(<SifresizUyari oturum={{ role: "admin" }} />);
    expect(await screen.findByTestId("sifresiz-uyari")).toHaveTextContent("Veritabanı şifreli değil");
    unmount();
    render(<SifresizUyari oturum={{ role: "kullanici" }} />);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalledTimes(1)); // kullanıcı için sorgu bile yok
    expect(screen.queryByTestId("sifresiz-uyari")).toBeNull();
    cleanup();
    window.okul = { db: vi.fn(async () => true) };
    render(<SifresizUyari oturum={{ role: "admin" }} />);
    await waitFor(() => expect(window.okul.db).toHaveBeenCalled());
    expect(screen.queryByTestId("sifresiz-uyari")).toBeNull();
  });
});
