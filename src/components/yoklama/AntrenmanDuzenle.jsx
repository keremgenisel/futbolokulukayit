import { Btn, Alan, Girdi } from "../ui.jsx";
import { saatAraligiDogrula } from "../../lib/program.js";

/**
 * Antrenman düzenleme çubuğu (plan §13/§37): tarih (yoklama alınmışsa kilitli) · başlangıç · bitiş · saha. Refactor 2. tur §8.1.
 * @param {{ duzen: { tarih: string, saat: string, bitis: string, saha: string }, onDegis: (d: any) => void, onKaydet: () => void,
 *   onVazgec: () => void, tarihKilitli: boolean }} p
 */
export function AntrenmanDuzenle({ duzen, onDegis, onKaydet, onVazgec, tarihKilitli }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        padding: "12px 16px",
        borderBottom: "1px solid var(--cizgi)",
        background: "var(--uyari-acik)",
        flexWrap: "wrap",
      }}
    >
      <Alan etiket="Tarih" style={{ width: 170 }}>
        <Girdi
          type="date"
          value={duzen.tarih}
          onChange={(e) => onDegis({ ...duzen, tarih: e.target.value })}
          aria-label="Antrenman tarihi"
          disabled={tarihKilitli}
          title={tarihKilitli ? "Yoklaması alınmış antrenmanın tarihi değiştirilemez" : ""}
        />
      </Alan>
      <Alan etiket="Başlangıç" style={{ width: 130 }}>
        <Girdi type="time" value={duzen.saat} onChange={(e) => onDegis({ ...duzen, saat: e.target.value })} aria-label="Antrenman saati" />
      </Alan>
      <Alan etiket="Bitiş" style={{ width: 130 }}>
        <Girdi
          type="time"
          value={duzen.bitis}
          onChange={(e) => onDegis({ ...duzen, bitis: e.target.value })}
          aria-label="Antrenman bitişi"
          style={!saatAraligiDogrula(duzen.saat, duzen.bitis).gecerli ? { borderColor: "var(--kirmizi)" } : undefined}
        />
      </Alan>
      <Alan etiket="Saha" style={{ width: 160 }}>
        <Girdi value={duzen.saha} onChange={(e) => onDegis({ ...duzen, saha: e.target.value })} aria-label="Antrenman sahası" />
      </Alan>
      <Btn onClick={onKaydet}>Kaydet</Btn>
      <Btn tur="ghost" onClick={onVazgec}>
        Vazgeç
      </Btn>
      {tarihKilitli && <span style={{ fontSize: 12.5, color: "var(--soluk)" }}>Yoklama alındığı için yalnız saat ve saha değişir.</span>}
    </div>
  );
}
