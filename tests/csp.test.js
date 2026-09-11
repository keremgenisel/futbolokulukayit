// Güvenlik 2. inceleme #3: üretim CSP'sinde dev sunucusu adresi yok; dev dönüşümü yalnız serve modunda ekler.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { cspDev, DEV_CONNECT } from "../vite.config.js";

describe("CSP", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || "";
  it("index.html (üretim): default-src 'self', connect-src yalnız 'self', localhost yok", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/localhost|127\.0\.0\.1|ws:/);
  });
  it("dev dönüşümü localhost/ws ekler, üretim metnine dokunmaz", () => {
    expect(cspDev(html)).toContain(`connect-src 'self' ${DEV_CONNECT}`);
    expect(html).not.toContain(DEV_CONNECT);
  });
});
