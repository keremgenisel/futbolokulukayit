import { useState } from "react";
import { Btn, Alan, girisStili } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { COKLU_PC_ACIK } from "../lib/ozellikler.js";

// Son başarılı giriş yapan kullanıcı adı (parola asla saklanmaz).
const SON_KULLANICI = "sonKullanici";
function sonKullaniciOku() { try { return localStorage.getItem(SON_KULLANICI) || ""; } catch { return ""; } }
function sonKullaniciYaz(ad) { try { localStorage.setItem(SON_KULLANICI, ad); } catch { /* özel pencere vb. */ } }

export function Giris({ onGiris, mod, onModDegisti }) {
  const [baglanAcik, setBaglanAcik] = useState(false);
  const [url, setUrl] = useState("");
  const [fp, setFp] = useState(null);
  const [bilgi, setBilgi] = useState("");
  const [kullanici, setKullanici] = useState(sonKullaniciOku);
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [kurtarma, setKurtarma] = useState(false); // "Parolamı unuttum" paneli
  const [k, setK] = useState({ kullanici: "", kod: "", p1: "", p2: "" });
  const [kMesaj, setKMesaj] = useState({ tur: "", metin: "" });

  const gonder = async (e) => {
    e.preventDefault();
    setBekliyor(true); setHata("");
    const ad = kullanici.trim();
    const r = await window.okul.auth.login(ad, parola);
    setBekliyor(false);
    if (!r.ok) { setHata(r.error || "Giriş başarısız"); return; }
    sonKullaniciYaz(ad);
    onGiris(r.user);
  };

  const kurtarmaAc = () => { setKurtarma(true); setK({ kullanici: kullanici.trim(), kod: "", p1: "", p2: "" }); setKMesaj({ tur: "", metin: "" }); };
  const kurtarmaGonder = async () => {
    if (!k.kullanici.trim() || !k.kod.trim()) return setKMesaj({ tur: "err", metin: "Kullanıcı adı ve kurtarma kodu gerekli" });
    if (k.p1.length < 6) return setKMesaj({ tur: "err", metin: "Yeni parola en az 6 karakter olmalı" });
    if (k.p1 !== k.p2) return setKMesaj({ tur: "err", metin: "Parolalar aynı değil" });
    setBekliyor(true);
    const r = await window.okul.auth.kurtarmaSifirla(k.kullanici.trim(), k.kod, k.p1);
    setBekliyor(false);
    if (!r.ok) return setKMesaj({ tur: "err", metin: r.error || "Sıfırlanamadı" });
    setKullanici(k.kullanici.trim()); setParola(""); setKurtarma(false); setHata("");
    let ek = "";
    if (r.kalan === 0) ek = " Kurtarma kodlarınız bitti; girişten sonra Ayarlar > Kullanıcılar'dan yenilerini üretin.";
    else if (r.kalan !== undefined && r.kalan < 3) ek = " " + r.kalan + " kurtarma kodunuz kaldı.";
    setKMesaj({ tur: "ok", metin: "Parola sıfırlandı, yeni parolanızla giriş yapın." + ek });
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
        </div>
        <span style={{ color: "var(--sari)", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>Kuruluş 1919</span>
      </div>
      {kurtarma ? (
        <form onSubmit={(e) => { e.preventDefault(); kurtarmaGonder(); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 34 }}>Parolamı Unuttum</h2>
              <p style={{ color: "var(--soluk)", margin: "4px 0 0" }}>Kurtarma kodlarınızdan birini girin. Her kod bir kez kullanılır.</p>
            </div>
            <Alan etiket="Kullanıcı adı"><input style={girisStili} value={k.kullanici} onChange={(e) => setK({ ...k, kullanici: e.target.value })} autoFocus={!k.kullanici} /></Alan>
            <Alan etiket="Kurtarma kodu"><input style={{ ...girisStili, fontFamily: "monospace", letterSpacing: ".08em" }} value={k.kod} onChange={(e) => setK({ ...k, kod: e.target.value.toUpperCase() })} placeholder="XXXX-XXXX" autoFocus={!!k.kullanici} /></Alan>
            <Alan etiket="Yeni parola"><input style={girisStili} type="password" value={k.p1} onChange={(e) => setK({ ...k, p1: e.target.value })} /></Alan>
            <Alan etiket="Yeni parola (tekrar)"><input style={girisStili} type="password" value={k.p2} onChange={(e) => setK({ ...k, p2: e.target.value })} /></Alan>
            {kMesaj.metin && <div role="alert" style={{ color: kMesaj.tur === "err" ? "var(--kirmizi)" : "var(--yesil)", fontSize: 14, fontWeight: 600 }}>{kMesaj.metin}</div>}
            <Btn type="submit" disabled={bekliyor} style={{ height: 48, justifyContent: "center", fontSize: 16 }}>Parolayı Sıfırla</Btn>
            <button type="button" onClick={() => setKurtarma(false)} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Girişe dön</button>
            <span style={{ color: "var(--soluk)", fontSize: 13, textAlign: "center" }}>Kurtarma kodunuz yoksa bir yöneticiden parolanızı sıfırlamasını isteyin.</span>
          </div>
        </form>
      ) : (
      <form onSubmit={gonder} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 34 }}>Giriş Yap</h2>
            <p style={{ color: "var(--soluk)", margin: "4px 0 0" }}>Kullanıcı adı ve parolanızla devam edin.</p>
          </div>
          <Alan etiket="Kullanıcı adı"><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}><Ikon ad="kullanici" /></span><input style={{ ...girisStili, paddingLeft: 40 }} value={kullanici} onChange={(e) => setKullanici(e.target.value)} autoFocus={!kullanici} /></div></Alan>
          <Alan etiket="Parola"><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}><Ikon ad="kilit" /></span><input style={{ ...girisStili, paddingLeft: 40 }} type="password" value={parola} onChange={(e) => setParola(e.target.value)} autoFocus={!!kullanici} /></div></Alan>
          {hata && <div role="alert" style={{ color: "var(--kirmizi)", fontSize: 14, fontWeight: 600 }}>{hata}</div>}
          {kMesaj.tur === "ok" && kMesaj.metin && <div role="status" style={{ color: "var(--yesil)", fontSize: 14, fontWeight: 600 }}>{kMesaj.metin}</div>}
          <Btn type="submit" disabled={bekliyor} style={{ height: 48, justifyContent: "center", fontSize: 16 }}>Giriş Yap</Btn>
          <span style={{ color: "var(--soluk)", fontSize: 13, textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
            {mod?.mode === "istemci" && <span>Sunucuya bağlı: <b>{mod.serverUrl}</b> · sunucudaki hesabınızla girin</span>}
            <button type="button" onClick={kurtarmaAc} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Parolamı unuttum</button>
          </span>
          {COKLU_PC_ACIK && mod && mod.mode !== "sunucu" && !baglanAcik && <button type="button" onClick={() => setBaglanAcik(true)} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>{mod.mode === "istemci" ? "Sunucu adresini değiştir" : "Başka bilgisayardaki sunucuya bağlan"}</button>}
          {COKLU_PC_ACIK && baglanAcik && (
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
      )}
    </div>
  );
}
