import { useState, useEffect } from "react";
import { Modal, Btn, Alan, Girdi, ParaGirdi, Secim, useToast } from "./ui.jsx";
import { db, hataMetni } from "../lib/api.js";
import { DURUMLAR, UCRET_TIPLERI, ODEME_DONEMLERI, UYRUKLAR, aidatHesapla, indirimYuzdesi, paraTR, pasaportGecerliMi, pasaportNormalize } from "../lib/aidat.js";

const BOS = { tc_no: "", uyruk: "tc", pasaport_no: "", ad_soyad: "", dogum_tarihi: "", dogum_yeri: "", okul: "", gsm: "", adres: "", kan_grubu: "", yas_grubu_id: "", durum: "aktif", ucret_tipi: "normal", aylik_aidat: "", odeme_donemi: "1-10", kayit_tarihi: new Date().toISOString().slice(0, 10), notlar: "" };
const KAN = ["A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-"].map((k) => ({ kod: k, ad: k }));

// Oyuncu ekleme / düzenleme formu (kayıt formundaki Öğrenci alanları + kayıt ve ücret).
export function OyuncuForm({ oyuncu, gruplar, onKaydedildi, onKapat }) {
  const [f, setF] = useState(oyuncu ? { ...BOS, ...oyuncu, yas_grubu_id: oyuncu.yas_grubu_id ?? "", aylik_aidat: oyuncu.aylik_aidat ?? "" } : { ...BOS });
  const [ayar, setAyar] = useState(null); // { taban, indirimler } — Ayarlar > Aidat Kalemleri
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const g = (k) => ({ value: f[k] ?? "", onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  // Taban aidat + indirimler yüklenir; yeni kayıtta aidat ücret tipine göre otomatik dolar.
  useEffect(() => {
    db("aidatAyarlari").then((a) => {
      setAyar(a);
      if (!oyuncu) setF((o) => ({ ...o, aylik_aidat: String(aidatHesapla(a.taban, o.ucret_tipi, a.indirimler)) }));
    }).catch(() => {});
  }, [oyuncu]);
  // Ücret tipi değişince aidat yeniden hesaplanır (düzenlemede de; tutar sonra elle değiştirilebilir).
  const ucretTipiDegisti = (e) => {
    const tip = e.target.value;
    setF((o) => ({ ...o, ucret_tipi: tip, aylik_aidat: ayar ? String(aidatHesapla(ayar.taban, tip, ayar.indirimler)) : o.aylik_aidat }));
  };
  const yuzde = ayar ? indirimYuzdesi(f.ucret_tipi, ayar.indirimler[f.ucret_tipi]) : 0;

  const kaydet = async () => {
    if (!f.ad_soyad.trim()) return setHata("Ad soyad zorunlu");
    const yabanci = f.uyruk === "yabanci";
    if (!yabanci && f.tc_no && !/^\d{11}$/.test(f.tc_no)) return setHata("TC kimlik no 11 haneli olmalı");
    if (yabanci && !pasaportGecerliMi(pasaportNormalize(f.pasaport_no))) return setHata("Yabancı uyruklu oyuncu için pasaport no zorunlu (5-15 harf/rakam)");
    if (!f.dogum_tarihi) return setHata("Doğum tarihi zorunlu");
    setHata(""); setBekliyor(true);
    const veri = { ...f, tc_no: yabanci ? null : f.tc_no || null, pasaport_no: yabanci ? pasaportNormalize(f.pasaport_no) : null, yas_grubu_id: f.yas_grubu_id ? Number(f.yas_grubu_id) : null, aylik_aidat: Number(f.aylik_aidat) || 0 };
    delete veri.id; delete veri.yas_grubu_ad; delete veri.created_at; delete veri.updated_at; delete veri.foto_yolu;
    delete veri.aidat_durum; delete veri.aidat_tutar;
    try {
      const kayit = oyuncu ? await db("updatePlayer", oyuncu.id, veri) : await db("createPlayer", veri);
      toast("ok", oyuncu ? "Oyuncu güncellendi" : "Oyuncu kaydedildi");
      onKaydedildi(kayit);
    } catch (e) {
      const m = hataMetni(e);
      setHata(m.includes("UNIQUE") ? (yabanci ? "Bu pasaport numarasıyla kayıtlı oyuncu var" : "Bu TC kimlik numarasıyla kayıtlı oyuncu var") : m);
    } finally { setBekliyor(false); }
  };

  const satir = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };
  return (
    <Modal baslik={oyuncu ? "Oyuncuyu Düzenle" : "Yeni Oyuncu"} onKapat={onKapat} genislik={860}
      altBar={<><Btn tur="ghost" onClick={onKapat}>Vazgeç</Btn><Btn onClick={kaydet} disabled={bekliyor}>{oyuncu ? "Kaydet" : "Oyuncuyu Kaydet"}</Btn></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h3 style={{ fontSize: 20 }}>Öğrenci</h3>
        <div style={satir}>
          <Alan etiket="Uyruk"><Secim secenekler={UYRUKLAR} {...g("uyruk")} aria-label="Uyruk" /></Alan>
          {f.uyruk === "yabanci"
            ? <Alan etiket="Pasaport No *"><Girdi {...g("pasaport_no")} maxLength={15} style={{ textTransform: "uppercase" }} aria-label="Pasaport No" /></Alan>
            : <Alan etiket="TC Kimlik No"><Girdi {...g("tc_no")} maxLength={11} inputMode="numeric" aria-label="TC Kimlik No" /></Alan>}
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
          <Alan etiket="Ücret Tipi"><Secim secenekler={UCRET_TIPLERI} value={f.ucret_tipi} onChange={ucretTipiDegisti} /></Alan>
          <Alan etiket="Aylık Aidat (₺)">
            <ParaGirdi value={f.aylik_aidat} onDegis={(v) => setF({ ...f, aylik_aidat: v })} disabled={f.ucret_tipi === "ucretsiz"} aria-label="Aylık aidat" />
            {ayar && <span style={{ fontSize: 12, color: "var(--soluk)" }}>{ayar.taban > 0 ? `Taban ${paraTR(ayar.taban)}${yuzde ? ` − %${yuzde} indirim` : ""}` : "Taban fiyat Ayarlar > Aidat Kalemleri'nde girilir"}</span>}
          </Alan>
          <Alan etiket="Ödeme Dönemi"><Secim secenekler={ODEME_DONEMLERI.map((d) => ({ kod: d, ad: `Her ayın ${d} arası` }))} {...g("odeme_donemi")} /></Alan>
          <Alan etiket="Notlar" style={{ gridColumn: "span 3" }}><Girdi {...g("notlar")} /></Alan>
        </div>
        {hata && <div role="alert" style={{ color: "var(--kirmizi)", fontWeight: 600 }}>{hata}</div>}
      </div>
    </Modal>
  );
}
