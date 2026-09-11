// Ayarlar > Kulüp ve Makbuz (plan §32.6): kimlik (ad, kısa ad, alt yazı, kuruluş yılı, tahsil eden), kulüp logosu, renkler.
// Logo seçimi dosya yazdığı için anında uygulanır; diğer alanlar tek Kaydet ile (satır başına kaydet yok; onKirli uyarısı).
import { useCallback, useEffect, useState } from "react";
import { Btn, Alan, Girdi, useToast, useDene, KaydetCubugu } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { db, files, uygulama } from "../../lib/api.js";
import { VARSAYILAN_TEMA } from "../../lib/tema.js";
import { VARSAYILAN_KULUP } from "../../lib/marka.js";
import { TemaSecici } from "./TemaSecici.jsx";

const ALANLAR = ["kulup_adi", "kulup_kisa_ad", "kulup_alt_yazi", "kurulus_yili", "tahsil_eden", "tema_ana", "tema_vurgu"];
const bos = () => Object.fromEntries(ALANLAR.map((k) => [k, ""]));

export function KulupAyar({ saltOkunur, admin, onKirli, onMarkaDegisti }) {
  const [a, setA] = useState(bos);
  const [ilk, setIlk] = useState(bos);
  const [logo, setLogo] = useState(""); // data URL (marka kanalından)
  const toast = useToast();
  const dene = useDene();
  const kilitli = saltOkunur || !admin;

  // Yalnız logoyu yeniler; form alanlarına DOKUNMAZ (Kerem, 10.09.2026: logo seçince girilen alanlar siliniyordu)
  const logoYenile = useCallback(async () => {
    try {
      const m = await uygulama().marka();
      setLogo(m?.logo || "");
    } catch {
      setLogo("");
    }
  }, []);
  const yukle = useCallback(async () => {
    const o = bos();
    for (const k of ALANLAR) o[k] = (await db("getSetting", k)) || "";
    setA(o);
    setIlk(o);
    await logoYenile();
  }, [logoYenile]);
  useEffect(() => {
    yukle().catch(() => {});
  }, [yukle]);
  const kirli = ALANLAR.some((k) => a[k] !== ilk[k]);
  useEffect(() => {
    onKirli?.(kirli);
  }, [kirli, onKirli]);

  const tema = { ana: a.tema_ana || VARSAYILAN_TEMA.ana, vurgu: a.tema_vurgu || VARSAYILAN_TEMA.vurgu };
  const temaDegis = (t) => setA({ ...a, tema_ana: t.ana, tema_vurgu: t.vurgu });
  const kaydet = () =>
    dene(async () => {
      for (const k of ALANLAR) if (a[k] !== ilk[k]) await db("setSetting", k, a[k]);
      setIlk({ ...a });
      toast("ok", "Kaydedildi");
      onMarkaDegisti?.();
    });
  const vazgec = () => setA({ ...ilk });
  const logoSec = () =>
    dene(async () => {
      const r = await files().kulupLogoSec();
      if (r?.iptal) return;
      if (r?.error) throw new Error(r.error);
      toast("ok", "Logo kaydedildi");
      await logoYenile(); // girilmiş ama kaydedilmemiş alanlar korunur
      onMarkaDegisti?.();
    });
  const logoKaldir = () =>
    dene(async () => {
      const r = await files().kulupLogoSil();
      if (r?.error) throw new Error(r.error);
      toast("ok", "Logo kaldırıldı");
      await logoYenile();
      onMarkaDegisti?.();
    });
  const kisaAd = (a.kulup_kisa_ad || a.kulup_adi || VARSAYILAN_KULUP).toLocaleUpperCase("tr-TR");
  const girdi = (k, ek = {}) => <Girdi value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} disabled={kilitli} {...ek} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 22 }}>Kulüp ve Makbuz</h3>
        <div style={{ fontSize: 14, color: "var(--soluk)", marginTop: 4 }}>
          Kulübün adı, logosu ve renkleri; giriş ekranında, kenar menüde, makbuz ve formlarda kullanılır.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Alan etiket="Kulüp adı (makbuz ve raporlarda)">
            {girdi("kulup_adi", { placeholder: "Kulübünüzün adı", "aria-label": "Kulüp adı" })}
          </Alan>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
            <Alan etiket="Kısa ad (giriş ekranı ve menü)">
              {girdi("kulup_kisa_ad", { placeholder: a.kulup_adi || VARSAYILAN_KULUP, "aria-label": "Kısa ad" })}
            </Alan>
            <Alan etiket="Kuruluş yılı">
              {girdi("kurulus_yili", { placeholder: "—", "aria-label": "Kuruluş yılı", maxLength: 4, inputMode: "numeric" })}
            </Alan>
          </div>
          <Alan etiket="Menü alt yazısı">{girdi("kulup_alt_yazi", { placeholder: "Futbol Okulu", "aria-label": "Menü alt yazısı" })}</Alan>
          <Alan etiket="Varsayılan tahsil eden (makbuzda; boşsa giriş yapan kullanıcı)">
            {girdi("tahsil_eden", { "aria-label": "Tahsil eden" })}
          </Alan>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Kulüp logosu
            </span>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 112,
                  height: 112,
                  border: "1px solid var(--cizgi)",
                  borderRadius: 12,
                  background: "repeating-conic-gradient(var(--zemin) 0 25%, #fff 0 50%) 0 0/16px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {logo ? (
                  <img src={logo} alt="Kulüp logosu" style={{ maxWidth: 92, maxHeight: 92, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, color: "var(--soluk)" }}>Logo yok</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!kilitli && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={logoSec} ikon={<Ikon ad="yukle" />}>
                      Logo Seç…
                    </Btn>
                    {logo && (
                      <Btn tur="danger" onClick={logoKaldir}>
                        Kaldır
                      </Btn>
                    )}
                  </div>
                )}
                <span style={{ fontSize: 13, color: "var(--soluk)", lineHeight: 1.45, maxWidth: 340 }}>
                  PNG önerilir (şeffaf zemin), JPEG de olur. 512 px'e küçültülür; makbuz ve formlarda 28 mm yükseklikte basılır. Logo yoksa
                  belgelerde yalnız kulüp adı yazılır.
                </span>
              </div>
            </div>
          </div>
        </div>
        <TemaSecici tema={tema} onDegis={temaDegis} logo={logo} kisaAd={kisaAd} disabled={kilitli} />
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
