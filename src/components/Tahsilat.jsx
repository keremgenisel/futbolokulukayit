import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, Avatar, Rozet, Onay, Bos, useToast, ParaGirdi } from "./ui.jsx";
import { db, cikti, bugun, hataMetni } from "../lib/api.js";
import { ODEME_YONTEMLERI, paraTR, tarihTR, AY_ADLARI, aidatKalan } from "../lib/aidat.js";
import { makbuzHtmlUret, makbuzYazdir } from "../lib/yazdir.js";
import { Ikon } from "./Ikon.jsx";

export function Tahsilat({ oturum, saltOkunur, onOyuncu, secilenOyuncuId, onSecildi }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [oyuncu, setOyuncu] = useState(null);
  const [aidatlar, setAidatlar] = useState([]);
  const [kalemler, setKalemler] = useState([]);
  const [secili, setSecili] = useState({}); // fee_item_id → tutar (string) — aidat dışı kalemler
  const [aidatAylar, setAidatAylar] = useState({}); // "yil-ay" → tutar (string): tek makbuzda birden fazla ay
  const ayAnahtar = (y, a) => `${y}-${a}`;
  const ayCoz = (k) => { const [y, a] = k.split("-").map(Number); return { yil: y, ay: a }; };
  const [yontem, setYontem] = useState("nakit");
  const [tarih, setTarih] = useState(bugun().iso);
  const [tahsilEden, setTahsilEden] = useState(oturum?.ad_soyad || "");
  const [not_, setNot] = useState("");
  const [bugunku, setBugunku] = useState([]);
  const [iptal, setIptal] = useState(null);
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const { yil, ay } = bugun();

  const bugunkuYukle = useCallback(async () => { try { setBugunku(await db("listReceiptsByDate", bugun().iso, bugun().iso)); } catch {} }, []);
  useEffect(() => {
    db("listFeeItems").then(setKalemler).catch(() => {});
    db("getSetting", "tahsil_eden").then((v) => { if (v && !oturum?.ad_soyad) setTahsilEden(v); }).catch(() => {});
    bugunkuYukle();
  }, [bugunkuYukle, oturum]);

  useEffect(() => {
    if (!q.trim()) { setSonuc([]); return; }
    const t = setTimeout(() => db("listPlayersWithDue", { q: q.trim(), yil, ay }).then((l) => setSonuc(l.slice(0, 8))).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [q, yil, ay]);

  const oyuncuSec = useCallback(async (id) => {
    try {
      const p = await db("getPlayer", id); setOyuncu(p); setQ(""); setSonuc([]);
      const d = await db("listDues", id); setAidatlar(d);
      const ilkBorc = [...d].reverse().find((x) => x.durum === "odenmedi" || x.durum === "kismi"); // en eski borç önce
      const secim = ilkBorc ? { yil: ilkBorc.yil, ay: ilkBorc.ay } : { yil, ay };
      const muaf = p.ucret_tipi === "ucretsiz" || !(p.aylik_aidat > 0);
      setAidatAylar(muaf ? {} : { [ayAnahtar(secim.yil, secim.ay)]: String(ilkBorc ? aidatKalan(ilkBorc) : p.aylik_aidat) });
      setSecili({});
    } catch (e) { toast("err", hataMetni(e)); }
  }, [yil, ay, toast]);

  useEffect(() => { if (secilenOyuncuId && kalemler.length) { oyuncuSec(secilenOyuncuId); onSecildi?.(); } }, [secilenOyuncuId, kalemler, oyuncuSec, onSecildi]);

  const donemSecenekleri = (() => {
    const borclar = aidatlar.filter((a) => a.durum === "odenmedi" || a.durum === "kismi").map((a) => ({ yil: a.yil, ay: a.ay, borc: true, kismi: a.durum === "kismi", kalan: aidatKalan(a) })).sort((a, b) => (a.yil - b.yil) || (a.ay - b.ay));
    const gelecek = [];
    let y = yil, m = ay;
    for (let i = 0; i < 3; i++) { if (!aidatlar.some((a) => a.yil === y && a.ay === m && a.durum !== "odenmedi" && a.durum !== "kismi") && !borclar.some((b) => b.yil === y && b.ay === m)) gelecek.push({ yil: y, ay: m }); m++; if (m > 12) { m = 1; y++; } }
    return [...borclar, ...gelecek];
  })();

  const aidatKalem = kalemler.find((k) => k.kod === "aidat");
  const aidatToplam = Object.values(aidatAylar).reduce((s, v) => s + (Number(v) || 0), 0);
  const toplam = Object.values(secili).reduce((s, v) => s + (Number(v) || 0), 0) + aidatToplam;
  const aidatSecili = Object.keys(aidatAylar).length > 0;
  const ayToggle = (d) => {
    const k = ayAnahtar(d.yil, d.ay); const n = { ...aidatAylar };
    if (n[k] !== undefined) delete n[k];
    else { const a = aidatlar.find((x) => x.yil === d.yil && x.ay === d.ay && (x.durum === "odenmedi" || x.durum === "kismi")); n[k] = String(a ? aidatKalan(a) : oyuncu?.aylik_aidat || ""); }
    setAidatAylar(n);
  };
  const kalemToggle = (k) => {
    if (k.kod === "aidat") { if (aidatSecili) setAidatAylar({}); else if (donemSecenekleri[0]) ayToggle(donemSecenekleri[0]); return; }
    if (secili[k.id] !== undefined) { const n = { ...secili }; delete n[k.id]; setSecili(n); }
    else setSecili({ ...secili, [k.id]: String(k.varsayilan_fiyat || "") });
  };
  const secliAylar = Object.keys(aidatAylar).map(ayCoz).sort((a, b) => (a.yil - b.yil) || (a.ay - b.ay));
  const aidatEtiket = secliAylar.length ? "Aidat · " + secliAylar.map((d) => `${AY_ADLARI[d.ay - 1]} ${d.yil}`).join(", ") : "Aidat";

  const kaydet = async (yazdir) => {
    if (!oyuncu) return toast("err", "Önce oyuncu seçin");
    const aidatSatirlari = aidatKalem ? Object.entries(aidatAylar).filter(([, v]) => Number(v) > 0).map(([k, v]) => { const d = ayCoz(k); return { fee_item_id: aidatKalem.id, tutar: Number(v), aciklama: `${AY_ADLARI[d.ay - 1]} ${d.yil}`, yil: d.yil, ay: d.ay }; })
      .sort((a, b) => (a.yil - b.yil) || (a.ay - b.ay)) : [];
    const digerSatirlar = Object.entries(secili).filter(([, v]) => Number(v) > 0).map(([id, v]) => { const k = kalemler.find((x) => x.id === Number(id)); return { fee_item_id: Number(id), tutar: Number(v), aciklama: k?.ad || "", yil: null, ay: null }; });
    const satirlar = [...aidatSatirlari, ...digerSatirlar];
    if (!satirlar.length) return toast("err", "En az bir kalem seçin");
    setBekliyor(true);
    try {
      const r = await db("createReceipt", { player_id: oyuncu.id, tarih, odeme_yontemi: yontem, tahsil_eden: tahsilEden, not_, satirlar });
      const html = await makbuzHtmlUret(r.id);
      await cikti().makbuzPdf(r.id, html);
      toast("ok", `Makbuz ${r.makbuz_no} kaydedildi`);
      if (yazdir) { const y = await makbuzYazdir(r.id, html); if (!y.ok) toast("err", y.mesaj); }
      setOyuncu(null); setSecili({}); setAidatAylar({}); setNot(""); setAidatlar([]);
      bugunkuYukle();
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };

  const yazdir = async (id) => { try { const y = await makbuzYazdir(id); if (!y.ok) toast("err", y.mesaj); } catch (e) { toast("err", hataMetni(e)); } };
  const iptalEt = async () => { try { await db("cancelReceipt", iptal.id); toast("ok", "Makbuz iptal edildi"); setIptal(null); bugunkuYukle(); } catch (e) { toast("err", hataMetni(e)); } };

  const bugunToplam = bugunku.reduce((s, m) => s + m.toplam, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Rozet ton="purple" style={{ fontSize: 14, padding: "8px 14px" }}>Bugünkü tahsilat: {paraTR(bugunToplam)}</Rozet></div>
      {saltOkunur ? <Kart style={{ padding: 20, color: "var(--kirmizi)", fontWeight: 600 }}>Lisans salt okunur modda: makbuz kesilemez.</Kart> : (
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, alignItems: "start" }}>
        <Kart style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ fontSize: 22 }}>Oyuncu</h3>
          {oyuncu ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 10, border: "1px solid var(--mor)", background: "var(--mor-acik)" }}>
              <Avatar ad={oyuncu.ad_soyad} boyut={48} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{oyuncu.ad_soyad}</div><div style={{ fontSize: 13, color: "var(--soluk)" }}>{oyuncu.yas_grubu_ad || "Grup yok"} · {tarihTR(oyuncu.dogum_tarihi)} · {paraTR(oyuncu.aylik_aidat)}/ay</div></div>
              <Btn kucuk tur="ghost" onClick={() => onOyuncu?.(oyuncu.id)}>Kart</Btn>
              <Btn kucuk tur="ghost" onClick={() => { setOyuncu(null); setSecili({}); setAidatlar([]); }}>Değiştir</Btn>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: 11, color: "var(--soluk)" }}><Ikon ad="ara" /></span><Girdi placeholder="Ad, soyad veya TC ile oyuncu ara" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Oyuncu ara" style={{ paddingLeft: 40 }} />
              {sonuc.length > 0 && (
                <div style={{ position: "absolute", top: 46, left: 0, right: 0, background: "#fff", border: "1px solid var(--cizgi)", borderRadius: 10, boxShadow: "0 12px 30px rgba(27,21,48,.15)", zIndex: 5, overflow: "hidden" }}>
                  {sonuc.map((s) => <div key={s.id} onClick={() => oyuncuSec(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--cizgi)" }}><Avatar ad={s.ad_soyad} boyut={30} /><span style={{ fontWeight: 600, flex: 1 }}>{s.ad_soyad}</span><span style={{ color: "var(--soluk)", fontSize: 13 }}>{s.yas_grubu_ad || ""}</span><Rozet ton={s.aidat_durum === "odenmedi" ? "red" : "green"}>{s.aidat_durum === "odenmedi" ? "Borç" : "Temiz"}</Rozet></div>)}
                </div>
              )}
            </div>
          )}
          {oyuncu && aidatKalem && (
            <div>
              <div style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Aidat dönemi <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· birden fazla ay seçilebilir, tek makbuz kesilir</span></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {donemSecenekleri.map((d) => { const aktif = aidatAylar[ayAnahtar(d.yil, d.ay)] !== undefined; return (
                  <button key={`${d.yil}-${d.ay}`} type="button" onClick={() => ayToggle(d)} aria-pressed={aktif} aria-label={`${AY_ADLARI[d.ay - 1]} ${d.yil}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, border: `1px solid ${aktif ? (d.borc ? "var(--kirmizi)" : "var(--mor)") : "var(--cizgi)"}`, background: aktif ? (d.borc ? "var(--kirmizi-acik)" : "var(--mor-acik)") : "#fff", color: aktif ? (d.borc ? "var(--kirmizi)" : "var(--mor)") : "var(--soluk)" }}>{d.borc ? <Ikon ad="uyari" boyut={16} /> : null}{AY_ADLARI[d.ay - 1]} {d.yil}{d.borc ? (d.kismi ? ` · kalan ${paraTR(d.kalan)}` : " · ödenmedi") : ""}</button>
                ); })}
              </div>
            </div>
          )}
          <h3 style={{ fontSize: 22 }}>Kalemler</h3>
          <div>
            {kalemler.filter((k) => k.aktif).map((k) => {
              if (k.kod === "aidat") return (
                <div key={k.id} style={{ borderBottom: "1px solid var(--cizgi)", padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <input type="checkbox" checked={aidatSecili} onChange={() => kalemToggle(k)} disabled={!oyuncu || !donemSecenekleri.length} aria-label={k.ad} style={{ width: 20, height: 20 }} />
                    <span style={{ flex: 1, fontWeight: aidatSecili ? 700 : 400 }}>{aidatEtiket}</span>
                    <span style={{ width: 140, textAlign: "right", fontWeight: 700 }}>{aidatSecili ? paraTR(aidatToplam) : ""}</span>
                  </div>
                  {secliAylar.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, paddingLeft: 34 }}>
                      {secliAylar.map((d) => { const key = ayAnahtar(d.yil, d.ay); return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 14 }}>
                          <span style={{ flex: 1, color: "var(--soluk)" }}>{AY_ADLARI[d.ay - 1]} {d.yil}</span>
                          <ParaGirdi value={aidatAylar[key]} onDegis={(v) => setAidatAylar({ ...aidatAylar, [key]: v })} style={{ width: 140, height: 36 }} aria-label={`${AY_ADLARI[d.ay - 1]} ${d.yil} aidat tutarı`} />
                        </div>
                      ); })}
                    </div>
                  )}
                </div>
              );
              const on = secili[k.id] !== undefined; return (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", borderBottom: "1px solid var(--cizgi)" }}>
                <input type="checkbox" checked={on} onChange={() => kalemToggle(k)} disabled={!oyuncu} aria-label={k.ad} style={{ width: 20, height: 20 }} />
                <span style={{ flex: 1, fontWeight: on ? 700 : 400 }}>{k.ad}</span>
                <ParaGirdi value={on ? secili[k.id] : ""} disabled={!on} onDegis={(v) => setSecili({ ...secili, [k.id]: v })} style={{ width: 140, height: 40, fontWeight: 700 }} aria-label={`${k.ad} tutar`} />
              </div>
            ); })}
          </div>
        </Kart>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Kart style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 22 }}>Ödeme</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ODEME_YONTEMLERI.map((y) => <button key={y.kod} type="button" onClick={() => setYontem(y.kod)} style={{ height: 42, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, border: `1px solid ${yontem === y.kod ? "var(--mor)" : "var(--cizgi)"}`, background: yontem === y.kod ? "var(--mor)" : "#fff", color: yontem === y.kod ? "#fff" : "var(--metin)" }}>{y.ad}</button>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Alan etiket="Tarih"><Girdi type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Alan>
              <Alan etiket="Tahsil eden"><Girdi value={tahsilEden} onChange={(e) => setTahsilEden(e.target.value)} /></Alan>
            </div>
            <Alan etiket="Not"><Girdi value={not_} onChange={(e) => setNot(e.target.value)} placeholder="İsteğe bağlı" /></Alan>
          </Kart>
          <div style={{ background: "var(--mor-koyu)", borderRadius: 12, color: "#fff", padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            {secliAylar.filter((d) => Number(aidatAylar[ayAnahtar(d.yil, d.ay)]) > 0).map((d) => <div key={ayAnahtar(d.yil, d.ay)} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#D8CCE9" }}><span>Aidat · {AY_ADLARI[d.ay - 1]} {d.yil}</span><span>{paraTR(aidatAylar[ayAnahtar(d.yil, d.ay)])}</span></div>)}
            {Object.entries(secili).filter(([, v]) => Number(v) > 0).map(([id, v]) => { const k = kalemler.find((x) => x.id === Number(id)); return <div key={id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#D8CCE9" }}><span>{k?.ad}</span><span>{paraTR(v)}</span></div>; })}
            <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span className="baslik" style={{ color: "#fff", fontSize: 22 }}>TOPLAM</span><span className="baslik" style={{ fontSize: 40, color: "var(--sari)" }}>{paraTR(toplam)}</span></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn tur="ghost" ikon={<Ikon ad="dosya" />} onClick={() => kaydet(false)} disabled={bekliyor || !oyuncu} style={{ flex: 1, height: 52 }}>Kaydet</Btn>
            <Btn tur="sari" ikon={<Ikon ad="yazdir" />} onClick={() => kaydet(true)} disabled={bekliyor || !oyuncu} style={{ flex: 2, height: 52, fontSize: 15 }}>Kaydet ve Yazdır</Btn>
          </div>
        </div>
      </div>)}
      <Kart>
        <div style={{ padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 20 }}>Bugün Kesilen Makbuzlar</h3><span style={{ color: "var(--soluk)", fontSize: 14 }}>{bugunku.length} makbuz</span></div>
        {bugunku.length === 0 ? <Bos metin="Bugün henüz makbuz kesilmedi." /> : (
          <table><thead><tr><th>No</th><th>Oyuncu</th><th>Tutar</th><th>Yöntem</th><th>Tahsil eden</th><th style={{ width: 200 }}></th></tr></thead><tbody>
            {bugunku.map((m) => <tr key={m.id}><td>{m.makbuz_no}</td><td style={{ fontWeight: 600 }}>{m.ad_soyad}</td><td>{paraTR(m.toplam)}</td><td>{ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad}</td><td>{m.tahsil_eden}</td><td><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Btn kucuk tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={() => yazdir(m.id)}>Yazdır</Btn>{!saltOkunur && <Btn kucuk tur="danger" onClick={() => setIptal(m)}>İptal</Btn>}</div></td></tr>)}
          </tbody></table>
        )}
      </Kart>
      {iptal && <Onay tehlikeli mesaj={`${iptal.makbuz_no} numaralı makbuz iptal edilecek, aidat kaydı tekrar "ödenmedi" olacak. Emin misiniz?`} onEvet={iptalEt} onHayir={() => setIptal(null)} />}
    </div>
  );
}
