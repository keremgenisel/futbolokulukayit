import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Rozet, Onay, Bos, useToast } from "./ui.jsx";
import { db, hataMetni } from "../lib/api.js";

export function YasGruplari({ saltOkunur }) {
  const [gruplar, setGruplar] = useState([]);
  const [oyuncular, setOyuncular] = useState([]);
  const [yeni, setYeni] = useState({ ad: "", sezon: "" });
  const [duzenle, setDuzenle] = useState(null); // { id, ad, sezon, sira, aktif }
  const [sil, setSil] = useState(null);
  const toast = useToast();

  const yukle = async () => {
    try { setGruplar(await db("listAgeGroups")); setOyuncular(await db("listPlayers")); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  useEffect(() => { yukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sayi = (id) => oyuncular.filter((o) => o.yas_grubu_id === id && ["aktif", "deneme", "sakat"].includes(o.durum)).length;

  const ekle = async () => {
    if (!yeni.ad.trim()) return;
    try { await db("createAgeGroup", { ad: yeni.ad.trim(), sezon: yeni.sezon.trim(), sira: gruplar.length + 1 }); setYeni({ ad: "", sezon: "" }); toast("ok", "Grup eklendi"); yukle(); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const kaydet = async () => {
    try { await db("updateAgeGroup", duzenle.id, { ad: duzenle.ad, sezon: duzenle.sezon, sira: Number(duzenle.sira) || 0, aktif: duzenle.aktif ? 1 : 0 }); setDuzenle(null); toast("ok", "Kaydedildi"); yukle(); }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const silOnayla = async () => {
    try { const r = await db("deleteAgeGroup", sil.id); if (r?.error) toast("err", r.error); else toast("ok", "Grup silindi"); setSil(null); yukle(); }
    catch (e) { toast("err", hataMetni(e)); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!saltOkunur && (
        <Kart style={{ padding: 20, display: "flex", gap: 12, alignItems: "flex-end" }}>
          <Alan etiket="Grup adı" style={{ width: 200 }}><Girdi value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} placeholder="U11" onKeyDown={(e) => e.key === "Enter" && ekle()} /></Alan>
          <Alan etiket="Sezon" style={{ width: 200 }}><Girdi value={yeni.sezon} onChange={(e) => setYeni({ ...yeni, sezon: e.target.value })} placeholder="2026-2027" onKeyDown={(e) => e.key === "Enter" && ekle()} /></Alan>
          <Btn onClick={ekle} disabled={!yeni.ad.trim()}>Grup Ekle</Btn>
        </Kart>
      )}
      <Kart>
        {gruplar.length === 0 ? <Bos metin="Henüz yaş grubu yok. Yukarıdan ekleyin." /> : (
          <table>
            <thead><tr><th style={{ width: 60 }}>Sıra</th><th>Grup</th><th>Sezon</th><th>Aktif oyuncu</th><th>Durum</th><th style={{ width: 200 }}></th></tr></thead>
            <tbody>
              {gruplar.map((g) => duzenle?.id === g.id ? (
                <tr key={g.id}>
                  <td><Girdi value={duzenle.sira} onChange={(e) => setDuzenle({ ...duzenle, sira: e.target.value })} style={{ width: 56, height: 36 }} /></td>
                  <td><Girdi value={duzenle.ad} onChange={(e) => setDuzenle({ ...duzenle, ad: e.target.value })} style={{ height: 36 }} /></td>
                  <td><Girdi value={duzenle.sezon} onChange={(e) => setDuzenle({ ...duzenle, sezon: e.target.value })} style={{ height: 36 }} /></td>
                  <td>{sayi(g.id)}</td>
                  <td><label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!duzenle.aktif} onChange={(e) => setDuzenle({ ...duzenle, aktif: e.target.checked })} /> Aktif</label></td>
                  <td><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Btn kucuk tur="ghost" onClick={() => setDuzenle(null)}>Vazgeç</Btn><Btn kucuk onClick={kaydet}>Kaydet</Btn></div></td>
                </tr>
              ) : (
                <tr key={g.id}>
                  <td style={{ color: "var(--soluk)" }}>{g.sira}</td>
                  <td><Rozet ton="purple">{g.ad}</Rozet></td>
                  <td>{g.sezon || "—"}</td>
                  <td><b>{sayi(g.id)}</b></td>
                  <td>{g.aktif ? <Rozet ton="green">Aktif</Rozet> : <Rozet ton="gray">Pasif</Rozet>}</td>
                  <td><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {!saltOkunur && <><Btn kucuk tur="ghost" onClick={() => setDuzenle({ ...g })}>Düzenle</Btn><Btn kucuk tur="danger" onClick={() => setSil(g)}>Sil</Btn></>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
      {sil && <Onay tehlikeli mesaj={`"${sil.ad}" grubunu silmek istiyor musunuz? Grupta oyuncu varsa silinemez.`} onEvet={silOnayla} onHayir={() => setSil(null)} />}
    </div>
  );
}
