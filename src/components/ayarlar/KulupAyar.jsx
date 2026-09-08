// Ayarlar > Kulüp ve Makbuz
import { useEffect, useState } from "react";
import { Btn, Alan, Girdi, useToast } from "../ui.jsx";
import { db, hataMetni } from "../../lib/api.js";
import { Ikon } from "../Ikon.jsx";

export function KulupAyar({ saltOkunur, admin, onKurulumAc }) {
  const [a, setA] = useState({ kulup_adi: "", tahsil_eden: "" });
  const toast = useToast();
  useEffect(() => {
    (async () => {
      const o = {};
      for (const k of Object.keys(a)) o[k] = (await db("getSetting", k)) || "";
      setA(o);
    })().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = async () => {
    try {
      for (const [k, v] of Object.entries(a)) await db("setSetting", k, v);
      toast("ok", "Kaydedildi");
    } catch (e) {
      toast("err", hataMetni(e));
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h3 style={{ fontSize: 22 }}>Kulüp ve Makbuz</h3>
      <Alan etiket="Makbuzda görünen kulüp adı">
        <Girdi value={a.kulup_adi} onChange={(e) => setA({ ...a, kulup_adi: e.target.value })} placeholder="EYÜPSPOR FUTBOL OKULU" />
      </Alan>
      <Alan etiket="Varsayılan tahsil eden (kullanıcı adı boşsa)">
        <Girdi value={a.tahsil_eden} onChange={(e) => setA({ ...a, tahsil_eden: e.target.value })} />
      </Alan>
      {!saltOkunur && (
        <div>
          <Btn onClick={kaydet}>Kaydet</Btn>
        </div>
      )}
      {admin && onKurulumAc && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>İlk kurulum sihirbazı</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
            Kulüp adı, aidat ve indirimler, yaş grupları, yedek klasörü ve kurtarma kodlarını adım adım gözden geçirmek için. İlk açılışta
            otomatik çıkar; buradan istediğiniz zaman yeniden açabilirsiniz.
          </p>
          <div>
            <Btn tur="ghost" ikon={<Ikon ad="takvim" />} onClick={onKurulumAc}>
              Kurulum Sihirbazını Aç
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
