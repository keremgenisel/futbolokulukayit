import { describe, it, expect } from "vitest";
import { kosulHatasi, donerek, firlatarak, MESAJ } from "../electron/ipc/koruma.cjs";

const admin = { username: "a", role: "admin" };
const kul = { username: "k", role: "kullanici" };

describe("IPC ön koşulları (koruma.cjs)", () => {
  it("oturum yoksa her zaman 'Oturum gerekli'; yönetici şartı rolü denetler", () => {
    expect(kosulHatasi(null)).toBe(MESAJ.oturum);
    expect(kosulHatasi(undefined, { yonetici: true })).toBe(MESAJ.oturum);
    expect(kosulHatasi(kul, { yonetici: true })).toBe(MESAJ.yonetici);
    expect(kosulHatasi(admin, { yonetici: true })).toBeNull();
    expect(kosulHatasi(kul)).toBeNull();
  });
  it("istemci modu ve salt okunur lisans sırayla, verilen mesajla", () => {
    expect(kosulHatasi(admin, { istemciMi: () => true, istemciMesaji: "Yalnız sunucuda" })).toBe("Yalnız sunucuda");
    expect(kosulHatasi(admin, { istemciMi: () => false, saltOkunurMu: () => true })).toBe(MESAJ.saltOkunur);
    expect(kosulHatasi(kul, { yonetici: true, istemciMi: () => true, istemciMesaji: "x" })).toBe(MESAJ.yonetici); // yetki önce
  });
  it("donerek { error } verir, firlatarak Error fırlatır; koşul sağlanınca sessiz", () => {
    expect(donerek(() => null, { yonetici: true })()).toEqual({ error: MESAJ.oturum });
    expect(donerek(() => admin, { yonetici: true })()).toBeNull();
    expect(() => firlatarak(() => kul, { yonetici: true })()).toThrow(MESAJ.yonetici);
    expect(() => firlatarak(() => admin)()).not.toThrow();
  });
});
