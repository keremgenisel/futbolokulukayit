// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useSezonDurumu } from "../../src/lib/useSezonDurumu.js";

afterEach(cleanup);

describe("useSezonDurumu (refactor §8.3)", () => {
  it("yüklemeden önce boş varsayılanlar; yüklenince aktif sezon, başlangıç ayı ve tarihler; eksik tarih null", async () => {
    let cevap = { aktifSezon: "2026-2027", baslangicAyi: 9, tarihler: { baslangic: "2026-09-01", bitis: "2027-06-30", kayitli: true } };
    window.okul = { db: vi.fn(async (fn) => (fn === "sezonDurumu" ? cevap : null)) };
    const { result } = renderHook(() => useSezonDurumu());
    expect(result.current.aktifSezon).toBe("");
    expect(result.current.baslangicAyi).toBe(9);
    expect(result.current.tarihler).toBeNull();
    await waitFor(() => expect(result.current.aktifSezon).toBe("2026-2027"));
    expect(result.current.tarihler).toEqual(cevap.tarihler);
    cevap = { aktifSezon: "2027-2028", baslangicAyi: 1, tarihler: { baslangic: "", bitis: "" } };
    let d;
    await act(async () => {
      d = await result.current.yenile();
    });
    expect(d).toEqual(cevap);
    expect(result.current.aktifSezon).toBe("2027-2028");
    expect(result.current.baslangicAyi).toBe(1);
    expect(result.current.tarihler).toBeNull(); // boş tarihler sezon dışı hesabına girmez
    expect(window.okul.db).toHaveBeenCalledTimes(2);
  });
  it("çağrı hata verirse durum null kalır, yenile null döner", async () => {
    window.okul = {
      db: vi.fn(async () => {
        throw new Error("kopuk");
      }),
    };
    const { result } = renderHook(() => useSezonDurumu());
    let d;
    await act(async () => {
      d = await result.current.yenile();
    });
    expect(d).toBeNull();
    expect(result.current.durum).toBeNull();
  });
});
