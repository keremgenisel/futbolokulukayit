import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Avatar, Rozet, Onay, Bos, useToast } from "./ui.jsx";
import { db, cikti, uygulama, bugun, hataMetni } from "../lib/api.js";
import { yoklamaFormuHtml } from "../lib/yoklamaFormuHtml.js";
import { htmlYazdir } from "../lib/yazdir.js";
import { Ikon } from "./Ikon.jsx";
import { TakvimSeridi, SERIT_GUN } from "./TakvimSeridi.jsx";
import { gunKaydir, varsayilanBaslangic, uzunTarih, haftaBasi } from "../lib/takvim.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { antrenmanDegerleri, hatirlatmaUygunMu } from "../lib/whatsapp.js";

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
  const [duzen, setDuzen] = useState(null);   // antrenman düzenleme formu { tarih, saat, saha }
  const [bildir, setBildir] = useState(null); // "Velilere bildirilsin mi?" sorusu { t, tur }
  const [waAnt, setWaAnt] = useState(null);   // açık bildirim penceresi { t, tur, alicilar }
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
  const haftayiDoldur = async () => {
    try {
      const r = await db("haftayiProgramdanDoldur", haftaBasi(tarih));
      if (r?.error) return toast("err", r.error);
      if (r.eklenen === 0 && r.programsiz > 0 && r.atlanan === 0) toast("err", "Hiçbir yaş grubunun haftalık programı yok. Yaş Grupları > Düzenle'den gün ve saat girin.");
      else toast("ok", `${r.eklenen} antrenman eklendi${r.atlanan ? `, ${r.atlanan} zaten vardı` : ""}${r.programsiz ? `, ${r.programsiz} grubun programı yok` : ""}`);
      await takvimYukle();
    } catch (e) { toast("err", hataMetni(e)); }
  };
  const iptalEt = async () => { try { await db("cancelTraining", iptal.id, "İptal"); toast("ok", "Antrenman iptal edildi"); const t = { ...iptal, iptal: 1, iptal_nedeni: "İptal", bildirim_gerekli: 1 }; setIptal(null); setAktif(null); await takvimYukle(); setBildir({ t, tur: "iptal" }); } catch (e) { toast("err", hataMetni(e)); } };
  // Antrenman düzenleme (plan §13): tarih/saat/saha; değiştiyse velilere bildirim sorulur
  const duzenKaydet = async () => {
    try {
      const t = await db("updateTraining", aktif.id, { tarih: duzen.tarih, saat: duzen.saat, saha: duzen.saha });
      setDuzen(null);
      if (!t.degisti) return toast("ok", "Değişiklik yok");
      toast("ok", "Antrenman güncellendi");
      if (t.tarih !== tarih) setTarih(t.tarih); // başka güne taşındıysa o güne git
      await takvimYukle();
      setAktif((a) => (a ? { ...a, ...t } : a));
      setBildir({ t: { ...aktif, ...t }, tur: "degisiklik" });
    } catch (e) { toast("err", hataMetni(e)); }
  };
  // Bildirim penceresi: grubun aktif oyuncularının birincil velileri (onay + numara) ve bu antrenman için açılmış kayıtlar
  const bildirimAc = async (t0, tur) => {
    setBildir(null);
    try {
      // Antrenmanı taze oku: iptal/değişiklik yeni olay açar (grup_bildirim sıfırlanır); ekrandaki eski kopya yanıltmasın
      const t = (await db("trainingCalendar", t0.tarih, t0.tarih)).find((x) => x.id === t0.id) || t0;
      const l = await db("antrenmanVelileri", t.id);
      setWaAnt({ t, tur, alicilar: l.map((v) => ({ key: String(v.player_id), player_id: v.player_id, guardian_id: v.guardian_id, oyuncu_ad: v.ad_soyad, veli_ad: v.veli_ad || "", grup: t.yas_grubu_ad, numara: v.veli_wa || "", onay: v.veli_onay, mesaj_id: v.mesaj_id, degerler: antrenmanDegerleri(t, { veli_ad: v.veli_ad, ad_soyad: v.ad_soyad }) })) });
    } catch (e) { toast("err", hataMetni(e)); }
  };
  const bildirimKapat = async () => {
    const t = waAnt.t; setWaAnt(null);
    try {
      // Uygun velilerin hepsine açıldıysa bayrak iner; kalan varsa kartta "x/y veli bildirildi" sürer
      const l = await db("antrenmanVelileri", t.id);
      const uygun = l.filter((v) => hatirlatmaUygunMu({ numara: v.veli_wa, onay: v.veli_onay }).ok);
      if (!saltOkunur && uygun.length > 0 && uygun.every((v) => v.mesaj_id)) await db("bildirimGerekliAyarla", t.id, 0);
    } catch { /* yalnız bayrak */ }
    takvimYukle();
  };
  // Veli grubuna gönderim geri al (kart başlığından; pencere kapalıyken de): bildirim gereği yeniden açılır
  const grupGeriAl = async () => { try { await db("grupBildirimSil", aktif.id); toast("ok", "Grup bildirimi geri alındı"); takvimYukle(); } catch (e) { toast("err", hataMetni(e)); } };
  const bildirimGerekmiyor = async () => { try { await db("bildirimGerekliAyarla", aktif.id, 0); takvimYukle(); } catch (e) { toast("err", hataMetni(e)); } };

  // Saha yoklama formu (plan §12): ekrandaki liste + işaretler; programda işaretli olanlar dolu, kalanlar boş kutu.
  const formHtml = async () => {
    let logo = ""; try { logo = await uygulama().logo(); } catch { /* logosuz */ }
    return yoklamaFormuHtml({ grup: aktif.yas_grubu_ad || "", tarih: aktif.tarih, saat: aktif.saat, saha: aktif.saha, logo, oyuncular: oyuncular.map((o) => ({ ad_soyad: o.ad_soyad, durum: o.durum, isaret: yoklama[o.id] })) });
  };
  const formAdi = () => `yoklama-${(aktif.yas_grubu_ad || "grup").replace(/\s+/g, "")}-${aktif.tarih}`;
  // Yazıcı yoksa / yazdırma başarısızsa form PDF olarak açılır (makbuzla aynı davranış); kullanıcı sessiz kalmaz.
  const formYazdir = async () => { try { const y = await htmlYazdir(await formHtml(), formAdi()); if (!y.ok) toast("err", y.mesaj); } catch (e) { toast("err", hataMetni(e)); } };
  const formPdf = async () => { try { await cikti().pdfKaydet(await formHtml(), formAdi() + ".pdf", false); } catch (e) { toast("err", hataMetni(e)); } };
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
          {!saltOkunur && !formAcik && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn tur="ghost" ikon={<Ikon ad="takvim" />} onClick={haftayiDoldur} title="Yaş gruplarının haftalık programındaki antrenmanları bu haftaya ekler (var olanlar atlanır)">Haftayı Programdan Doldur</Btn>
              <Btn ikon={<Ikon ad="arti" />} onClick={() => setFormAcik(true)}>Antrenman Ekle</Btn>
            </div>
          )}
        </div>
        {antrenmanlar.length === 0 && !formAcik ? <div style={{ color: "var(--soluk)", fontSize: 14 }}>Bu tarihte antrenman yok.{!saltOkunur && " Eklemek için sağdaki düğmeyi kullanın."}</div> : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {antrenmanlar.map((t) => {
              const on = aktif?.id === t.id;
              return (
                <button key={t.id} type="button" onClick={() => antrenmanSec(t)} aria-pressed={on} style={{ display: "flex", flexDirection: "column", gap: 6, width: 200, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${on ? "var(--mor)" : "var(--cizgi)"}`, background: on ? "var(--mor-acik)" : "#fff", opacity: t.iptal ? .7 : 1 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span className="baslik" style={{ fontSize: 20, fontWeight: 700, color: "var(--mor-koyu)" }}>{t.yas_grubu_ad} · {t.saat || "—"}</span>{t.iptal ? <Rozet ton="red">İptal</Rozet> : null}</span>
                  <span style={{ fontSize: 13, color: "var(--soluk)" }}>{t.saha || "Saha belirtilmedi"}</span>
                  {t.bildirim_gerekli ? <span style={{ fontSize: 12, fontWeight: 600, color: t.bildirilen > 0 ? "var(--mor)" : "var(--kirmizi)" }}>{t.bildirilen > 0 ? `${t.bildirilen}/${t.oyuncu} veli bildirildi` : "Velilere bildirilmedi"}</span> : t.grup_bildirim ? <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yesil)" }}>Veli grubuna bildirildi</span> : null}
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
                {aktif.grup_bildirim ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Rozet ton="green">Veli grubuna bildirildi</Rozet>{!saltOkunur && <button type="button" onClick={grupGeriAl} aria-label="Grup bildirimini geri al" style={{ background: "none", border: 0, color: "var(--soluk)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>Geri al</button>}</span> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {aktif.bildirim_gerekli ? <Btn tur="yesil" ikon={<Ikon ad="whatsapp" />} onClick={() => bildirimAc(aktif, aktif.iptal ? "iptal" : "degisiklik")} title="Grubun velilerine WhatsApp ile iptal/değişiklik bildir">Velilere Bildir</Btn> : null}
                {aktif.bildirim_gerekli && !saltOkunur ? <Btn tur="ghost" kucuk onClick={bildirimGerekmiyor} title="Bildirim yapılmayacak; rozeti kaldır">Bildirim gerekmiyor</Btn> : null}
                {!aktif.iptal && <>
                  <Btn tur="ghost" ikon={<Ikon ad="yazdir" />} onClick={formYazdir} title="Sahada elle doldurulacak A4 yoklama formu; programda işaretli olanlar dolu gelir">Formu Yazdır</Btn>
                  <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={formPdf} title="Yoklama formunu PDF olarak kaydet">PDF</Btn>
                  {!saltOkunur && <Btn tur="ghost" ikon={<Ikon ad="onay" />} onClick={tumuGeldi}>Kalanları Geldi İşaretle</Btn>}
                  {!saltOkunur && !duzen && <Btn tur="ghost" ikon={<Ikon ad="takvim" />} onClick={() => setDuzen({ tarih: aktif.tarih, saat: aktif.saat || "", saha: aktif.saha || "" })}>Düzenle</Btn>}
                  {!saltOkunur && <Btn tur="danger" ikon={<Ikon ad="kapat" />} onClick={() => setIptal(aktif)}>İptal Et</Btn>}
                </>}
              </div>
            </div>
            {duzen && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "12px 16px", borderBottom: "1px solid var(--cizgi)", background: "var(--sari-acik)", flexWrap: "wrap" }}>
                <Alan etiket="Tarih" style={{ width: 170 }}><Girdi type="date" value={duzen.tarih} onChange={(e) => setDuzen({ ...duzen, tarih: e.target.value })} aria-label="Antrenman tarihi" disabled={aktif.isaretli > 0} title={aktif.isaretli > 0 ? "Yoklaması alınmış antrenmanın tarihi değiştirilemez" : ""} /></Alan>
                <Alan etiket="Saat" style={{ width: 130 }}><Girdi type="time" value={duzen.saat} onChange={(e) => setDuzen({ ...duzen, saat: e.target.value })} aria-label="Antrenman saati" /></Alan>
                <Alan etiket="Saha" style={{ width: 160 }}><Girdi value={duzen.saha} onChange={(e) => setDuzen({ ...duzen, saha: e.target.value })} aria-label="Antrenman sahası" /></Alan>
                <Btn onClick={duzenKaydet}>Kaydet</Btn>
                <Btn tur="ghost" onClick={() => setDuzen(null)}>Vazgeç</Btn>
                {aktif.isaretli > 0 && <span style={{ fontSize: 12.5, color: "var(--soluk)" }}>Yoklama alındığı için yalnız saat ve saha değişir.</span>}
              </div>
            )}
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
      {bildir && <Onay mesaj={`${bildir.t.yas_grubu_ad} grubunun velilerine WhatsApp ile ${bildir.tur === "iptal" ? "iptal" : "değişiklik"} bildirilsin mi? Her veli için WhatsApp açılır, Gönder'e siz basarsınız.`} onEvet={() => bildirimAc(bildir.t, bildir.tur)} onHayir={() => setBildir(null)} />}
      {waAnt && <WhatsAppHatirlat grup={{ ad: waAnt.t.yas_grubu_ad, training_id: waAnt.t.id, gonderildi: !!waAnt.t.grup_bildirim }} tur={waAnt.tur} baslik={waAnt.tur === "iptal" ? "Antrenman İptali — Velilere Bildir" : "Antrenman Değişikliği — Velilere Bildir"} altBaslik={`${waAnt.t.yas_grubu_ad} · ${uzunTarih(waAnt.t.tarih)}${waAnt.t.saat ? " · " + waAnt.t.saat : ""}`} alicilar={waAnt.alicilar} kayit={{ training_id: waAnt.t.id }} saltOkunur={saltOkunur} onKapat={bildirimKapat} />}
    </div>
  );
}
