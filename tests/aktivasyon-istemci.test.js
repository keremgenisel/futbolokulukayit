// Aktivasyon istemcisi (electron/aktivasyonIstemci.cjs) — dış fetch sarmalayıcısı. Regresyon:
// aktivasyon ayarlı DEĞİLKEN (URL boş) uygulama ÇÖKMEMELİ; istemci fetch yapmadan { error } döner
// (yalnız elle lease modu). URL gömülüyse (deploy sonrası) ağ testi manueldir; birim testi ağa
// çıkmaz — bu yüzden ayarlıyken atlanır. `npm test` internetten bağımsız kalır.
import { describe, it, expect } from "vitest";
import { aktive, yenile, ayarli } from "../electron/aktivasyonIstemci.cjs";

describe("aktivasyonIstemci — güvenli sarmalayıcı", () => {
  it("dışa açık API doğru biçimde: aktive/yenile fonksiyon, ayarli() boolean", () => {
    expect(typeof aktive).toBe("function");
    expect(typeof yenile).toBe("function");
    expect(typeof ayarli()).toBe("boolean");
  });

  it("aktivasyon URL'si BOŞken fetch yapmadan error döner (throw etmez)", async () => {
    if (ayarli()) return; // URL gömülü (deploy sonrası) → ağ testi manuel; birim testi ağa çıkmaz
    expect((await aktive("k", "m", "1")).error).toBeTruthy();
    expect((await yenile("k", "m")).error).toBeTruthy();
  });
});
