// Ayarlar > Resim ve Belge Optimizasyonu
import { useState } from "react";
import { Btn, Rozet, useToast, useDene } from "../ui.jsx";
import { optimize } from "../../lib/api.js";
import { Ikon } from "../Ikon.jsx";

const KATEGORI_AD = {
  foto: "Vesikalık fotoğraf",
  saglik: "Sağlık raporu",
  sporcu_kimlik: "Sporcu kimlik",
  veli_kimlik: "Veli kimlik",
  kayit_formu: "Kayıt formu",
  makbuz: "Makbuz",
  diger: "Diğer",
};

const kb = (b) => `${Math.round((b || 0) / 1024).toLocaleString("tr-TR")} KB`;

// makina-crm'deki Resim Optimizasyonu: analiz et → optimize et; yalnız jpg/png, PDF'lere dokunmaz.

export function OptimizeAyar({ admin, saltOkunur }) {
  const [durum, setDurum] = useState(null); // analiz sonucu
  const [sonuc, setSonuc] = useState(null); // uygulama sonucu
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const dene = useDene();
  const analiz = async () => {
    setBekliyor(true);
    return dene(
      async () => {
        const r = await optimize().analiz();
        if (r.error) toast("err", r.error);
        else {
          setDurum(r);
          setSonuc(null);
        }
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  const uygula = async () => {
    setBekliyor(true);
    return dene(
      async () => {
        const r = await optimize().uygula();
        if (r.error) return toast("err", r.error);
        setSonuc(r);
        const yuzde = r.once > 0 ? Math.round((r.tasarruf / r.once) * 100) : 0;
        toast(
          "ok",
          r.adet === 0 ? "Optimize edilecek resim yok" : `${r.kucultulen} resim küçültüldü, ${kb(r.tasarruf)} tasarruf (%${yuzde})`,
        );
        const a = await optimize().analiz();
        if (!a.error) setDurum(a);
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  if (!admin) return <div style={{ color: "var(--soluk)" }}>Bu bölüm yalnız yöneticiler içindir.</div>;
  const yuzde = sonuc && sonuc.once > 0 ? Math.round((sonuc.tasarruf / sonuc.once) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h3 style={{ fontSize: 22 }}>Resim ve Belge Optimizasyonu</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Vesikalık ve belge fotoğraflarını (JPG/PNG) en fazla 2000 piksele küçültür ve yeniden sıkıştırır; yedekler küçülür, program
        hızlanır. Yeni yüklenen resimler zaten yükleme anında optimize edilir; bu araç eski dosyalara uygular. PDF ve Office belgelerine
        dokunulmaz, okunurluk korunur. Yalnız gerçekten küçülen dosyalar değiştirilir.
      </p>
      {durum && (
        <div
          style={{
            background: "var(--zemin)",
            border: "1px solid var(--cizgi)",
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {Object.entries(durum.resim.gruplar).map(([k, g]) => (
              <span key={k}>
                <span style={{ color: "var(--soluk)" }}>{KATEGORI_AD[k] || k}:</span> <b>{g.adet} resim</b>{" "}
                <span style={{ color: "var(--soluk)" }}>({kb(g.bayt)})</span>
              </span>
            ))}
            {durum.resim.adet === 0 && <span style={{ color: "var(--soluk)" }}>Optimize edilebilecek resim yok.</span>}
          </div>
          <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 8 }}>
            Resimler toplam <b>{kb(durum.resim.bayt)}</b> · PDF ve diğer belgeler {durum.diger.adet} dosya, {kb(durum.diger.bayt)}{" "}
            (dokunulmaz)
          </div>
          {sonuc && sonuc.adet > 0 && (
            <div>
              <span style={{ color: "var(--soluk)" }}>{kb(sonuc.once)}</span> → <b style={{ color: "var(--yesil)" }}>{kb(sonuc.sonra)}</b>{" "}
              <Rozet ton="green">
                {kb(sonuc.tasarruf)} tasarruf (%{yuzde})
              </Rozet>
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn tur="ghost" onClick={analiz} disabled={bekliyor}>
          Analiz Et
        </Btn>
        {!saltOkunur && (
          <Btn ikon={<Ikon ad="dosya" />} onClick={uygula} disabled={bekliyor}>
            {bekliyor ? "Çalışıyor…" : sonuc ? "Tekrar Optimize Et" : "Optimize Et"}
          </Btn>
        )}
      </div>
    </div>
  );
}
