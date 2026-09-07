// Ücret tipleri artık veritabanında (fee_types). Bu modül listeyi bir kez çeker, bileşenler arasında paylaşır;
// Ayarlar'da kaydettikten sonra `ucretTipleriYenile()` çağrılır. Liste gelene kadar varsayılan tipler görünür.
import { useEffect, useState } from "react";
import { UCRET_TIPLERI } from "./aidat.js";

let onbellek = null;          // son bilinen liste
let bekleyen = null;          // sürmekte olan istek
const dinleyenler = new Set();

async function getir() {
  if (onbellek) return onbellek;
  if (!bekleyen) {
    bekleyen = (async () => {
      try { const l = await window.okul?.db("listFeeTypes"); if (Array.isArray(l) && l.length) onbellek = l; } catch { /* varsayılan kalır */ }
      bekleyen = null;
      return onbellek;
    })();
  }
  return bekleyen;
}

export function ucretTipleriYenile() { onbellek = null; getir().then(() => dinleyenler.forEach((f) => f(onbellek))); }

/** @returns {{ tipler: {kod:string, ad:string, indirim:number, aktif:number, sabit:number}[], ad: (kod: string) => string }} */
export function useUcretTipleri() {
  const [tipler, setTipler] = useState(onbellek || UCRET_TIPLERI);
  useEffect(() => {
    const f = (l) => { if (l) setTipler(l); };
    dinleyenler.add(f);
    getir().then(f);
    return () => { dinleyenler.delete(f); };
  }, []);
  return { tipler, ad: (kod) => tipler.find((t) => t.kod === kod)?.ad || kod || "" };
}
