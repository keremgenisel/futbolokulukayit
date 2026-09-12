import { describe, it, expect } from "vitest";
import { cagriYetkisi, OKUMA, YAZMA, ADMIN } from "../electron/yetki.cjs";

const admin = { username: "a", role: "admin" },
  kullanici = { username: "k", role: "kullanici" };

describe("cagriYetkisi — IPC ve sunucu için ortak yetki kararı", () => {
  it("oturumsuz her çağrı 401", () => {
    expect(cagriYetkisi("listAgeGroups", null, false).kod).toBe(401);
  });
  it("okuma herkese açık, salt okunurda bile", () => {
    expect(cagriYetkisi("listPlayers", kullanici, true).ok).toBe(true);
    for (const f of ["playersPage", "playerAttendanceSon", "listCancelledReceipts"]) expect(cagriYetkisi(f, kullanici, true).ok).toBe(true);
  });
  it("yazma lisans salt okunurken 403, normalde serbest", () => {
    expect(cagriYetkisi("createPlayer", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("cancelTraining", kullanici, true).kod).toBe(403);
    // WhatsApp (plan §13): okuma serbest, kayıt yazma; salt okunurda mesaj kaydı reddedilir ama bağlantı açma IPC'si db dışında
    expect(cagriYetkisi("antrenmanVelileri", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("sonMesajlar", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("mesajKaydet", kullanici, true).kod).toBe(403);
    expect(cagriYetkisi("updateTraining", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("updateGuardian", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("grupBildirimKaydet", kullanici, true).kod).toBe(403);
    expect(cagriYetkisi("grupBildirimSil", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("updateDocument", kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("updateDocument", kullanici, true).kod).toBe(403);
    expect(cagriYetkisi("haftayiProgramdanDoldur", kullanici, false).ok).toBe(true);
    const r = cagriYetkisi("createPlayer", kullanici, true);
    expect(r.ok).toBe(false);
    expect(r.kod).toBe(403);
    expect(r.mesaj).toMatch(/salt okunur/);
  });
  it("Ayarlar yazmaları (setSetting, aidat kalemleri) yalnız yönetici; yaş grupları ve oyuncu işleri kullanıcıya açık", () => {
    for (const f of ["setSetting", "aidatAyarlariKaydet", "updateFeeItem", "yeniSezonaGec"])
      expect(cagriYetkisi(f, kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("setSetting", admin, false, ["kulup_adi", "x"]).ok).toBe(true); // izinli anahtarla (2. inceleme #1)
    expect(cagriYetkisi("aidatAyarlariKaydet", admin, false).ok).toBe(true);
    for (const f of ["createAgeGroup", "updateAgeGroup", "createReceipt", "cancelReceipt", "updateTraining", "mesajKaydet"])
      expect(cagriYetkisi(f, kullanici, false).ok).toBe(true);
    expect(cagriYetkisi("getSetting", kullanici, true).ok).toBe(true); // okuma serbest (şablon, kulüp adı)
  });
  it("güvenlik incelemesi (08.09.2026): listUsers yönetici; isEncrypted okunur; zorunlu parola değişimi ana süreçte", () => {
    expect(cagriYetkisi("listUsers", kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("listUsers", admin, false).ok).toBe(true);
    expect(cagriYetkisi("isEncrypted", kullanici, true).ok).toBe(true);
    const degistirmeli = { username: "k", role: "kullanici", must_change_password: true };
    const r = cagriYetkisi("listPlayers", degistirmeli, false);
    expect(r.ok).toBe(false);
    expect(r.kod).toBe(403);
    expect(r.mesaj).toMatch(/parolanızı değiştirin/);
    expect(cagriYetkisi("listPlayers", { ...degistirmeli, must_change_password: false }, false).ok).toBe(true);
  });
  it("admin işlemleri yalnız yönetici", () => {
    expect(cagriYetkisi("createUser", kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("createUser", admin, false).ok).toBe(true);
    expect(cagriYetkisi("createUser", admin, true).kod).toBe(403);
  });
  it("beyaz liste dışı fonksiyon (ör. close, init, verifyPassword) 403", () => {
    for (const f of [
      "close",
      "init",
      "verifyPassword",
      "getMetaValue",
      "lisansKaydet",
      "changePassword",
      "kurtarmaIleSifirla",
      "kurtarmaKodlariUret",
    ])
      expect(cagriYetkisi(f, admin, false).kod).toBe(403);
  });
  it("kümeler kesişmez", () => {
    for (const f of YAZMA) expect(OKUMA.has(f) || ADMIN.has(f)).toBe(false);
    for (const f of ADMIN) expect(OKUMA.has(f)).toBe(false);
  });

  it("sezon: okuma herkese, geçiş yalnız yönetici", () => {
    expect(cagriYetkisi("sezonAdayListesi", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("sezonDurumu", kullanici, true).ok).toBe(true);
    expect(cagriYetkisi("yeniSezonaGec", kullanici, false).kod).toBe(403);
    expect(cagriYetkisi("yeniSezonaGec", admin, false).ok).toBe(true);
  });
  it("deleteUser yalnız yönetici", () => {
    expect(cagriYetkisi("deleteUser", admin, false).ok).toBe(true);
    expect(cagriYetkisi("deleteUser", { username: "u", role: "kullanici" }, false).kod).toBe(403);
    expect(cagriYetkisi("deleteUser", admin, true).kod).toBe(403);
  });
  it("güvenlik 2. inceleme #1 (11.09.2026): setSetting yalnız izinli anahtarlar; korumalı ve bilinmeyen anahtar 403", () => {
    const admin = { role: "admin" };
    for (const k of [
      "kulup_adi",
      "tema_ana",
      "aktif_sezon",
      "sezon_baslangic_ayi",
      "kurulum_tamam",
      "wa_sablon_aidat",
      "tahsil_eden",
      "aidat_vade_bekle",
      "kulup_adres",
      "kart_kural_4",
      "kart_qr",
    ])
      expect(cagriYetkisi("setSetting", admin, false, [k, "x"]).ok).toBe(true);
    for (const k of ["yedek_klasoru", "yedek_sikligi", "son_yedek", "kulup_logo", "sunucu_adres", "son_sezon_gecisi"]) {
      const r = cagriYetkisi("setSetting", admin, false, [k, "/tmp"]);
      expect(r.ok).toBe(false);
      expect(r.kod).toBe(403);
      expect(r.mesaj).toMatch(/yalnız ilgili ekrandan/);
    }
    expect(cagriYetkisi("setSetting", admin, false, ["indirim_burslu", "50"]).mesaj).toMatch(/Bilinmeyen ayar/);
    expect(cagriYetkisi("setSetting", admin, false, []).ok).toBe(false); // anahtarsız
    expect(cagriYetkisi("setSetting", { role: "kullanici" }, false, ["kulup_adi", "x"]).kod).toBe(403); // rol önce
  });
});
