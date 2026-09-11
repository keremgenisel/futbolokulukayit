// Sezon durumu için TEK kanca (refactor 2. tur §8.3, 11.09.2026). Daha önce 8 bileşen aynı `db("sezonDurumu")` çağrısını kendi
// useState/useEffect'iyle yapıyordu. Bileşen başına bir istek atılır (paylaşılan önbellek YOK: sezon geçişinden sonra her ekran
// kendi yüklemesini yapar); `yenile()` sonucu döndürür (Ayarlar > Sezon işlemden sonra tazeler).
import { useCallback, useEffect, useState } from "react";
import { db } from "./api.js";

/**
 * @returns {{ durum: any, aktifSezon: string, baslangicAyi: number, tarihler: { baslangic: string, bitis: string, kayitli?: boolean } | null,
 *   yenile: () => Promise<any> }}
 */
export function useSezonDurumu() {
  const [durum, setDurum] = useState(null);
  const yenile = useCallback(async () => {
    try {
      const d = await db("sezonDurumu");
      if (d) setDurum(d);
      return d || null;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    yenile();
  }, [yenile]);
  const t = durum?.tarihler;
  const tarihler = t?.baslangic && t?.bitis ? t : null; // plan §37: tarihler yoksa hiçbir gün sezon dışı sayılmaz
  return { durum, aktifSezon: durum?.aktifSezon || "", baslangicAyi: durum?.baslangicAyi || 9, tarihler, yenile };
}
