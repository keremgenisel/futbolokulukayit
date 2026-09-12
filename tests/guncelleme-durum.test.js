// Ana süreç güncelleyici son durum makinesi (electron/ipc/guncelleme.cjs sonDurumGuncelle) — şerit girişten sonra bağlanınca
// kaçırdığı olayı buradan okur (12.09.2026: 1.1.0'da banner gelmedi).
import { describe, it, expect } from "vitest";
import { sonDurumGuncelle } from "../electron/ipc/guncelleme.cjs";

describe("sonDurumGuncelle", () => {
  it("available → var; progress → indiriliyor+yüzde; downloaded → indirildi; error yalnız bir şey başladıysa", () => {
    let d = { asama: "yok" };
    expect(sonDurumGuncelle(d, "error", "ağ")).toEqual({ asama: "yok" }); // henüz sürüm yokken hata şerit açmaz
    d = sonDurumGuncelle(d, "available", { version: "1.2.3" });
    expect(d).toEqual({ asama: "var", surum: "1.2.3" });
    d = sonDurumGuncelle(d, "progress", 42);
    expect(d).toMatchObject({ asama: "indiriliyor", yuzde: 42, surum: "1.2.3" });
    expect(sonDurumGuncelle(d, "available", { version: "1.2.3" })).toBe(d); // indirme sürerken 'available' durumu geri almaz
    d = sonDurumGuncelle(d, "downloaded", {});
    expect(d).toEqual({ asama: "indirildi", surum: "1.2.3" });
    expect(sonDurumGuncelle({ asama: "var", surum: "x" }, "error", "boom")).toMatchObject({ asama: "hata", mesaj: "boom" });
    expect(sonDurumGuncelle(d, "bilinmeyen", 1)).toBe(d);
  });
});
