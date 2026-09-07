import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, ParaGirdi, Secim, Rozet, Onay, Modal, Bos, useToast } from "./ui.jsx";
import { db, yedek, optimize, uygulama, hataMetni, bugun } from "../lib/api.js";
import { paraTR, tarihTR, AY_ADLARI, UCRET_TIPLERI, SABIT_INDIRIM, indirimYuzdesi, aidatHesapla } from "../lib/aidat.js";
import { ParolaDegistir } from "./ParolaDegistir.jsx";
import { SettingsLisans } from "./SettingsLisans.jsx";
import { SettingsSunucu } from "./SettingsSunucu.jsx";
import { COKLU_PC_ACIK } from "../lib/ozellikler.js";
import { guncelSezon, sonrakiSezon, sezonGecerliMi, sezonSonuMu, ustGrupOner } from "../lib/sezon.js";
import { ucretTipleriYenile } from "../lib/ucretTipleri.js";
import { araEslesir } from "../lib/metin.js";
import { SABLON_ANAHTARLARI, SABLON_ADLARI, VARSAYILAN_SABLONLAR, VARSAYILAN_KULUP, YER_TUTUCULAR, sablonDoldur, aidatDegerleri, antrenmanDegerleri } from "../lib/whatsapp.js";

// WhatsApp mesaj şablonları (plan §13.2): dört şablon, yer tutucular, örnek oyuncuyla canlı önizleme, tek Kaydet.
const WA_ORNEK = { veli_ad: "Murat Yıldız", ad_soyad: "Kaan Yıldız", yil: 2026, ay: 9, tutar: 3500, kalan: 3500, odeme_donemi: "1-10", yas_grubu_ad: "U11" };
const WA_ORNEK_ANT = { tarih: "2026-09-08", saat: "18:30", saha: "Saha 2", yas_grubu_ad: "U11", iptal_nedeni: "Yağmur nedeniyle.", degisiklik_notu: JSON.stringify({ eskiTarih: "2026-09-07", eskiSaat: "17:00" }) };
function WhatsAppAyar({ saltOkunur, onKirli }) {
  const TURLER = Object.keys(SABLON_ANAHTARLARI);
  const [kayitli, setKayitli] = useState(null); // tur → metin
  const [taslak, setTaslak] = useState({});
  const [kulup, setKulup] = useState(VARSAYILAN_KULUP);
  const [onizleme, setOnizleme] = useState("aidat");
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const yukle = useCallback(async () => {
    try {
      const m = {}; for (const t of TURLER) m[t] = (await db("getSetting", SABLON_ANAHTARLARI[t])) || VARSAYILAN_SABLONLAR[t];
      setKayitli(m); setTaslak(m); setKulup((await db("getSetting", "kulup_adi")) || VARSAYILAN_KULUP);
    } catch (e) { toast("err", hataMetni(e)); }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { yukle(); }, [yukle]);
  const degisen = kayitli ? TURLER.filter((t) => taslak[t] !== kayitli[t]) : [];
  useEffect(() => { onKirli?.(degisen.length > 0); }, [degisen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onKirli?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = async () => {
    setBekliyor(true);
    try {
      for (const t of degisen) { if (!String(taslak[t]).trim()) throw new Error(`${SABLON_ADLARI[t]} şablonu boş olamaz`); await db("setSetting", SABLON_ANAHTARLARI[t], taslak[t]); }
      toast("ok", `${degisen.length} şablon kaydedildi`); await yukle();
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };
  const ornekDegerler = (t) => (t === "aidat" || t === "genel" ? aidatDegerleri(WA_ORNEK, kulup) : antrenmanDegerleri(WA_ORNEK_ANT, WA_ORNEK, kulup));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>WhatsApp Mesajları</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Program mesajı hazırlar ve kulübün WhatsApp'ında açar; Gönder'e siz basarsınız. Ücretsizdir, WhatsApp hesabı ya da API gerekmez. Yalnız mesaj onayı verilmiş velilere açılır (Oyuncu kartı &gt; Aile). Değişiklikler alttaki Kaydet ile kaydedilir.</p>
      {kayitli && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {TURLER.map((t) => (
              <label key={t} style={{ display: "flex", flexDirection: "column", gap: 6 }} onFocus={() => setOnizleme(t)}>
                <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{SABLON_ADLARI[t]}{taslak[t] !== kayitli[t] && <span style={{ color: "var(--mor)", marginLeft: 8 }}>· değişti</span>}</span>
                <textarea aria-label={SABLON_ADLARI[t]} value={taslak[t]} onChange={(e) => setTaslak({ ...taslak, [t]: e.target.value })} onFocus={() => setOnizleme(t)} disabled={saltOkunur} rows={t === "genel" ? 2 : 3} style={{ border: "1px solid var(--cizgi)", borderRadius: 10, padding: "10px 12px", fontSize: 14.5, lineHeight: 1.45, fontFamily: "inherit", resize: "vertical", background: taslak[t] !== kayitli[t] ? "var(--sari-acik)" : "#fff" }} />
              </label>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}><span style={{ fontSize: 12.5, color: "var(--soluk)", marginRight: 4 }}>Yer tutucular:</span>{YER_TUTUCULAR.map((y) => <code key={y} style={{ padding: "3px 9px", borderRadius: 999, background: "var(--mor-acik)", color: "var(--mor-koyu)", fontSize: 12.5, fontWeight: 600 }}>{`{${y}}`}</code>)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Önizleme · {SABLON_ADLARI[onizleme]} · Kaan Yıldız (örnek)</span>
            <div style={{ background: "#ECE5DD", borderRadius: 12, padding: 16 }}><div data-testid="wa-ayar-onizleme" style={{ background: "#DCF8C6", borderRadius: "12px 12px 2px 12px", padding: "10px 12px", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-line" }}>{sablonDoldur(taslak[onizleme] || "", ornekDegerler(onizleme))}</div></div>
            {!saltOkunur && taslak[onizleme] !== VARSAYILAN_SABLONLAR[onizleme] && <button type="button" onClick={() => setTaslak({ ...taslak, [onizleme]: VARSAYILAN_SABLONLAR[onizleme] })} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Varsayılan metne dön</button>}
            <div style={{ border: "1px solid var(--sari)", background: "var(--sari-acik)", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.4, color: "var(--mor-koyu)" }}><b>KVKK:</b> Veli kaydında "WhatsApp ile bilgilendirme onayı" işaretli olmalı; mevcut veliler onaylı kabul edildi (kulüp kararı). Kâğıt kayıt formuna bir onay satırı eklemeniz önerilir.</div>
          </div>
        </div>
      )}
      {!saltOkunur && degisen.length > 0 && (
        <div role="status" style={{ position: "sticky", bottom: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: "1px solid var(--sari)", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{degisen.length} şablon kaydedilmedi</span>
          <Btn tur="ghost" onClick={() => setTaslak(kayitli)} disabled={bekliyor}>Vazgeç</Btn>
          <Btn onClick={kaydet} disabled={bekliyor}>Kaydet</Btn>
        </div>
      )}
    </div>
  );
}
import { Ikon } from "./Ikon.jsx";

const BOLUMLER = [{ kod: "kulup", ad: "Kulüp ve Makbuz", ikon: "tahsilat" }, { kod: "kalem", ad: "Aidat Kalemleri", ikon: "raporlar" }, { kod: "kullanici", ad: "Kullanıcılar", ikon: "kullanici" }, { kod: "sezon", ad: "Yeni Sezon", ikon: "takvim" }, { kod: "yedek", ad: "Yedekleme", ikon: "yedek" }, { kod: "optimize", ad: "Resim ve Belge Optimizasyonu", ikon: "dosya" }, { kod: "whatsapp", ad: "WhatsApp Mesajları", ikon: "whatsapp" }, ...(COKLU_PC_ACIK ? [{ kod: "sunucu", ad: "Sunucu / Çoklu PC", ikon: "sunucu" }] : []), { kod: "lisans", ad: "Lisans", ikon: "kilit" }, { kod: "hakkinda", ad: "Hakkında", ikon: "uyari" }];

export function Ayarlar({ oturum, saltOkunur, onLisansDegisti, onModDegisti, baslangicBolum, onKurulumAc }) {
  const [bolum, setBolum] = useState(baslangicBolum || "kulup");
  const [kirli, setKirli] = useState(false);     // açık bölümde kaydedilmemiş değişiklik var mı
  const [hedefBolum, setHedefBolum] = useState(null); // onay bekleyen bölüm geçişi
  const admin = oturum?.role === "admin";
  const bolumeGit = (kod) => { if (kod === bolum) return; if (kirli) setHedefBolum(kod); else setBolum(kod); };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {BOLUMLER.map((b) => <button key={b.kod} type="button" onClick={() => bolumeGit(b.kod)} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 8, cursor: "pointer", border: 0, background: bolum === b.kod ? "var(--mor-acik)" : "transparent", color: bolum === b.kod ? "var(--mor-koyu)" : "var(--metin)", fontWeight: bolum === b.kod ? 700 : 500, fontSize: 15, display: "flex", alignItems: "center", gap: 10 }}><Ikon ad={b.ikon} /><span>{b.ad}</span></button>)}
      </Kart>
      <Kart style={{ padding: 24 }}>
        {bolum === "kulup" && <KulupAyar saltOkunur={saltOkunur} admin={admin} onKurulumAc={onKurulumAc} />}
        {bolum === "kalem" && <KalemAyar saltOkunur={saltOkunur} onKirli={setKirli} />}
        {bolum === "whatsapp" && <WhatsAppAyar saltOkunur={saltOkunur} onKirli={setKirli} />}
        {bolum === "kullanici" && <KullaniciAyar oturum={oturum} admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "yedek" && <YedekAyar admin={admin} />}
        {bolum === "sezon" && <SezonAyar admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "optimize" && <OptimizeAyar admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "sunucu" && COKLU_PC_ACIK && <SettingsSunucu admin={admin} onModDegisti={onModDegisti} />}
        {bolum === "lisans" && <SettingsLisans admin={admin} onLisansDegisti={onLisansDegisti} />}
        {bolum === "hakkinda" && <Hakkinda />}
      </Kart>
      {hedefBolum && <Onay tehlikeli mesaj="Bu bölümde kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı? (Değişiklikler kaybolur.)" onEvet={() => { setKirli(false); setBolum(hedefBolum); setHedefBolum(null); }} onHayir={() => setHedefBolum(null)} />}
    </div>
  );
}

function KulupAyar({ saltOkunur, admin, onKurulumAc }) {
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
      {admin && onKurulumAc && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>İlk kurulum sihirbazı</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Kulüp adı, aidat ve indirimler, yaş grupları, yedek klasörü ve kurtarma kodlarını adım adım gözden geçirmek için. İlk açılışta otomatik çıkar; buradan istediğiniz zaman yeniden açabilirsiniz.</p>
          <div><Btn tur="ghost" ikon={<Ikon ad="takvim" />} onClick={onKurulumAc}>Kurulum Sihirbazını Aç</Btn></div>
        </div>
      )}
    </div>
  );
}

// Aidat kalemleri + ücret tipi indirimleri: değişiklikler ekranda birikir, TEK Kaydet ile tek işlemde yazılır.
// (Satır başına Kaydet, kaydetme sonrası yenilemede diğer satırların girdisini siliyordu.)
function KalemAyar({ saltOkunur, onKirli }) {
  // Kayıtlı listeler + ekranda biriken değişiklikler (düzenleme / yeni / silme); tek Kaydet tek işlemde yazar.
  const [kalemler, setKalemler] = useState([]);   // kayıtlı kalemler
  const [taslak, setTaslak] = useState({});        // id → düzenlenen satır
  const [yeniKalemler, setYeniKalemler] = useState([]);   // [{ tmp, ad, varsayilan_fiyat }]
  const [silKalem, setSilKalem] = useState(new Set());    // silinecek id'ler
  const [yeniKalem, setYeniKalem] = useState({ ad: "", fiyat: "" });
  const [tipler, setTipler] = useState(null);      // kayıtlı ücret tipleri
  const [tipTaslak, setTipTaslak] = useState({});  // kod → { ad, indirim (metin), aktif }
  const [yeniTipler, setYeniTipler] = useState([]);       // [{ tmp, ad, indirim }]
  const [silTip, setSilTip] = useState(new Set());
  const [yeniTip, setYeniTip] = useState({ ad: "", indirim: "0" });
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();

  const tipSatiri = (t) => ({ ad: t.ad, indirim: String(indirimYuzdesi(t.kod, t.indirim)), aktif: t.aktif !== 0 });
  const yukle = useCallback(async () => {
    try {
      const l = await db("listFeeItems");
      const a = await db("aidatAyarlari");
      // Eski sürüm / test: ucretTipleri yoksa varsayılan tiplerden kur
      const tl = a.ucretTipleri?.length ? a.ucretTipleri : UCRET_TIPLERI.map((t) => ({ ...t, indirim: indirimYuzdesi(t.kod, a.indirimler?.[t.kod]), aktif: 1, sabit: SABIT_INDIRIM.has(t.kod) ? 1 : 0 }));
      setKalemler(l); setTaslak(Object.fromEntries(l.map((k) => [k.id, { ...k }]))); setYeniKalemler([]); setSilKalem(new Set());
      setTipler(tl); setTipTaslak(Object.fromEntries(tl.map((t) => [t.kod, tipSatiri(t)]))); setYeniTipler([]); setSilTip(new Set());
    } catch (e) { toast("err", hataMetni(e)); }
  }, [toast]);
  useEffect(() => { yukle(); }, [yukle]);

  const satirDegisti = (k) => { const t = taslak[k.id]; return !!t && !silKalem.has(k.id) && (t.ad !== k.ad || Number(t.varsayilan_fiyat) !== Number(k.varsayilan_fiyat) || !!t.aktif !== !!k.aktif); };
  const tipDegisti = (t) => { const d = tipTaslak[t.kod]; if (!d || silTip.has(t.kod)) return false; const k = tipSatiri(t); return d.ad !== k.ad || d.indirim !== k.indirim || d.aktif !== k.aktif; };
  const degisenKalemler = kalemler.filter(satirDegisti);
  const degisenTipler = (tipler || []).filter(tipDegisti);
  const degisiklik = degisenKalemler.length + yeniKalemler.length + silKalem.size + degisenTipler.length + yeniTipler.length + silTip.size;
  useEffect(() => { onKirli?.(degisiklik > 0); }, [degisiklik]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onKirli?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const duzenle = (id, alan, deger) => setTaslak({ ...taslak, [id]: { ...taslak[id], [alan]: deger } });
  const tipDuzenle = (kod, alan, deger) => setTipTaslak({ ...tipTaslak, [kod]: { ...tipTaslak[kod], [alan]: deger } });
  const kumeToggle = (kume, setKume, anahtar) => { const n = new Set(kume); if (n.has(anahtar)) n.delete(anahtar); else n.add(anahtar); setKume(n); };
  const kalemEkle = () => {
    const ad = yeniKalem.ad.trim(); if (!ad) return toast("err", "Kalem adı boş olamaz");
    setYeniKalemler([...yeniKalemler, { tmp: Date.now(), ad, varsayilan_fiyat: Number(yeniKalem.fiyat) || 0 }]); setYeniKalem({ ad: "", fiyat: "" });
  };
  const tipEkle = () => {
    const ad = yeniTip.ad.trim(); if (!ad) return toast("err", "Ücret tipi adı boş olamaz");
    setYeniTipler([...yeniTipler, { tmp: Date.now(), ad, indirim: Math.min(100, Math.max(0, Number(yeniTip.indirim) || 0)) }]); setYeniTip({ ad: "", indirim: "0" });
  };
  const vazgec = () => {
    setTaslak(Object.fromEntries(kalemler.map((k) => [k.id, { ...k }]))); setYeniKalemler([]); setSilKalem(new Set());
    setTipTaslak(Object.fromEntries((tipler || []).map((t) => [t.kod, tipSatiri(t)]))); setYeniTipler([]); setSilTip(new Set());
  };
  const kaydet = async () => {
    setBekliyor(true);
    try {
      const r = await db("aidatAyarlariKaydet", {
        kalemler: [
          ...degisenKalemler.map((k) => { const t = taslak[k.id]; return { id: k.id, ad: t.ad, varsayilan_fiyat: Number(t.varsayilan_fiyat) || 0, aktif: t.aktif ? 1 : 0 }; }),
          ...yeniKalemler.map((k) => ({ yeni: true, ad: k.ad, varsayilan_fiyat: k.varsayilan_fiyat })),
          ...[...silKalem].map((id) => ({ id, sil: true })),
        ],
        ucretTipleri: [
          ...degisenTipler.map((t) => { const d = tipTaslak[t.kod]; return { kod: t.kod, ad: d.ad, indirim: indirimYuzdesi(t.kod, d.indirim), aktif: d.aktif ? 1 : 0 }; }),
          ...yeniTipler.map((t) => ({ yeni: true, ad: t.ad, indirim: t.indirim })),
          ...[...silTip].map((kod) => ({ kod, sil: true })),
        ],
      });
      if (r?.error) return toast("err", r.error);
      toast("ok", `${degisiklik} değişiklik kaydedildi`);
      ucretTipleriYenile();
      await yukle();
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };

  const taban = Number(taslak[kalemler.find((k) => k.kod === "aidat")?.id]?.varsayilan_fiyat) || 0;
  const silStil = { opacity: .55, textDecoration: "line-through" };
  const baglanti = { background: "none", border: 0, padding: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>Aidat Kalemleri ve Varsayılan Fiyatlar</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Aidat satırındaki fiyat aylık aidatın taban fiyatıdır; oyuncu kaydında ücret tipine göre indirim düşülerek gelir. Diğer kalemlerin fiyatı makbuz keserken gelir, makbuzda değiştirilebilir. Makbuzda kullanılmış kalem silinemez, pasife alınır. Değişiklikler alttaki Kaydet ile birlikte kaydedilir.</p>
      <table><thead><tr><th>Kalem</th><th>Fiyat (₺)</th><th>Aktif</th><th></th></tr></thead><tbody>
        {kalemler.map((k) => { const t = taslak[k.id] || k; const d = satirDegisti(k); const sil = silKalem.has(k.id); return (
          <tr key={k.id} style={{ background: d ? "var(--sari-acik)" : sil ? "var(--kirmizi-acik, #fdecec)" : undefined }}>
            <td style={sil ? silStil : undefined}>{k.kod === "aidat" ? <b>{k.ad}</b> : <Girdi value={t.ad} onChange={(e) => duzenle(k.id, "ad", e.target.value)} disabled={saltOkunur || sil} aria-label={`${k.ad} adı`} style={{ height: 36, width: 240 }} />}</td>
            <td><ParaGirdi value={t.varsayilan_fiyat} onDegis={(v) => duzenle(k.id, "varsayilan_fiyat", v)} disabled={saltOkunur || sil} aria-label={`${k.ad} fiyatı`} style={{ height: 36, width: 140 }} /></td>
            <td>{k.kod === "aidat" ? <Rozet ton="green">Aktif</Rozet> : <input type="checkbox" checked={!!t.aktif} onChange={(e) => duzenle(k.id, "aktif", e.target.checked)} disabled={saltOkunur || sil} aria-label={`${k.ad} aktif`} />}</td>
            <td style={{ textAlign: "right" }}>{k.kod !== "aidat" && !saltOkunur && (sil
              ? <button type="button" style={baglanti} onClick={() => kumeToggle(silKalem, setSilKalem, k.id)}>Geri al</button>
              : <Btn tur="danger" kucuk onClick={() => kumeToggle(silKalem, setSilKalem, k.id)} aria-label={`${k.ad} sil`}>Sil</Btn>)}</td>
          </tr>
        ); })}
        {yeniKalemler.map((k) => (
          <tr key={"y" + k.tmp} style={{ background: "var(--sari-acik)" }}>
            <td><b>{k.ad}</b> <Rozet ton="yellow">Yeni</Rozet></td><td>{paraTR(k.varsayilan_fiyat)}</td><td><Rozet ton="green">Aktif</Rozet></td>
            <td style={{ textAlign: "right" }}><button type="button" style={baglanti} onClick={() => setYeniKalemler(yeniKalemler.filter((x) => x.tmp !== k.tmp))}>Kaldır</button></td>
          </tr>
        ))}
        {!saltOkunur && (
          <tr>
            <td><Girdi value={yeniKalem.ad} onChange={(e) => setYeniKalem({ ...yeniKalem, ad: e.target.value })} placeholder="Yeni kalem adı" aria-label="Yeni kalem adı" style={{ height: 36, width: 240 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); kalemEkle(); } }} /></td>
            <td><ParaGirdi value={yeniKalem.fiyat} onDegis={(v) => setYeniKalem({ ...yeniKalem, fiyat: v })} aria-label="Yeni kalem fiyatı" style={{ height: 36, width: 140 }} /></td>
            <td></td>
            <td style={{ textAlign: "right" }}><Btn tur="ghost" kucuk ikon={<Ikon ad="arti" />} onClick={kalemEkle}>Kalem Ekle</Btn></td>
          </tr>
        )}
      </tbody></table>

      {tipler && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          <h3 style={{ fontSize: 22 }}>Ücret Tipleri ve İndirimler</h3>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Yeni oyuncu kaydında ücret tipi seçilince aylık aidat şöyle hesaplanır: taban fiyat − indirim yüzdesi. Tutar oyuncu kartında elle değiştirilebilir. %100 indirim aidattan muaf demektir. Normal ve Ücretsiz sabittir; oyuncusu olan tip silinemez, pasife alınır.</p>
          <table><thead><tr><th>Ücret tipi</th><th>İndirim (%)</th><th>Hesaplanan aylık aidat</th><th>Aktif</th><th></th></tr></thead><tbody>
            {tipler.map((t) => {
              const sabit = !!t.sabit || SABIT_INDIRIM.has(t.kod);
              const d = tipTaslak[t.kod] || tipSatiri(t); const sil = silTip.has(t.kod);
              const hesap = aidatHesapla(taban, t.kod, { [t.kod]: d.indirim });
              return (
                <tr key={t.kod} style={{ background: tipDegisti(t) ? "var(--sari-acik)" : sil ? "var(--kirmizi-acik, #fdecec)" : undefined }}>
                  <td style={sil ? silStil : undefined}><Girdi value={d.ad} onChange={(e) => tipDuzenle(t.kod, "ad", e.target.value)} disabled={saltOkunur || sil} aria-label={`${t.ad} adı`} style={{ height: 36, width: 220, fontWeight: 600 }} /></td>
                  <td>{sabit ? <span style={{ color: "var(--soluk)" }}>%{d.indirim}</span> : <Girdi type="number" min="0" max="100" value={d.indirim} onChange={(e) => tipDuzenle(t.kod, "indirim", e.target.value)} disabled={saltOkunur || sil} aria-label={`${t.ad} indirimi`} style={{ height: 36, width: 110 }} />}</td>
                  <td>{hesap === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(hesap)}</b>}</td>
                  <td>{sabit ? <Rozet ton="green">Aktif</Rozet> : <input type="checkbox" checked={!!d.aktif} onChange={(e) => tipDuzenle(t.kod, "aktif", e.target.checked)} disabled={saltOkunur || sil} aria-label={`${t.ad} aktif`} />}</td>
                  <td style={{ textAlign: "right" }}>{!sabit && !saltOkunur && (sil
                    ? <button type="button" style={baglanti} onClick={() => kumeToggle(silTip, setSilTip, t.kod)}>Geri al</button>
                    : <Btn tur="danger" kucuk onClick={() => kumeToggle(silTip, setSilTip, t.kod)} aria-label={`${t.ad} sil`}>Sil</Btn>)}</td>
                </tr>
              );
            })}
            {yeniTipler.map((t) => { const hesap = aidatHesapla(taban, "yeni", { yeni: t.indirim }); return (
              <tr key={"y" + t.tmp} style={{ background: "var(--sari-acik)" }}>
                <td><b>{t.ad}</b> <Rozet ton="yellow">Yeni</Rozet></td><td>%{t.indirim}</td><td>{hesap === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(hesap)}</b>}</td><td><Rozet ton="green">Aktif</Rozet></td>
                <td style={{ textAlign: "right" }}><button type="button" style={baglanti} onClick={() => setYeniTipler(yeniTipler.filter((x) => x.tmp !== t.tmp))}>Kaldır</button></td>
              </tr>
            ); })}
            {!saltOkunur && (
              <tr>
                <td><Girdi value={yeniTip.ad} onChange={(e) => setYeniTip({ ...yeniTip, ad: e.target.value })} placeholder="Yeni ücret tipi adı" aria-label="Yeni ücret tipi adı" style={{ height: 36, width: 220 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); tipEkle(); } }} /></td>
                <td><Girdi type="number" min="0" max="100" value={yeniTip.indirim} onChange={(e) => setYeniTip({ ...yeniTip, indirim: e.target.value })} aria-label="Yeni ücret tipi indirimi" style={{ height: 36, width: 110 }} /></td>
                <td colSpan={2}></td>
                <td style={{ textAlign: "right" }}><Btn tur="ghost" kucuk ikon={<Ikon ad="arti" />} onClick={tipEkle}>Ücret Tipi Ekle</Btn></td>
              </tr>
            )}
          </tbody></table>
        </div>
      )}

      {!saltOkunur && degisiklik > 0 && (
        <div role="status" style={{ position: "sticky", bottom: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: "1px solid var(--sari)", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{degisiklik} değişiklik kaydedilmedi</span>
          <Btn tur="ghost" onClick={vazgec} disabled={bekliyor}>Vazgeç</Btn>
          <Btn onClick={kaydet} disabled={bekliyor}>Kaydet</Btn>
        </div>
      )}
    </div>
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
export function KurtarmaKodlari({ username, kodlar, onKapat, kapatMetni = "Kaydettim, Kapat" }) {
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
    <Modal baslik={`${username} — Kurtarma Kodları`} onKapat={onKapat} genislik={520} altBar={<><Btn tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={yazdir}>Yazdır</Btn><Btn tur="ghost" onClick={kopyala}>Kopyala</Btn><Btn onClick={onKapat}>{kapatMetni}</Btn></>}>
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

// Yeni sezon sihirbazı (plan §10): yenileyenleri işaretle → yenilemeyenler pasif, yenileyenler yeni sezon (+ üst grup).
function SezonAyar({ admin, saltOkunur }) {
  const [durum, setDurum] = useState(null);   // sezonDurumu
  const [adaylar, setAdaylar] = useState(null);
  const [gruplar, setGruplar] = useState([]);
  const [secim, setSecim] = useState({});     // id → { yeniledi, yas_grubu_id }
  const [yeniSezon, setYeniSezon] = useState("");
  const [eskiBorcSil, setEskiBorcSil] = useState(false);
  const [onay, setOnay] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const iso = bugun().iso;

  const yukle = useCallback(async () => {
    try {
      const d = await db("sezonDurumu"); setDurum(d);
      const g = await db("listAgeGroups"); setGruplar(g);
      const l = await db("sezonAdayListesi"); setAdaylar(l);
      setSecim(Object.fromEntries(l.map((o) => [o.id, { yeniledi: false, yas_grubu_id: ustGrupOner(g, o.yas_grubu_id) }])));
      setYeniSezon(d.aktifSezon ? sonrakiSezon(d.aktifSezon) : guncelSezon(iso, d.baslangicAyi));
    } catch (e) { toast("err", hataMetni(e)); }
  }, [toast, iso]);
  useEffect(() => { yukle(); }, [yukle]);

  const ayKaydet = async (ay) => { try { await db("setSetting", "sezon_baslangic_ayi", String(ay)); toast("ok", "Sezon başlangıç ayı kaydedildi"); yukle(); } catch (e) { toast("err", hataMetni(e)); } };
  const aktifSezonKaydet = async (sz) => { if (!sezonGecerliMi(sz)) return toast("err", "Sezon 2026-2027 biçiminde olmalı"); try { await db("setSetting", "aktif_sezon", sz); toast("ok", "Aktif sezon kaydedildi"); yukle(); } catch (e) { toast("err", hataMetni(e)); } };
  const [grupFiltre, setGrupFiltre] = useState("");
  const [ara, setAra] = useState("");
  // Filtre yalnız GÖRÜNÜMÜ daraltır; işaretler ve alttaki özet tüm liste üzerinden hesaplanır.
  const gorunen = (adaylar || []).filter((o) => (!grupFiltre || String(o.yas_grubu_id) === grupFiltre) && (!ara.trim() || araEslesir(o.ad_soyad, ara)));
  const filtreli = !!grupFiltre || !!ara.trim();
  const hepsi = (deger) => { const ids = new Set(gorunen.map((o) => String(o.id))); setSecim(Object.fromEntries(Object.entries(secim).map(([id, v]) => [id, ids.has(id) ? { ...v, yeniledi: deger } : v]))); };
  const yenileyenler = adaylar ? adaylar.filter((o) => secim[o.id]?.yeniledi) : [];
  const yenilemeyenler = adaylar ? adaylar.filter((o) => !secim[o.id]?.yeniledi) : [];
  const eskiBorc = yenilemeyenler.reduce((t, o) => t + (o.borc_tutar || 0), 0);
  const gec = async () => {
    setOnay(false); setBekliyor(true);
    try {
      const r = await db("yeniSezonaGec", { sezon: yeniSezon, eskiBorcSil, yenileyenler: yenileyenler.map((o) => ({ id: o.id, yas_grubu_id: secim[o.id].yas_grubu_id })) });
      if (r?.error) return toast("err", r.error);
      setSonuc(r); toast("ok", `${r.sezon} sezonuna geçildi`); yukle();
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };

  if (!admin) return <div style={{ color: "var(--soluk)" }}>Bu bölüm yalnız yöneticiler içindir.</div>;
  if (!durum || !adaylar) return null;
  const sezonSonu = durum.aktifSezon && sezonSonuMu(durum.aktifSezon, iso, durum.baslangicAyi);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ fontSize: 22 }}>Yeni Sezon</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Sezon bitince yılda bir kez çalıştırılır. Yenileyen oyuncular yeni sezona geçer (isteğe bağlı bir üst yaş grubuna), yenilemeyenler <b>silinmez</b>, "Pasif" olur: aidat borcu açılmaz, listelerde görünmez; makbuz, yoklama ve belgeleri kalır. Geri dönerse kartından durumu Aktif yapmak yeter.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Alan etiket="Aktif sezon" style={{ width: 160 }}><Girdi defaultValue={durum.aktifSezon} placeholder="2026-2027" aria-label="Aktif sezon" onBlur={(e) => e.target.value !== durum.aktifSezon && aktifSezonKaydet(e.target.value.trim())} disabled={saltOkunur} /></Alan>
        <Alan etiket="Sezon başlangıç ayı" style={{ width: 180 }}><Secim secenekler={AY_ADLARI.map((a, i) => ({ kod: i + 1, ad: a }))} value={durum.baslangicAyi} onChange={(e) => ayKaydet(Number(e.target.value))} aria-label="Sezon başlangıç ayı" disabled={saltOkunur} /></Alan>
        <div style={{ fontSize: 13, color: "var(--soluk)", paddingBottom: 10 }}>{durum.sonGecis ? `Son geçiş: ${tarihTR(durum.sonGecis)}` : "Henüz sezon geçişi yapılmadı"}{sezonSonu ? " · " : ""}{sezonSonu && <b style={{ color: "var(--kirmizi)" }}>{durum.aktifSezon} sezonu bitti, geçiş bekliyor</b>}</div>
      </div>

      {sonuc && <div role="status" style={{ background: "var(--yesil-acik)", border: "1.5px solid var(--yesil)", borderRadius: 10, padding: "12px 16px" }}><b>{sonuc.sezon} sezonuna geçildi.</b> {sonuc.yenilenen} oyuncu yeniledi{sonuc.grupDegisen ? ` (${sonuc.grupDegisen} üst gruba taşındı)` : ""}, {sonuc.pasif} oyuncu pasife alındı{sonuc.borcSilinen ? `, ${sonuc.borcSilinen} eski aidat kaydı silindi` : ""}.</div>}

      <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "sticky", top: -24, zIndex: 2, background: "#fff", padding: "8px 0", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Alan etiket="Geçilecek sezon" style={{ width: 150 }}><Girdi value={yeniSezon} onChange={(e) => setYeniSezon(e.target.value.trim())} aria-label="Geçilecek sezon" disabled={saltOkunur} /></Alan>
          <Alan etiket="Yaş grubu" style={{ width: 160 }}><Secim secenekler={gruplar} bos="Tüm gruplar" value={grupFiltre} onChange={(e) => setGrupFiltre(e.target.value)} aria-label="Yaş grubu filtresi" /></Alan>
          <Alan etiket="Ara" style={{ width: 180 }}><Girdi value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Ad soyad" aria-label="Oyuncu ara" /></Alan>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8, paddingBottom: 4, whiteSpace: "nowrap" }}>
            <Btn kucuk tur="ghost" onClick={() => hepsi(true)} disabled={saltOkunur || gorunen.length === 0}>{filtreli ? "Görünenleri yeniledi işaretle" : "Tümünü yeniledi işaretle"}</Btn>
            <Btn kucuk tur="ghost" onClick={() => hepsi(false)} disabled={saltOkunur || gorunen.length === 0}>{filtreli ? "Görünenleri kaldır" : "Tümünü kaldır"}</Btn>
          </div>
        </div>
        {filtreli && <div style={{ fontSize: 13, color: "var(--soluk)" }}>{gorunen.length} / {adaylar.length} oyuncu gösteriliyor · işaretler ve özet tüm liste için geçerli</div>}
        {adaylar.length === 0 ? <Bos metin="Aktif oyuncu yok." /> : (
          <table><thead style={{ position: "sticky", top: 74, zIndex: 1, background: "#fff" }}><tr><th>Yeniledi</th><th>Oyuncu</th><th>Mevcut grup</th><th>Yeni sezon grubu</th><th>Ödenmemiş aidat</th></tr></thead><tbody>
            {gorunen.length === 0 && <tr><td colSpan={5} style={{ color: "var(--soluk)" }}>Filtreye uyan oyuncu yok.</td></tr>}
            {gorunen.map((o) => { const sc = secim[o.id]; return (
              <tr key={o.id} style={{ background: sc?.yeniledi ? "var(--yesil-acik)" : undefined }}>
                <td><input type="checkbox" checked={!!sc?.yeniledi} onChange={(e) => setSecim({ ...secim, [o.id]: { ...sc, yeniledi: e.target.checked } })} aria-label={`${o.ad_soyad} yeniledi`} disabled={saltOkunur} style={{ width: 20, height: 20 }} /></td>
                <td style={{ fontWeight: 600 }}>{o.ad_soyad}{o.durum !== "aktif" && <span style={{ color: "var(--soluk)", fontWeight: 400 }}> · {o.durum === "deneme" ? "Deneme" : "Sakat"}</span>}</td>
                <td>{o.yas_grubu_ad || "—"}</td>
                <td>{sc?.yeniledi ? <Secim secenekler={gruplar.filter((g) => g.aktif)} bos="Grup yok" value={sc.yas_grubu_id || ""} onChange={(e) => setSecim({ ...secim, [o.id]: { ...sc, yas_grubu_id: e.target.value ? Number(e.target.value) : null } })} aria-label={`${o.ad_soyad} yeni grup`} style={{ height: 36, width: 150 }} /> : <span style={{ color: "var(--soluk)" }}>Pasife alınacak</span>}</td>
                <td>{o.borc_adet > 0 ? <Rozet ton="red">{o.borc_adet} ay · {paraTR(o.borc_tutar)}</Rozet> : <span style={{ color: "var(--soluk)" }}>—</span>}</td>
              </tr>
            ); })}
          </tbody></table>
        )}
        {adaylar.length > 0 && (
          <div style={{ background: "var(--zemin)", border: "1px solid var(--cizgi)", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <div data-testid="sezon-ozet"><b>{yenileyenler.length}</b> oyuncu {yeniSezon || "yeni"} sezonuna geçecek · <b>{yenilemeyenler.length}</b> oyuncu pasife alınacak</div>
            {eskiBorc > 0 && <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={eskiBorcSil} onChange={(e) => setEskiBorcSil(e.target.checked)} disabled={saltOkunur} /> Yenilemeyenlerin ödenmemiş eski aidatını ({paraTR(eskiBorc)}) sil (kayıt "muaf" olur; işaretlenmezse borç kayıtta kalır, raporlarda görünür)</label>}
            {!saltOkunur && <div><Btn ikon={<Ikon ad="takvim" />} onClick={() => { if (!sezonGecerliMi(yeniSezon)) return toast("err", "Geçilecek sezon 2027-2028 biçiminde olmalı"); setOnay(true); }} disabled={bekliyor}>Yeni Sezona Geç</Btn></div>}
          </div>
        )}
      </div>
      {onay && <Onay tehlikeli mesaj={`${yeniSezon} sezonuna geçilsin mi? ${yenileyenler.length} oyuncu yeni sezona geçecek, ${yenilemeyenler.length} oyuncu pasife alınacak${eskiBorcSil ? ", eski borçlar silinecek" : ""}. Pasife alınanlar silinmez, kartından yeniden aktif yapılabilir.`} onEvet={gec} onHayir={() => setOnay(false)} />}
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
