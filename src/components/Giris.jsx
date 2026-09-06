import { useState } from "react";
import { Btn, Alan, girisStili } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";

export function Giris({ onGiris, mod, onModDegisti }) {
  const [baglanAcik, setBaglanAcik] = useState(false);
  const [url, setUrl] = useState("");
  const [fp, setFp] = useState(null);
  const [bilgi, setBilgi] = useState("");
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
          <Alan etiket="Kullanıcı adı"><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}><Ikon ad="kullanici" /></span><input style={{ ...girisStili, paddingLeft: 40 }} value={kullanici} onChange={(e) => setKullanici(e.target.value)} autoFocus /></div></Alan>
          <Alan etiket="Parola"><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}><Ikon ad="kilit" /></span><input style={{ ...girisStili, paddingLeft: 40 }} type="password" value={parola} onChange={(e) => setParola(e.target.value)} /></div></Alan>
          {hata && <div role="alert" style={{ color: "var(--kirmizi)", fontSize: 14, fontWeight: 600 }}>{hata}</div>}
          <Btn type="submit" disabled={bekliyor} style={{ height: 48, justifyContent: "center", fontSize: 16 }}>Giriş Yap</Btn>
          <span style={{ color: "var(--soluk)", fontSize: 13, textAlign: "center" }}>
            {mod?.mode === "istemci" ? <>Sunucuya bağlı: <b>{mod.serverUrl}</b> · sunucudaki hesabınızla girin</> : "Parolanızı unuttuysanız yöneticiye başvurun."}
          </span>
          {mod && mod.mode !== "sunucu" && !baglanAcik && <button type="button" onClick={() => setBaglanAcik(true)} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>{mod.mode === "istemci" ? "Sunucu adresini değiştir" : "Başka bilgisayardaki sunucuya bağlan"}</button>}
          {baglanAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--cizgi)", paddingTop: 12 }}>
              <Alan etiket="Sunucu adresi"><input style={girisStili} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://100.x.x.x:3535" /></Alan>
              {fp && <div style={{ fontSize: 12, color: "var(--soluk)" }}>Sunucu parmak izi: <b style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{fp}</b> — sunucudaki Ayarlar &gt; Sunucu ekranıyla aynıysa onaylayın.</div>}
              {bilgi && <div style={{ fontSize: 13, color: "var(--kirmizi)", fontWeight: 600 }}>{bilgi}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn tur="ghost" onClick={() => { setBaglanAcik(false); setFp(null); setBilgi(""); }}>Vazgeç</Btn>
                <Btn onClick={async () => {
                  setBilgi("");
                  const r = await window.okul.mod.istemciBaglan(url.trim(), fp ? { trust: true, force: true } : {});
                  if (r.error) setBilgi(r.error);
                  else if (r.needTrust || r.mismatch) { setFp(r.fp); if (r.mismatch) setBilgi("Sunucu sertifikası daha önce kaydedilenden farklı. Emin değilseniz onaylamayın."); }
                  else { setBaglanAcik(false); setFp(null); onModDegisti?.("istemci"); }
                }}>{fp ? "Onayla ve Bağlan" : "Bağlan"}</Btn>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
