import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const { yedekGerekliMi, sikliktNormalize, SIKLIKLAR } = createRequire(import.meta.url)("../electron/yedekSiklik.cjs");

const simdi = new Date("2026-09-07T10:00:00Z");
describe("otomatik yedek sıklığı", () => {
  it("kapalı → hiç; her açılışta → her zaman", () => {
    expect(yedekGerekliMi("kapali", null, simdi)).toBe(false);
    expect(yedekGerekliMi("kapali", "2020-01-01T00:00:00Z", simdi)).toBe(false);
    expect(yedekGerekliMi("acilis", "2026-09-07T09:59:00Z", simdi)).toBe(true);
  });
  it("günlük: aynı gün alınmışsa alınmaz, dün alınmışsa alınır, hiç yoksa alınır", () => {
    expect(yedekGerekliMi("gunluk", "2026-09-07T01:00:00Z", simdi)).toBe(false);
    expect(yedekGerekliMi("gunluk", "2026-09-06T23:00:00Z", simdi)).toBe(true);
    expect(yedekGerekliMi("gunluk", null, simdi)).toBe(true);
  });
  it("haftalık: 7 günden yeni ise alınmaz, 7 gün ve üstü alınır", () => {
    expect(yedekGerekliMi("haftalik", "2026-09-01T10:00:01Z", simdi)).toBe(false);
    expect(yedekGerekliMi("haftalik", "2026-08-31T10:00:00Z", simdi)).toBe(true);
    expect(yedekGerekliMi("haftalik", null, simdi)).toBe(true);
  });
  it("bilinmeyen/boş ayar günlük sayılır; bozuk tarih yedek aldırır", () => {
    expect(sikliktNormalize(null)).toBe("gunluk");
    expect(sikliktNormalize("saatlik")).toBe("gunluk");
    expect(yedekGerekliMi(undefined, "2026-09-07T01:00:00Z", simdi)).toBe(false);
    expect(yedekGerekliMi("gunluk", "bozuk", simdi)).toBe(true);
    expect(SIKLIKLAR.map((s) => s.kod)).toEqual(["acilis", "gunluk", "haftalik", "kapali"]);
  });
});
