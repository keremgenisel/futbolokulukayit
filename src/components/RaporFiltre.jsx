// Raporlar tek filtre çubuğu (plan §20): kutular sabit sırada, seçili raporda anlamsız olanlar gizlenir; seçimler raporlar
// arasında korunur. Sağda Önizle / Excel / PDF; filtre değiştiyse Önizle sarı vurgulanır ve "Filtre değişti" notu çıkar.
import { Btn, Alan, Girdi, Secim } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { SezonAySecim } from "./SezonAySecim.jsx";

export function RaporFiltre({
  gorunen,
  filtre,
  onFiltre,
  sezonlar,
  aktifSezon,
  baslangicAyi,
  gruplar,
  kirli,
  onOnizle,
  onExcel,
  onPdf,
  not,
}) {
  const g = (k) => gorunen.includes(k);
  const degistir = (k, v) => onFiltre({ ...filtre, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        {g("mod") && (
          <Alan etiket="Dönem seçimi" style={{ width: 160 }}>
            <Secim
              secenekler={[
                { kod: "sezon", ad: "Sezon ve ay" },
                { kod: "tarih", ad: "Tarih aralığı" },
              ]}
              value={filtre.mod}
              onChange={(e) => degistir("mod", e.target.value)}
              aria-label="Dönem seçimi"
            />
          </Alan>
        )}
        {g("sezon") && (
          <SezonAySecim
            sezonlar={sezonlar}
            aktifSezon={aktifSezon}
            baslangicAyi={baslangicAyi}
            sezon={filtre.sezon}
            ay={filtre.ay}
            onChange={(v) => onFiltre({ ...filtre, sezon: v.sezon, ay: v.ay })}
          />
        )}
        {g("tarih") && (
          <>
            <Alan etiket="Başlangıç" style={{ width: 160 }}>
              <Girdi type="date" value={filtre.from} onChange={(e) => degistir("from", e.target.value)} aria-label="Başlangıç" />
            </Alan>
            <Alan etiket="Bitiş" style={{ width: 160 }}>
              <Girdi type="date" value={filtre.to} onChange={(e) => degistir("to", e.target.value)} aria-label="Bitiş" />
            </Alan>
          </>
        )}
        {g("grup") && (
          <Alan etiket="Yaş grubu" style={{ width: 160 }}>
            <Secim
              secenekler={gruplar}
              bos="Tümü"
              value={filtre.grup}
              onChange={(e) => degistir("grup", e.target.value)}
              aria-label="Yaş grubu"
            />
          </Alan>
        )}
        <div style={{ flex: 1 }} />
        <Btn
          ikon={<Ikon ad="goz" />}
          onClick={onOnizle}
          tur={kirli ? "sari" : "primary"}
          title={kirli ? "Filtre değişti, yeniden önizleyin" : ""}
        >
          Önizle
        </Btn>
        {kirli && <span style={{ fontSize: 12, color: "var(--soluk)", alignSelf: "center" }}>Filtre değişti</span>}
        <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={onExcel}>
          Excel
        </Btn>
        <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={onPdf}>
          PDF
        </Btn>
      </div>
      {not && <div style={{ fontSize: 13, color: "var(--soluk)" }}>{not}</div>}
    </div>
  );
}
