import { Btn, Girdi, Avatar, Rozet } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { paraTR, tarihTR, gorunenAidatDurumu } from "../../lib/aidat.js";

/** Seçili oyuncu kartı ya da arama kutusu + sonuç listesi (refactor 2. tur §8.2). */
export function OyuncuSecici({ oyuncu, q, onQ, sonuc, onSec, onDegistir, onKart }) {
  if (oyuncu)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 14,
          borderRadius: 10,
          border: "1px solid var(--mor)",
          background: "var(--mor-acik)",
        }}
      >
        <Avatar ad={oyuncu.ad_soyad} boyut={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{oyuncu.ad_soyad}</div>
          <div style={{ fontSize: 13, color: "var(--soluk)" }}>
            {oyuncu.yas_grubu_ad || "Grup yok"} · {tarihTR(oyuncu.dogum_tarihi)} · {paraTR(oyuncu.aylik_aidat)}/ay
          </div>
        </div>
        <Btn kucuk tur="ghost" onClick={() => onKart?.(oyuncu.id)}>
          Kart
        </Btn>
        <Btn kucuk tur="ghost" onClick={onDegistir}>
          Değiştir
        </Btn>
      </div>
    );
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}>
        <Ikon ad="ara" />
      </span>
      <Girdi
        placeholder="Ad, soyad veya TC ile oyuncu ara"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        autoFocus
        aria-label="Oyuncu ara"
        style={{ paddingLeft: 40 }}
      />
      {sonuc.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 46,
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid var(--cizgi)",
            borderRadius: 10,
            boxShadow: "0 12px 30px rgba(27,21,48,.15)",
            zIndex: 5,
            overflow: "hidden",
          }}
        >
          {sonuc.map((s) => (
            <div
              key={s.id}
              onClick={() => onSec(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: "1px solid var(--cizgi)",
              }}
            >
              <Avatar ad={s.ad_soyad} boyut={30} />
              <span style={{ fontWeight: 600, flex: 1 }}>{s.ad_soyad}</span>
              <span style={{ color: "var(--soluk)", fontSize: 13 }}>{s.yas_grubu_ad || ""}</span>
              {(() => {
                const g = gorunenAidatDurumu(s.aidat_durum, s.vade_gecti); // plan §38: vadesi gelmemiş "Bekliyor"
                return g === "odenmedi" ? (
                  <Rozet ton="red">Borç</Rozet>
                ) : g === "bekliyor" ? (
                  <Rozet ton="gray">Bekliyor</Rozet>
                ) : (
                  <Rozet ton="green">Temiz</Rozet>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
