import { useEffect, useState, useCallback } from "react";
import { Giris } from "./components/Giris.jsx";
import { ParolaDegistir } from "./components/ParolaDegistir.jsx";
import { Pano } from "./components/Pano.jsx";
import { Oyuncular } from "./components/Oyuncular.jsx";
import { YasGruplari } from "./components/YasGruplari.jsx";
import { Tahsilat } from "./components/Tahsilat.jsx";
import { Yoklama } from "./components/Yoklama.jsx";
import { Raporlar } from "./components/Raporlar.jsx";
import { Ayarlar } from "./components/Ayarlar.jsx";
import { ToastSaglayici } from "./components/ui.jsx";
import { KenarMenu } from "./components/KenarMenu.jsx";
import { SifresizUyari } from "./components/SifresizUyari.jsx";
import { IlkKurulum } from "./components/IlkKurulum.jsx";
import { HizliArama } from "./components/HizliArama.jsx";
import { tarihTR } from "./lib/aidat.js";
import { bugun, guncelleme } from "./lib/api.js";

// Yönlendirici yok: sekme bir string, TABS'a göre koşullu render.
export const TABS = [
  { kod: "pano", ad: "Pano" }, { kod: "oyuncular", ad: "Oyuncular" }, { kod: "gruplar", ad: "Yaş Grupları" },
  { kod: "tahsilat", ad: "Tahsilat" }, { kod: "yoklama", ad: "Yoklama" }, { kod: "raporlar", ad: "Raporlar" }, { kod: "ayarlar", ad: "Ayarlar" },
];

export function App() {
  const [oturum, setOturum] = useState(null);
  const [hazir, setHazir] = useState(false);
  const [tab, setTab] = useState("pano");
  const [lisans, setLisans] = useState(null);
  const [tahsilatOyuncu, setTahsilatOyuncu] = useState(null); // Tahsilat'a önceden seçili oyuncu
  const [acilacakOyuncu, setAcilacakOyuncu] = useState(null); // Oyuncular'da açılacak kart
  const [sekmeKey, setSekmeKey] = useState(0); // aynı sekmeye tekrar geçişte ekranı tazelemek için
  const [mod, setMod] = useState(null); // { mode, serverUrl, sunucu }
  const [arama, setArama] = useState(false); // Ctrl/Cmd+K hızlı oyuncu arama
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setArama((a) => !a); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [kurulum, setKurulum] = useState(false); // ilk kurulum sihirbazı (ilk parola değişiminden sonra, oyuncu yokken)
  const kurulumGerekliMi = useCallback(async () => {
    try {
      if (!oturum || oturum.role !== "admin" || oturum.must_change_password) return false;
      if (await window.okul.db("getSetting", "kurulum_tamam")) return false;
      return (await window.okul.db("playersPage", { yil: bugun().yil, ay: bugun().ay, sayfaBoyu: 1 })).toplam === 0;
    } catch { return false; }
  }, [oturum]);
  useEffect(() => { kurulumGerekliMi().then((g) => g && setKurulum(true)); }, [kurulumGerekliMi]);
  const [ayarBolum, setAyarBolum] = useState(null); // Ayarlar'a belirli bölümle gitmek için
  const [yeniSurum, setYeniSurum] = useState(null); // açılış denetimi yeni sürüm bulursa (paketli sürüm; yöneticiye şerit)
  useEffect(() => { const g = guncelleme(); if (!g?.on) return undefined; return g.on("available", (i) => setYeniSurum(i?.version || "yeni")); }, []);
  const modYenile = useCallback(() => { window.okul?.mod?.oku().then(setMod).catch(() => {}); }, []);

  const lisansYenile = useCallback(() => { window.okul?.lisans.durum().then((r) => { if (r?.ok) setLisans(r.durum); }).catch(() => {}); }, []);

  useEffect(() => {
    window.okul?.auth.session().then((s) => { setOturum(s); setHazir(true); }).catch(() => setHazir(true));
  }, []);
  useEffect(() => { if (oturum) lisansYenile(); }, [oturum, lisansYenile]);
  useEffect(() => { modYenile(); }, [oturum, modYenile]);
  // Mod değişince (istemciye bağlandı / yerele döndü) oturum düşer, giriş ekranına dönülür.
  const modDegisti = (yeniMod) => { modYenile(); if (yeniMod === "istemci" || yeniMod === "yerel") { setOturum(null); setTab("pano"); } };
  // Lisans yenileme kalbi: açılışta + 12 saatte bir (aktivasyon ayarlı değilse sunucuda no-op).
  useEffect(() => {
    if (!oturum || !window.okul?.lisans?.yenile) return;
    const kalp = () => window.okul.lisans.yenile().then((r) => { if (r?.ok && r.durum) setLisans(r.durum); }).catch(() => {});
    kalp();
    const t = setInterval(kalp, 12 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [oturum]);

  const saltOkunur = lisans?.mod === "saltOkunur";
  const git = (kod, param) => {
    setTab(kod); setSekmeKey((k) => k + 1);
    if (kod === "oyuncular" && param === "yeni") setAcilacakOyuncu("yeni");
  };
  const oyuncuAc = (id) => { setTab("oyuncular"); setAcilacakOyuncu(id); };
  const makbuzKes = (id) => { setTahsilatOyuncu(id); setTab("tahsilat"); setSekmeKey((k) => k + 1); };

  if (!hazir) return null;
  if (!oturum) return <ToastSaglayici><Giris onGiris={setOturum} mod={mod} onModDegisti={modDegisti} /></ToastSaglayici>;

  return (
    <ToastSaglayici>
    <div style={{ display: "flex", height: "100%" }}>
      <KenarMenu sekmeler={oturum.role === "admin" ? TABS : TABS.filter((t) => t.kod !== "ayarlar")} tab={tab} onSec={git} oturum={oturum} mod={mod} onAra={() => setArama(true)} onCikis={async () => { await window.okul.auth.logout(); setOturum(null); setTab("pano"); }} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "22px 32px 16px", borderBottom: "1px solid var(--cizgi)", background: "#fff" }}>
          <h1 style={{ fontSize: 30 }}>{TABS.find((t) => t.kod === tab)?.ad}</h1>
        </header>
        <section style={{ padding: 24, flex: 1, overflow: "auto" }}>
          <SifresizUyari oturum={oturum} />
          {saltOkunur && (
            <div role="alert" style={{ background: "var(--kirmizi-acik)", border: "1.5px solid var(--kirmizi)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "var(--kirmizi)" }}>{lisans.neden === "denemeBitti" ? "Deneme süresi doldu — salt okunur mod" : "Lisans geçerli değil — salt okunur mod"}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Verileriniz güvende; görüntüleme ve dışa aktarma açık, değişiklik kapalı. Ayarlar &gt; Lisans'tan anahtar girince kilit kalkar.</div>
            </div>
          )}
          {yeniSurum && oturum.role === "admin" && tab !== "ayarlar" && (
            <div role="status" style={{ background: "var(--mor-acik)", border: "1.5px solid var(--mor)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13.5, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1 }}><b>Yeni sürüm {yeniSurum} hazır.</b> Kurmak için Ayarlar &gt; Hakkında bölümünden İndir ve Kur deyin.</span>
              <button type="button" onClick={() => { setTab("ayarlar"); setAyarBolum("hakkinda"); setSekmeKey((k) => k + 1); }} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Hakkında'ya git</button>
            </div>
          )}
          {!saltOkunur && lisans?.mod === "deneme" && (
            <div style={{ background: "var(--sari-acik)", border: "1.5px solid var(--sari)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13.5 }}><b>Deneme sürümü</b> — {lisans.kalanGun} gün kaldı. Lisans anahtarınızı Ayarlar &gt; Lisans'tan girebilirsiniz.</div>
          )}
          {!saltOkunur && lisans?.mod === "lisansli" && lisans.kalanGun != null && lisans.kalanGun <= 30 && (
            <div style={{ background: "var(--sari-acik)", border: "1.5px solid var(--sari)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13.5 }}>Lisansınızın bitmesine <b>{lisans.kalanGun} gün</b> kaldı ({tarihTR(lisans.bitis)}). Yenileme anahtarınızı hazırlayın.</div>
          )}
          {tab === "pano" && <Pano key={sekmeKey} onOyuncu={oyuncuAc} onSekme={git} onMakbuzKes={makbuzKes} saltOkunur={saltOkunur} onSezon={() => { setTab("ayarlar"); setAyarBolum("sezon"); setSekmeKey((k) => k + 1); }} />}
          {tab === "oyuncular" && <Oyuncular key={sekmeKey} oturum={oturum} saltOkunur={saltOkunur} onMakbuzKes={makbuzKes} acilacakOyuncu={acilacakOyuncu} onAcildi={() => setAcilacakOyuncu(null)} />}
          {tab === "gruplar" && <YasGruplari key={sekmeKey} saltOkunur={saltOkunur} />}
          {tab === "tahsilat" && <Tahsilat key={sekmeKey} oturum={oturum} saltOkunur={saltOkunur} onOyuncu={oyuncuAc} secilenOyuncuId={tahsilatOyuncu} onSecildi={() => setTahsilatOyuncu(null)} />}
          {tab === "yoklama" && <Yoklama key={sekmeKey} saltOkunur={saltOkunur} />}
          {tab === "raporlar" && <Raporlar key={sekmeKey} />}
          {tab === "ayarlar" && oturum.role === "admin" && <Ayarlar key={sekmeKey} oturum={oturum} saltOkunur={saltOkunur} onLisansDegisti={lisansYenile} onModDegisti={modDegisti} baslangicBolum={ayarBolum} onKurulumAc={() => setKurulum(true)} />}
        </section>
      </main>
      {oturum.must_change_password && <ParolaDegistir oturum={oturum} zorunlu onTamam={() => setOturum({ ...oturum, must_change_password: false })} />}
      <HizliArama acik={arama} onKapat={() => setArama(false)} onOyuncu={oyuncuAc} onMakbuz={makbuzKes} saltOkunur={saltOkunur} />
      {kurulum && !oturum.must_change_password && <IlkKurulum oturum={oturum} onBitti={() => { setKurulum(false); setTab("pano"); setSekmeKey((k) => k + 1); }} onAktar={() => { setTab("oyuncular"); setAcilacakOyuncu("aktar"); }} />}
    </div>
    </ToastSaglayici>
  );
}
