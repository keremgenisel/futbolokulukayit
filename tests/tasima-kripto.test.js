import { describe, it, expect } from "vitest";
import { sifrele, coz, paketMi, parolaGecerliMi, PAROLA_MIN } from "../electron/tasimaKripto.cjs";

describe("taşıma paketi şifrelemesi", () => {
  const veri = Buffer.from("PK sahte zip içeriği, Türkçe harfler: ğüşiöç", "utf8");
  it("şifrele/çöz aynı veriyi verir; her paket farklı (salt/iv)", () => {
    const a = sifrele(veri, "cok-gizli-parola"), b = sifrele(veri, "cok-gizli-parola");
    expect(paketMi(a)).toBe(true); expect(a.equals(b)).toBe(false);
    expect(coz(a, "cok-gizli-parola").equals(veri)).toBe(true); expect(coz(b, "cok-gizli-parola").equals(veri)).toBe(true);
    expect(a.includes(veri.subarray(4, 20))).toBe(false); // düz metin paketin içinde görünmez
  });
  it("yanlış parola ve bozuk paket açık hata verir", () => {
    const p = sifrele(veri, "cok-gizli-parola");
    expect(() => coz(p, "yanlis-parola1")).toThrow("Parola yanlış ya da paket bozuk");
    const bozuk = Buffer.from(p); bozuk[bozuk.length - 1] ^= 0xff;
    expect(() => coz(bozuk, "cok-gizli-parola")).toThrow("Parola yanlış ya da paket bozuk");
    expect(() => coz(Buffer.from("PK zip ama paket degil"), "cok-gizli-parola")).toThrow("Bu bir Eyüpspor taşıma paketi değil");
  });
  it("parola en az 8 karakter", () => {
    expect(parolaGecerliMi("1234567")).toBe(false); expect(parolaGecerliMi("12345678")).toBe(true); expect(PAROLA_MIN).toBe(8);
    expect(() => sifrele(veri, "kisa")).toThrow("en az 8 karakter");
  });
});
