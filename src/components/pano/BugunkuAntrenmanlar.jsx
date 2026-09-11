import { Kart, Rozet, Bos } from "../ui.jsx";

/** Bugünkü Antrenmanlar kartı: saat/saha/oyuncu, durum rozeti (refactor 2. tur §8.7 — Pano.jsx'ten ayrıldı). */
export function BugunkuAntrenmanlar({ antrenmanlar, onSekme }) {
  return (
    <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 22 }}>Bugünkü Antrenmanlar</h3>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSekme("yoklama");
          }}
          style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          Yoklama
        </a>
      </div>
      {antrenmanlar.length === 0 ? (
        <Bos kucuk metin="Bugün antrenman yok." />
      ) : (
        antrenmanlar.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--cizgi)",
              opacity: t.iptal ? 0.6 : 1,
            }}
          >
            <span className="baslik" style={{ fontSize: 22, color: "var(--mor)", width: 64 }}>
              {t.saat || "—"}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {t.yas_grubu_ad}
                {t.saha ? ` · ${t.saha}` : ""}
              </div>
              <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                {t.oyuncu} oyuncu{t.isaretli ? ` · ${t.geldi} geldi` : ""}
              </div>
            </div>
            {t.iptal ? (
              <Rozet ton="red">İptal</Rozet>
            ) : t.isaretli >= t.oyuncu && t.oyuncu > 0 ? (
              <Rozet ton="green">Yoklama alındı</Rozet>
            ) : t.isaretli > 0 ? (
              <Rozet ton="yellow">Devam ediyor</Rozet>
            ) : (
              <Rozet ton="yellow">Yoklama bekliyor</Rozet>
            )}
          </div>
        ))
      )}
    </Kart>
  );
}
