import { useState } from "react";
import { Ikon } from "./Ikon.jsx";
import { VARSAYILAN_KULUP } from "../lib/marka.js";

// Kenar menü: sola doğru daraltılır (yalnız ikonlar), sağa doğru genişletilir — GenCRM'deki gibi.
// Tercih bu bilgisayara özel (localStorage); sunucuya gitmez.
const MENU_DAR = "menuDar";
function menuDarOku() {
  try {
    return localStorage.getItem(MENU_DAR) === "1";
  } catch {
    return false;
  }
}
function menuDarYaz(dar) {
  try {
    localStorage.setItem(MENU_DAR, dar ? "1" : "0");
  } catch {
    /* özel pencere vb. */
  }
}

export function KenarMenu({ sekmeler, tab, onSec, oturum, mod, onCikis, onAra, marka }) {
  const kisaAd = (marka?.kisaAd || VARSAYILAN_KULUP).toLocaleUpperCase("tr-TR");
  const altYazi = marka?.altYazi || "Kayıt Programı";
  const [dar, setDar] = useState(menuDarOku);
  const degistir = () =>
    setDar((v) => {
      menuDarYaz(!v);
      return !v;
    });
  const genislik = dar ? 68 : 232;
  const acKapaDugme = (
    <button
      type="button"
      onClick={degistir}
      title={dar ? "Menüyü genişlet" : "Menüyü daralt"}
      aria-label={dar ? "Menüyü genişlet" : "Menüyü daralt"}
      aria-expanded={!dar}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,.25)",
        background: "rgba(255,255,255,.1)",
        color: "var(--ana-ustu, #fff)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Ikon ad={dar ? "sag" : "sol"} boyut={16} />
    </button>
  );

  return (
    <aside
      data-dar={dar ? "1" : "0"}
      style={{
        width: genislik,
        flexShrink: 0,
        background: "var(--mor)",
        display: "flex",
        flexDirection: "column",
        padding: dar ? "20px 10px" : "20px 14px",
        transition: "width .22s ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: dar ? "center" : "flex-start",
          gap: 12,
          padding: dar ? "4px 0 18px" : "4px 8px 22px",
          borderBottom: "1px solid rgba(255,255,255,.15)",
          marginBottom: 16,
        }}
      >
        <img
          src={marka?.logo || "./logo.png"}
          alt=""
          data-kulup-logo={marka?.logo ? "1" : "0"}
          style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0, borderRadius: marka?.logo ? 0 : 10 }}
        />
        {!dar && (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              className="baslik"
              title={kisaAd}
              style={{
                color: "var(--ana-ustu, #fff)",
                fontSize: kisaAd.length > 12 ? 16 : 20,
                fontWeight: 700,
                letterSpacing: ".04em",
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {kisaAd}
            </span>
            <span style={{ color: "var(--sari)", fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>
              {altYazi}
            </span>
          </div>
        )}
      </div>
      {onAra && (
        <button
          type="button"
          onClick={onAra}
          aria-label="Oyuncu ara (Ctrl+K)"
          title="Her yerden oyuncu ara (Ctrl+K)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: dar ? "center" : "flex-start",
            gap: 10,
            height: 40,
            marginBottom: 10,
            padding: dar ? 0 : "0 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.25)",
            background: "rgba(255,255,255,.12)",
            color: "var(--ana-ustu, #fff)",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <Ikon ad="ara" boyut={18} />
          {!dar && (
            <>
              <span style={{ flex: 1, textAlign: "left", color: "var(--ana-ustu-soluk, #d8cce9)" }}>Oyuncu ara…</span>
              <span
                style={{
                  fontSize: 11,
                  border: "1px solid rgba(255,255,255,.3)",
                  borderRadius: 6,
                  padding: "1px 6px",
                  color: "var(--ana-ustu-soluk, #d8cce9)",
                }}
              >
                Ctrl K
              </span>
            </>
          )}
        </button>
      )}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sekmeler.map((t) => (
          <button
            key={t.kod}
            type="button"
            onClick={() => onSec(t.kod)}
            title={dar ? t.ad : undefined}
            aria-label={t.ad}
            style={{
              textAlign: "left",
              padding: dar ? "11px 0" : "11px 14px",
              borderRadius: 8,
              fontSize: 15,
              cursor: "pointer",
              background: tab === t.kod ? "rgba(255,255,255,.14)" : "transparent",
              color: tab === t.kod ? "var(--ana-ustu, #fff)" : "var(--ana-ustu-soluk, #d8cce9)",
              fontWeight: tab === t.kod ? 600 : 400,
              border: 0,
              borderLeft: `3px solid ${tab === t.kod ? "var(--sari)" : "transparent"}`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: dar ? "center" : "flex-start", gap: 12 }}>
              <Ikon ad={t.kod} />
              {!dar && <span>{t.ad}</span>}
            </span>
          </button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      {dar ? (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,.15)",
            padding: "12px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {acKapaDugme}
          <button
            type="button"
            onClick={onCikis}
            title="Çıkış"
            aria-label="Çıkış"
            style={{ background: "none", border: 0, color: "var(--ana-ustu-soluk, #d8cce9)", padding: 4, cursor: "pointer" }}
          >
            <Ikon ad="cikis" boyut={16} />
          </button>
        </div>
      ) : (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,.15)",
            padding: "12px 10px",
            color: "var(--ana-ustu-soluk, #d8cce9)",
            fontSize: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "var(--ana-ustu, #fff)",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {oturum.ad_soyad || oturum.username}
            </div>
            <div style={{ fontSize: 12 }}>{oturum.role === "admin" ? "Yönetici" : "Kullanıcı"}</div>
            {mod?.mode === "istemci" && <div style={{ fontSize: 11, color: "var(--sari)", marginTop: 4 }}>Sunucuya bağlı</div>}
            {mod?.mode === "sunucu" && (
              <div style={{ fontSize: 11, color: mod.sunucu?.calisiyor ? "var(--sari)" : "#f99", marginTop: 4 }}>
                Sunucu {mod.sunucu?.calisiyor ? "açık · " + mod.sunucu.port : "kapalı"}
              </div>
            )}
            <button
              type="button"
              onClick={onCikis}
              style={{
                background: "none",
                border: 0,
                color: "var(--ana-ustu-soluk, #d8cce9)",
                padding: 0,
                cursor: "pointer",
                fontSize: 12,
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ikon ad="cikis" boyut={14} />
              Çıkış
            </button>
          </div>
          {acKapaDugme}
        </div>
      )}
    </aside>
  );
}
