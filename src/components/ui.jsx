// Arayüz ilkelleri. Tüm stil inline; kulüp renkleri ui.css'teki CSS değişkenlerinden.
import React from "react";

export function Btn({ tur = "primary", children, ikon, style, ...rest }) {
  const turler = {
    primary: { background: "var(--mor)", color: "#fff", border: "1px solid var(--mor)" },
    sari: { background: "var(--sari)", color: "var(--mor-koyu)", border: "1px solid var(--sari)" },
    ghost: { background: "#fff", color: "var(--mor-koyu)", border: "1px solid var(--cizgi)" },
    danger: { background: "#fff", color: "var(--kirmizi)", border: "1px solid var(--kirmizi)" },
  };
  return (
    <button {...rest} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", ...turler[tur], ...style }}>
      {ikon}{children}
    </button>
  );
}

export function Rozet({ ton = "gray", children }) {
  const tonlar = {
    green: ["var(--yesil-acik)", "var(--yesil)"], red: ["var(--kirmizi-acik)", "var(--kirmizi)"],
    yellow: ["var(--sari-acik)", "#7A6300"], purple: ["var(--mor-acik)", "var(--mor)"], gray: ["#EEECF2", "var(--soluk)"],
  };
  const [bg, fg] = tonlar[ton] || tonlar.gray;
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

export function Kart({ children, style }) {
  return <div style={{ background: "#fff", border: "1px solid var(--cizgi)", borderRadius: 12, ...style }}>{children}</div>;
}

export function Alan({ etiket, children, style }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{etiket}</span>
      {children}
    </label>
  );
}

export const girisStili = { height: 42, padding: "0 12px", border: "1px solid var(--cizgi)", borderRadius: 8, background: "#fff", fontSize: 15, width: "100%" };
