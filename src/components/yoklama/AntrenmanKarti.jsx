import { Rozet } from "../ui.jsx";
import { saatAraligi, sureDk } from "../../lib/program.js";

/**
 * Gün kartı: "U11 · 17:00–18:30", saha + süre, bildirim durumu, x/y işaretli (refactor 2. tur §8.1 — Yoklama.jsx'ten ayrıldı).
 * @param {{ t: any, on: boolean, onSec: (t: any) => void }} p
 */
export function AntrenmanKarti({ t, on, onSec }) {
  return (
    <button
      type="button"
      onClick={() => onSec(t)}
      aria-pressed={on}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 200,
        padding: "12px 14px",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        border: `1px solid ${on ? "var(--mor)" : "var(--cizgi)"}`,
        background: on ? "var(--mor-acik)" : "#fff",
        opacity: t.iptal ? 0.7 : 1,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="baslik" style={{ fontSize: 20, fontWeight: 700, color: "var(--mor-koyu)" }}>
          {t.yas_grubu_ad} · {saatAraligi(t.saat || "", t.bitis_saat || "") || "—"}
        </span>
        {t.iptal ? <Rozet ton="red">İptal</Rozet> : null}
      </span>
      <span style={{ fontSize: 13, color: "var(--soluk)" }}>
        {t.saha || "Saha belirtilmedi"}
        {sureDk(t.saat, t.bitis_saat) ? ` · ${sureDk(t.saat, t.bitis_saat)} dk` : ""}
      </span>
      {t.bildirim_gerekli ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: t.bildirilen > 0 ? "var(--mor)" : "var(--kirmizi)" }}>
          {t.bildirilen > 0 ? `${t.bildirilen}/${t.oyuncu} veli bildirildi` : "Velilere bildirilmedi"}
        </span>
      ) : t.grup_bildirim ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yesil)" }}>Veli grubuna bildirildi</span>
      ) : null}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: t.oyuncu > 0 && t.isaretli >= t.oyuncu ? "var(--yesil)" : "var(--soluk)",
        }}
      >
        {t.isaretli}/{t.oyuncu} işaretli
      </span>
    </button>
  );
}
