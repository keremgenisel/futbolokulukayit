import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, ParaGirdi, Secim, Rozet, Onay, Modal, useToast } from "./ui.jsx";
import { db, yedek, optimize, uygulama, hataMetni } from "../lib/api.js";
import { paraTR, tarihTR, UCRET_TIPLERI, SABIT_INDIRIM, indirimAnahtari, indirimYuzdesi, aidatHesapla } from "../lib/aidat.js";
import { ParolaDegistir } from "./ParolaDegistir.jsx";
import { SettingsLisans } from "./SettingsLisans.jsx";
import { SettingsSunucu } from "./SettingsSunucu.jsx";
import { COKLU_PC_ACIK } from "../lib/ozellikler.js";
import { Ikon } from "./Ikon.jsx";

const BOLUMLER = [{ kod: "kulup", ad: "Kulüp ve Makbuz", ikon: "tahsilat" }, { kod: "kalem", ad: "Aidat Kalemleri", ikon: "raporlar" }, { kod: "kullanici", ad: "Kullanıcılar", ikon: "kullanici" }, { kod: "yedek", ad: "Yedekleme", ikon: "yedek" }, { kod: "optimize", ad: "Resim ve Belge Optimizasyonu", ikon: "dosya" }, ...(COKLU_PC_ACIK ? [{ kod: "sunucu", ad: "Sunucu / Çoklu PC", ikon: "sunucu" }] : []), { kod: "lisans", ad: "Lisans", ikon: "kilit" }, { kod: "hakkinda", ad: "Hakkında", ikon: "uyari" }];

export function Ayarlar({ oturum, saltOkunur, onLisansDegisti, onModDegisti, baslangicBolum }) {
  const [bolum, setBolum] = useState(baslangicBolum || "kulup");
  const admin = oturum?.role === "admin";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {BOLUMLER.map((b) => <button key={b.kod} type="button" onClick={() => setBolum(b.kod)} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 8, cursor: "pointer", border: 0, background: bolum === b.kod ? "var(--mor-acik)" : "transparent", color: bolum === b.kod ? "var(--mor-koyu)" : "var(--metin)", fontWeight: bolum === b.kod ? 700 : 500, fontSize: 15, display: "flex", alignItems: "center", gap: 10 }}><Ikon ad={b.ikon} /><span>{b.ad}</span></button>)}
      </Kart>
      <Kart style={{ padding: 24 }}>
        {bolum === "kulup" && <KulupAyar saltOkunur={saltOkunur} />}
        {bolum === "kalem" && <KalemAyar saltOkunur={saltOkunur} />}
        {bolum === "kullanici" && <KullaniciAyar oturum={oturum} admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "yedek" && <YedekAyar admin={admin} />}
        {bolum === "optimize" && <OptimizeAyar admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "sunucu" && COKLU_PC_ACIK && <SettingsSunucu admin={admin} onModDegisti={onModDegisti} />}
        {bolum === "lisans" && <SettingsLisans admin={admin} onLisansDegisti={onLisansDegisti} />}
        {bolum === "hakkinda" && <Hakkinda />}
      </Kart>
    </div>
  );
}

function KulupAyar({ saltOkunur }) {
  const [a, setA] = useState({ kulup_adi: "", tahsil_eden: "" });
  const toast = useToast();
  useEffect(() => { (async () => { const o = {}; for (const k of Object.keys(a)) o[k] = (await db("getSetting", k)) || ""; setA(o); })().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = async () => { try { for (const [k, v] of Object.entries(a)) await db("setSetting", k, v); toast("ok", "Kaydedildi"); } catch (e) { toast("err", hataMetni(e)); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h3 style={{ fontSize: 22 }}>Kulüp ve Makbuz</h3>
      <Alan etiket="Makbuzda görünen kulüp adı"><Girdi value={a.kulup_adi} onChange={(e) => setA({ ...a, kulup_adi: e.target.value })} placeholder="EYÜPSPOR FUTBOL OKULU" /></Alan>
      <Alan etiket="Varsayılan tahsil eden (kullanıcı adı boşsa)"><Girdi value={a.tahsil_eden} onChange={(e) => setA({ ...a, tahsil_eden: e.target.value })} /></Alan>
      {!saltOkunur && <div><Btn onClick={kaydet}>Kaydet</Btn></div>}
    </div>
  );
}

function KalemAyar({ saltOkunur }) {
  const [kalemler, setKalemler] = useState([]);
  const toast = useToast();
  const yukle = () => db("listFeeItems").then(setKalemler).catch(() => {});
  useEffect(() => { yukle(); }, []);
  const kaydet = async (k) => { try { await db("updateFeeItem", k.id, { ad: k.ad, varsayilan_fiyat: Number(k.varsayilan_fiyat) || 0, aktif: k.aktif ? 1 : 0 }); toast("ok", "Kaydedildi"); yukle(); } catch (e) { toast("err", hataMetni(e)); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>Aidat Kalemleri ve Varsayılan Fiyatlar</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Aidat satırındaki fiyat aylık aidatın taban fiyatıdır; oyuncu kaydında ücret tipine göre indirim düşülerek gelir. Diğer kalemlerin fiyatı makbuz keserken gelir, makbuzda değiştirilebilir.</p>
      <table><thead><tr><th>Kalem</th><th>Fiyat (₺)</th><th>Aktif</th><th></th></tr></thead><tbody>
        {kalemler.map((k) => <KalemSatir key={k.id} k={k} onKaydet={kaydet} saltOkunur={saltOkunur} />)}
      </tbody></table>
      <IndirimAyar taban={Number(kalemler.find((k) => k.kod === "aidat")?.varsayilan_fiyat) || 0} saltOkunur={saltOkunur} />
    </div>
  );
}

// Ücret tipi başına indirim yüzdesi; hesaplanan aidat taban fiyattan düşülerek gösterilir.
function IndirimAyar({ taban, saltOkunur }) {
  const [ind, setInd] = useState(null); // kod → yüzde (metin)
  const [kayitli, setKayitli] = useState({});
  const toast = useToast();
  const yukle = useCallback(async () => {
    try {
      const a = await db("aidatAyarlari");
      const m = {}; for (const t of UCRET_TIPLERI) m[t.kod] = String(indirimYuzdesi(t.kod, a.indirimler[t.kod]));
      setInd(m); setKayitli(m);
    } catch (e) { toast("err", hataMetni(e)); }
  }, [toast]);
  useEffect(() => { yukle(); }, [yukle]);
  const kaydet = async () => {
    try {
      for (const t of UCRET_TIPLERI) if (!SABIT_INDIRIM.has(t.kod)) await db("setSetting", indirimAnahtari(t.kod), String(indirimYuzdesi(t.kod, ind[t.kod])));
      toast("ok", "İndirimler kaydedildi"); yukle();
    } catch (e) { toast("err", hataMetni(e)); }
  };
  if (!ind) return null;
  const degisti = UCRET_TIPLERI.some((t) => ind[t.kod] !== kayitli[t.kod]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <h3 style={{ fontSize: 22 }}>Ücret Tipleri ve İndirimler</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Yeni oyuncu kaydında ücret tipi seçilince aylık aidat şöyle hesaplanır: taban fiyat − indirim yüzdesi. Tutar oyuncu kartında elle değiştirilebilir. %100 indirim aidattan muaf demektir.</p>
      <table><thead><tr><th>Ücret tipi</th><th>İndirim (%)</th><th>Hesaplanan aylık aidat</th></tr></thead><tbody>
        {UCRET_TIPLERI.map((t) => {
          const sabit = SABIT_INDIRIM.has(t.kod);
          const hesap = aidatHesapla(taban, t.kod, { [t.kod]: ind[t.kod] });
          return (
            <tr key={t.kod}>
              <td><b>{t.ad}</b></td>
              <td>{sabit ? <span style={{ color: "var(--soluk)" }}>%{ind[t.kod]}</span> : <Girdi type="number" min="0" max="100" value={ind[t.kod]} onChange={(e) => setInd({ ...ind, [t.kod]: e.target.value })} disabled={saltOkunur} aria-label={`${t.ad} indirimi`} style={{ height: 36, width: 110 }} />}</td>
              <td>{hesap === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(hesap)}</b>}</td>
            </tr>
          );
        })}
      </tbody></table>
      {!saltOkunur && degisti && <div><Btn onClick={kaydet}>İndirimleri Kaydet</Btn></div>}
    </div>
  );
}
function KalemSatir({ k, onKaydet, saltOkunur }) {
  const [s, setS] = useState({ ...k });
  useEffect(() => setS({ ...k }), [k]);
  const degisti = s.ad !== k.ad || Number(s.varsayilan_fiyat) !== Number(k.varsayilan_fiyat) || !!s.aktif !== !!k.aktif;
  return (
    <tr>
      <td>{k.kod === "aidat" ? <b>{k.ad}</b> : <Girdi value={s.ad} onChange={(e) => setS({ ...s, ad: e.target.value })} disabled={saltOkunur} style={{ height: 36, width: 240 }} />}</td>
      <td><ParaGirdi value={s.varsayilan_fiyat} onDegis={(v) => setS({ ...s, varsayilan_fiyat: v })} disabled={saltOkunur} aria-label={`${k.ad} fiyatı`} style={{ height: 36, width: 140 }} /></td>
      <td>{k.kod === "aidat" ? <Rozet ton="green">Aktif</Rozet> : <input type="checkbox" checked={!!s.aktif} onChange={(e) => setS({ ...s, aktif: e.target.checked })} disabled={saltOkunur} />}</td>
      <td>{degisti && !saltOkunur && <Btn kucuk onClick={() => onKaydet(s)}>Kaydet</Btn>}</td>
    </tr>
  );
}

function KullaniciAyar({ oturum, admin, saltOkunur }) {
  const [liste, setListe] = useState([]);
  const [yeni, setYeni] = useState({ username: "", ad_soyad: "", password: "", role: "kullanici" });
  const [parola, setParola] = useState(false);
  const [sifirla, setSifirla] = useState(null);
  const [sil, setSil] = useState(null);
  const [kodUret, setKodUret] = useState(null); // onay bekleyen kullanıcı
  const [kodlar, setKodlar] = useState(null); // { username, kodlar }
  const toast = useToast();
  // Yönetici tüm listeyi görür; kullanıcı yalnız kendi kaydını (kurtarma kodu sayısı için).
  const yukle = () => { db("listUsers").then(setListe).catch(() => {}); };
  useEffect(yukle, [admin]);
  const ben = liste.find((u) => u.username === oturum.username);
  const kodUretOnay = async () => {
    const u = kodUret; setKodUret(null);
    try { const r = await window.okul.auth.kurtarmaUret(u.id); if (!r.ok) return toast("err", r.error); setKodlar({ username: u.username, kodlar: r.kodlar }); yukle(); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const silOnay = async () => {
    try { const r = await db("deleteUser", sil.id); if (r?.error) toast("err", r.error); else toast("ok", `${sil.username} silindi`); setSil(null); yukle(); }
    catch (e) { toast("err", hataMetni(e)); setSil(null); }
  };
  const ekle = async () => {
    if (!yeni.username.trim() || yeni.password.length < 6) return toast("err", "Kullanıcı adı ve en az 6 karakter parola gerekli");
    try { await db("createUser", { ...yeni, username: yeni.username.trim(), must_change_password: 1 }); toast("ok", "Kullanıcı eklendi"); setYeni({ username: "", ad_soyad: "", password: "", role: "kullanici" }); yukle(); } catch (e) { toast("err", hataMetni(e).includes("UNIQUE") ? "Bu kullanıcı adı kullanımda" : hataMetni(e)); }
  };
  const sifirlaOnay = async () => { try { const p = "eyupspor" + Math.floor(1000 + Math.random() * 9000); await db("resetUserPassword", sifirla.id, p); toast("ok", `Geçici parola: ${p} (ilk girişte değiştirilecek)`); setSifirla(null); } catch (e) { toast("err", hataMetni(e)); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h3 style={{ fontSize: 22 }}>Hesabım</h3>
        <p style={{ color: "var(--soluk)", margin: "4px 0 10px" }}>{oturum.ad_soyad || oturum.username} · {oturum.role === "admin" ? "Yönetici" : "Kullanıcı"}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Btn tur="ghost" onClick={() => setParola(true)}>Parolamı Değiştir</Btn>
          {ben && !saltOkunur && <Btn tur="ghost" ikon={<Ikon ad="kilit" boyut={16} />} onClick={() => setKodUret(ben)}>{ben.kurtarma_kodu > 0 ? "Kurtarma Kodlarını Yenile" : "Kurtarma Kodları Üret"}</Btn>}
          {ben && (ben.kurtarma_kodu > 0 ? <Rozet ton="green">{ben.kurtarma_kodu} kurtarma kodu</Rozet> : <Rozet ton="red">Kurtarma kodu yok</Rozet>)}
        </div>
        <p style={{ color: "var(--soluk)", fontSize: 13, margin: "8px 0 0" }}>Parolanızı unutursanız giriş ekranındaki "Parolamı unuttum" ile bu kodlardan biriyle yeni parola belirlersiniz. Her kod bir kez kullanılır; kodları yazdırıp güvenli bir yerde saklayın.</p>
      </div>
      {admin && (
        <>
          <div style={{ height: 1, background: "var(--cizgi)" }} />
          <h3 style={{ fontSize: 22 }}>Kullanıcılar</h3>
          <table style={{ width: "100%" }}><thead><tr><th style={{ whiteSpace: "nowrap" }}>Kullanıcı adı</th><th style={{ whiteSpace: "nowrap" }}>Ad Soyad</th><th>Rol</th><th>Durum</th><th style={{ whiteSpace: "nowrap" }}>Kurtarma kodu</th><th></th></tr></thead><tbody>
            {liste.map((u) => <tr key={u.id}><td style={{ fontWeight: 600 }}>{u.username}</td><td>{u.ad_soyad}</td><td>{u.role === "admin" ? "Yönetici" : "Kullanıcı"}</td><td>{u.is_active ? <Rozet ton="green">Aktif</Rozet> : <Rozet ton="gray">Pasif</Rozet>}</td><td>{u.kurtarma_kodu > 0 ? <Rozet ton="green">{u.kurtarma_kodu}</Rozet> : <Rozet ton="red">Yok</Rozet>}</td><td style={{ whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{u.username !== oturum.username && !saltOkunur && <><Btn kucuk tur="ghost" onClick={() => setSifirla(u)}>Parola sıfırla</Btn><Btn kucuk tur="ghost" onClick={() => setKodUret(u)}>Kurtarma kodu</Btn><Btn kucuk tur={u.is_active ? "danger" : "primary"} onClick={async () => { await db("setUserActive", u.id, !u.is_active); yukle(); }}>{u.is_active ? "Pasif yap" : "Aktif yap"}</Btn><Btn kucuk tur="danger" ikon={<Ikon ad="kapat" boyut={14} />} onClick={() => setSil(u)} aria-label={`${u.username} kullanıcısını sil`}>Sil</Btn></>}</div></td></tr>)}
          </tbody></table>
          {!saltOkunur && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Alan etiket="Kullanıcı adı" style={{ width: 160 }}><Girdi value={yeni.username} onChange={(e) => setYeni({ ...yeni, username: e.target.value })} /></Alan>
              <Alan etiket="Ad Soyad" style={{ width: 200 }}><Girdi value={yeni.ad_soyad} onChange={(e) => setYeni({ ...yeni, ad_soyad: e.target.value })} /></Alan>
              <Alan etiket="Geçici parola" style={{ width: 160 }}><Girdi type="password" value={yeni.password} onChange={(e) => setYeni({ ...yeni, password: e.target.value })} /></Alan>
              <Alan etiket="Rol" style={{ width: 140 }}><select value={yeni.role} onChange={(e) => setYeni({ ...yeni, role: e.target.value })} style={{ height: 42, borderRadius: 8, border: "1px solid var(--cizgi)", padding: "0 10px" }}><option value="kullanici">Kullanıcı</option><option value="admin">Yönetici</option></select></Alan>
              <Btn onClick={ekle}>Kullanıcı Ekle</Btn>
            </div>
          )}
        </>
      )}
      {parola && <ParolaDegistir oturum={oturum} onTamam={() => setParola(false)} onKapat={() => setParola(false)} />}
      {sifirla && <Onay mesaj={`${sifirla.username} için geçici parola üretilsin mi? Kullanıcı ilk girişte değiştirecek.`} onEvet={sifirlaOnay} onHayir={() => setSifirla(null)} />}
      {sil && <Onay tehlikeli mesaj={`${sil.username} kullanıcısı silinsin mi? Bu işlem geri alınamaz; kestiği makbuzlar ve kayıtlar kalır.`} onEvet={silOnay} onHayir={() => setSil(null)} />}
      {kodUret && <Onay mesaj={`${kodUret.username} için 8 yeni kurtarma kodu üretilsin mi?${kodUret.kurtarma_kodu > 0 ? " Eski kodlar geçersiz olur." : ""}`} onEvet={kodUretOnay} onHayir={() => setKodUret(null)} />}
      {kodlar && <KurtarmaKodlari username={kodlar.username} kodlar={kodlar.kodlar} onKapat={() => setKodlar(null)} />}
    </div>
  );
}

// Üretilen kodlar YALNIZ bu pencerede görünür (DB'de şifreli). Kopyala / yazdır.
function KurtarmaKodlari({ username, kodlar, onKapat }) {
  const toast = useToast();
  const metin = `Eyüpspor Futbol Okulu — ${username} parola kurtarma kodları\n${kodlar.join("\n")}\nHer kod bir kez kullanılır.`;
  const kopyala = async () => { try { await navigator.clipboard.writeText(metin); toast("ok", "Kodlar panoya kopyalandı"); } catch { toast("err", "Kopyalanamadı"); } };
  const yazdir = async () => {
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kurtarma kodları</title><style>body{font-family:sans-serif;padding:32px}h1{font-size:18px}code{display:block;font-size:18px;letter-spacing:.1em;margin:6px 0}</style></head><body><h1>Eyüpspor Futbol Okulu — ${esc(username)} parola kurtarma kodları</h1>${kodlar.map((k) => `<code>${esc(k)}</code>`).join("")}<p>Her kod bir kez kullanılır. Güvenli bir yerde saklayın.</p></body></html>`;
    const r = await window.okul.cikti.yazdir(html);
    if (!r?.ok) toast("err", r?.hata || "Yazdırılamadı");
  };
  return (
    <Modal baslik={`${username} — Kurtarma Kodları`} onKapat={onKapat} genislik={520} altBar={<><Btn tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={yazdir}>Yazdır</Btn><Btn tur="ghost" onClick={kopyala}>Kopyala</Btn><Btn onClick={onKapat}>Kaydettim, Kapat</Btn></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="alert" style={{ background: "var(--sari-acik)", border: "1.5px solid var(--sari)", borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>Bu kodlar yalnız şimdi görünür; kapattıktan sonra tekrar gösterilemez. Yazdırıp güvenli bir yerde saklayın.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {kodlar.map((k) => <code key={k} style={{ fontSize: 18, letterSpacing: ".1em", padding: "8px 12px", border: "1px solid var(--cizgi)", borderRadius: 8, textAlign: "center" }}>{k}</code>)}
        </div>
      </div>
    </Modal>
  );
}

const KATEGORI_AD = { foto: "Vesikalık fotoğraf", saglik: "Sağlık raporu", sporcu_kimlik: "Sporcu kimlik", veli_kimlik: "Veli kimlik", kayit_formu: "Kayıt formu", makbuz: "Makbuz", diger: "Diğer" };
const kb = (b) => `${Math.round((b || 0) / 1024).toLocaleString("tr-TR")} KB`;

// makina-crm'deki Resim Optimizasyonu: analiz et → optimize et; yalnız jpg/png, PDF'lere dokunmaz.
function OptimizeAyar({ admin, saltOkunur }) {
  const [durum, setDurum] = useState(null); // analiz sonucu
  const [sonuc, setSonuc] = useState(null); // uygulama sonucu
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const analiz = async () => { setBekliyor(true); try { const r = await optimize().analiz(); if (r.error) toast("err", r.error); else { setDurum(r); setSonuc(null); } } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); } };
  const uygula = async () => {
    setBekliyor(true);
    try {
      const r = await optimize().uygula();
      if (r.error) return toast("err", r.error);
      setSonuc(r);
      const yuzde = r.once > 0 ? Math.round((r.tasarruf / r.once) * 100) : 0;
      toast("ok", r.adet === 0 ? "Optimize edilecek resim yok" : `${r.kucultulen} resim küçültüldü, ${kb(r.tasarruf)} tasarruf (%${yuzde})`);
      const a = await optimize().analiz(); if (!a.error) setDurum(a);
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };
  if (!admin) return <div style={{ color: "var(--soluk)" }}>Bu bölüm yalnız yöneticiler içindir.</div>;
  const yuzde = sonuc && sonuc.once > 0 ? Math.round((sonuc.tasarruf / sonuc.once) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h3 style={{ fontSize: 22 }}>Resim ve Belge Optimizasyonu</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Vesikalık ve belge fotoğraflarını (JPG/PNG) en fazla 2000 piksele küçültür ve yeniden sıkıştırır; yedekler küçülür, program hızlanır. Yeni yüklenen resimler zaten yükleme anında optimize edilir; bu araç eski dosyalara uygular. PDF ve Office belgelerine dokunulmaz, okunurluk korunur. Yalnız gerçekten küçülen dosyalar değiştirilir.</p>
      {durum && (
        <div style={{ background: "var(--zemin)", border: "1px solid var(--cizgi)", borderRadius: 10, padding: "14px 18px", fontSize: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {Object.entries(durum.resim.gruplar).map(([k, g]) => <span key={k}><span style={{ color: "var(--soluk)" }}>{KATEGORI_AD[k] || k}:</span> <b>{g.adet} resim</b> <span style={{ color: "var(--soluk)" }}>({kb(g.bayt)})</span></span>)}
            {durum.resim.adet === 0 && <span style={{ color: "var(--soluk)" }}>Optimize edilebilecek resim yok.</span>}
          </div>
          <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 8 }}>Resimler toplam <b>{kb(durum.resim.bayt)}</b> · PDF ve diğer belgeler {durum.diger.adet} dosya, {kb(durum.diger.bayt)} (dokunulmaz)</div>
          {sonuc && sonuc.adet > 0 && <div><span style={{ color: "var(--soluk)" }}>{kb(sonuc.once)}</span> → <b style={{ color: "var(--yesil)" }}>{kb(sonuc.sonra)}</b> <Rozet ton="green">{kb(sonuc.tasarruf)} tasarruf (%{yuzde})</Rozet></div>}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn tur="ghost" onClick={analiz} disabled={bekliyor}>Analiz Et</Btn>
        {!saltOkunur && <Btn ikon={<Ikon ad="dosya" />} onClick={uygula} disabled={bekliyor}>{bekliyor ? "Çalışıyor…" : sonuc ? "Tekrar Optimize Et" : "Optimize Et"}</Btn>}
      </div>
    </div>
  );
}

function YedekAyar({ admin }) {
  const [d, setD] = useState({ klasor: null, son: null });
  const [bekliyor, setBekliyor] = useState(false);
  const [aday, setAday] = useState(null); // seçilen yedeğin özeti (onay bekliyor)
  const toast = useToast();
  const geriYukleSec = async () => {
    try { const r = await yedek().geriYukleSec(); if (r.iptal) return; if (r.error) return toast("err", r.error); setAday(r); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const geriYukleOnayla = async () => {
    setBekliyor(true);
    try { const r = await yedek().geriYukle(aday.klasor); if (r.error) toast("err", r.error); else toast("ok", "Geri yüklendi, program yeniden başlatılıyor…"); }
    catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); setAday(null); }
  };
  const yukle = () => yedek().durum().then(setD).catch(() => {});
  useEffect(() => { yukle(); }, []);
  const sec = async () => { try { const r = await yedek().klasorSec(); if (!r.iptal) { toast("ok", "Yedek klasörü ayarlandı"); yukle(); } } catch (e) { toast("err", hataMetni(e)); } };
  const siklikDegistir = async (e) => { const k = e.target.value; try { const r = await yedek().siklik(k); if (r.error) toast("err", r.error); else { toast("ok", "Yedekleme sıklığı kaydedildi"); yukle(); } } catch (err) { toast("err", hataMetni(err)); } };
  const al = async () => { setBekliyor(true); try { const r = await yedek().al(); if (r.error) toast("err", r.error); else toast("ok", "Yedek alındı: " + r.yol); yukle(); } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <h3 style={{ fontSize: 22 }}>Yedekleme</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Veritabanı, vesikalık fotoğraflar, belgeler ve makbuz PDF'leri tek bir zip dosyasına (<code>eyupspor-yedek-tarih.zip</code>) yazılır. Otomatik yedek uygulama açılışında, aşağıda seçtiğiniz sıklıkla alınır; en eski yedekler silinir, son 30 yedek saklanır. Klasör olarak harici disk veya bulut klasörü (OneDrive, Google Drive) seçebilirsiniz.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 15 }}>
        <div><span style={{ color: "var(--soluk)" }}>Yedek klasörü:</span> <b>{d.klasor || "Seçilmedi"}</b></div>
        <div><span style={{ color: "var(--soluk)" }}>Son yedek:</span> <b>{d.son ? `${tarihTR(d.son)} ${d.son.slice(11, 16)}` : "Henüz alınmadı"}</b></div>
      </div>
      {!d.istemci && d.sikliklar && (
        <Alan etiket="Otomatik yedekleme sıklığı" style={{ width: 320 }}>
          <Secim secenekler={d.sikliklar} value={d.siklik} onChange={siklikDegistir} aria-label="Otomatik yedekleme sıklığı" />
        </Alan>
      )}
      <div style={{ display: "flex", gap: 10 }}><Btn tur="ghost" onClick={sec}>Klasör Seç</Btn><Btn ikon={<Ikon ad="yedek" />} onClick={al} disabled={!d.klasor || bekliyor}>Şimdi Yedek Al</Btn></div>
      {admin && !d.istemci && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Yedekten geri yükle</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Bir yedek zip dosyası seçin. Mevcut veriler silinmez, <code>.pre-restore</code> uzantısıyla kenara alınır. Geri yükleme bittiğinde program yeniden başlar. Yedek bu bilgisayarda alınmış olmalıdır.</p>
          <div><Btn tur="danger" ikon={<Ikon ad="geri" />} onClick={geriYukleSec} disabled={bekliyor}>Yedek Dosyası Seç ve Geri Yükle</Btn></div>
        </div>
      )}
      {aday && <Onay tehlikeli mesaj={`Seçilen yedek: ${aday.oyuncu} oyuncu, ${aday.makbuz} makbuz${aday.sonMakbuz ? ", son makbuz " + tarihTR(aday.sonMakbuz) : ""}. Mevcut veriler kenara alınıp bu yedek yüklenecek ve program yeniden başlayacak. Devam edilsin mi?`} onEvet={geriYukleOnayla} onHayir={() => setAday(null)} />}
    </div>
  );
}

function Hakkinda() {
  const [v, setV] = useState("");
  useEffect(() => { uygulama().version().then(setV).catch(() => {}); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Eyüpspor Futbol Okulu Kayıt Programı</h3>
      <div style={{ color: "var(--soluk)" }}>Sürüm {v || "—"}</div>
      <div style={{ color: "var(--soluk)", fontSize: 14 }}>Oyuncu kayıt, aylık aidat, tahsilat makbuzu ve antrenman yoklaması. Veritabanı şifreli olarak bu bilgisayarda saklanır.</div>
      <div style={{ color: "var(--soluk)", fontSize: 14 }}>Geliştirici: Kerem Genişel</div>
    </div>
  );
}

export { paraTR };
