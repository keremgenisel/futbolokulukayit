import { Ikon } from "../Ikon.jsx";
import { paraTR, AY_ADLARI } from "../../lib/aidat.js";
import { ayAnahtar } from "../../lib/tahsilat.js";

/** Aidat dönemi pilleri (borçlu kırmızı, gelecek sade) + "Uzun Dönem Seç" (plan §11/§24; refactor 2. tur §8.2). */
export function AidatAySecimi({ secenekler, aidatAylar, onToggle, onUzunDonem, saltOkunur }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--soluk)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".05em",
          }}
        >
          Aidat dönemi{" "}
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            · birden fazla ay seçilebilir, tek makbuz kesilir
          </span>
        </div>
        {!saltOkunur && (
          <button
            type="button"
            onClick={onUzunDonem}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              padding: "4px 6px",
              cursor: "pointer",
              color: "var(--mor)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Ikon ad="takvim" boyut={16} />
            <span>Uzun Dönem Seç</span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {secenekler.map((d) => {
          const aktif = aidatAylar[ayAnahtar(d.yil, d.ay)] !== undefined;
          return (
            <button
              key={`${d.yil}-${d.ay}`}
              type="button"
              onClick={() => onToggle(d)}
              aria-pressed={aktif}
              aria-label={`${AY_ADLARI[d.ay - 1]} ${d.yil}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                border: `1px solid ${aktif ? (d.borc ? "var(--kirmizi)" : "var(--mor)") : "var(--cizgi)"}`,
                background: aktif ? (d.borc ? "var(--kirmizi-acik)" : "var(--mor-acik)") : "#fff",
                color: aktif ? (d.borc ? "var(--kirmizi)" : "var(--mor)") : "var(--soluk)",
              }}
            >
              {d.borc ? <Ikon ad="uyari" boyut={16} /> : null}
              {AY_ADLARI[d.ay - 1]} {d.yil}
              {d.kismi ? ` · kalan ${paraTR(d.kalan)}` : d.borc ? " · ödenmedi" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
