// Güvenlik 2. inceleme #5: 30 günden eski .pre-restore kopyaları açılışta silinir; yeniler ve başka dosyalar kalır.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { kenarKopyalariniTemizle, KENAR_SAKLAMA_MS } from "../electron/ipc/yedekCekirdek.cjs";

describe("kenar kopyası temizliği", () => {
  it("30 günden eski data.db/uploads .pre-restore kopyaları silinir", () => {
    const kok = fs.mkdtempSync(path.join(os.tmpdir(), "fok-kenar-test-"));
    const now = Date.now();
    const yap = (ad, yasMs, klasor = false) => {
      const y = path.join(kok, ad);
      if (klasor) {
        fs.mkdirSync(y);
        fs.writeFileSync(path.join(y, "x"), "1");
      } else fs.writeFileSync(y, "db");
      const t = new Date(now - yasMs);
      fs.utimesSync(y, t, t);
    };
    yap("data.db.pre-restore-2026-08-01-10-00-00", KENAR_SAKLAMA_MS + 1000);
    yap("uploads.pre-restore-2026-08-01-10-00-00", KENAR_SAKLAMA_MS + 1000, true);
    yap("data.db.pre-restore-2026-09-10-10-00-00", 24 * 3600 * 1000);
    yap("data.db", 1000);
    expect(kenarKopyalariniTemizle(kok, now)).toBe(2);
    expect(fs.existsSync(path.join(kok, "data.db.pre-restore-2026-09-10-10-00-00"))).toBe(true);
    expect(fs.existsSync(path.join(kok, "data.db"))).toBe(true);
    expect(fs.existsSync(path.join(kok, "uploads.pre-restore-2026-08-01-10-00-00"))).toBe(false);
    fs.rmSync(kok, { recursive: true, force: true });
  });
});
