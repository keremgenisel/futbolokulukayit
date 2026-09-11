import { ParaGirdi } from "../ui.jsx";
import { paraTR, AY_ADLARI } from "../../lib/aidat.js";
import { ayAnahtar } from "../../lib/tahsilat.js";

/** Kalem satırları: aidat (seçili aylar + ay bazlı tutar kutuları) ve diğer kalemler (refactor 2. tur §8.2). */
export function KalemListesi({
  kalemler,
  oyuncu,
  donemVar,
  aidatSecili,
  aidatEtiket,
  aidatToplam,
  secliAylar,
  aidatAylar,
  onAidatAylar,
  secili,
  onSecili,
  onToggle,
}) {
  return (
    <div>
      {kalemler
        .filter((k) => k.aktif)
        .map((k) => {
          if (k.kod === "aidat")
            return (
              <div key={k.id} style={{ borderBottom: "1px solid var(--cizgi)", padding: "8px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <input
                    type="checkbox"
                    checked={aidatSecili}
                    onChange={() => onToggle(k)}
                    disabled={!oyuncu || !donemVar}
                    aria-label={k.ad}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ flex: 1, fontWeight: aidatSecili ? 700 : 400 }}>{aidatEtiket}</span>
                  <span style={{ width: 140, textAlign: "right", fontWeight: 700 }}>{aidatSecili ? paraTR(aidatToplam) : ""}</span>
                </div>
                {secliAylar.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingLeft: 34 }}>
                    {secliAylar.map((d) => {
                      const key = ayAnahtar(d.yil, d.ay);
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
                          <span style={{ flex: 1, color: "var(--soluk)" }}>
                            {AY_ADLARI[d.ay - 1]} {d.yil}
                          </span>
                          <ParaGirdi
                            value={aidatAylar[key]}
                            onDegis={(v) => onAidatAylar({ ...aidatAylar, [key]: v })}
                            style={{ width: 140, height: 36 }}
                            aria-label={`${AY_ADLARI[d.ay - 1]} ${d.yil} aidat tutarı`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          const on = secili[k.id] !== undefined;
          return (
            <div
              key={k.id}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--cizgi)" }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(k)}
                disabled={!oyuncu}
                aria-label={k.ad}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ flex: 1, fontWeight: on ? 700 : 400 }}>{k.ad}</span>
              <ParaGirdi
                value={on ? secili[k.id] : ""}
                disabled={!on}
                onDegis={(v) => onSecili({ ...secili, [k.id]: v })}
                style={{ width: 140, height: 40, fontWeight: 700 }}
                aria-label={`${k.ad} tutar`}
              />
            </div>
          );
        })}
    </div>
  );
}
