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
  it("ağ hatası mesaja kısa neden kodunu ekler (DNS/TLS/zaman aşımı ayırt edilir; 12.09.2026)", async () => {
    const { hataKodu } = await import("../electron/aktivasyonIstemci.cjs");
    expect(hataKodu(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }))).toBe("ENOTFOUND");
    expect(hataKodu(Object.assign(new Error("x"), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }))).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(hataKodu(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe("ZAMAN_ASIMI_10s");
    expect(hataKodu(new TypeError("fetch failed"))).toBe("fetch failed");
  });
  it("baglantiSina: fetch başarısızsa { error } ve neden kodu; başarılıysa { ok, ms }", async () => {
    const { baglantiSina } = await import("../electron/aktivasyonIstemci.cjs");
    const eski = globalThis.fetch;
    globalThis.fetch = async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    };
    try {
      expect((await baglantiSina()).error).toMatch(/ECONNREFUSED/);
      globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
      const r = await baglantiSina();
      expect(r.ok).toBe(true);
      expect(typeof r.ms).toBe("number");
    } finally {
      globalThis.fetch = eski;
    }
  });
});
