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
import { tarihTR } from "./lib/aidat.js";

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
  const [kurtarmaHatirlat, setKurtarmaHatirlat] = useState(false); // ilk parola değişiminden sonra
  const [ayarBolum, setAyarBolum] = useState(null); // Ayarlar'a belirli bölümle gitmek için
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
      <KenarMenu sekmeler={TABS} tab={tab} onSec={git} oturum={oturum} mod={mod} onCikis={async () => { await window.okul.auth.logout(); setOturum(null); setTab("pano"); }} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "22px 32px 16px", borderBottom: "1px solid var(--cizgi)", background: "#fff" }}>
          <h1 style={{ fontSize: 30 }}>{TABS.find((t) => t.kod === tab)?.ad}</h1>
        </header>
        <section style={{ padding: 24, flex: 1, overflow: "auto" }}>
          {saltOkunur && (
            <div role="alert" style={{ background: "var(--kirmizi-acik)", border: "1.5px solid var(--kirmizi)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "var(--kirmizi)" }}>{lisans.neden === "denemeBitti" ? "Deneme süresi doldu — salt okunur mod" : "Lisans geçerli değil — salt okunur mod"}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Verileriniz güvende; görüntüleme ve dışa aktarma açık, değişiklik kapalı. Ayarlar &gt; Lisans'tan anahtar girince kilit kalkar.</div>
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
          {tab === "ayarlar" && <Ayarlar key={sekmeKey} oturum={oturum} saltOkunur={saltOkunur} onLisansDegisti={lisansYenile} onModDegisti={modDegisti} baslangicBolum={ayarBolum} />}
        </section>
      </main>
      {oturum.must_change_password && <ParolaDegistir oturum={oturum} zorunlu onTamam={() => { setOturum({ ...oturum, must_change_password: false }); setKurtarmaHatirlat(true); }} />}
      {kurtarmaHatirlat && (
        <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 50, background: "#fff", border: "1.5px solid var(--sari)", borderRadius: 12, padding: "14px 16px", maxWidth: 420, boxShadow: "0 8px 30px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Kurtarma kodlarınızı üretin</b>
          <span style={{ fontSize: 14 }}>Parolanızı unutursanız bu kodlarla sıfırlarsınız. Ayarlar &gt; Kullanıcılar &gt; Hesabım.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => { setKurtarmaHatirlat(false); setTab("ayarlar"); setAyarBolum("kullanici"); }} style={{ background: "var(--mor)", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}>Şimdi üret</button>
            <button type="button" onClick={() => setKurtarmaHatirlat(false)} style={{ background: "none", border: "1px solid var(--cizgi)", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Sonra</button>
          </div>
        </div>
      )}
    </div>
    </ToastSaglayici>
  );
}
