import { useEffect, useState } from "react";
import { Kart, Btn, Girdi, Avatar, Rozet, useToast } from "./ui.jsx";
import { db, bugun, hataMetni } from "../lib/api.js";
import { AY_ADLARI, gecikmeGunu, tesiseGirebilir } from "../lib/aidat.js";

function Stat({ etiket, deger, renk, not }) {
  return <Kart style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 13, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{etiket}</span><span className="baslik" style={{ fontSize: 40, color: renk, lineHeight: 1 }}>{deger}</span><span style={{ fontSize: 13, color: "var(--soluk)" }}>{not}</span></Kart>;
}

export function Pano({ onOyuncu, onSekme, onMakbuzKes, saltOkunur }) {
  const [ozet, setOzet] = useState(null);
  const [borclular, setBorclular] = useState([]);
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const toast = useToast();
  const { yil, ay, iso } = bugun();

  useEffect(() => {
    db("panoOzet", { yil, ay, bugun: iso }).then(setOzet).catch((e) => toast("err", hataMetni(e)));
    db("listUnpaid", yil, ay).then(setBorclular).catch(() => {});
  }, [yil, ay, iso, toast]);

  useEffect(() => {
    if (!q.trim()) { setSonuc([]); return; }
    const t = setTimeout(() => db("listPlayersWithDue", { q: q.trim(), yil, ay }).then((l) => setSonuc(l.slice(0, 6))).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [q, yil, ay]);

  const gun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--soluk)" }}>{gun}</span>
        <div style={{ display: "flex", gap: 10 }}>{!saltOkunur && <><Btn tur="sari" onClick={() => onSekme("tahsilat")}>Makbuz Kes</Btn><Btn onClick={() => onSekme("oyuncular", "yeni")}>+ Yeni Oyuncu</Btn></>}</div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat etiket="Aktif oyuncu" deger={ozet?.aktif ?? "—"} renk="var(--mor)" not={`${ozet?.grup ?? 0} yaş grubunda`} />
        <Stat etiket="Bu ay ödeyen" deger={ozet?.odeyen ?? "—"} renk="var(--yesil)" not={`${AY_ADLARI[ay - 1]} ${yil}`} />
        <Stat etiket="Aidat borcu olan" deger={ozet?.borclu ?? "—"} renk="var(--kirmizi)" not="Tesise giremez" />
        <Stat etiket="Bugün antrenman" deger={ozet?.antrenmanlar?.length ?? "—"} renk="#9A7D00" not={(ozet?.antrenmanlar || []).map((t) => t.yas_grubu_ad).join(" · ") || "Antrenman yok"} />
      </div>
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 22 }}>Tesise Giriş Kontrolü</h3><span style={{ fontSize: 13, color: "var(--soluk)" }}>Ad, soyad veya TC ile ara</span></div>
        <Girdi value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oyuncu adı veya TC yazın" style={{ height: 52, fontSize: 17 }} aria-label="Tesise giriş araması" />
        {sonuc.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {sonuc.map((o) => {
              const ok = tesiseGirebilir(o, o.aidat_durum ? { durum: o.aidat_durum } : null);
              return (
                <div key={o.id} onClick={() => onOyuncu(o.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 10, border: "1px solid var(--cizgi)", background: ok ? "var(--yesil-acik)" : "var(--kirmizi-acik)", cursor: "pointer" }}>
                  <Avatar ad={o.ad_soyad} boyut={48} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{o.ad_soyad}</div><div style={{ fontSize: 13, color: "var(--soluk)" }}>{o.yas_grubu_ad || "Grup yok"} · {o.durum} · {AY_ADLARI[ay - 1]} aidatı {o.aidat_durum === "odendi" ? "ödendi" : o.aidat_durum === "muaf" ? "muaf" : o.aidat_durum === "odenmedi" ? "ödenmedi" : "kaydı yok"}</div></div>
                  <span style={{ fontWeight: 700, color: ok ? "var(--yesil)" : "var(--kirmizi)" }}>{ok ? "✓ GİREBİLİR" : "✕ " + (o.aidat_durum === "odenmedi" ? "AİDAT BORCU" : "GİREMEZ")}</span>
                </div>
              );
            })}
          </div>
        )}
      </Kart>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 22 }}>Bugünkü Antrenmanlar</h3><a href="#" onClick={(e) => { e.preventDefault(); onSekme("yoklama"); }} style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Yoklama</a></div>
          {(ozet?.antrenmanlar || []).length === 0 ? <div style={{ color: "var(--soluk)" }}>Bugün antrenman yok.</div> : ozet.antrenmanlar.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--cizgi)", opacity: t.iptal ? .6 : 1 }}>
              <span className="baslik" style={{ fontSize: 22, color: "var(--mor)", width: 64 }}>{t.saat || "—"}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{t.yas_grubu_ad}{t.saha ? ` · ${t.saha}` : ""}</div><div style={{ fontSize: 13, color: "var(--soluk)" }}>{t.oyuncu} oyuncu{t.isaretli ? ` · ${t.geldi} geldi` : ""}</div></div>
              {t.iptal ? <Rozet ton="red">İptal</Rozet> : t.isaretli >= t.oyuncu && t.oyuncu > 0 ? <Rozet ton="green">Yoklama alındı</Rozet> : t.isaretli > 0 ? <Rozet ton="yellow">Devam ediyor</Rozet> : <Rozet ton="yellow">Yoklama bekliyor</Rozet>}
            </div>
          ))}
        </Kart>
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 22 }}>{AY_ADLARI[ay - 1]} Aidatı Ödemeyenler</h3><a href="#" onClick={(e) => { e.preventDefault(); onSekme("oyuncular", "borclu"); }} style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Tümü ({borclular.length})</a></div>
          {borclular.length === 0 ? <div style={{ color: "var(--soluk)" }}>Borçlu oyuncu yok.</div> : (
            <table><thead><tr><th>Oyuncu</th><th>Grup</th><th>Ödeme dönemi</th><th>Gecikme</th><th></th></tr></thead><tbody>
              {borclular.slice(0, 8).map((b) => { const g = gecikmeGunu(b.odeme_donemi, b.yil, b.ay, new Date()); return <tr key={b.id} onClick={() => onOyuncu(b.player_id)} style={{ cursor: "pointer" }}><td style={{ fontWeight: 600 }}>{b.ad_soyad}</td><td>{b.yas_grubu_ad || "—"}</td><td>{b.odeme_donemi}</td><td style={{ color: g > 0 ? "var(--kirmizi)" : "var(--soluk)" }}>{g > 0 ? `${g} gün` : "—"}</td><td>{!saltOkunur && <Btn kucuk tur="sari" onClick={(e) => { e.stopPropagation(); onMakbuzKes(b.player_id); }}>Makbuz</Btn>}</td></tr>; })}
            </tbody></table>
          )}
        </Kart>
      </div>
    </div>
  );
}
