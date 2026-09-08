// Oyuncu kartı > Aile ve Acil Kişiler sekmesi (veli ekle/sil, mesaj onayı, acil kişi)
import { useState } from "react";
import { Btn, Rozet, Alan, Girdi, Secim, Bos, useToast, useDene } from "../ui.jsx";
import { db, hataMetni } from "../../lib/api.js";
import { hatirlatmaUygunMu } from "../../lib/whatsapp.js";
import { Ikon } from "../Ikon.jsx";

export function AileSekmesi({ oyuncu, veliler, acil, saltOkunur, onDegisti, onSil, onWhatsApp }) {
  const [v, setV] = useState({ tip: "baba", ad_soyad: "", gsm: "", whatsapp_no: "", veli_mi: false, mesaj_onayi: true });
  const onayDegistir = (x, deger) =>
    dene(async () => {
      await db("updateGuardian", x.id, { mesaj_onayi: deger ? 1 : 0 });
      onDegisti();
    });
  const [a, setA] = useState({ ad_soyad: "", yakinlik: "", telefon: "" });
  const toast = useToast();
  const dene = useDene();
  const veliEkle = async () => {
    if (!v.ad_soyad.trim()) return;
    try {
      await db("addGuardian", oyuncu.id, {
        ...v,
        whatsapp_no: v.whatsapp_no || v.gsm,
        veli_mi: v.veli_mi ? 1 : 0,
        mesaj_onayi: v.mesaj_onayi ? 1 : 0,
      });
      setV({ tip: "anne", ad_soyad: "", gsm: "", whatsapp_no: "", veli_mi: false, mesaj_onayi: true });
      onDegisti();
    } catch (e) {
      toast("err", hataMetni(e));
    }
  };
  const acilEkle = async () => {
    if (!a.ad_soyad.trim()) return;
    try {
      await db("addEmergency", oyuncu.id, a);
      setA({ ad_soyad: "", yakinlik: "", telefon: "" });
      onDegisti();
    } catch (e) {
      toast("err", hataMetni(e));
    }
  };
  const TIP = [
    { kod: "baba", ad: "Baba" },
    { kod: "anne", ad: "Anne" },
    { kod: "veli", ad: "Diğer veli" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 12 }}>Aile Bilgileri</h3>
        {veliler.length === 0 ? (
          <Bos metin="Henüz veli eklenmedi." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Yakınlık</th>
                <th>Ad Soyad</th>
                <th>GSM</th>
                <th>WhatsApp</th>
                <th>Veli</th>
                <th title="WhatsApp ile bilgilendirme onayı (KVKK)">Mesaj onayı</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {veliler.map((x) => {
                const u = hatirlatmaUygunMu({ numara: x.whatsapp_no || x.gsm, onay: x.mesaj_onayi });
                return (
                  <tr key={x.id}>
                    <td>{TIP.find((t) => t.kod === x.tip)?.ad}</td>
                    <td style={{ fontWeight: 600 }}>{x.ad_soyad}</td>
                    <td>{x.gsm}</td>
                    <td>{x.whatsapp_no}</td>
                    <td>{x.veli_mi ? <Rozet ton="purple">Veli</Rozet> : ""}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={x.mesaj_onayi !== 0}
                        onChange={(e) => onayDegistir(x, e.target.checked)}
                        disabled={saltOkunur}
                        aria-label={`${x.ad_soyad} mesaj onayı`}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Btn
                          kucuk
                          tur={u.ok ? "yesil" : "ghost"}
                          ikon={<Ikon ad="whatsapp" boyut={16} />}
                          disabled={!u.ok}
                          title={u.ok ? "WhatsApp'ta mesaj yaz" : u.neden}
                          onClick={() => onWhatsApp(x)}
                          aria-label={`${x.ad_soyad} WhatsApp`}
                        >
                          WhatsApp
                        </Btn>
                        {!saltOkunur && (
                          <Btn kucuk tur="danger" onClick={() => onSil({ tip: "veli", id: x.id, mesaj: `${x.ad_soyad} silinsin mi?` })}>
                            Sil
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!saltOkunur && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
            <Alan etiket="Yakınlık" style={{ width: 130 }}>
              <Secim secenekler={TIP} value={v.tip} onChange={(e) => setV({ ...v, tip: e.target.value })} />
            </Alan>
            <Alan etiket="Ad Soyad" style={{ flex: 1, minWidth: 160 }}>
              <Girdi value={v.ad_soyad} onChange={(e) => setV({ ...v, ad_soyad: e.target.value })} />
            </Alan>
            <Alan etiket="GSM" style={{ width: 150 }}>
              <Girdi value={v.gsm} onChange={(e) => setV({ ...v, gsm: e.target.value })} />
            </Alan>
            <Alan etiket="WhatsApp" style={{ width: 150 }}>
              <Girdi
                value={v.whatsapp_no}
                onChange={(e) => setV({ ...v, whatsapp_no: e.target.value })}
                placeholder="GSM ile aynıysa boş"
              />
            </Alan>
            <label style={{ display: "flex", gap: 6, alignItems: "center", height: 42 }}>
              <input type="checkbox" checked={v.veli_mi} onChange={(e) => setV({ ...v, veli_mi: e.target.checked })} /> Veli
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", height: 42 }} title="WhatsApp ile bilgilendirme onayı (KVKK)">
              <input type="checkbox" checked={v.mesaj_onayi} onChange={(e) => setV({ ...v, mesaj_onayi: e.target.checked })} /> Mesaj onayı
            </label>
            <Btn onClick={veliEkle} disabled={!v.ad_soyad.trim()}>
              Ekle
            </Btn>
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 12 }}>Acil Durumda Veli Dışında Ulaşılacak Kişiler</h3>
        {acil.length === 0 ? (
          <Bos metin="Henüz kişi eklenmedi." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Yakınlık</th>
                <th>Telefon</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {acil.map((x) => (
                <tr key={x.id}>
                  <td style={{ fontWeight: 600 }}>{x.ad_soyad}</td>
                  <td>{x.yakinlik}</td>
                  <td>{x.telefon}</td>
                  <td>
                    {!saltOkunur && (
                      <Btn kucuk tur="danger" onClick={() => onSil({ tip: "acil", id: x.id, mesaj: `${x.ad_soyad} silinsin mi?` })}>
                        Sil
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!saltOkunur && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
            <Alan etiket="Ad Soyad" style={{ flex: 1 }}>
              <Girdi value={a.ad_soyad} onChange={(e) => setA({ ...a, ad_soyad: e.target.value })} />
            </Alan>
            <Alan etiket="Yakınlık" style={{ width: 160 }}>
              <Girdi value={a.yakinlik} onChange={(e) => setA({ ...a, yakinlik: e.target.value })} />
            </Alan>
            <Alan etiket="Telefon" style={{ width: 160 }}>
              <Girdi value={a.telefon} onChange={(e) => setA({ ...a, telefon: e.target.value })} />
            </Alan>
            <Btn onClick={acilEkle} disabled={!a.ad_soyad.trim()}>
              Ekle
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
