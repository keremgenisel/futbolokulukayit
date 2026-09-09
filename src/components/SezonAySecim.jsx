// Raporlar için ortak "Sezon + Ay" süzgeci (plan §19.1): sezon (aktif seçili, kayıtlardaki eski sezonlar) ve sezonun ayları
// başlangıç ayından itibaren sıralı; en üstte "Tümü" (ay = null). Değer: { sezon, ay }.
import { Alan, Secim } from "./ui.jsx";
import { AY_ADLARI } from "../lib/aidat.js";
import { sezonAylari } from "../lib/sezon.js";

export function SezonAySecim({ sezonlar, aktifSezon, baslangicAyi = 9, sezon, ay, onChange, ayTumu = true }) {
  const sezonSecenekleri = [...new Set([sezon, aktifSezon, ...sezonlar].filter(Boolean))].map((s) => ({
    kod: s,
    ad: s === aktifSezon ? `${s} (aktif)` : s,
  }));
  const aySecenekleri = sezonAylari(sezon, baslangicAyi).map((a) => ({ kod: a.ay, ad: `${AY_ADLARI[a.ay - 1]} ${a.yil}` }));
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Alan etiket="Sezon" style={{ width: 150 }}>
        <Secim secenekler={sezonSecenekleri} value={sezon} onChange={(e) => onChange({ sezon: e.target.value, ay })} aria-label="Sezon" />
      </Alan>
      <Alan etiket="Ay" style={{ flex: 1 }}>
        <Secim
          secenekler={aySecenekleri}
          bos={ayTumu ? "Tümü" : undefined}
          value={ay ?? ""}
          onChange={(e) => onChange({ sezon, ay: e.target.value ? Number(e.target.value) : null })}
          aria-label="Ay"
        />
      </Alan>
    </div>
  );
}
