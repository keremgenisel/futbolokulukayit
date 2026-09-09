// Sezon seçim kutusu (plan §15): serbest metin yerine aktif sezon / sonraki sezon (+ eski kayıt değeri). Yaş Grupları ve İlk Kurulum.
import { Secim } from "./ui.jsx";
import { sezonSecenekleri } from "../lib/sezon.js";
import { bugun } from "../lib/api.js";

/** durum: db("sezonDurumu") sonucu ({ aktifSezon, baslangicAyi }) ya da null; value mevcut değer (eskiyse üçüncü seçenek olur). */
export function SezonSecim({ durum, value, onChange, ...props }) {
  const secenekler = sezonSecenekleri({
    aktifSezon: durum?.aktifSezon || "",
    bugunIso: bugun().iso,
    baslangicAyi: durum?.baslangicAyi || 9,
    mevcut: value || "",
  });
  return <Secim secenekler={secenekler} value={value || secenekler[0].kod} onChange={(e) => onChange(e.target.value)} {...props} />;
}
