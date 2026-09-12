// Ayarlar > Kulüp ve Makbuz › Giriş kartı (plan §40): kulüp iletişimi, 4 kural, QR anahtarı ve örnek oyuncuyla önizleme.
// Alanlar KulupAyar'ın tek Kaydet çubuğuyla yazılır (ayar tablolarında satır başına Kaydet yok).
import { useEffect, useState } from "react";
import { Alan, AltBaslik } from "../ui.jsx";
import { girisKartiHtml, KART_KURAL_VARSAYILAN } from "../../lib/kartHtml.js";
import { qrSvg, code128Svg, kodMetni } from "../../lib/kartKod.js";
import { VARSAYILAN_KULUP } from "../../lib/marka.js";

const ORNEK = {
  id: 123,
  ad_soyad: "Kaan Yıldız",
  yas_grubu_ad: "U11",
  dogum_tarihi: "2015-11-02",
  veli_ad: "Ayşe Yıldız",
  veli_tel: "05321112233",
};

export function GirisKartiAyar({ a, setA, kilitli, girdi, logo, tema }) {
  const qr = a.kart_qr === "1";
  const [kod, setKod] = useState({ qrSvg: "", barkodSvg: "" });
  useEffect(() => {
    let iptal = false;
    if (!qr) {
      setKod({ qrSvg: "", barkodSvg: "" });
      return undefined;
    }
    const metin = kodMetni("2026 0123");
    qrSvg(metin)
      .then((svg) => !iptal && setKod({ qrSvg: svg, barkodSvg: code128Svg(metin) }))
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [qr]);
  const kurallar = [1, 2, 3, 4].map((i) => a[`kart_kural_${i}`] || KART_KURAL_VARSAYILAN[i - 1]);
  const html = girisKartiHtml({
    oyuncular: [{ ...ORNEK, ...kod }],
    ayar: {
      kulupAdi: a.kulup_adi || VARSAYILAN_KULUP,
      kurulusYili: a.kurulus_yili,
      logo,
      tema,
      adres: a.kulup_adres,
      telefon: a.kulup_telefon,
      web: a.kulup_web,
      sezon: "2026-2027",
      kurallar,
    },
    duzen: "onizleme",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AltBaslik>Giriş kartı</AltBaslik>
      <div style={{ fontSize: 13, color: "var(--soluk)", marginTop: -8 }}>
        11 × 6 cm oyuncu giriş kartı: oyuncu kartından tek tek, Oyuncular ekranından toplu yazdırılır. Kulüp adı, logo, renkler ve sezon
        yukarıdaki ayarlardan gelir.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Alan etiket="Kulüp adresi (arka yüz)">
            {girdi("kulup_adres", { "aria-label": "Kulüp adresi", placeholder: "Mahalle, cadde, ilçe" })}
          </Alan>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Alan etiket="Kulüp telefonu">{girdi("kulup_telefon", { "aria-label": "Kulüp telefonu", placeholder: "0212 000 00 00" })}</Alan>
            <Alan etiket="Web / e-posta">{girdi("kulup_web", { "aria-label": "Kulüp web", placeholder: "kulup.org" })}</Alan>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Alan key={i} etiket={`${i}. kural`}>
              {girdi(`kart_kural_${i}`, { "aria-label": `${i}. kural`, placeholder: KART_KURAL_VARSAYILAN[i - 1], maxLength: 140 })}
            </Alan>
          ))}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: kilitli ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={qr}
              disabled={kilitli}
              onChange={(e) => setA({ ...a, kart_qr: e.target.checked ? "1" : "" })}
              aria-label="Kartta giriş kodu bas"
              style={{ width: 18, height: 18, marginTop: 2 }}
            />
            <span>
              <b>Kartta giriş kodu (QR ve barkod) bas</b>
              <span style={{ display: "block", fontSize: 13, color: "var(--soluk)" }}>
                Kulüpte kart okuyucu yoksa kapalı bırakın. Açılırsa kod oyuncu numarasından üretilir; ileride okuyucuyla giriş için aynı kod
                kullanılır.
              </span>
            </span>
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Önizleme (örnek oyuncu)
          </span>
          <iframe
            title="Giriş kartı önizlemesi"
            sandbox=""
            srcDoc={html}
            style={{
              width: 440,
              height: 500,
              border: "1px solid var(--cizgi)",
              borderRadius: 12,
              background: "#fff",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
