// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { KenarMenu } from "../../src/components/KenarMenu.jsx";
import { TABS } from "../../src/App.jsx";

afterEach(cleanup);
const oturum = { username: "admin", ad_soyad: "Ahmet Hoca", role: "admin" };

describe("Kenar menü daralt/genişlet", () => {
  beforeEach(() => localStorage.clear());

  it("varsayılan geniş; daraltınca metinler gizlenir, ikonlar tıklanabilir kalır; tercih hatırlanır", () => {
    const onSec = vi.fn();
    const { unmount } = render(<KenarMenu sekmeler={TABS} tab="pano" onSec={onSec} oturum={oturum} onCikis={vi.fn()} />);
    expect(screen.getByText("Oyuncular")).toBeInTheDocument();
    expect(screen.getByText("Ahmet Hoca")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menüyü daralt" }));
    expect(screen.queryByText("Oyuncular")).toBeNull();
    expect(screen.queryByText("Ahmet Hoca")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Oyuncular" }));
    expect(onSec).toHaveBeenCalledWith("oyuncular");
    expect(screen.getByRole("button", { name: "Çıkış" })).toBeInTheDocument();
    unmount();
    // Yeniden açılışta dar kalır, genişletince metinler döner
    render(<KenarMenu sekmeler={TABS} tab="pano" onSec={onSec} oturum={oturum} onCikis={vi.fn()} />);
    expect(screen.queryByText("Oyuncular")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menüyü genişlet" }));
    expect(screen.getByText("Oyuncular")).toBeInTheDocument();
    expect(localStorage.getItem("menuDar")).toBe("0");
  });
});
