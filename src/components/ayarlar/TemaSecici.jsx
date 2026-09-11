// Uygulama renkleri seçici (plan §32.4/§32.6): logodan önerilen renkler, hazır paletler, özel ana/vurgu, canlı önizleme,
// kontrast uyarısı. Ayarlar > Kulüp ve Makbuz ile İlk Kurulum sihirbazı paylaşır. Renkleri UYGULAMAZ; seçimi `onDegis` ile verir.
import { useEffect, useState } from "react";
import { PRESETLER, temaTuret, logodanPalet, renkGecerliMi } from "../../lib/tema.js";
import { logodanRenklerOku } from "../../lib/temaUygula.js";
import { Btn } from "../ui.jsx";

const et = { fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" };

function Kutu({ renk, boyut = 30, secili }) {
  return (
    <div
      style={{
        width: boyut,
        height: boyut,
        borderRadius: 8,
        background: renk,
        border: secili ? "3px solid var(--mor-koyu)" : "1px solid var(--cizgi)",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    />
  );
}

/** Kenar menü + Pano parçasıyla minyatür önizleme; seçilen tema yalnız bu kutuya uygulanır (CSS değişkenleri yerelde). */
export function TemaOnizleme({ tema, kisaAd = "KULÜP", logo = "" }) {
  const t = temaTuret(tema);
  return (
    <div
      data-testid="tema-onizleme"
      style={{ border: "1px solid var(--cizgi)", borderRadius: 12, overflow: "hidden", display: "flex", height: 150, background: "#fff" }}
    >
      <div style={{ width: 170, background: t.mor, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {logo ? (
            <img src={logo} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
          ) : (
            <img src="./logo.png" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              className="baslik"
              style={{
                color: t.anaUstuMetin,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: ".04em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {kisaAd}
            </div>
            <div style={{ color: t.sari, fontSize: 9, fontWeight: 600, letterSpacing: ".08em" }}>FUTBOL OKULU</div>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.15)" }} />
        <div
          style={{
            padding: "7px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,.14)",
            color: t.anaUstuMetin,
            fontSize: 12,
            fontWeight: 600,
            borderLeft: `3px solid ${t.sari}`,
          }}
        >
          Pano
        </div>
        <div style={{ padding: "7px 10px", color: t.anaUstuMetin, opacity: 0.75, fontSize: 12 }}>Oyuncular</div>
      </div>
      <div style={{ flex: 1, background: "var(--zemin)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="baslik" style={{ fontSize: 20, fontWeight: 700, color: t.morKoyu }}>
            Pano
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{ padding: "6px 10px", borderRadius: 8, background: t.sari, color: t.vurguUstuMetin, fontSize: 12, fontWeight: 600 }}
            >
              Makbuz Kes
            </span>
            <span style={{ padding: "6px 10px", borderRadius: 8, background: t.mor, color: t.anaUstuMetin, fontSize: 12, fontWeight: 600 }}>
              Yeni Oyuncu
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "3px 10px", borderRadius: 999, background: t.morAcik, color: t.mor, fontSize: 12, fontWeight: 600 }}>
            Aktif
          </span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "var(--yesil-acik)",
              color: "var(--yesil)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Ödendi
          </span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "var(--kirmizi-acik)",
              color: "var(--kirmizi)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Borçlu
          </span>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--cizgi)",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: "var(--soluk)",
          }}
        >
          Yeşil/kırmızı anlam renkleri sabit kalır; ana ve vurgu rengi değişir.
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ tema: {ana: string, vurgu: string}, onDegis: (t: {ana: string, vurgu: string}) => void, logo?: string, kisaAd?: string, disabled?: boolean }} p
 */
export function TemaSecici({ tema, onDegis, logo = "", kisaAd = "KULÜP", disabled = false }) {
  const [oneri, setOneri] = useState(null); // logodan palet { ana, vurgu, renkler }
  useEffect(() => {
    let iptal = false;
    if (!logo) {
      setOneri(null);
      return;
    }
    logodanRenklerOku(logo).then((c) => {
      if (iptal) return;
      const p = logodanPalet(c);
      setOneri(p ? { ...p, renkler: c.renkler, beyazVar: c.beyazVar } : null);
    });
    return () => {
      iptal = true;
    };
  }, [logo]);
  const t = temaTuret(tema);
  const seciliPreset = PRESETLER.find((p) => p.ana === tema.ana && p.vurgu === tema.vurgu)?.kod;
  const oneriSecili = !!oneri && oneri.ana === tema.ana && oneri.vurgu === tema.vurgu;
  const renkGir = (alan, v) => {
    if (renkGecerliMi(v)) onDegis({ ...tema, [alan]: v.toLowerCase() });
  };
  const kart = (kod, ad, ana, vurgu, secili, etiket) => (
    <button
      key={kod}
      type="button"
      disabled={disabled}
      onClick={() => onDegis({ ana, vurgu })}
      aria-pressed={secili}
      aria-label={`Palet: ${ad}`}
      style={{
        width: 150,
        border: secili ? "2px solid var(--mor)" : "1px solid var(--cizgi)",
        borderRadius: 10,
        padding: 10,
        background: "#fff",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        position: "relative",
      }}
    >
      {etiket && (
        <span
          style={{
            position: "absolute",
            top: -9,
            left: 10,
            background: "var(--uyari)",
            color: "var(--uyari-metin)",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "1px 8px",
            borderRadius: 999,
            letterSpacing: ".04em",
          }}
        >
          {etiket}
        </span>
      )}
      <div style={{ display: "flex", height: 34, borderRadius: 7, overflow: "hidden", border: "1px solid var(--cizgi)" }}>
        <div style={{ flex: 3, background: ana }} />
        <div style={{ flex: 1, background: vurgu }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: secili ? 700 : 600 }}>{ad}</div>
      <div style={{ fontSize: 11, color: "var(--soluk)", fontFamily: "monospace" }}>
        {ana} · {vurgu}
      </div>
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={et}>Uygulama renkleri</span>
      {oneri && (
        <div
          role="status"
          style={{
            border: "1px solid var(--uyari)",
            background: "var(--uyari-acik)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--mor-koyu)", fontWeight: 600, whiteSpace: "nowrap" }}>Logodan önerilen:</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[...oneri.renkler, ...(oneri.beyazVar ? ["#ffffff"] : [])].map((r) => (
              <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Kutu renk={r} secili={r === tema.ana} />
                <span style={{ fontSize: 10.5, color: "var(--soluk)", fontFamily: "monospace" }}>{r}</span>
              </div>
            ))}
          </div>
          {!disabled && (
            <Btn kucuk style={{ marginLeft: "auto" }} onClick={() => onDegis({ ana: oneri.ana, vurgu: oneri.vurgu })}>
              Bu renkleri kullan
            </Btn>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 6 }}>
        {oneri && kart("logodan", "Logodan (öneri)", oneri.ana, oneri.vurgu, oneriSecili, "YENİ")}
        {PRESETLER.map((p) => kart(p.kod, p.ad, p.ana, p.vurgu, seciliPreset === p.kod && !oneriSecili))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          ["ana", "Ana renk (özel)"],
          ["vurgu", "Vurgu rengi (özel)"],
        ].map(([alan, etiket]) => (
          <label key={alan} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={et}>{etiket}</span>
            <div
              style={{
                height: 42,
                padding: "0 12px",
                border: "1px solid var(--cizgi)",
                borderRadius: 8,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                type="color"
                aria-label={etiket}
                value={tema[alan]}
                disabled={disabled}
                onChange={(e) => renkGir(alan, e.target.value)}
                style={{ width: 30, height: 26, border: 0, padding: 0, background: "none", cursor: disabled ? "default" : "pointer" }}
              />
              <span style={{ fontFamily: "monospace", fontSize: 14 }}>{tema[alan]}</span>
            </div>
          </label>
        ))}
      </div>
      <span style={et}>Canlı önizleme</span>
      <TemaOnizleme tema={tema} kisaAd={kisaAd} logo={logo} />
      {t.anaOkunakli ? (
        <div style={{ fontSize: 12.5, color: "var(--yesil)", fontWeight: 600 }}>
          ✓ Ana renk üzerinde beyaz yazı okunaklı (kontrast {t.kontrast}:1)
        </div>
      ) : (
        <div role="alert" style={{ fontSize: 12.5, color: "var(--kirmizi)", fontWeight: 600 }}>
          Ana renk açık; üzerindeki yazılar koyu renkle gösterilir. Daha koyu bir ana renk daha okunaklı olur.
        </div>
      )}
    </div>
  );
}
