// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UyariSeridi, Btn } from "../../src/components/ui.jsx";

afterEach(cleanup);

describe("UyariSeridi (refactor §8.4)", () => {
  it("varsayılan sarı uyarı, role=alert, başlık + metin + sağda eylem", () => {
    render(
      <UyariSeridi baslik="Sezon bitti" eylem={<Btn>Yeni Sezona Geç</Btn>}>
        yenileyenleri işaretleyin
      </UyariSeridi>,
    );
    const s = screen.getByRole("alert");
    expect(s).toHaveTextContent("Sezon bitti");
    expect(s).toHaveTextContent("yenileyenleri işaretleyin");
    expect(s.style.background).toBe("var(--uyari-acik)");
    expect(screen.getByRole("button", { name: "Yeni Sezona Geç" })).toBeInTheDocument();
  });
  it("kırmızı ton, rol/testid geçirilebilir, yoğun kip dar dolgu", () => {
    render(
      <UyariSeridi ton="kirmizi" yogun sessiz data-testid="x" style={{ marginBottom: 20 }}>
        salt okunur
      </UyariSeridi>,
    );
    const s = screen.getByTestId("x");
    expect(s).not.toHaveAttribute("role"); // sessiz: toast sorguları ([role=status]) ve alert okuyucular karışmasın
    expect(s.style.background).toBe("var(--kirmizi-acik)");
    expect(s.style.padding).toBe("10px 16px");
    expect(s.style.marginBottom).toBe("20px");
  });
});
