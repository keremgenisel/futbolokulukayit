import React, { useEffect, useState } from "react";
import { Giris } from "./components/Giris.jsx";
import { Kart } from "./components/ui.jsx";

// Yönlendirici yok: sekme bir string, TABS'a göre koşullu render.
export const TABS = [
  { kod: "pano", ad: "Pano" }, { kod: "oyuncular", ad: "Oyuncular" }, { kod: "gruplar", ad: "Yaş Grupları" },
  { kod: "tahsilat", ad: "Tahsilat" }, { kod: "yoklama", ad: "Yoklama" }, { kod: "raporlar", ad: "Raporlar" }, { kod: "ayarlar", ad: "Ayarlar" },
];

export function App() {
  const [oturum, setOturum] = useState(null);
  const [hazir, setHazir] = useState(false);
  const [tab, setTab] = useState("pano");

  useEffect(() => {
    window.okul?.auth.session().then((s) => { setOturum(s); setHazir(true); }).catch(() => setHazir(true));
  }, []);

  if (!hazir) return null;
  if (!oturum) return <Giris onGiris={setOturum} />;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <aside style={{ width: 232, background: "var(--mor)", display: "flex", flexDirection: "column", padding: "20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px 22px", borderBottom: "1px solid rgba(255,255,255,.15)", marginBottom: 16 }}>
          <img src="./logo.png" alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="baslik" style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: ".04em", lineHeight: 1 }}>EYÜPSPOR</span>
            <span style={{ color: "var(--sari)", fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Futbol Okulu</span>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.kod} onClick={() => setTab(t.kod)} style={{
              textAlign: "left", padding: "11px 14px", borderRadius: 8, fontSize: 15, cursor: "pointer",
              background: tab === t.kod ? "rgba(255,255,255,.14)" : "transparent",
              color: tab === t.kod ? "#fff" : "#D8CCE9", fontWeight: tab === t.kod ? 600 : 400,
              border: 0, borderLeft: `3px solid ${tab === t.kod ? "var(--sari)" : "transparent"}`,
            }}>{t.ad}</button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", padding: "12px 10px", color: "#D8CCE9", fontSize: 14 }}>
          <div style={{ color: "#fff", fontWeight: 600 }}>{oturum.ad_soyad || oturum.username}</div>
          <button onClick={async () => { await window.okul.auth.logout(); setOturum(null); }} style={{ background: "none", border: 0, color: "#D8CCE9", padding: 0, cursor: "pointer", fontSize: 12 }}>Çıkış</button>
        </div>
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "22px 32px 16px", borderBottom: "1px solid var(--cizgi)", background: "#fff" }}>
          <h1 style={{ fontSize: 30 }}>{TABS.find((t) => t.kod === tab)?.ad}</h1>
        </header>
        <section style={{ padding: 24, flex: 1, overflow: "auto" }}>
          <Kart style={{ padding: 24, color: "var(--soluk)" }}>Bu ekran Faz 1 kapsamında geliştirilecek. Tasarım: design/ tuvali.</Kart>
        </section>
      </main>
    </div>
  );
}
