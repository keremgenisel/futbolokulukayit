// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { ParaGirdi } from "../../src/components/ui.jsx";

afterEach(cleanup);

function Deneme({ onDegis }) {
  const [v, setV] = useState("3500");
  return (
    <ParaGirdi
      value={v}
      onDegis={(x) => {
        setV(x);
        onDegis(x);
      }}
      aria-label="Tutar"
    />
  );
}

describe("ParaGirdi", () => {
  it("5.000 biçiminde gösterir, dışarı rakam verir, harf ve noktayı yok sayar", () => {
    const onDegis = vi.fn();
    render(<Deneme onDegis={onDegis} />);
    const g = screen.getByLabelText("Tutar");
    expect(g).toHaveValue("3.500");
    fireEvent.change(g, { target: { value: "12.5a00" } });
    expect(onDegis).toHaveBeenLastCalledWith("12500");
    expect(g).toHaveValue("12.500");
    fireEvent.change(g, { target: { value: "" } });
    expect(onDegis).toHaveBeenLastCalledWith("");
    expect(g).toHaveValue("");
  });
});
