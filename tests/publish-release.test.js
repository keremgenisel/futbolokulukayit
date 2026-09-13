// GitHub Release yayınlayıcının saf yardımcıları (scripts/publish-release.cjs).
// Ağ/dosya yan etkisi olmadan test edilir: asset ad türetimi ve latest.yml biçimi.
// Regresyon amacı: v3.0.0/v3.0.1'de yaşanan (a) electron-builder çift-release yarışı,
// (b) bayat latest.yml (yanlış sürüm/hash). latest.yml url'i ile yüklenen asset adı
// bire bir uyuşmazsa electron-updater güncellemeyi reddeder.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pub from "../scripts/publish-release.cjs";

const { assetNameFromLocal, buildLatestYml, exeLocalName } = pub;

describe("assetNameFromLocal", () => {
  it("boşlukları tireye çevirir (electron-builder yükleme adıyla aynı)", () => {
    expect(assetNameFromLocal("Altunmak CRM Setup 3.0.1.exe")).toBe("Altunmak-CRM-Setup-3.0.1.exe");
    expect(assetNameFromLocal("Altunmak CRM Setup 3.0.1.exe.blockmap")).toBe("Altunmak-CRM-Setup-3.0.1.exe.blockmap");
  });
});

describe("buildLatestYml", () => {
  const yml = buildLatestYml({
    version: "3.0.1",
    exeAssetName: "Altunmak-CRM-Setup-3.0.1.exe",
    sha512: "ABC+/def==",
    size: 114387629,
    releaseDate: "2026-07-12T16:51:11.928Z",
  });

  it("doğru sürüm, tireli url ve hash içerir", () => {
    expect(yml).toContain("version: 3.0.1");
    expect(yml).toContain("url: Altunmak-CRM-Setup-3.0.1.exe");
    expect(yml).toContain("sha512: ABC+/def==");
    expect(yml).toContain("size: 114387629");
  });

  it("electron-updater biçimini korur (path + tekrar sha512 + tırnaklı tarih)", () => {
    expect(yml).toContain("path: Altunmak-CRM-Setup-3.0.1.exe");
    expect(yml).toMatch(/releaseDate: '2026-07-12T16:51:11\.928Z'/);
    // url ve path'teki .exe adı latest.yml içinde birebir aynı olmalı (uyuşmazlık = update reddi)
    const exeCount = (yml.match(/Altunmak-CRM-Setup-3\.0\.1\.exe/g) || []).length;
    expect(exeCount).toBe(2);
  });
});

describe("exeLocalName", () => {
  it("artifactName yer tutucularını doldurur; yoksa '<productName> Setup <version>.exe'", () => {
    expect(exeLocalName({ artifactName: "Futbol-Okulu-Kayit-Programi-Setup-${version}.${ext}", productName: "X", version: "1.2.3" })).toBe(
      "Futbol-Okulu-Kayit-Programi-Setup-1.2.3.exe",
    );
    expect(exeLocalName({ artifactName: "", productName: "Futbol Okulu Kayıt Programı", version: "1.2.3" })).toBe(
      "Futbol Okulu Kayıt Programı Setup 1.2.3.exe",
    );
  });
  it("package.json'daki artifactName ASCII ve boşluksuz (GitHub asset adı = latest.yml url)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    const ad = exeLocalName({ artifactName: pkg.build.artifactName, productName: pkg.build.productName, version: pkg.version });
    expect(ad).toMatch(/^[A-Za-z0-9.-]+\.exe$/);
    expect(assetNameFromLocal(ad)).toBe(ad); // yüklenen ad yerel adla aynı
  });
});

// Regresyon: .github/workflows/release.yml `npm run release` çağırır ama package.json'da bu script
// hiç tanımlı değildi (10.09.2026'da fark edildi) — etiket push edilince CI "Missing script" ile düşerdi.
describe("release.yml ↔ package.json script tutarlılığı", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "release.yml"), "utf-8");

  it("release.yml'in çağırdığı `npm run release` script'i package.json'da tanımlı", () => {
    expect(workflow).toContain("npm run release");
    expect(pkg.scripts.release).toBeTruthy();
  });

  it("`release` script'i build + electron-builder --win + publish-release.cjs'i sırayla çalıştırır", () => {
    expect(pkg.scripts.release).toContain("vite build");
    expect(pkg.scripts.release).toContain("electron-builder --win");
    expect(pkg.scripts.release).toContain("scripts/publish-release.cjs");
  });
});

describe("surumNotuGovdesi (13.09.2026): release gövdesi asla boş değil", () => {
  it("docs/surum-notlari/<v>.md varsa içeriği, yoksa 'Sürüm <v>'", async () => {
    const { surumNotuGovdesi } = await import("../scripts/publish-release.cjs");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const kok = fs.mkdtempSync(path.join(os.tmpdir(), "surum-notu-"));
    fs.mkdirSync(path.join(kok, "docs", "surum-notlari"), { recursive: true });
    fs.writeFileSync(path.join(kok, "docs", "surum-notlari", "9.9.9.md"), "## Yenilik\n\n- bir\n");
    expect(surumNotuGovdesi("9.9.9", kok)).toBe("## Yenilik\n\n- bir");
    expect(surumNotuGovdesi("9.9.8", kok)).toBe("Sürüm 9.9.8");
    expect(surumNotuGovdesi("1.3.1")).toContain("Düzeltme"); // depodaki gerçek dosya
    fs.rmSync(kok, { recursive: true, force: true });
  });
});
