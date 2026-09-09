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
