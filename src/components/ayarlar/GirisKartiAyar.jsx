// Ayarlar > Giriş Kartı (plan §40; 12.09.2026: Kulüp ve Makbuz'un altında AYRI bölüm): kulüp iletişimi, 4 kural, QR anahtarı,
// örnek oyuncuyla önizleme. Kulüp adı/logo/renkler Kulüp ve Makbuz'dan okunur (burada değiştirilmez). Tek Kaydet çubuğu; onKirli uyarısı.
import { useCallback, useEffect, useState } from "react";
import { Alan, Girdi, useToast, useDene, KaydetCubugu } from "../ui.jsx";
import { db, uygulama } from "../../lib/api.js";
import { girisKartiHtml, KART_KURAL_VARSAYILAN } from "../../lib/kartHtml.js";
import { qrSvg, code128Svg, kodMetni } from "../../lib/kartKod.js";
import { KART_AYAR_ANAHTARLARI } from "../../lib/kartVeri.js";
import { VARSAYILAN_KULUP } from "../../lib/marka.js";
import { VARSAYILAN_TEMA } from "../../lib/tema.js";

const ORNEK = {
  id: 123,
  ad_soyad: "Kaan Yıldız",
  yas_grubu_ad: "U11",
  dogum_tarihi: "2015-11-02",
  veli_ad: "Ayşe Yıldız",
  veli_tel: "05321112233",
};
// Bu bölümde düzenlenen anahtarlar (kulup_adi/kurulus_yili/tema salt okunur bağlam)
const ALANLAR = KART_AYAR_ANAHTARLARI.filter((k) => k.startsWith("kart_") || ["kulup_adres", "kulup_telefon", "kulup_web"].includes(k));
const bos = () => Object.fromEntries(ALANLAR.map((k) => [k, ""]));

export function GirisKartiAyar({ saltOkunur, admin, onKirli }) {
  const [a, setA] = useState(bos);
  const [ilk, setIlk] = useState(bos);
  const [baglam, setBaglam] = useState({ kulupAdi: "", kurulusYili: "", logo: "", tema: VARSAYILAN_TEMA });
  const [kod, setKod] = useState({ qrSvg: "", barkodSvg: "" });
  const toast = useToast();
  const dene = useDene();
  const kilitli = saltOkunur || !admin;

  const yukle = useCallback(async () => {
    const o = bos();
    for (const k of ALANLAR) o[k] = (await db("getSetting", k)) || "";
    const kulupAdi = (await db("getSetting", "kulup_adi")) || "";
    const kurulusYili = (await db("getSetting", "kurulus_yili")) || "";
    let m = null;
    try {
      m = await uygulama().marka();
    } catch {
      m = null;
    }
    setA(o);
    setIlk(o);
    setBaglam({ kulupAdi, kurulusYili, logo: m?.logo || "", tema: m?.tema || VARSAYILAN_TEMA });
  }, []);
  useEffect(() => {
    yukle().catch(() => {});
  }, [yukle]);
  const kirli = ALANLAR.some((k) => a[k] !== ilk[k]);
  useEffect(() => {
    onKirli?.(kirli);
  }, [kirli, onKirli]);

  const qr = a.kart_qr === "1";
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

  const kaydet = () =>
    dene(async () => {
      for (const k of ALANLAR) if (a[k] !== ilk[k]) await db("setSetting", k, a[k]);
      setIlk({ ...a });
      toast("ok", "Kaydedildi");
    });
  const vazgec = () => setA({ ...ilk });
  const girdi = (k, ek = {}) => <Girdi value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} disabled={kilitli} {...ek} />;

  const kurallar = [1, 2, 3, 4].map((i) => a[`kart_kural_${i}`] || KART_KURAL_VARSAYILAN[i - 1]);
  const html = girisKartiHtml({
    oyuncular: [{ ...ORNEK, ...kod }],
    ayar: {
      kulupAdi: baglam.kulupAdi || VARSAYILAN_KULUP,
      kurulusYili: baglam.kurulusYili,
      logo: baglam.logo,
      tema: baglam.tema,
      adres: a.kulup_adres,
      telefon: a.kulup_telefon,
      web: a.kulup_web,
      sezon: "2026-2027",
      kurallar,
    },
    duzen: "onizleme",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 22 }}>Giriş Kartı</h3>
        <div style={{ fontSize: 14, color: "var(--soluk)", marginTop: 4 }}>
          11 × 6 cm oyuncu giriş kartı: oyuncu kartından tek tek, Oyuncular ekranından toplu yazdırılır. Kulüp adı, logo, renkler ve sezon
          Kulüp ve Makbuz ayarlarından gelir.
        </div>
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
      {!kilitli && kirli && (
        <KaydetCubugu
          metin={`${ALANLAR.filter((k) => a[k] !== ilk[k]).length} değişiklik kaydedilmedi`}
          onVazgec={vazgec}
          onKaydet={kaydet}
        />
      )}
    </div>
  );
}
