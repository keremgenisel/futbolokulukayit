import { useEffect, useRef, useState } from "react";
import { Avatar, Rozet, aidatTonu, aidatEtiket, Bos } from "./ui.jsx";
import { db, bugun } from "../lib/api.js";
import { kimlikKisa } from "../lib/aidat.js";
import { Ikon } from "./Ikon.jsx";

// Her yerden oyuncu arama (Ctrl/Cmd+K): ad, TC ya da pasaport yaz → ↑↓ seç, Enter kartı açar, Esc kapatır.
// Sağdaki "Makbuz" düğmesi doğrudan tahsilata götürür.
export function HizliArama({ acik, onKapat, onOyuncu, onMakbuz, saltOkunur }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [secili, setSecili] = useState(0);
  const girdi = useRef(null);
  const { yil, ay } = bugun();

  useEffect(() => {
    if (acik) {
      setQ("");
      setSonuc([]);
      setSecili(0);
      setTimeout(() => girdi.current?.focus(), 0);
    }
  }, [acik]);
  useEffect(() => {
    if (!acik) return;
    if (!q.trim()) {
      setSonuc([]);
      return;
    }
    const t = setTimeout(
      () =>
        db("listPlayersWithDue", { q: q.trim(), yil, ay })
          .then((l) => {
            setSonuc(l.slice(0, 8));
            setSecili(0);
          })
          .catch(() => {}),
      120,
    );
    return () => clearTimeout(t);
  }, [q, acik, yil, ay]);

  if (!acik) return null;
  const sec = (o) => {
    onKapat();
    onOyuncu(o.id);
  };
  const klavye = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onKapat();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSecili((i) => Math.min(sonuc.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSecili((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && sonuc[secili]) {
      e.preventDefault();
      sec(sonuc[secili]);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hızlı arama"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKapat();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(27,21,48,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: "92vw",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 30px 80px rgba(27,21,48,.35)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--cizgi)" }}>
          <span style={{ color: "var(--soluk)" }}>
            <Ikon ad="ara" boyut={22} />
          </span>
          <input
            ref={girdi}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={klavye}
            placeholder="Oyuncu adı, TC veya pasaport no…"
            aria-label="Oyuncu ara"
            style={{ flex: 1, border: 0, outline: "none", fontSize: 18, background: "transparent" }}
          />
          <span style={{ fontSize: 12, color: "var(--soluk)", border: "1px solid var(--cizgi)", borderRadius: 6, padding: "2px 6px" }}>
            Esc
          </span>
        </div>
        {q.trim() && sonuc.length === 0 && (
          <div style={{ padding: "8px 18px" }}>
            <Bos kucuk metin="Oyuncu bulunamadı." />
          </div>
        )}
        {sonuc.map((o, i) => (
          <div
            key={o.id}
            role="option"
            aria-selected={i === secili}
            onMouseEnter={() => setSecili(i)}
            onClick={() => sec(o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              cursor: "pointer",
              background: i === secili ? "var(--mor-acik)" : "#fff",
              borderBottom: "1px solid var(--cizgi)",
            }}
          >
            <Avatar ad={o.ad_soyad} boyut={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {o.ad_soyad}{" "}
                <span style={{ fontWeight: 400, color: "var(--soluk)", fontSize: 13 }}>{o.yas_grubu_ad ? "· " + o.yas_grubu_ad : ""}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--soluk)" }}>
                {kimlikKisa(o)}
                {o.durum !== "aktif" ? ` · ${o.durum}` : ""}
              </div>
            </div>
            <Rozet ton={aidatTonu(o.aidat_durum)}>{aidatEtiket(o.aidat_durum)}</Rozet>
            {!saltOkunur && onMakbuz && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onKapat();
                  onMakbuz(o.id);
                }}
                aria-label={`${o.ad_soyad} makbuz`}
                style={{
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid var(--cizgi)",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--mor-koyu)",
                }}
              >
                Makbuz
              </button>
            )}
          </div>
        ))}
        <div style={{ padding: "8px 18px", fontSize: 12, color: "var(--soluk)", display: "flex", gap: 14 }}>
          <span>↑↓ seç</span>
          <span>Enter kartı aç</span>
          <span>Ctrl+K her yerden</span>
        </div>
      </div>
    </div>
  );
}
