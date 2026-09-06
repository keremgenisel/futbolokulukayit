import { useState } from "react";
import { Btn, Alan, girisStili } from "./ui.jsx";

export function Giris({ onGiris }) {
  const [kullanici, setKullanici] = useState("");
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);

  const gonder = async (e) => {
    e.preventDefault();
    setBekliyor(true); setHata("");
    const r = await window.okul.auth.login(kullanici.trim(), parola);
    setBekliyor(false);
    if (!r.ok) { setHata(r.error || "Giriş başarısız"); return; }
    onGiris(r.user);
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: "42%", background: "var(--mor)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="./logo.png" alt="Eyüpspor" style={{ width: 56, height: 56, objectFit: "contain" }} />
          <span className="baslik" style={{ color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: ".06em" }}>EYÜPSPOR</span>
        </div>
        <div>
          <h1 style={{ color: "#fff", fontSize: 56, lineHeight: .95 }}>Futbol Okulu<br />Kayıt Programı</h1>
          <p style={{ color: "#D8CCE9", fontSize: 18, maxWidth: 420 }}>Oyuncu kayıtları, aylık aidat takibi, makbuz ve yoklama tek ekranda.</p>
        </div>
        <span style={{ color: "var(--sari)", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>Kuruluş 1919</span>
      </div>
      <form onSubmit={gonder} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 34 }}>Giriş Yap</h2>
            <p style={{ color: "var(--soluk)", margin: "4px 0 0" }}>Kullanıcı adı ve parolanızla devam edin.</p>
          </div>
          <Alan etiket="Kullanıcı adı"><input style={girisStili} value={kullanici} onChange={(e) => setKullanici(e.target.value)} autoFocus /></Alan>
          <Alan etiket="Parola"><input style={girisStili} type="password" value={parola} onChange={(e) => setParola(e.target.value)} /></Alan>
          {hata && <div role="alert" style={{ color: "var(--kirmizi)", fontSize: 14, fontWeight: 600 }}>{hata}</div>}
          <Btn type="submit" disabled={bekliyor} style={{ height: 48, justifyContent: "center", fontSize: 16 }}>Giriş Yap</Btn>
        </div>
      </form>
    </div>
  );
}
