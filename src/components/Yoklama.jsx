import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Avatar, Rozet, Onay, Bos, useToast } from "./ui.jsx";
import { db, bugun, hataMetni } from "../lib/api.js";
import { tarihTR } from "../lib/aidat.js";
import { Ikon } from "./Ikon.jsx";

export function Yoklama({ saltOkunur }) {
  const [tarih, setTarih] = useState(bugun().iso);
  const [gruplar, setGruplar] = useState([]);
  const [antrenmanlar, setAntrenmanlar] = useState([]);
  const [aktif, setAktif] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [yoklama, setYoklama] = useState({}); // player_id → durum
  const [yeni, setYeni] = useState({ age_group_id: "", saat: "", saha: "" });
  const [iptal, setIptal] = useState(null);
  const toast = useToast();

  const antrenmanlariYukle = useCallback(async () => {
    try { const l = await db("listTrainings", tarih, tarih); setAntrenmanlar(l); if (aktif && !l.some((t) => t.id === aktif.id)) setAktif(null); }
    catch (e) { toast("err", hataMetni(e)); }
  }, [tarih, aktif, toast]);
  useEffect(() => { db("listAgeGroups").then((g) => setGruplar(g.filter((x) => x.aktif))).catch(() => {}); }, []);
  useEffect(() => { antrenmanlariYukle(); }, [tarih]); // eslint-disable-line react-hooks/exhaustive-deps

  const antrenmanSec = useCallback(async (t) => {
    setAktif(t);
    try {
      const { yil, ay } = bugun();
      const l = await db("listPlayersWithDue", { yas_grubu_id: t.age_group_id, yil, ay });
      setOyuncular(l.filter((o) => ["aktif", "deneme", "sakat"].includes(o.durum)));
      const a = await db("listAttendance", t.id);
      setYoklama(Object.fromEntries(a.map((x) => [x.player_id, x.durum])));
    } catch (e) { toast("err", hataMetni(e)); }
  }, [toast]);

  const isaretle = async (pid, durum) => {
    if (saltOkunur || aktif.iptal) return;
    setYoklama({ ...yoklama, [pid]: durum });
    try { await db("setAttendance", aktif.id, pid, durum); } catch (e) { toast("err", hataMetni(e)); }
  };
  const tumuGeldi = async () => {
    const n = { ...yoklama };
    for (const o of oyuncular) if (!n[o.id]) { n[o.id] = "geldi"; try { await db("setAttendance", aktif.id, o.id, "geldi"); } catch (e) { toast("err", hataMetni(e)); } }
    setYoklama(n); toast("ok", "İşaretlenmemiş oyuncular geldi olarak kaydedildi");
  };
  const antrenmanEkle = async () => {
    if (!yeni.age_group_id) return toast("err", "Yaş grubu seçin");
    try { const t = await db("createTraining", { age_group_id: Number(yeni.age_group_id), tarih, saat: yeni.saat, saha: yeni.saha }); toast("ok", "Antrenman eklendi"); setYeni({ age_group_id: "", saat: "", saha: "" }); await antrenmanlariYukle(); antrenmanSec({ ...t, yas_grubu_ad: gruplar.find((g) => g.id === t.age_group_id)?.ad, iptal: 0 }); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const iptalEt = async () => { try { await db("cancelTraining", iptal.id, "İptal"); toast("ok", "Antrenman iptal edildi"); setIptal(null); setAktif(null); antrenmanlariYukle(); } catch (e) { toast("err", hataMetni(e)); } };

  const say = (d) => oyuncular.filter((o) => yoklama[o.id] === d).length;
  const borclu = oyuncular.filter((o) => o.aidat_durum === "odenmedi").length;
  const Dugme = ({ pid, durum, etiket, ton }) => {
    const on = yoklama[pid] === durum;
    const renk = { geldi: "var(--yesil)", gelmedi: "var(--kirmizi)", izinli: "#7A6300" }[durum];
    return <button type="button" onClick={() => isaretle(pid, durum)} disabled={saltOkunur || !!aktif?.iptal} style={{ height: 36, width: 96, borderRadius: 8, cursor: "pointer", fontWeight: on ? 700 : 600, fontSize: 13, border: `1px solid ${on ? renk : "var(--cizgi)"}`, background: on ? renk : "#fff", color: on ? "#fff" : "var(--soluk)" }}>{etiket}{ton}</button>;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ fontSize: 22 }}>Antrenman</h3>
        <Alan etiket="Tarih"><Girdi type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Alan>
        <div style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{tarihTR(tarih)} antrenmanları</div>
        {antrenmanlar.length === 0 ? <div style={{ color: "var(--soluk)", fontSize: 14 }}>Bu tarihte antrenman yok.</div> : antrenmanlar.map((t) => {
          const on = aktif?.id === t.id;
          return <button key={t.id} type="button" onClick={() => antrenmanSec(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: `1px solid ${on ? "var(--mor)" : "var(--cizgi)"}`, background: on ? "var(--mor-acik)" : "#fff", fontSize: 14, opacity: t.iptal ? .6 : 1 }}><span style={{ fontWeight: on ? 700 : 600, color: on ? "var(--mor-koyu)" : "var(--metin)" }}>{t.yas_grubu_ad} · {t.saat || "—"}</span>{t.iptal ? <Rozet ton="red">İptal</Rozet> : null}</button>;
        })}
        {!saltOkunur && (
          <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Yeni antrenman</div>
            <Secim secenekler={gruplar} bos="Yaş grubu" value={yeni.age_group_id} onChange={(e) => setYeni({ ...yeni, age_group_id: e.target.value })} aria-label="Yaş grubu" />
            <div style={{ display: "flex", gap: 8 }}><Girdi type="time" value={yeni.saat} onChange={(e) => setYeni({ ...yeni, saat: e.target.value })} aria-label="Saat" /><Girdi placeholder="Saha" value={yeni.saha} onChange={(e) => setYeni({ ...yeni, saha: e.target.value })} /></div>
            <Btn ikon={<Ikon ad="arti" />} onClick={antrenmanEkle}>Antrenman Ekle</Btn>
          </div>
        )}
        {aktif && (
          <>
            <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              {[["Toplam", oyuncular.length, ""], ["Geldi", say("geldi"), "var(--yesil)"], ["Gelmedi", say("gelmedi"), "var(--kirmizi)"], ["İzinli", say("izinli"), ""], ["İşaretlenmedi", oyuncular.length - say("geldi") - say("gelmedi") - say("izinli"), ""]].map(([e, n, c]) => <div key={e} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--soluk)" }}>{e}</span><b style={{ color: c || "inherit" }}>{n}</b></div>)}
            </div>
            {!saltOkunur && !aktif.iptal && <Btn tur="danger" ikon={<Ikon ad="kapat" />} onClick={() => setIptal(aktif)}>Antrenmanı İptal Et</Btn>}
          </>
        )}
      </Kart>
      <Kart>
        {!aktif ? <Bos metin="Soldan bir antrenman seçin veya yeni antrenman ekleyin." /> : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid var(--cizgi)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><h3 style={{ fontSize: 22 }}>{aktif.yas_grubu_ad} Yoklama</h3>{aktif.saat && <span style={{ color: "var(--soluk)" }}>{aktif.saat}</span>}{borclu > 0 && <Rozet ton="red">{borclu} aidat borcu</Rozet>}{aktif.iptal ? <Rozet ton="red">İptal edildi</Rozet> : null}</div>
              {!saltOkunur && !aktif.iptal && <Btn tur="ghost" ikon={<Ikon ad="onay" />} onClick={tumuGeldi}>Kalanları Geldi İşaretle</Btn>}
            </div>
            {oyuncular.length === 0 ? <Bos metin="Bu grupta aktif oyuncu yok." /> : oyuncular.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: "1px solid var(--cizgi)" }}>
                <Avatar ad={o.ad_soyad} boyut={40} />
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}>{o.ad_soyad}{o.aidat_durum === "odenmedi" && <Rozet ton="red">Aidat</Rozet>}</div></div>
                <div style={{ display: "flex", gap: 8 }}><Dugme pid={o.id} durum="geldi" etiket="Geldi" /><Dugme pid={o.id} durum="gelmedi" etiket="Gelmedi" /><Dugme pid={o.id} durum="izinli" etiket="İzinli" /></div>
              </div>
            ))}
          </>
        )}
      </Kart>
      {iptal && <Onay tehlikeli mesaj={`${iptal.yas_grubu_ad} ${iptal.saat} antrenmanı iptal edilsin mi?`} onEvet={iptalEt} onHayir={() => setIptal(null)} />}
    </div>
  );
}
