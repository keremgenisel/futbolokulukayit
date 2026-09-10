// Tahsilat > "Uzun Dönem Seç" modalı (plan §24): bir oyuncunun birden fazla ayını (ör. 6 ay ya da
// sezon sonuna kadar) tek seferde işaretlemesi için. Hızlı seçim (3 Ay / 6 Ay / Sezon Sonuna Kadar) ya
// da elle başlangıç-bitiş ayı; "Uygula" seçilen aralığı [{yil,ay}] olarak `onUygula`'ya döner — ay
// listesini üretmek ve önizleme hesaplamak SAF `ayAraligi`/`ayEkle` ile (src/lib/aidat.js), veritabanı
// yazma (ensureMonthlyDuesAraligi) ve aidatAylar'ı doldurma Tahsilat.jsx'te (parent) yapılır.
import { useState } from "react";
import { Modal, Btn, Secim } from "./ui.jsx";
import { AY_ADLARI, paraTR, ayAraligi, ayEkle } from "../lib/aidat.js";
import { sezonAylari } from "../lib/sezon.js";

const etiketStili = { fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" };

// Seçim kutularının aralığı: merkez aydan 12 ay öncesine, 23 ay sonrasına kadar (geriye dönük düzeltme +
// ileriye dönük uzun dönem ödemesini kapsar, ~3 sezon).
function secenekAylari(merkezYil, merkezAy) {
  const bas = ayEkle(merkezYil, merkezAy, -12);
  const bit = ayEkle(merkezYil, merkezAy, 23);
  return ayAraligi(bas.yil, bas.ay, bit.yil, bit.ay).map((d) => ({ kod: `${d.yil}-${d.ay}`, ad: `${AY_ADLARI[d.ay - 1]} ${d.yil}` }));
}

/**
 * @param {{ oyuncuAdi: string, aylikAidat: number, baslangic?: {yil:number,ay:number}, sezon?: string,
 *   odenmisAylar?: Set<string>, onUygula: (aylar: {yil:number,ay:number}[]) => void, onKapat: () => void }} p
 * odenmisAylar: "yil-ay" anahtarları — zaten ödenmiş/muaf aylar; aralıktan atlanır (Kerem, 10.09.2026: "ödenmiş
 * olanlar gösterilmesin"), önizleme sayısı ve toplam yalnız gerçekten tahsil edilecek ayları sayar.
 */
export function UzunDonemModal({ oyuncuAdi, aylikAidat, baslangic, sezon, odenmisAylar = new Set(), onUygula, onKapat }) {
  const bugun = new Date();
  const varsayilanBas = baslangic || { yil: bugun.getFullYear(), ay: bugun.getMonth() + 1 };
  const [bas, setBas] = useState(varsayilanBas);
  const [bit, setBit] = useState(ayEkle(varsayilanBas.yil, varsayilanBas.ay, 5)); // varsayılan: 6 ay
  const [hizli, setHizli] = useState("6ay");
  const secenekler = secenekAylari(varsayilanBas.yil, varsayilanBas.ay);
  const sezonSonu = sezon ? sezonAylari(sezon)[11] : null;

  const hizliSec = (kod, n) => {
    setHizli(kod);
    setBas(varsayilanBas);
    setBit(n === "sezon" ? sezonSonu || varsayilanBas : ayEkle(varsayilanBas.yil, varsayilanBas.ay, n));
  };
  const elleSec = (alan, deger) => {
    setHizli(null);
    const [yil, ay] = deger.split("-").map(Number);
    if (alan === "bas") setBas({ yil, ay });
    else setBit({ yil, ay });
  };

  const aralik = ayAraligi(bas.yil, bas.ay, bit.yil, bit.ay);
  const aylar = aralik.filter((d) => !odenmisAylar.has(`${d.yil}-${d.ay}`));
  const atlanan = aralik.length - aylar.length;
  const toplam = aylar.length * (Number(aylikAidat) || 0);
  const adi = (d) => `${AY_ADLARI[d.ay - 1]} ${d.yil}`;
  const ozet = aylar.length
    ? `${aylar.length} ay seçilecek: ${adi(aylar[0])} – ${adi(aylar[aylar.length - 1])}`
    : "Seçilen aralıktaki tüm aylar zaten ödenmiş";

  return (
    <Modal baslik="Uzun Dönem Seç" onKapat={onKapat} genislik={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--soluk)" }}>{oyuncuAdi} için birden fazla ayı tek seferde işaretleyin.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={etiketStili}>Hızlı seçim</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn tur={hizli === "3ay" ? "primary" : "ghost"} style={{ flex: 1 }} onClick={() => hizliSec("3ay", 2)}>
              3 Ay
            </Btn>
            <Btn tur={hizli === "6ay" ? "primary" : "ghost"} style={{ flex: 1 }} onClick={() => hizliSec("6ay", 5)}>
              6 Ay
            </Btn>
            <Btn
              tur={hizli === "sezon" ? "primary" : "ghost"}
              style={{ flex: 1.7, whiteSpace: "normal", textAlign: "center", lineHeight: 1.2 }}
              disabled={!sezonSonu}
              onClick={() => hizliSec("sezon", "sezon")}
            >
              Sezon Sonuna Kadar
            </Btn>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--soluk)", fontSize: 12 }}>
          <div style={{ flex: 1, borderTop: "1px solid var(--cizgi)" }} />
          <span>veya elle aralık seç</span>
          <div style={{ flex: 1, borderTop: "1px solid var(--cizgi)" }} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={etiketStili}>Başlangıç ayı</span>
            <Secim secenekler={secenekler} value={`${bas.yil}-${bas.ay}`} onChange={(e) => elleSec("bas", e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={etiketStili}>Bitiş ayı</span>
            <Secim secenekler={secenekler} value={`${bit.yil}-${bit.ay}`} onChange={(e) => elleSec("bit", e.target.value)} />
          </label>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--mor-acik)",
            border: "1px solid var(--mor)",
          }}
        >
          <span style={{ fontSize: 13.5, color: "var(--mor-koyu)", lineHeight: 1.4 }}>
            <b>{ozet}</b>
            {aylar.length > 0 && (
              <>
                {" "}
                · Toplam <b>{paraTR(toplam)}</b>
              </>
            )}
            {atlanan > 0 && <span style={{ color: "var(--soluk)" }}> · {atlanan} ay zaten ödenmiş, atlandı</span>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn tur="ghost" style={{ flex: 1 }} onClick={onKapat}>
            Vazgeç
          </Btn>
          <Btn tur="primary" style={{ flex: 2 }} disabled={!aylar.length} onClick={() => onUygula(aylar)}>
            Uygula
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
