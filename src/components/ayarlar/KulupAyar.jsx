// Ayarlar > Kulüp ve Makbuz
import { useEffect, useState } from "react";
import { Btn, Alan, Girdi, useToast, useDene } from "../ui.jsx";
import { db } from "../../lib/api.js";

export function KulupAyar({ saltOkunur }) {
  const [a, setA] = useState({ kulup_adi: "", tahsil_eden: "" });
  const toast = useToast();
  const dene = useDene();
  useEffect(() => {
    (async () => {
      const o = {};
      for (const k of Object.keys(a)) o[k] = (await db("getSetting", k)) || "";
      setA(o);
    })().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = () =>
    dene(async () => {
      for (const [k, v] of Object.entries(a)) await db("setSetting", k, v);
      toast("ok", "Kaydedildi");
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>Kulüp ve Makbuz</h3>
      <Alan etiket="Makbuzda görünen kulüp adı">
        <Girdi value={a.kulup_adi} onChange={(e) => setA({ ...a, kulup_adi: e.target.value })} placeholder="EYÜPSPOR FUTBOL OKULU" />
      </Alan>
      <Alan etiket="Varsayılan tahsil eden (makbuzda; boşsa giriş yapan kullanıcı)">
        <Girdi value={a.tahsil_eden} onChange={(e) => setA({ ...a, tahsil_eden: e.target.value })} />
      </Alan>
      {!saltOkunur && (
        <div>
          <Btn onClick={kaydet}>Kaydet</Btn>
        </div>
      )}
    </div>
  );
}
