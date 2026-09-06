import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Rozet, Onay, useToast } from "./ui.jsx";
import { db, yedek, uygulama, hataMetni } from "../lib/api.js";
import { paraTR, tarihTR } from "../lib/aidat.js";
import { ParolaDegistir } from "./ParolaDegistir.jsx";
import { SettingsLisans } from "./SettingsLisans.jsx";
import { SettingsSunucu } from "./SettingsSunucu.jsx";
import { Ikon } from "./Ikon.jsx";

const BOLUMLER = [{ kod: "kulup", ad: "Kulüp ve Makbuz", ikon: "tahsilat" }, { kod: "kalem", ad: "Aidat Kalemleri", ikon: "raporlar" }, { kod: "kullanici", ad: "Kullanıcılar", ikon: "kullanici" }, { kod: "yedek", ad: "Yedekleme", ikon: "yedek" }, { kod: "sunucu", ad: "Sunucu / Çoklu PC", ikon: "sunucu" }, { kod: "lisans", ad: "Lisans", ikon: "kilit" }, { kod: "hakkinda", ad: "Hakkında", ikon: "uyari" }];

export function Ayarlar({ oturum, saltOkunur, onLisansDegisti, onModDegisti }) {
  const [bolum, setBolum] = useState("kulup");
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
        {bolum === "sunucu" && <SettingsSunucu admin={admin} onModDegisti={onModDegisti} />}
        {bolum === "lisans" && <SettingsLisans admin={admin} onLisansDegisti={onLisansDegisti} />}
        {bolum === "hakkinda" && <Hakkinda />}
      </Kart>
    </div>
  );
}

function KulupAyar({ saltOkunur }) {
  const [a, setA] = useState({ kulup_adi: "", makbuz_alt_yazi: "", tahsil_eden: "" });
  const toast = useToast();
  useEffect(() => { (async () => { const o = {}; for (const k of Object.keys(a)) o[k] = (await db("getSetting", k)) || ""; setA(o); })().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = async () => { try { for (const [k, v] of Object.entries(a)) await db("setSetting", k, v); toast("ok", "Kaydedildi"); } catch (e) { toast("err", hataMetni(e)); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h3 style={{ fontSize: 22 }}>Kulüp ve Makbuz</h3>
      <Alan etiket="Makbuzda görünen kulüp adı"><Girdi value={a.kulup_adi} onChange={(e) => setA({ ...a, kulup_adi: e.target.value })} placeholder="EYÜPSPOR FUTBOL OKULU" /></Alan>
      <Alan etiket="Makbuz alt yazısı"><Girdi value={a.makbuz_alt_yazi} onChange={(e) => setA({ ...a, makbuz_alt_yazi: e.target.value })} placeholder="#BirSemtinRüyası #SemtiMukaddes #HayaleAşıkOl" /></Alan>
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
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Makbuz keserken kalem seçilince bu fiyat gelir, tutar makbuzda değiştirilebilir. Aidat kalemi oyuncunun aylık aidatını kullanır.</p>
      <table><thead><tr><th>Kalem</th><th>Varsayılan fiyat</th><th>Aktif</th><th></th></tr></thead><tbody>
        {kalemler.map((k) => <KalemSatir key={k.id} k={k} onKaydet={kaydet} saltOkunur={saltOkunur} />)}
      </tbody></table>
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
      <td>{k.kod === "aidat" ? <span style={{ color: "var(--soluk)" }}>Oyuncu bazlı</span> : <Girdi type="number" value={s.varsayilan_fiyat} onChange={(e) => setS({ ...s, varsayilan_fiyat: e.target.value })} disabled={saltOkunur} style={{ height: 36, width: 140 }} />}</td>
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
  const toast = useToast();
  const yukle = () => { if (admin) db("listUsers").then(setListe).catch(() => {}); };
  useEffect(yukle, [admin]);
  const ekle = async () => {
    if (!yeni.username.trim() || yeni.password.length < 6) return toast("err", "Kullanıcı adı ve en az 6 karakter parola gerekli");
    try { await db("createUser", { ...yeni, username: yeni.username.trim(), must_change_password: 1 }); toast("ok", "Kullanıcı eklendi"); setYeni({ username: "", ad_soyad: "", password: "", role: "kullanici" }); yukle(); } catch (e) { toast("err", hataMetni(e).includes("UNIQUE") ? "Bu kullanıcı adı kullanımda" : hataMetni(e)); }
  };
  const sifirlaOnay = async () => { try { const p = "eyupspor" + Math.floor(1000 + Math.random() * 9000); await db("resetUserPassword", sifirla.id, p); toast("ok", `Geçici parola: ${p} (ilk girişte değiştirilecek)`); setSifirla(null); } catch (e) { toast("err", hataMetni(e)); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div><h3 style={{ fontSize: 22 }}>Hesabım</h3><p style={{ color: "var(--soluk)", margin: "4px 0 10px" }}>{oturum.ad_soyad || oturum.username} · {oturum.role === "admin" ? "Yönetici" : "Kullanıcı"}</p><Btn tur="ghost" onClick={() => setParola(true)}>Parolamı Değiştir</Btn></div>
      {admin && (
        <>
          <div style={{ height: 1, background: "var(--cizgi)" }} />
          <h3 style={{ fontSize: 22 }}>Kullanıcılar</h3>
          <table><thead><tr><th>Kullanıcı adı</th><th>Ad Soyad</th><th>Rol</th><th>Durum</th><th></th></tr></thead><tbody>
            {liste.map((u) => <tr key={u.id}><td style={{ fontWeight: 600 }}>{u.username}</td><td>{u.ad_soyad}</td><td>{u.role === "admin" ? "Yönetici" : "Kullanıcı"}</td><td>{u.is_active ? <Rozet ton="green">Aktif</Rozet> : <Rozet ton="gray">Pasif</Rozet>}</td><td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>{u.username !== oturum.username && !saltOkunur && <><Btn kucuk tur="ghost" onClick={() => setSifirla(u)}>Parola sıfırla</Btn><Btn kucuk tur={u.is_active ? "danger" : "primary"} onClick={async () => { await db("setUserActive", u.id, !u.is_active); yukle(); }}>{u.is_active ? "Pasif yap" : "Aktif yap"}</Btn></>}</td></tr>)}
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
  const al = async () => { setBekliyor(true); try { const r = await yedek().al(); if (r.error) toast("err", r.error); else toast("ok", "Yedek alındı: " + r.yol); yukle(); } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <h3 style={{ fontSize: 22 }}>Yedekleme</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Veritabanı ve tüm belgeler seçilen klasöre kopyalanır. Uygulama her açılışta günde bir kez otomatik yedek alır, 30 günden eski yedekleri siler. Klasör olarak harici disk veya bulut klasörü (OneDrive, Google Drive) seçebilirsiniz.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 15 }}>
        <div><span style={{ color: "var(--soluk)" }}>Yedek klasörü:</span> <b>{d.klasor || "Seçilmedi"}</b></div>
        <div><span style={{ color: "var(--soluk)" }}>Son yedek:</span> <b>{d.son ? `${tarihTR(d.son)} ${d.son.slice(11, 16)}` : "Henüz alınmadı"}</b></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}><Btn tur="ghost" onClick={sec}>Klasör Seç</Btn><Btn ikon={<Ikon ad="yedek" />} onClick={al} disabled={!d.klasor || bekliyor}>Şimdi Yedek Al</Btn></div>
      {admin && !d.istemci && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Yedekten geri yükle</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Bir yedek klasörü seçin (içinde <code>data.db</code> olmalı). Mevcut veriler silinmez, <code>.pre-restore</code> uzantısıyla kenara alınır. Geri yükleme bittiğinde program yeniden başlar. Yedek bu bilgisayarda alınmış olmalıdır.</p>
          <div><Btn tur="danger" ikon={<Ikon ad="geri" />} onClick={geriYukleSec} disabled={bekliyor}>Yedek Klasörü Seç ve Geri Yükle</Btn></div>
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
