import { useEffect, useRef } from "react";
import { Btn, Girdi } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { gunSeridi, gunKaydir, varsayilanBaslangic, gunNoktalari, sezonDisiMi } from "../lib/takvim.js";

export const SERIT_GUN = 14;
const NOKTA_RENK = { gri: "#C9C2D6", mor: "var(--mor)", yesil: "var(--yesil)", kirmizi: "var(--kirmizi)" };
// Seçili (mor zeminli) hücrede mor nokta kaybolur; orada beyaz tonları kullanılır.
const NOKTA_RENK_SECILI = { gri: "rgba(255,255,255,.45)", mor: "#fff", yesil: "var(--yesil)", kirmizi: "var(--kirmizi)" };
const NOKTA_AD = { gri: "yoklama alınmadı", mor: "kısmen alındı", yesil: "tamamlandı", kirmizi: "iptal" };

/**
 * Havayolu tarzı yatay gün şeridi. 14 gün görünür; oklar 7 gün kaydırır, Bugün düğmesi şeridi
 * bugüne getirir, tarih girdisiyle uzak tarihe atlanır. Klavye: ← → gün, Home bugün.
 * @param {{ secili: string, bugun: string, baslangic: string, onSec: (iso: string) => void,
 *   onBaslangic: (iso: string) => void, gunOzetleri: Record<string, {iptal:number, oyuncu:number, isaretli:number}[]>,
 *   sezon?: { baslangic?: string, bitis?: string } | null }} p
 * `sezon` verilirse aralık dışındaki günler soluk çizilir (plan §37.6); tıklanabilir kalır, antrenman eklenebilir.
 */
export function TakvimSeridi({ secili, bugun, baslangic, onSec, onBaslangic, gunOzetleri, sezon = null }) {
  const hucreler = gunSeridi(baslangic, SERIT_GUN, bugun);
  const kok = useRef(null);

  // Seçili gün şeridin dışına çıkarsa (klavye, tarih girdisi) şeridi onu içerecek şekilde kaydır.
  useEffect(() => {
    const son = gunKaydir(baslangic, SERIT_GUN - 1);
    if (secili < baslangic) onBaslangic(gunKaydir(secili, -(SERIT_GUN - 1)));
    else if (secili > son) onBaslangic(secili);
  }, [secili]); // eslint-disable-line react-hooks/exhaustive-deps

  const klavye = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSec(gunKaydir(secili, -1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSec(gunKaydir(secili, 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSec(bugun);
      onBaslangic(varsayilanBaslangic(bugun));
    }
  };
  const bugune = () => {
    onSec(bugun);
    onBaslangic(varsayilanBaslangic(bugun));
  };
  const okStil = {
    width: 40,
    alignSelf: "stretch",
    borderRadius: 10,
    border: "1px solid var(--cizgi)",
    background: "#fff",
    color: "var(--mor)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div
      ref={kok}
      tabIndex={0}
      onKeyDown={klavye}
      aria-label="Gün şeridi"
      style={{
        background: "#fff",
        border: "1px solid var(--cizgi)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        outline: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          aria-label="Önceki hafta"
          title="Önceki hafta"
          onClick={() => onBaslangic(gunKaydir(baslangic, -7))}
          style={okStil}
        >
          <Ikon ad="sol" boyut={20} />
        </button>
        {hucreler.map((h) => {
          const on = h.iso === secili;
          const noktalar = gunNoktalari(gunOzetleri[h.iso] || []);
          const sezonDisi = sezonDisiMi(h.iso, sezon);
          const etiket = `${h.gun} ${h.ay}${h.bugunMu ? " (bugün)" : ""}${noktalar.length ? ` · ${noktalar.length} antrenman` : ""}${sezonDisi ? " · sezon dışı" : ""}`;
          return (
            <button
              key={h.iso}
              type="button"
              onClick={() => onSec(h.iso)}
              aria-label={etiket}
              aria-pressed={on}
              data-iso={h.iso}
              data-sezon-disi={sezonDisi ? "1" : "0"}
              title={sezonDisi ? "Sezon dışı gün (antrenman eklenebilir)" : undefined}
              style={{
                opacity: sezonDisi && !on ? 0.5 : 1,
                position: "relative",
                flex: "1 1 0",
                minWidth: 0,
                height: 84,
                borderRadius: 10,
                cursor: "pointer",
                background: on ? "var(--mor)" : "#fff",
                border: `1px solid ${on ? "var(--mor)" : "var(--cizgi)"}`,
                color: on ? "#fff" : h.haftaSonu ? "var(--soluk)" : "var(--mor-koyu)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  lineHeight: "12px",
                  height: 12,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  color: on ? "var(--sari)" : "var(--mor)",
                }}
              >
                {h.ayEtiketi ? h.ay : ""}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: on ? "var(--ana-ustu-soluk, #d8cce9)" : "var(--soluk)",
                }}
              >
                {h.gunAdi}
              </span>
              <span className="baslik" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                {h.gun}
              </span>
              <span style={{ display: "flex", gap: 4, height: 7, alignItems: "center" }}>
                {noktalar.map((n, i) => (
                  <span
                    key={i}
                    title={NOKTA_AD[n]}
                    data-nokta={n}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: (on ? NOKTA_RENK_SECILI : NOKTA_RENK)[n] }}
                  />
                ))}
              </span>
              {h.bugunMu && (
                <span
                  style={{ position: "absolute", left: 14, right: 14, bottom: 6, height: 3, borderRadius: 2, background: "var(--sari)" }}
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Sonraki hafta"
          title="Sonraki hafta"
          onClick={() => onBaslangic(gunKaydir(baslangic, 7))}
          style={okStil}
        >
          <Ikon ad="sag" boyut={20} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", gap: 12 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {Object.keys(NOKTA_AD).map((k) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--soluk)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: NOKTA_RENK[k] }} />
              {NOKTA_AD[k][0].toLocaleUpperCase("tr-TR") + NOKTA_AD[k].slice(1)}
            </span>
          ))}
          {sezon?.baslangic && sezon?.bitis && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--soluk)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, border: "1px solid var(--cizgi)", opacity: 0.5 }} />
              Soluk gün: sezon dışı
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn kucuk tur="ghost" ikon={<Ikon ad="takvim" boyut={16} />} onClick={bugune}>
            Bugün
          </Btn>
          <Girdi
            type="date"
            value={secili}
            onChange={(e) => e.target.value && onSec(e.target.value)}
            aria-label="Tarihe git"
            style={{ width: 150, height: 36 }}
          />
        </div>
      </div>
    </div>
  );
}
