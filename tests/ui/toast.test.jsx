// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ToastSaglayici, useToast } from "../../src/components/ui.jsx";

afterEach(cleanup);

function Deneme() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast("ok", "Kaydedildi")}>
      Göster
    </button>
  );
}

describe("Bildirimler (toast)", () => {
  it("en üstte ortada çıkar (sağ altta değil) ve modal'ların üstünde kalır", () => {
    render(
      <ToastSaglayici>
        <Deneme />
      </ToastSaglayici>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Göster" }));
    expect(screen.getByRole("status")).toHaveTextContent("Kaydedildi");
    const k = screen.getByTestId("toast-kapsayici");
    expect(k.style.position).toBe("fixed");
    expect(k.style.top).toBe("20px");
    expect(k.style.left).toBe("50%");
    expect(k.style.transform).toContain("translateX(-50%)");
    expect(k.style.bottom).toBe("");
    expect(k.style.right).toBe("");
    expect(Number(k.style.zIndex)).toBeGreaterThan(50);
  });
});
