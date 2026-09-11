// Güvenlik 2. inceleme #7: hız sınırı haritası sınırsız büyümez — eşik aşılınca dolmuş pencereler, sonra en eskiler atılır.
import { describe, it, expect } from "vitest";
import { rateHit, rateBudama, rateAllow } from "../electron/rateLimit.cjs";

describe("rateBudama", () => {
  it("eşik altında dokunmaz; üstünde önce süresi dolanları, yetmezse en eski bitişlileri siler; aktif kilit korunur", () => {
    const s = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) rateHit(s, "eski" + i, now - 100_000, 60_000); // pencereleri dolmuş
    for (let i = 0; i < 10; i++) rateHit(s, "yeni" + i, now - i, 60_000); // aktif
    expect(rateBudama(s, now, 50)).toBe(0);
    expect(rateBudama(s, now, 12)).toBe(10); // dolmuş 10 gitti → 10 kaldı (≤12)
    expect(s.size).toBe(10);
    expect(rateBudama(s, now, 4)).toBe(6); // en eski bitişli 6 aktif kayıt da gitti
    expect(s.size).toBe(4);
    // hâlâ kilitli olan (en yeni) korunur
    for (let i = 0; i < 7; i++) rateHit(s, "kilit", now, 60_000);
    rateHit(s, "kilit", now, 60_000);
    expect(rateAllow(s, "kilit", now, 8, 60_000)).toBe(false);
    rateBudama(s, now, 1);
    expect(s.has("kilit")).toBe(true);
  });
});
