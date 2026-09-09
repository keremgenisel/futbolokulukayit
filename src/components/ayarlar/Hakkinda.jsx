// Ayarlar > Hakkında (sürüm, güncelleme)
import { useEffect, useState } from "react";
import { Btn, Rozet } from "../ui.jsx";
import { uygulama, guncelleme, hataMetni } from "../../lib/api.js";
import { Ikon } from "../Ikon.jsx";

export function Hakkinda({ admin }) {
  const [v, setV] = useState("");
  useEffect(() => {
    uygulama()
      .version()
      .then(setV)
      .catch(() => {});
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Futbol Okulu Kayıt Programı</h3>
      <div style={{ color: "var(--soluk)" }}>Sürüm {v || "—"}</div>
      <div style={{ color: "var(--soluk)", fontSize: 14 }}>
        Oyuncu kayıt, aylık aidat, tahsilat makbuzu ve antrenman yoklaması. Veritabanı şifreli olarak bu bilgisayarda saklanır.
      </div>
      <div style={{ color: "var(--soluk)", fontSize: 14 }}>Geliştirici: Kerem Genişel</div>
      <Guncelleme admin={admin} />
    </div>
  );
}

// Uygulama güncellemesi (GitHub Releases: keremgenisel/eyupspor, herkese açık tek depo). Akış: Denetle → "Yeni sürüm X" → İndir (ilerleme)

// → Yeniden Başlat ve Kur. Yalnız paketli (Setup ile kurulmuş) sürümde çalışır; geliştirme modunda bilgi verir.

export function Guncelleme({ admin }) {
  const [durum, setDurum] = useState({ asama: "bos" }); // bos|denetleniyor|guncel|var|indiriliyor|indirildi|hata|dev
  const [yuzde, setYuzde] = useState(0);
  const g = guncelleme();
  useEffect(() => {
    if (!g?.on) return undefined;
    const kapat = [
      g.on("available", (i) =>
        setDurum((d) => (d.asama === "indiriliyor" || d.asama === "indirildi" ? d : { asama: "var", latest: i?.version })),
      ),
      g.on("progress", (p) => {
        setYuzde(Number(p) || 0);
        setDurum((d) => ({ ...d, asama: "indiriliyor" }));
      }),
      g.on("downloaded", (i) => setDurum({ asama: "indirildi", latest: i?.version })),
      g.on("error", (m) => setDurum({ asama: "hata", mesaj: String(m || "Bilinmeyen hata") })),
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
  if (!g) return null;
  const denetle = async () => {
    setDurum({ asama: "denetleniyor" });
    try {
      const r = await g.check();
      if (r?.devMode) return setDurum({ asama: "dev", current: r.current });
      if (r?.error) return setDurum({ asama: "hata", mesaj: r.error });
      setDurum(r.available ? { asama: "var", latest: r.latest, notlar: r.notlar } : { asama: "guncel", current: r.current });
    } catch (e) {
      setDurum({ asama: "hata", mesaj: hataMetni(e) });
    }
  };
  const indir = async () => {
    setYuzde(0);
    setDurum((d) => ({ ...d, asama: "indiriliyor" }));
    const r = await g.download();
    if (r?.error) setDurum({ asama: "hata", mesaj: r.error });
  };
  const kur = async () => {
    const r = await g.install();
    if (r?.error) setDurum({ asama: "hata", mesaj: r.error });
  };
  return (
    <div
      data-testid="guncelleme"
      style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 14, marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>Uygulama güncellemesi</div>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Yeni sürümler internetten kendiliğinden bulunur; kurulum yöneticinin onayıyla yapılır. Kurulum sırasında program kapanıp yeniden
        açılır, veriler yerinde kalır.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {durum.asama === "bos" && (
          <Btn tur="ghost" onClick={denetle}>
            Güncelleme Denetle
          </Btn>
        )}
        {durum.asama === "denetleniyor" && <span style={{ color: "var(--soluk)" }}>Denetleniyor…</span>}
        {durum.asama === "dev" && (
          <span role="status" style={{ color: "var(--soluk)" }}>
            Geliştirme modunda güncelleme denetlenmez (yalnız Setup ile kurulmuş sürümde).
          </span>
        )}
        {durum.asama === "guncel" && (
          <>
            <Rozet ton="green">Güncel</Rozet>
            <span style={{ color: "var(--soluk)", fontSize: 14 }}>Sürüm {durum.current} en yeni sürüm.</span>
            <Btn kucuk tur="ghost" onClick={denetle}>
              Yeniden denetle
            </Btn>
          </>
        )}
        {durum.asama === "var" && (
          <>
            <Rozet ton="yellow">Yeni sürüm {durum.latest}</Rozet>
            {admin ? (
              <Btn ikon={<Ikon ad="indir" />} onClick={indir}>
                İndir
              </Btn>
            ) : (
              <span style={{ color: "var(--soluk)", fontSize: 14 }}>Kurulum için yönetici girişi gerekir.</span>
            )}
          </>
        )}
        {durum.asama === "indiriliyor" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 320 }}>
            <div style={{ flex: 1, height: 10, borderRadius: 999, background: "var(--cizgi)", overflow: "hidden" }}>
              <div style={{ width: `${yuzde}%`, height: "100%", background: "var(--mor)", transition: "width .2s" }} />
            </div>
            <span role="status" style={{ fontSize: 14, minWidth: 44 }}>
              %{yuzde}
            </span>
          </div>
        )}
        {durum.asama === "indirildi" && (
          <>
            <Rozet ton="green">İndirildi{durum.latest ? ` · ${durum.latest}` : ""}</Rozet>
            {admin && <Btn onClick={kur}>Yeniden Başlat ve Kur</Btn>}
          </>
        )}
        {durum.asama === "hata" && (
          <>
            <span role="alert" style={{ color: "var(--kirmizi)", fontWeight: 600, fontSize: 14 }}>
              {durum.mesaj}
            </span>
            <Btn kucuk tur="ghost" onClick={denetle}>
              Tekrar dene
            </Btn>
          </>
        )}
      </div>
      {durum.asama === "var" && durum.notlar && (
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            fontSize: 13,
            color: "var(--soluk)",
            background: "var(--zemin)",
            padding: "10px 12px",
            borderRadius: 8,
          }}
        >
          {durum.notlar}
        </pre>
      )}
    </div>
  );
}
