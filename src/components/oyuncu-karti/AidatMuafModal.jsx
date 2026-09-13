// Ay bazında aidat muafiyeti penceresi (plan §42): neden (dondurma | sakatlık | burs | diğer) + not; "Muaf ay ekle"de yıl/ay da seçilir.
import { useState } from "react";
import { Modal, Btn, Alan, Girdi, Secim } from "../ui.jsx";
import { AY_ADLARI, MUAF_NEDENLERI } from "../../lib/aidat.js";

export function AidatMuafModal({ oyuncuAdi, yil, ay, aySecimli = false, onKaydet, onKapat }) {
  const simdi = new Date();
  const [f, setF] = useState({ yil: yil || simdi.getFullYear(), ay: ay || simdi.getMonth() + 1, neden: "dondurma", not: "" });
  const yillar = Array.from({ length: 7 }, (_, i) => simdi.getFullYear() - 5 + i);
  return (
    <Modal
      baslik="Aidat Muafiyeti"
      genislik={480}
      onKapat={onKapat}
      altBar={
        <>
          <Btn tur="ghost" onClick={onKapat}>
            Vazgeç
          </Btn>
          <Btn onClick={() => onKaydet({ yil: Number(f.yil), ay: Number(f.ay), neden: f.neden, not: f.not.trim() })}>Muaf Yap</Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: "var(--soluk)" }}>
          <b style={{ color: "var(--metin)" }}>{oyuncuAdi}</b> için {aySecimli ? "seçilen ay" : `${AY_ADLARI[f.ay - 1]} ${f.yil}`} aidatı
          borç sayılmaz; kayıt "muaf" olarak nedeniyle kalır. Ödeme yapılmış ay muaf yapılamaz.
        </div>
        {aySecimli && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Alan etiket="Yıl">
              <Secim
                secenekler={yillar.map((y) => ({ kod: String(y), ad: String(y) }))}
                value={String(f.yil)}
                onChange={(e) => setF({ ...f, yil: e.target.value })}
                aria-label="Muaf yılı"
              />
            </Alan>
            <Alan etiket="Ay">
              <Secim
                secenekler={AY_ADLARI.map((a, i) => ({ kod: String(i + 1), ad: a }))}
                value={String(f.ay)}
                onChange={(e) => setF({ ...f, ay: e.target.value })}
                aria-label="Muaf ayı"
              />
            </Alan>
          </div>
        )}
        <Alan etiket="Neden">
          <Secim
            secenekler={MUAF_NEDENLERI}
            value={f.neden}
            onChange={(e) => setF({ ...f, neden: e.target.value })}
            aria-label="Muafiyet nedeni"
          />
        </Alan>
        <Alan etiket="Not (isteğe bağlı)">
          <Girdi
            value={f.not}
            onChange={(e) => setF({ ...f, not: e.target.value })}
            maxLength={200}
            aria-label="Muafiyet notu"
            placeholder="Örn. 3 ay askerlik / sakatlık raporu"
          />
        </Alan>
      </div>
    </Modal>
  );
}
