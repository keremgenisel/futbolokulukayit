import { describe, it, expect } from "vitest";
import { kodUret, KOD_GECERLI } from "../electron/kodUret.cjs";

describe("kodUret: ad → makine kodu", () => {
  it("Türkçe harfleri ASCII'ye çevirir, boşluk/noktalama alt çizgi olur", () => {
    expect(kodUret("Kardeş İndirimi")).toBe("kardes_indirimi");
    expect(kodUret("Eldiven & Bere")).toBe("eldiven_bere");
    expect(kodUret("  Çorap (kışlık) ")).toBe("corap_kislik");
    expect(kodUret("Şampiyonluk Bursu %50")).toBe("sampiyonluk_bursu_50");
  });
  it("çakışırsa _2, _3 … ekler; büyük/küçük harf ayırmaz", () => {
    expect(kodUret("Forma", ["forma"])).toBe("forma_2");
    expect(kodUret("Forma", ["forma", "forma_2"])).toBe("forma_3");
    expect(kodUret("FORMA", ["Forma"])).toBe("forma_2");
  });
  it("boş ya da rakamla başlayan ad için varsayılan önek", () => {
    expect(kodUret("", [], "kalem")).toBe("kalem");
    expect(kodUret("%%%", [], "tip")).toBe("tip");
    expect(kodUret("2. Kardeş", [], "tip")).toBe("tip_2_kardes");
  });
  it("üretilen her kod geçerlilik kalıbına uyar", () => {
    for (const ad of ["Aidat", "Ücretsiz", "3 Ay Peşin", "", "ÇĞİÖŞÜ"]) expect(KOD_GECERLI.test(kodUret(ad, [], "x"))).toBe(true);
  });
});
