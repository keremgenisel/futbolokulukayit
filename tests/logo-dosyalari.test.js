// Logo dosyaları (plan §30, §32): uygulama ikonu build/icon.png (1024x1024 PNG, alfa kanallı; electron-builder .ico'yu bundan
// üretir, main.cjs pencere ikonu, package.json win.icon), giriş/kenar menü varsayılan logosu public/logo.png (512x512).
// Kulüp arması artık depoda DEĞİL (§32.3): kulüp kendi logosunu Ayarlar'dan yükler (uploads/kulup/logo.*), makbuz/form/rapor
// `app:logo` ile onu okur; yüklenmemişse logosuz basılır. Kaynak SVG'ler build/logo.svg (beyaz zemin) ve build/logo-kirmizi.svg.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const kok = path.join(__dirname, "..");

/** PNG başlığından genişlik/yükseklik/renk tipi okur. */
function pngBilgi(dosya) {
  const b = fs.readFileSync(path.join(kok, dosya));
  expect(b.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), renkTipi: b[25] };
}

describe("Logo dosyaları", () => {
  it("build/icon.png 1024x1024 alfa kanallı PNG; package.json ve main.cjs onu ikon olarak kullanır", () => {
    const p = pngBilgi("build/icon.png");
    expect(p).toEqual({ w: 1024, h: 1024, renkTipi: 6 }); // 6 = RGBA
    const pkg = JSON.parse(fs.readFileSync(path.join(kok, "package.json"), "utf-8"));
    expect(pkg.build.win.icon).toBe("build/icon.png");
    const main = fs.readFileSync(path.join(kok, "electron/main.cjs"), "utf-8");
    expect(main).toContain('icon: path.join(__dirname, "../build/icon.png")');
  });

  it("public/logo.png 512x512 (giriş ekranı + kenar menü; kulüp logosu yoksa)", () => {
    expect(pngBilgi("public/logo.png")).toEqual({ w: 512, h: 512, renkTipi: 6 });
    for (const dosya of ["src/components/Giris.jsx", "src/components/KenarMenu.jsx"]) {
      expect(fs.readFileSync(path.join(kok, dosya), "utf-8")).toContain('marka?.logo || "./logo.png"');
    }
  });

  it("Eyüpspor arması depodan kalktı: build/kulup-logo.png yok, extraResources yok, app:logo kulüp ayarından okur", () => {
    expect(fs.existsSync(path.join(kok, "build/kulup-logo.png"))).toBe(false);
    const pkg = JSON.parse(fs.readFileSync(path.join(kok, "package.json"), "utf-8"));
    expect(pkg.build.extraResources).toBeUndefined();
    const main = fs.readFileSync(path.join(kok, "electron/main.cjs"), "utf-8");
    expect(main).not.toContain("kulup-logo.png");
    expect(main).toContain('ipcMain.handle("app:logo"');
    expect(main).toContain("markaOku(");
  });

  it("kaynak SVG'ler build/ altında ve kırmızı/beyaz paleti kullanır", () => {
    for (const d of ["build/logo.svg", "build/logo-beyaz.svg", "build/logo-kirmizi.svg"]) {
      const svg = fs.readFileSync(path.join(kok, d), "utf-8");
      expect(svg).toContain('viewBox="0 0 512 512"');
      expect(svg).toMatch(/#E0101F|#7A0A12/);
    }
    // kullanılan logo kırmızı zeminli: kök dikdörtgen dolgusu kırmızı
    expect(fs.readFileSync(path.join(kok, "build/logo.svg"), "utf-8")).toMatch(
      /<rect x="0" y="0" width="512" height="512" rx="112" fill="#E0101F"\/>/,
    );
  });
});
