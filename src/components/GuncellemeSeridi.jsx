import { useEffect, useState } from "react";
import { guncelleme, hataMetni } from "../lib/api.js";
import { Ikon } from "./Ikon.jsx";

// Uygulama güncelleme şeridi: içerik sütununun (main) EN ÜSTÜNDE, sayfa başlığının üzerinde; kenar menüyü etkilemez ve içerikle
// kaydırılmaz. Açılış denetimi yeni sürüm bulunca (updater:available) yöneticiye görünür; buradan İndir → ilerleme → Yeniden Başlat ve Kur.
// Kullanıcı rolüne gösterilmez (kuramaz). "Kapat" yalnız bu oturum için gizler. Ayarlar > Hakkında'daki Guncelleme aynı olayları dinler.
export function GuncellemeSeridi({ oturum, onHakkinda }) {
  const [durum, setDurum] = useState({ asama: "yok" }); // yok|var|indiriliyor|indirildi|hata
  const [yuzde, setYuzde] = useState(0);
  const [kapali, setKapali] = useState(false);
  const g = guncelleme();
  useEffect(() => {
    if (!g?.on) return undefined;
    const kapat = [
      g.on("available", (i) =>
        setDurum((d) => (d.asama === "indiriliyor" || d.asama === "indirildi" ? d : { asama: "var", surum: i?.version || "" })),
      ),
      g.on("progress", (p) => {
        setYuzde(Number(p) || 0);
        setDurum((d) => ({ ...d, asama: "indiriliyor" }));
      }),
      g.on("downloaded", (i) => setDurum((d) => ({ asama: "indirildi", surum: i?.version || d.surum }))),
      g.on("error", (m) => setDurum((d) => (d.asama === "yok" ? d : { ...d, asama: "hata", mesaj: String(m || "Bilinmeyen hata") }))),
    ];
    return () =>
      kapat.forEach((k) => {
        try {
          k?.();
        } catch {
          /* yoksay */
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g || kapali || durum.asama === "yok" || oturum?.role !== "admin") return null;

  const indir = async () => {
    setYuzde(0);
    setDurum((d) => ({ ...d, asama: "indiriliyor" }));
    try {
      const r = await g.download();
      if (r?.error) setDurum((d) => ({ ...d, asama: "hata", mesaj: r.error }));
    } catch (e) {
      setDurum((d) => ({ ...d, asama: "hata", mesaj: hataMetni(e) }));
    }
  };
  const kur = async () => {
    try {
      const r = await g.install();
      if (r?.error) setDurum((d) => ({ ...d, asama: "hata", mesaj: r.error }));
    } catch (e) {
      setDurum((d) => ({ ...d, asama: "hata", mesaj: hataMetni(e) }));
    }
  };
  const hata = durum.asama === "hata";
  const dugme = {
    height: 30,
    padding: "0 14px",
    borderRadius: 8,
    border: 0,
    background: "var(--sari)",
    color: "var(--mor-koyu)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };
  const baglanti = {
    background: "none",
    border: 0,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    padding: 0,
  };
  return (
    <div
      role="status"
      data-testid="guncelleme-seridi"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "8px 32px",
        background: hata ? "var(--kirmizi)" : "var(--mor-koyu)",
        color: "#fff",
        fontSize: 13.5,
        borderBottom: "1px solid rgba(255,255,255,.15)",
      }}
    >
      <Ikon ad={hata ? "uyari" : "indir"} boyut={18} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {durum.asama === "var" && (
          <>
            <b>Yeni sürüm {durum.surum} hazır.</b> Kurulum sırasında program kapanıp yeniden açılır, veriler yerinde kalır.
          </>
        )}
        {durum.asama === "indiriliyor" && (
          <>
            <b>Yeni sürüm {durum.surum} indiriliyor…</b> %{yuzde}
          </>
        )}
        {durum.asama === "indirildi" && (
          <>
            <b>Yeni sürüm {durum.surum} indirildi.</b> Kurmak için programı yeniden başlatın.
          </>
        )}
        {hata && (
          <>
            <b>Güncelleme başarısız:</b> {durum.mesaj}
          </>
        )}
      </span>
      {durum.asama === "indiriliyor" && (
        <div aria-hidden="true" style={{ width: 140, height: 6, borderRadius: 3, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, yuzde)}%`, height: "100%", background: "var(--sari)", transition: "width .2s" }} />
        </div>
      )}
      {(durum.asama === "var" || hata) && (
        <button type="button" onClick={indir} style={dugme}>
          {hata ? "Yeniden Dene" : "İndir"}
        </button>
      )}
      {durum.asama === "indirildi" && (
        <button type="button" onClick={kur} style={dugme}>
          Yeniden Başlat ve Kur
        </button>
      )}
      {onHakkinda && (
        <button type="button" onClick={onHakkinda} style={baglanti}>
          Hakkında
        </button>
      )}
      <button
        type="button"
        onClick={() => setKapali(true)}
        aria-label="Güncelleme şeridini kapat"
        title="Bu oturumda gizle"
        style={{ background: "none", border: 0, color: "#fff", cursor: "pointer", display: "flex", padding: 2 }}
      >
        <Ikon ad="kapat" boyut={18} />
      </button>
    </div>
  );
}
