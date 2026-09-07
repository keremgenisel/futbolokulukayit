import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Avatar, Rozet, Onay, Bos, useToast } from "./ui.jsx";
import { db, bugun, hataMetni } from "../lib/api.js";
import { Ikon } from "./Ikon.jsx";
import { TakvimSeridi, SERIT_GUN } from "./TakvimSeridi.jsx";
import { gunKaydir, varsayilanBaslangic, uzunTarih } from "../lib/takvim.js";

// Şerit kaydırıldıkça ±4 haftalık pencere tek sorguda yüklenir (plan §9.2).
const PENCERE_GUN = 28;

export function Yoklama({ saltOkunur }) {
  const bugunIso = bugun().iso;
  const [tarih, setTarih] = useState(bugunIso);
  const [baslangic, setBaslangic] = useState(() => varsayilanBaslangic(bugunIso));
  const [gruplar, setGruplar] = useState([]);
  const [takvim, setTakvim] = useState({}); // iso → antrenman özetleri (pencere içi)
  const [aktif, setAktif] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [yoklama, setYoklama] = useState({}); // player_id → durum
  const [formAcik, setFormAcik] = useState(false);
  const [yeni, setYeni] = useState({ age_group_id: "", saat: "", saha: "" });
  const [iptal, setIptal] = useState(null);
  const toast = useToast();

  const takvimYukle = useCallback(async () => {
    try {
      const l = await db("trainingCalendar", gunKaydir(baslangic, -PENCERE_GUN), gunKaydir(baslangic, SERIT_GUN - 1 + PENCERE_GUN));
      const m = {};
      for (const t of l) (m[t.tarih] ||= []).push(t);
      setTakvim(m);
      setAktif((a) => (a ? l.find((t) => t.id === a.id) || a : a)); // seçili antrenmanın sayaçlarını tazele
    } catch (e) { toast("err", hataMetni(e)); }
  }, [baslangic, toast]);
  useEffect(() => { db("listAgeGroups").then((g) => setGruplar(g.filter((x) => x.aktif))).catch(() => {}); }, []);
  useEffect(() => { takvimYukle(); }, [takvimYukle]);
  useEffect(() => { setAktif(null); setFormAcik(false); }, [tarih]);

  const antrenmanlar = takvim[tarih] || [];

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
    try { await db("setAttendance", aktif.id, pid, durum); takvimYukle(); } catch (e) { toast("err", hataMetni(e)); }
  };
  const tumuGeldi = async () => {
    const n = { ...yoklama };
    for (const o of oyuncular) if (!n[o.id]) { n[o.id] = "geldi"; try { await db("setAttendance", aktif.id, o.id, "geldi"); } catch (e) { toast("err", hataMetni(e)); } }
    setYoklama(n); takvimYukle(); toast("ok", "İşaretlenmemiş oyuncular geldi olarak kaydedildi");
  };
  const antrenmanEkle = async () => {
    if (!yeni.age_group_id) return toast("err", "Yaş grubu seçin");
    try {
      const t = await db("createTraining", { age_group_id: Number(yeni.age_group_id), tarih, saat: yeni.saat, saha: yeni.saha });
      toast("ok", "Antrenman eklendi"); setYeni({ age_group_id: "", saat: "", saha: "" }); setFormAcik(false);
      await takvimYukle();
      antrenmanSec({ ...t, yas_grubu_ad: gruplar.find((g) => g.id === t.age_group_id)?.ad, iptal: 0, oyuncu: 0, isaretli: 0 });
    } catch (e) { toast("err", hataMetni(e)); }
  };
  const iptalEt = async () => { try { await db("cancelTraining", iptal.id, "İptal"); toast("ok", "Antrenman iptal edildi"); setIptal(null); setAktif(null); takvimYukle(); } catch (e) { toast("err", hataMetni(e)); } };

  const say = (d) => oyuncular.filter((o) => yoklama[o.id] === d).length;
  const borclu = oyuncular.filter((o) => o.aidat_durum === "odenmedi").length;
  const Dugme = ({ pid, durum, etiket }) => {
    const on = yoklama[pid] === durum;
    const renk = { geldi: "var(--yesil)", gelmedi: "var(--kirmizi)", izinli: "#7A6300" }[durum];
    return <button type="button" onClick={() => isaretle(pid, durum)} disabled={saltOkunur || !!aktif?.iptal} style={{ height: 36, width: 96, borderRadius: 8, cursor: "pointer", fontWeight: on ? 700 : 600, fontSize: 13, border: `1px solid ${on ? renk : "var(--cizgi)"}`, background: on ? renk : "#fff", color: on ? "#fff" : "var(--soluk)" }}>{etiket}</button>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TakvimSeridi secili={tarih} bugun={bugunIso} baslangic={baslangic} onSec={setTarih} onBaslangic={setBaslangic} gunOzetleri={takvim} />

      <Kart style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ fontSize: 22 }}>{uzunTarih(tarih)}</h3>
            <span style={{ color: "var(--soluk)", fontSize: 14 }}>{antrenmanlar.length === 0 ? "antrenman yok" : `${antrenmanlar.length} antrenman`}</span>
          </div>
          {!saltOkunur && !formAcik && <Btn ikon={<Ikon ad="arti" />} onClick={() => setFormAcik(true)}>Antrenman Ekle</Btn>}
        </div>
        {antrenmanlar.length === 0 && !formAcik ? <div style={{ color: "var(--soluk)", fontSize: 14 }}>Bu tarihte antrenman yok.{!saltOkunur && " Eklemek için sağdaki düğmeyi kullanın."}</div> : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {antrenmanlar.map((t) => {
              const on = aktif?.id === t.id;
              return (
                <button key={t.id} type="button" onClick={() => antrenmanSec(t)} aria-pressed={on} style={{ display: "flex", flexDirection: "column", gap: 6, width: 200, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${on ? "var(--mor)" : "var(--cizgi)"}`, background: on ? "var(--mor-acik)" : "#fff", opacity: t.iptal ? .7 : 1 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span className="baslik" style={{ fontSize: 20, fontWeight: 700, color: "var(--mor-koyu)" }}>{t.yas_grubu_ad} · {t.saat || "—"}</span>{t.iptal ? <Rozet ton="red">İptal</Rozet> : null}</span>
                  <span style={{ fontSize: 13, color: "var(--soluk)" }}>{t.saha || "Saha belirtilmedi"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.oyuncu > 0 && t.isaretli >= t.oyuncu ? "var(--yesil)" : "var(--soluk)" }}>{t.isaretli}/{t.oyuncu} işaretli</span>
                </button>
              );
            })}
          </div>
        )}
        {formAcik && !saltOkunur && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: 14, borderRadius: 10, background: "var(--zemin)", border: "1px dashed #C9B8E0", flexWrap: "wrap" }}>
            <Alan etiket="Yaş grubu" style={{ width: 180 }}><Secim secenekler={gruplar} bos="Yaş grubu" value={yeni.age_group_id} onChange={(e) => setYeni({ ...yeni, age_group_id: e.target.value })} aria-label="Yaş grubu" /></Alan>
            <Alan etiket="Saat" style={{ width: 130 }}><Girdi type="time" value={yeni.saat} onChange={(e) => setYeni({ ...yeni, saat: e.target.value })} aria-label="Saat" /></Alan>
            <Alan etiket="Saha" style={{ width: 160 }}><Girdi placeholder="Saha 1" value={yeni.saha} onChange={(e) => setYeni({ ...yeni, saha: e.target.value })} aria-label="Saha" /></Alan>
            <Btn ikon={<Ikon ad="arti" />} onClick={antrenmanEkle}>Ekle</Btn>
            <Btn tur="ghost" ikon={<Ikon ad="kapat" />} onClick={() => setFormAcik(false)}>Vazgeç</Btn>
          </div>
        )}
      </Kart>

      <Kart>
        {!aktif ? <Bos metin="Yoklama almak için yukarıdan bir antrenman seçin." /> : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid var(--cizgi)", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 22 }}>{aktif.yas_grubu_ad} Yoklama{aktif.saat ? ` · ${aktif.saat}` : ""}</h3>
                <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
                  {[["Toplam", oyuncular.length, ""], ["Geldi", say("geldi"), "var(--yesil)"], ["Gelmedi", say("gelmedi"), "var(--kirmizi)"], ["İzinli", say("izinli"), ""], ["İşaretlenmedi", oyuncular.length - say("geldi") - say("gelmedi") - say("izinli"), ""]].map(([e, n, c]) => <span key={e}><span style={{ color: "var(--soluk)" }}>{e} </span><b style={{ color: c || "inherit" }}>{n}</b></span>)}
                </div>
                {borclu > 0 && <Rozet ton="red">{borclu} aidat borcu</Rozet>}{aktif.iptal ? <Rozet ton="red">İptal edildi</Rozet> : null}
              </div>
              {!saltOkunur && !aktif.iptal && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn tur="ghost" ikon={<Ikon ad="onay" />} onClick={tumuGeldi}>Kalanları Geldi İşaretle</Btn>
                  <Btn tur="danger" ikon={<Ikon ad="kapat" />} onClick={() => setIptal(aktif)}>İptal Et</Btn>
                </div>
              )}
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
