import { Kart, Btn, Alan, Girdi } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { ODEME_YONTEMLERI, paraTR, AY_ADLARI } from "../../lib/aidat.js";
import { ayAnahtar } from "../../lib/tahsilat.js";

/** Sağ sütun: ödeme yöntemi/tarih/tahsil eden/not, koyu toplam paneli, Kaydet / Kaydet ve Yazdır (refactor 2. tur §8.2). */
export function OdemePaneli({
  yontem,
  onYontem,
  tarih,
  onTarih,
  tahsilEden,
  onTahsilEden,
  not_,
  onNot,
  secliAylar,
  aidatAylar,
  secili,
  kalemler,
  toplam,
  bekliyor,
  oyuncuVar,
  onKaydet,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 22 }}>Ödeme</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ODEME_YONTEMLERI.map((y) => (
            <button
              key={y.kod}
              type="button"
              onClick={() => onYontem(y.kod)}
              style={{
                height: 42,
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                border: `1px solid ${yontem === y.kod ? "var(--mor)" : "var(--cizgi)"}`,
                background: yontem === y.kod ? "var(--mor)" : "#fff",
                color: yontem === y.kod ? "var(--ana-ustu)" : "var(--metin)",
              }}
            >
              {y.ad}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Alan etiket="Tarih">
            <Girdi type="date" value={tarih} onChange={(e) => onTarih(e.target.value)} />
          </Alan>
          <Alan etiket="Tahsil eden">
            <Girdi value={tahsilEden} onChange={(e) => onTahsilEden(e.target.value)} aria-label="Tahsil eden" />
          </Alan>
        </div>
        <Alan etiket="Not">
          <Girdi value={not_} onChange={(e) => onNot(e.target.value)} placeholder="İsteğe bağlı" />
        </Alan>
      </Kart>
      <div
        style={{
          background: "var(--mor-koyu)",
          borderRadius: 12,
          color: "var(--ana-ustu)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {secliAylar
          .filter((d) => Number(aidatAylar[ayAnahtar(d.yil, d.ay)]) > 0)
          .map((d) => (
            <div
              key={ayAnahtar(d.yil, d.ay)}
              style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--ana-ustu-soluk, #d8cce9)" }}
            >
              <span>
                Aidat · {AY_ADLARI[d.ay - 1]} {d.yil}
              </span>
              <span>{paraTR(aidatAylar[ayAnahtar(d.yil, d.ay)])}</span>
            </div>
          ))}
        {Object.entries(secili)
          .filter(([, v]) => Number(v) > 0)
          .map(([id, v]) => {
            const k = kalemler.find((x) => x.id === Number(id));
            return (
              <div
                key={id}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--ana-ustu-soluk, #d8cce9)" }}
              >
                <span>{k?.ad}</span>
                <span>{paraTR(v)}</span>
              </div>
            );
          })}
        <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="baslik" style={{ color: "var(--ana-ustu)", fontSize: 22 }}>
            TOPLAM
          </span>
          <span className="baslik" style={{ fontSize: 40, color: "var(--sari)" }}>
            {paraTR(toplam)}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn
          tur="ghost"
          ikon={<Ikon ad="dosya" />}
          onClick={() => onKaydet(false)}
          disabled={bekliyor || !oyuncuVar}
          style={{ flex: 1, height: 52 }}
        >
          Kaydet
        </Btn>
        <Btn
          tur="sari"
          ikon={<Ikon ad="yazdir" />}
          onClick={() => onKaydet(true)}
          disabled={bekliyor || !oyuncuVar}
          style={{ flex: 2, height: 52, fontSize: 15 }}
        >
          Kaydet ve Yazdır
        </Btn>
      </div>
    </div>
  );
}
