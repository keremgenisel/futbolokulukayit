import { describe, it, expect } from "vitest";
import {
  programCoz,
  programOzeti,
  haftaninAntrenmanlari,
  programGunu,
  saatAraligi,
  saatDk,
  saatEkle,
  sureDk,
  saatAraligiDogrula,
  aralikKesisir,
  programDegisiklikleri,
} from "../src/lib/program.js";

describe("haftalık antrenman programı", () => {
  it("JSON çözme: geçersiz girdiler ayıklanır, gün/saat sırasına dizilir", () => {
    const p = programCoz(
      '[{"gun":3,"saat":"17:00","saha":"Saha 1"},{"gun":1,"saat":"18:30"},{"gun":9,"saat":"10:00"},{"gun":2,"saat":"bozuk"},null]',
    );
    expect(p).toEqual([
      { gun: 1, saat: "18:30", bitis: "", saha: "" },
      { gun: 3, saat: "17:00", bitis: "", saha: "Saha 1" },
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
      { tarih: "2026-09-07", saat: "17:00", bitis: "", saha: "Saha 1" },
      { tarih: "2026-09-09", saat: "17:00", bitis: "", saha: "Saha 1" },
      { tarih: "2026-09-12", saat: "10:00", bitis: "", saha: "" },
    ]);
    expect(programGunu("2026-09-07")).toBe(1);
    expect(programGunu("2026-09-13")).toBe(7);
  });
  it("bitiş (plan §37): geçerli bitiş alınır, başlangıçtan önce/bozuk bitiş atılır; özet ve hafta üretimi aralığı taşır", () => {
    const p = programCoz(
      '[{"gun":1,"saat":"17:00","bitis":"18:30","saha":"Saha 1"},{"gun":3,"saat":"17:00","bitis":"16:00"},{"gun":5,"saat":"10:00","bitis":"bozuk"}]',
    );
    expect(p.map((x) => x.bitis)).toEqual(["18:30", "", ""]);
    expect(programOzeti(p)).toBe("Pzt 17:00–18:30 · Çar 17:00 · Cum 10:00");
    expect(haftaninAntrenmanlari("2026-09-10", p)[0]).toEqual({ tarih: "2026-09-07", saat: "17:00", bitis: "18:30", saha: "Saha 1" });
  });
  it("saat yardımcıları: aralık metni, dakika, ekleme, süre", () => {
    expect(saatAraligi("17:00", "18:30")).toBe("17:00–18:30");
    expect(saatAraligi("17:00", "")).toBe("17:00");
    expect(saatAraligi("", "18:30")).toBe("");
    expect(saatDk("17:30")).toBe(1050);
    expect(saatDk("24:00")).toBeNull();
    expect(saatDk("7:30")).toBeNull();
    expect(saatEkle("17:00", 90)).toBe("18:30");
    expect(saatEkle("23:30", 90)).toBe("23:59");
    expect(sureDk("17:00", "18:30")).toBe(90);
    expect(sureDk("17:00", "17:00")).toBeNull();
  });
  it("saat aralığı doğrulaması: bitiş isteğe bağlı; bozuk/önce olan reddedilir", () => {
    const durumlar = [
      ["17:00", ""],
      ["17:00", "18:30"],
      ["17:00", "16:00"],
      ["17:00", "17:00"],
      ["17:00", "bozuk"],
      ["", "18:00"],
    ];
    expect(durumlar.map(([a, b]) => saatAraligiDogrula(a, b).gecerli)).toEqual([true, true, false, false, false, false]);
  });
  it("aralık kesişmesi: bitişsiz antrenman 90 dk sayılır; uçtan uca değen aralıklar kesişmez", () => {
    expect(aralikKesisir({ saat: "17:00", bitis: "18:30" }, { saat: "17:30", bitis: "19:00" })).toBe(true);
    expect(aralikKesisir({ saat: "17:00", bitis: "18:30" }, { saat: "18:30", bitis: "20:00" })).toBe(false);
    expect(aralikKesisir({ saat: "17:00" }, { saat: "18:00" })).toBe(true); // 17:00–18:30 vs 18:00–19:30
    expect(aralikKesisir({ saat: "17:00" }, { saat: "18:30" })).toBe(false);
    expect(aralikKesisir({ saat: "" }, { saat: "18:30" })).toBe(false);
  });
});

describe("programDegisiklikleri (13.09.2026: grupta saha silinince Pano eski sahayı yazıyordu)", () => {
  it("aynı gün+saat: saha/bitiş farkı döner; saat değişimi tek satırlı günde eşleşir; kaldırılan gün dönmez; değişmeyen dönmez", () => {
    const eski = [
      { gun: 1, saat: "17:00", bitis: "18:00", saha: "Saha 1" },
      { gun: 3, saat: "17:00", bitis: "", saha: "Saha 2" },
      { gun: 5, saat: "10:00", bitis: "", saha: "Saha 3" },
    ];
    const yeni = [
      { gun: 1, saat: "17:00", bitis: "18:00", saha: "" }, // saha silindi
      { gun: 3, saat: "18:00", bitis: "19:00", saha: "Saha 2" }, // saat değişti (günde tek satır)
      // 5. gün kaldırıldı
    ];
    expect(programDegisiklikleri(eski, yeni)).toEqual([
      { gun: 1, eskiSaat: "17:00", eskiBitis: "18:00", eskiSaha: "Saha 1", saat: "17:00", bitis: "18:00", saha: "" },
      { gun: 3, eskiSaat: "17:00", eskiBitis: "", eskiSaha: "Saha 2", saat: "18:00", bitis: "19:00", saha: "Saha 2" },
    ]);
    expect(programDegisiklikleri(eski, eski)).toEqual([]);
    expect(programDegisiklikleri([], yeni)).toEqual([]);
    // aynı günde iki satır varken saat eşleşmezse belirsiz: dokunulmaz
    expect(
      programDegisiklikleri(
        [
          { gun: 2, saat: "10:00", saha: "A" },
          { gun: 2, saat: "12:00", saha: "A" },
        ],
        [
          { gun: 2, saat: "11:00", saha: "B" },
          { gun: 2, saat: "12:00", saha: "A" },
        ],
      ),
    ).toEqual([]);
  });
});
