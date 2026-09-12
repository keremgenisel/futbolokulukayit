// @ts-check
// Giriş kartı basım penceresi (plan §40.7) — SAF seçim/sayaç yardımcıları. Pencere: Oyuncular › Kartları Yazdır.
import { TOPLU_SAYFA_KART } from "./kartHtml.js";
import { tarihTR } from "./aidat.js";

export const KART_SINIR = 200; // tek basımda en çok oyuncu (HTML şişmesin)
export const KART_SUZGECLERI = [
  { kod: "basilmamis", ad: "Basılmamış" },
  { kod: "basilmis", ad: "Basılmış" },
  { kod: "tumu", ad: "Tümü" },
];

/** Toplu basımda sayfa sayısı (ön + arka). @param {number} n */
export const sayfaSayisi = (n) => (n > 0 ? Math.ceil(n / TOPLU_SAYFA_KART) * 2 : 0);

/** Seçim kümesinde bir id'yi aç/kapa (yeni Set döner). @param {Set<number>} set @param {number} id */
export function secimDegistir(set, id) {
  const s = new Set(set);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return s;
}

/** Listedeki id'lerin tümünü ekle ya da çıkar (başlıktaki kutu). @param {Set<number>} set @param {number[]} ids @param {boolean} sec */
export function tumunuSec(set, ids, sec) {
  const s = new Set(set);
  for (const id of ids)
    if (sec) s.add(id);
    else s.delete(id);
  return s;
}

/** Başlık kutusunun durumu: "hepsi" | "kismi" | "hic". @param {Set<number>} set @param {number[]} ids */
export function bastakiKutu(set, ids) {
  if (!ids.length) return "hic";
  const n = ids.filter((id) => set.has(id)).length;
  return n === 0 ? "hic" : n === ids.length ? "hepsi" : "kismi";
}

/** Seçili olup şu anki listede görünmeyenler (süzgeç değişti). @param {Set<number>} set @param {number[]} ids */
export const listedeOlmayan = (set, ids) => [...set].filter((id) => !ids.includes(id));

/** Satırın "Son basım" etiketi. @param {{ basim_sayisi?: number, son_basim?: string|null }} o */
export function basimEtiketi(o) {
  const n = Number(o?.basim_sayisi) || 0;
  if (!n) return { metin: "Basılmadı", ton: "gray" };
  const t = tarihTR(String(o?.son_basim || "").slice(0, 10));
  return n === 1 ? { metin: t, ton: "green" } : { metin: `${n}. basım · ${t}`, ton: "yellow" };
}

/** Seçilenlerden daha önce basılmış olanlar (alt şeritteki sarı not). @param {Set<number>} set @param {Map<number, any>} bilinen */
export function basilmisSecilenler(set, bilinen) {
  return [...set].map((id) => bilinen.get(id)).filter((o) => o && Number(o.basim_sayisi) > 0);
}

/** Sarı not metni: "3'ü daha önce basılmış (Ali Y., Ayşe K., …)". @param {any[]} liste */
export function basilmisNotu(liste) {
  if (!liste.length) return "";
  const adlar = liste.slice(0, 3).map((o) => kisaAd(o.ad_soyad));
  const kalan = liste.length > 3 ? ` +${liste.length - 3}` : "";
  return `${liste.length}'${liste.length === 1 ? "i" : "ü"} daha önce basılmış (${adlar.join(", ")}${kalan})`;
}
/** "Kerem Yılmaz" → "Kerem Y." @param {string} ad */
export const kisaAd = (ad) => {
  const p = String(ad || "")
    .trim()
    .split(/\s+/);
  return p.length > 1 ? `${p.slice(0, -1).join(" ")} ${p[p.length - 1][0]}.` : p[0] || "";
};
