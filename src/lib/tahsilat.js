// @ts-check
// Tahsilat ekranının SAF hesapları (refactor 2. tur §8.2, 11.09.2026): Tahsilat.jsx'ten çıkarıldı, davranış aynı.
// ay anahtarı "yil-ay" → tek makbuzda birden fazla ay (plan §11), dönem seçenekleri (plan §24 kuralları), makbuz satırları.
import { aidatKalan, gelecekAcikAidatMi, AY_ADLARI } from "./aidat.js";

/** @param {number} y @param {number} a */
export const ayAnahtar = (y, a) => `${y}-${a}`;
/** @param {string} k */
export const ayCoz = (k) => {
  const [y, a] = k.split("-").map(Number);
  return { yil: y, ay: a };
};
/** @param {{ durum: string }} a */
const acik = (a) => a.durum === "odenmedi" || a.durum === "kismi";

/**
 * Bugünden ileriye (12 ay) ilk ödenmemiş/muaf olmayan ay; hepsi ödenmişse null. dues: listDues çıktısı.
 * @param {any[]} dues @param {number} yil @param {number} ay
 */
export function ilkOdenmemisAy(dues, yil, ay) {
  for (let i = 0; i < 12; i++) {
    const t = yil * 12 + (ay - 1) + i;
    const d = { yil: Math.floor(t / 12), ay: (t % 12) + 1 };
    const due = dues.find((x) => x.yil === d.yil && x.ay === d.ay);
    if (!due || due.durum === "odenmedi" || due.durum === "kismi") return d;
  }
  return null;
}

/**
 * Oyuncu seçilince başlangıç ay seçimi: en eski borç (kalanıyla), yoksa ileriye ilk ödenmemiş ay (tam aidat); muaf/0 aidat → boş.
 * @param {any} oyuncu @param {any[]} dues @param {number} yil @param {number} ay
 * @returns {Record<string, string>}
 */
export function baslangicAySecimi(oyuncu, dues, yil, ay) {
  const ilkBorc = [...dues].reverse().find(acik); // en eski borç önce
  // Borç yoksa: bugünden ileriye ilk ÖDENMEMİŞ ay (bu ay peşin ödenmişse bir sonraki; 12 ay ileriye kadar bakılır) —
  // ödenmiş ay seçili gelmesin (Kerem, 10.09.2026).
  const secim = ilkBorc ? { yil: ilkBorc.yil, ay: ilkBorc.ay } : ilkOdenmemisAy(dues, yil, ay);
  const muaf = oyuncu.ucret_tipi === "ucretsiz" || !(oyuncu.aylik_aidat > 0);
  return muaf || !secim ? {} : { [ayAnahtar(secim.yil, secim.ay)]: String(ilkBorc ? aidatKalan(ilkBorc) : oyuncu.aylik_aidat) };
}

/**
 * Aidat dönemi pilleri. Borç = vadesi gelmiş (bu ay ve öncesi) ödenmemiş/kısmi aylar. İleri tarihli "odenmedi" satırları (iptal edilen
 * uzun dönem makbuzunun açtığı ya da peşin ödeme için oluşturulan aylar) borç DEĞİL: kırmızı listelenmez, "gelecek" kümesinde sade
 * seçenek olur (Kerem, 10.09.2026). Bugünden ileriye 3 seçilebilir ay: ödenmiş/muaf aylar atlanır, 12 ay ileriye kadar. Uzun Dönem ile
 * seçilmiş ama pencereye girmeyen aylar da pil olarak görünür (görüp kaldırabilmek için).
 * @param {any[]} aidatlar @param {Record<string, string>} aidatAylar @param {number} yil @param {number} ay
 * @returns {{ yil: number, ay: number, borc: boolean, kismi: boolean, kalan: number | null }[]}
 */
export function donemSecenekleri(aidatlar, aidatAylar, yil, ay) {
  const borclar = aidatlar
    .filter((a) => acik(a) && !gelecekAcikAidatMi(a, yil, ay))
    .map((a) => ({ yil: a.yil, ay: a.ay, borc: true, kismi: a.durum === "kismi", kalan: aidatKalan(a) }))
    .sort((a, b) => a.yil - b.yil || a.ay - b.ay);
  /** @type {{ yil: number, ay: number, borc: boolean, kismi: boolean, kalan: number | null }[]} */
  const gelecek = [];
  let y = yil,
    m = ay;
  for (let i = 0; i < 12 && gelecek.length < 3; i++) {
    const due = aidatlar.find((a) => a.yil === y && a.ay === m);
    if ((!due || acik(due)) && !borclar.some((b) => b.yil === y && b.ay === m))
      gelecek.push({ yil: y, ay: m, borc: false, kismi: due?.durum === "kismi", kalan: due ? aidatKalan(due) : null });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const ekstra = Object.keys(aidatAylar)
    .map(ayCoz)
    .filter((d) => !borclar.some((b) => b.yil === d.yil && b.ay === d.ay) && !gelecek.some((g) => g.yil === d.yil && g.ay === d.ay))
    .map((d) => {
      const due = aidatlar.find((a) => a.yil === d.yil && a.ay === d.ay);
      return { ...d, borc: false, kismi: due?.durum === "kismi", kalan: due ? aidatKalan(due) : null };
    });
  return [...borclar, ...[...gelecek, ...ekstra].sort((a, b) => a.yil - b.yil || a.ay - b.ay)];
}

/** Seçili ayların sıralı listesi. @param {Record<string, string>} aidatAylar */
export const seciliAylar = (aidatAylar) =>
  Object.keys(aidatAylar)
    .map(ayCoz)
    .sort((a, b) => a.yil - b.yil || a.ay - b.ay);

/** @param {Record<string, string>} aidatAylar @param {Record<string, string>} secili */
export function toplamlar(aidatAylar, secili) {
  const aidat = Object.values(aidatAylar).reduce((s, v) => s + (Number(v) || 0), 0);
  return { aidat, toplam: Object.values(secili).reduce((s, v) => s + (Number(v) || 0), 0) + aidat };
}

/**
 * Makbuz satırları: aidat ayları (kalem = aidat kalemi, ay sırasıyla) + diğer kalemler; 0/boş tutarlar atlanır.
 * @param {Record<string, string>} aidatAylar @param {Record<string, string>} secili @param {any[]} kalemler @param {any} aidatKalem
 */
export function makbuzSatirlari(aidatAylar, secili, kalemler, aidatKalem) {
  const aidatSatirlari = aidatKalem
    ? Object.entries(aidatAylar)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => {
          const d = ayCoz(k);
          return { fee_item_id: aidatKalem.id, tutar: Number(v), aciklama: `${AY_ADLARI[d.ay - 1]} ${d.yil}`, yil: d.yil, ay: d.ay };
        })
        .sort((a, b) => a.yil - b.yil || a.ay - b.ay)
    : [];
  const digerSatirlar = Object.entries(secili)
    .filter(([, v]) => Number(v) > 0)
    .map(([id, v]) => {
      const k = kalemler.find((x) => x.id === Number(id));
      return { fee_item_id: Number(id), tutar: Number(v), aciklama: k?.ad || "", yil: null, ay: null };
    });
  return [...aidatSatirlari, ...digerSatirlar];
}

/**
 * Uzun Dönem uygulaması: aralıktaki aylardan kalanı > 0 olanlar seçilir (ödenmiş/muaf/0 kalan atlanır; Kerem 10.09.2026).
 * @param {{ yil: number, ay: number }[]} aylar @param {any[]} dues @param {number} aylikAidat
 * @returns {Record<string, string>}
 */
export function uzunDonemSecimi(aylar, dues, aylikAidat) {
  /** @type {Record<string, string>} */
  const n = {};
  for (const { yil: y, ay: a } of aylar) {
    const due = dues.find((x) => x.yil === y && x.ay === a);
    const kalan = due ? aidatKalan(due) : Number(aylikAidat) || 0;
    if (kalan > 0) n[ayAnahtar(y, a)] = String(kalan);
  }
  return n;
}
