// @ts-check
// Haftalık antrenman programı — SAF mantık. Grup başına program JSON'u: [{ gun: 1..7 (Pzt=1), saat: "17:00", bitis: "18:30",
// saha: "Saha 1" }] — `bitis` isteğe bağlı (plan §37; eski kayıtlarda yok).
import { gunKaydir, haftaBasi, haftaGunu } from "./takvim.js";

export const GUN_ADLARI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/** JSON metnini güvenle programa çevirir (bozuksa boş). @param {unknown} metin */
export function programCoz(metin) {
  try {
    const p = typeof metin === "string" ? JSON.parse(metin || "[]") : metin;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x) => x && Number.isInteger(x.gun) && x.gun >= 1 && x.gun <= 7 && /^\d{2}:\d{2}$/.test(String(x.saat || "")))
      .map((x) => ({
        gun: x.gun,
        saat: String(x.saat),
        // bitiş yalnız biçimi doğru ve başlangıçtan sonraysa alınır; aksi hâlde boş (plan §37)
        bitis: saatAraligiDogrula(String(x.saat), String(x.bitis || "")).gecerli ? String(x.bitis || "") : "",
        saha: String(x.saha || "").trim(),
      }))
      .sort((a, b) => a.gun - b.gun || a.saat.localeCompare(b.saat));
  } catch {
    return [];
  }
}

/** "Pzt 17:00–18:30 · Çar 17:00" gibi kısa özet. @param {{gun:number, saat:string, bitis?:string}[]} program */
export function programOzeti(program) {
  const kisa = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return program.map((p) => `${kisa[p.gun - 1]} ${saatAraligi(p.saat, p.bitis)}`).join(" · ");
}

/** "17:00–18:30"; bitiş yoksa "17:00"; saat yoksa "". @param {string} saat @param {string} [bitis] */
export function saatAraligi(saat, bitis = "") {
  if (!saat) return "";
  return bitis ? `${saat}–${bitis}` : saat;
}
/** "HH:MM" → günün dakikası; biçim bozuksa null. @param {string} s */
export function saatDk(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const h = Number(m[1]),
    d = Number(m[2]);
  return h > 23 || d > 59 ? null : h * 60 + d;
}
/** Saate dakika ekler ("17:00" + 90 → "18:30"); gün sınırında 23:59'da durur. @param {string} saat @param {number} dk */
export function saatEkle(saat, dk) {
  const b = saatDk(saat);
  if (b === null) return "";
  const t = Math.max(0, Math.min(23 * 60 + 59, b + Number(dk || 0)));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Süre (dk); biri yoksa ya da bitiş önce ise null. @param {string} bas @param {string} bit */
export function sureDk(bas, bit) {
  const a = saatDk(bas),
    b = saatDk(bit);
  return a === null || b === null || b <= a ? null : b - a;
}
/**
 * Başlangıç–bitiş doğrulaması: bitiş boşsa geçerli (zorunlu değil); doluysa biçim + başlangıçtan sonra + aynı gün.
 * @param {string} bas @param {string} bit @returns {{ gecerli: boolean, neden?: string }}
 */
export function saatAraligiDogrula(bas, bit) {
  if (!bit) return { gecerli: true };
  if (saatDk(bit) === null) return { gecerli: false, neden: "Bitiş saati SS:DD biçiminde olmalı" };
  if (saatDk(bas) === null) return { gecerli: false, neden: "Önce başlangıç saatini girin" };
  if (sureDk(bas, bit) === null) return { gecerli: false, neden: "Bitiş başlangıçtan sonra olmalı" };
  return { gecerli: true };
}
export const VARSAYILAN_SURE_DK = 90;
/**
 * İki antrenman aralığı kesişir mi? Bitişi olmayan antrenman varsayılan süreyle (90 dk) sayılır.
 * @param {{ saat: string, bitis?: string }} a @param {{ saat: string, bitis?: string }} b
 */
export function aralikKesisir(a, b, varsayilanDk = VARSAYILAN_SURE_DK) {
  const ab = saatDk(a.saat),
    bb = saatDk(b.saat);
  if (ab === null || bb === null) return false;
  const ae = saatDk(a.bitis || "") ?? ab + varsayilanDk;
  const be = saatDk(b.bitis || "") ?? bb + varsayilanDk;
  return ab < be && bb < ae;
}

/**
 * Verilen haftada (haftaBasi pazartesi) programdan üretilecek antrenman tarihleri.
 * @param {string} haftaIcindeIso haftanın herhangi bir günü
 * @param {{gun:number, saat:string, bitis?:string, saha:string}[]} program
 * @returns {{ tarih: string, saat: string, bitis: string, saha: string }[]}
 */
export function haftaninAntrenmanlari(haftaIcindeIso, program) {
  const bas = haftaBasi(haftaIcindeIso);
  return program.map((p) => ({ tarih: gunKaydir(bas, p.gun - 1), saat: p.saat, bitis: p.bitis || "", saha: p.saha }));
}

/** ISO tarihin program günü (1..7). @param {string} iso */
export const programGunu = (iso) => haftaGunu(iso) + 1;
