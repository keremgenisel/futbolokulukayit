// @ts-check
// Haftalık antrenman programı — SAF mantık. Grup başına program JSON'u: [{ gun: 1..7 (Pzt=1), saat: "17:00", saha: "Saha 1" }].
import { gunKaydir, haftaBasi, haftaGunu } from "./takvim.js";

export const GUN_ADLARI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/** JSON metnini güvenle programa çevirir (bozuksa boş). @param {unknown} metin */
export function programCoz(metin) {
  try {
    const p = typeof metin === "string" ? JSON.parse(metin || "[]") : metin;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x) => x && Number.isInteger(x.gun) && x.gun >= 1 && x.gun <= 7 && /^\d{2}:\d{2}$/.test(String(x.saat || "")))
      .map((x) => ({ gun: x.gun, saat: String(x.saat), saha: String(x.saha || "").trim() }))
      .sort((a, b) => a.gun - b.gun || a.saat.localeCompare(b.saat));
  } catch {
    return [];
  }
}

/** "Pzt 17:00 · Çar 17:00" gibi kısa özet. @param {{gun:number, saat:string}[]} program */
export function programOzeti(program) {
  const kisa = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return program.map((p) => `${kisa[p.gun - 1]} ${p.saat}`).join(" · ");
}

/**
 * Verilen haftada (haftaBasi pazartesi) programdan üretilecek antrenman tarihleri.
 * @param {string} haftaIcindeIso haftanın herhangi bir günü
 * @param {{gun:number, saat:string, saha:string}[]} program
 * @returns {{ tarih: string, saat: string, saha: string }[]}
 */
export function haftaninAntrenmanlari(haftaIcindeIso, program) {
  const bas = haftaBasi(haftaIcindeIso);
  return program.map((p) => ({ tarih: gunKaydir(bas, p.gun - 1), saat: p.saat, saha: p.saha }));
}

/** ISO tarihin program günü (1..7). @param {string} iso */
export const programGunu = (iso) => haftaGunu(iso) + 1;
