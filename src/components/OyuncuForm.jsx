import { useState } from "react";
import { Modal, Btn, Alan, Girdi, Secim, useToast } from "./ui.jsx";
import { db, hataMetni } from "../lib/api.js";
import { DURUMLAR, UCRET_TIPLERI, ODEME_DONEMLERI } from "../lib/aidat.js";

const BOS = { tc_no: "", ad_soyad: "", dogum_tarihi: "", dogum_yeri: "", okul: "", gsm: "", adres: "", kan_grubu: "", yas_grubu_id: "", durum: "aktif", ucret_tipi: "normal", aylik_aidat: "", odeme_donemi: "1-10", kayit_tarihi: new Date().toISOString().slice(0, 10), notlar: "" };
const KAN = ["A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-"].map((k) => ({ kod: k, ad: k }));

// Oyuncu ekleme / düzenleme formu (kayıt formundaki Öğrenci alanları + kayıt ve ücret).
export function OyuncuForm({ oyuncu, gruplar, varsayilanAidat, onKaydedildi, onKapat }) {
  const [f, setF] = useState(oyuncu ? { ...BOS, ...oyuncu, yas_grubu_id: oyuncu.yas_grubu_id ?? "", aylik_aidat: oyuncu.aylik_aidat ?? "" } : { ...BOS, aylik_aidat: varsayilanAidat ?? "" });
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const g = (k) => ({ value: f[k] ?? "", onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  const kaydet = async () => {
    if (!f.ad_soyad.trim()) return setHata("Ad soyad zorunlu");
    if (f.tc_no && !/^\d{11}$/.test(f.tc_no)) return setHata("TC kimlik no 11 haneli olmalı");
    if (!f.dogum_tarihi) return setHata("Doğum tarihi zorunlu");
    setHata(""); setBekliyor(true);
    const veri = { ...f, tc_no: f.tc_no || null, yas_grubu_id: f.yas_grubu_id ? Number(f.yas_grubu_id) : null, aylik_aidat: Number(f.aylik_aidat) || 0 };
    delete veri.id; delete veri.yas_grubu_ad; delete veri.created_at; delete veri.updated_at; delete veri.foto_yolu;
    delete veri.aidat_durum; delete veri.aidat_tutar;
    try {
      const kayit = oyuncu ? await db("updatePlayer", oyuncu.id, veri) : await db("createPlayer", veri);
      toast("ok", oyuncu ? "Oyuncu güncellendi" : "Oyuncu kaydedildi");
      onKaydedildi(kayit);
    } catch (e) {
      const m = hataMetni(e);
      setHata(m.includes("UNIQUE") ? "Bu TC kimlik numarasıyla kayıtlı oyuncu var" : m);
    } finally { setBekliyor(false); }
  };

  const satir = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };
  return (
    <Modal baslik={oyuncu ? "Oyuncuyu Düzenle" : "Yeni Oyuncu"} onKapat={onKapat} genislik={860}
      altBar={<><Btn tur="ghost" onClick={onKapat}>Vazgeç</Btn><Btn onClick={kaydet} disabled={bekliyor}>{oyuncu ? "Kaydet" : "Oyuncuyu Kaydet"}</Btn></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h3 style={{ fontSize: 20 }}>Öğrenci</h3>
        <div style={satir}>
          <Alan etiket="TC Kimlik No"><Girdi {...g("tc_no")} maxLength={11} inputMode="numeric" /></Alan>
          <Alan etiket="Adı Soyadı *"><Girdi {...g("ad_soyad")} autoFocus /></Alan>
          <Alan etiket="Doğum Tarihi *"><Girdi type="date" {...g("dogum_tarihi")} /></Alan>
          <Alan etiket="Doğum Yeri"><Girdi {...g("dogum_yeri")} /></Alan>
          <Alan etiket="Okulu"><Girdi {...g("okul")} /></Alan>
          <Alan etiket="Kan Grubu"><Secim secenekler={KAN} bos="Seçin" {...g("kan_grubu")} /></Alan>
          <Alan etiket="GSM"><Girdi {...g("gsm")} placeholder="05xx xxx xx xx" /></Alan>
          <Alan etiket="Ev Adresi" style={{ gridColumn: "span 2" }}><Girdi {...g("adres")} /></Alan>
        </div>
        <h3 style={{ fontSize: 20 }}>Kayıt ve Ücret</h3>
        <div style={satir}>
          <Alan etiket="Yaş Grubu"><Secim secenekler={gruplar.filter((x) => x.aktif)} bos="Seçin" {...g("yas_grubu_id")} /></Alan>
          <Alan etiket="Durum"><Secim secenekler={DURUMLAR} {...g("durum")} /></Alan>
          <Alan etiket="Kayıt Tarihi"><Girdi type="date" {...g("kayit_tarihi")} /></Alan>
          <Alan etiket="Ücret Tipi"><Secim secenekler={UCRET_TIPLERI} {...g("ucret_tipi")} /></Alan>
          <Alan etiket="Aylık Aidat (₺)"><Girdi type="number" min="0" {...g("aylik_aidat")} disabled={["ucretsiz", "burslu"].includes(f.ucret_tipi)} /></Alan>
          <Alan etiket="Ödeme Dönemi"><Secim secenekler={ODEME_DONEMLERI.map((d) => ({ kod: d, ad: `Her ayın ${d} arası` }))} {...g("odeme_donemi")} /></Alan>
          <Alan etiket="Notlar" style={{ gridColumn: "span 3" }}><Girdi {...g("notlar")} /></Alan>
        </div>
        {hata && <div role="alert" style={{ color: "var(--kirmizi)", fontWeight: 600 }}>{hata}</div>}
      </div>
    </Modal>
  );
}
