import { describe, it, expect } from "vitest";
import { gunKaydir, haftaGunu, haftaBasi, gunSeridi, varsayilanBaslangic, uzunTarih, gunNoktalari } from "../src/lib/takvim.js";

describe("takvim yardımcıları", () => {
  it("gün kaydırma ay ve yıl sınırlarını aşar", () => {
    expect(gunKaydir("2026-08-31", 1)).toBe("2026-09-01");
    expect(gunKaydir("2026-12-31", 1)).toBe("2027-01-01");
    expect(gunKaydir("2026-03-01", -1)).toBe("2026-02-28");
    expect(gunKaydir("2028-03-01", -1)).toBe("2028-02-29"); // artık yıl
  });
  it("hafta günü pazartesi başlar, hafta başı pazartesiye gider", () => {
    expect(haftaGunu("2026-09-07")).toBe(0); // Pazartesi
    expect(haftaGunu("2026-09-13")).toBe(6); // Pazar
    expect(haftaBasi("2026-09-10")).toBe("2026-09-07");
    expect(haftaBasi("2026-09-07")).toBe("2026-09-07");
  });
  it("14 günlük şerit: Türkçe gün adları, ay etiketi ilk hücrede ve ay başında, bugün ve hafta sonu işaretli", () => {
    const s = gunSeridi("2026-08-31", 14, "2026-09-07");
    expect(s).toHaveLength(14);
    expect(s[0]).toMatchObject({ iso: "2026-08-31", gunAdi: "Pzt", gun: 31, ay: "AĞU", ayEtiketi: true, bugunMu: false });
    expect(s[1]).toMatchObject({ iso: "2026-09-01", gunAdi: "Sal", ay: "EYL", ayEtiketi: true });
    expect(s[2].ayEtiketi).toBe(false);
    expect(s[7]).toMatchObject({ iso: "2026-09-07", bugunMu: true, haftaSonu: false });
    expect(s[5].haftaSonu).toBe(true);
    expect(s[6].haftaSonu).toBe(true);
  });
  it("varsayılan başlangıç bugünü ikinci haftaya koyar", () => {
    expect(varsayilanBaslangic("2026-09-10")).toBe("2026-08-31");
    expect(gunSeridi(varsayilanBaslangic("2026-09-10"), 14, "2026-09-10")[10].bugunMu).toBe(true);
  });
  it("uzun Türkçe tarih", () => {
    expect(uzunTarih("2026-09-08")).toBe("8 Eylül 2026 Salı");
  });
  it("gün noktaları: iptal kırmızı, işaretsiz gri, tamam yeşil, kısmen mor", () => {
    expect(
      gunNoktalari([
        { iptal: 1, oyuncu: 10, isaretli: 10 },
        { iptal: 0, oyuncu: 10, isaretli: 0 },
        { iptal: 0, oyuncu: 10, isaretli: 10 },
        { iptal: 0, oyuncu: 10, isaretli: 3 },
      ]),
    ).toEqual(["kirmizi", "gri", "yesil", "mor"]);
    expect(gunNoktalari([])).toEqual([]);
  });
});
