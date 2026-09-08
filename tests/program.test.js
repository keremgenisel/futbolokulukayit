import { describe, it, expect } from "vitest";
import { programCoz, programOzeti, haftaninAntrenmanlari, programGunu } from "../src/lib/program.js";

describe("haftalık antrenman programı", () => {
  it("JSON çözme: geçersiz girdiler ayıklanır, gün/saat sırasına dizilir", () => {
    const p = programCoz(
      '[{"gun":3,"saat":"17:00","saha":"Saha 1"},{"gun":1,"saat":"18:30"},{"gun":9,"saat":"10:00"},{"gun":2,"saat":"bozuk"},null]',
    );
    expect(p).toEqual([
      { gun: 1, saat: "18:30", saha: "" },
      { gun: 3, saat: "17:00", saha: "Saha 1" },
    ]);
    expect(programCoz("bozuk json")).toEqual([]);
    expect(programCoz("")).toEqual([]);
    expect(programCoz(null)).toEqual([]);
  });
  it("özet metni", () => {
    expect(
      programOzeti([
        { gun: 1, saat: "17:00" },
        { gun: 3, saat: "17:00" },
      ]),
    ).toBe("Pzt 17:00 · Çar 17:00");
    expect(programOzeti([])).toBe("");
  });
  it("haftanın antrenman tarihleri: haftanın herhangi bir gününden pazartesiye göre", () => {
    const prog = [
      { gun: 1, saat: "17:00", saha: "Saha 1" },
      { gun: 3, saat: "17:00", saha: "Saha 1" },
      { gun: 6, saat: "10:00", saha: "" },
    ];
    expect(haftaninAntrenmanlari("2026-09-10", prog)).toEqual([
      { tarih: "2026-09-07", saat: "17:00", saha: "Saha 1" },
      { tarih: "2026-09-09", saat: "17:00", saha: "Saha 1" },
      { tarih: "2026-09-12", saat: "10:00", saha: "" },
    ]);
    expect(programGunu("2026-09-07")).toBe(1);
    expect(programGunu("2026-09-13")).toBe(7);
  });
});
