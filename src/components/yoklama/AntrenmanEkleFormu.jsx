import { Btn, Alan, Girdi, Secim } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { saatAraligi, saatAraligiDogrula, aralikKesisir } from "../../lib/program.js";

/**
 * Antrenman Ekle formu: yaş grubu · başlangıç · bitiş (isteğe bağlı, plan §37) · saha; aynı gün + aynı saha + kesişen aralıkta
 * sarı çakışma uyarısı (engel değil). Doğrulama ve kayıt üst bileşende (`onEkle`). Refactor 2. tur §8.1.
 * @param {{ gruplar: any[], yeni: { age_group_id: string, saat: string, bitis: string, saha: string }, onDegis: (y: any) => void,
 *   onEkle: () => void, onVazgec: () => void, antrenmanlar: any[] }} p
 */
export function AntrenmanEkleFormu({ gruplar, yeni, onDegis, onEkle, onVazgec, antrenmanlar }) {
  // Saha çakışma uyarısı (plan §37): aynı gün, aynı saha, kesişen aralık — engel değil
  const saha = yeni.saha.trim().toLocaleLowerCase("tr-TR");
  const cakisan =
    saha && yeni.saat
      ? antrenmanlar.find(
          (t) =>
            !t.iptal &&
            (t.saha || "").trim().toLocaleLowerCase("tr-TR") === saha &&
            aralikKesisir({ saat: t.saat, bitis: t.bitis_saat }, { saat: yeni.saat, bitis: yeni.bitis }),
        )
      : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        padding: 14,
        borderRadius: 10,
        background: "var(--zemin)",
        border: "1px dashed #C9B8E0",
        flexWrap: "wrap",
      }}
    >
      <Alan etiket="Yaş grubu" style={{ width: 180 }}>
        <Secim
          secenekler={gruplar}
          bos="Yaş grubu"
          value={yeni.age_group_id}
          onChange={(e) => onDegis({ ...yeni, age_group_id: e.target.value })}
          aria-label="Yaş grubu"
        />
      </Alan>
      <Alan etiket="Başlangıç" style={{ width: 130 }}>
        <Girdi type="time" value={yeni.saat} onChange={(e) => onDegis({ ...yeni, saat: e.target.value })} aria-label="Saat" />
      </Alan>
      <Alan etiket="Bitiş" style={{ width: 130 }}>
        <Girdi
          type="time"
          value={yeni.bitis}
          onChange={(e) => onDegis({ ...yeni, bitis: e.target.value })}
          aria-label="Bitiş"
          style={!saatAraligiDogrula(yeni.saat, yeni.bitis).gecerli ? { borderColor: "var(--kirmizi)" } : undefined}
        />
      </Alan>
      <Alan etiket="Saha" style={{ width: 160 }}>
        <Girdi placeholder="Saha 1" value={yeni.saha} onChange={(e) => onDegis({ ...yeni, saha: e.target.value })} aria-label="Saha" />
      </Alan>
      <Btn ikon={<Ikon ad="arti" />} onClick={onEkle}>
        Ekle
      </Btn>
      {cakisan ? (
        <div
          role="alert"
          style={{
            flexBasis: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--uyari-acik)",
            border: "1px solid var(--uyari)",
            fontSize: 13.5,
            color: "var(--mor-koyu)",
          }}
        >
          <Ikon ad="uyari" boyut={18} />
          <span>
            <b>{cakisan.saha}</b>'de {saatAraligi(cakisan.saat, cakisan.bitis_saat)} <b>{cakisan.yas_grubu_ad}</b> antrenmanı var;{" "}
            {saatAraligi(yeni.saat, yeni.bitis)} ile çakışıyor. Yine de ekleyebilirsiniz.
          </span>
        </div>
      ) : null}
      <Btn tur="ghost" ikon={<Ikon ad="kapat" />} onClick={onVazgec}>
        Vazgeç
      </Btn>
    </div>
  );
}
