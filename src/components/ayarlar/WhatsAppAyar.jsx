// Ayarlar > WhatsApp Mesajları
import { useEffect, useState, useCallback } from "react";
import { Btn, useToast } from "../ui.jsx";
import { db, hataMetni } from "../../lib/api.js";
import {
  SABLON_ANAHTARLARI,
  SABLON_ADLARI,
  VARSAYILAN_SABLONLAR,
  VARSAYILAN_KULUP,
  YER_TUTUCULAR,
  sablonDoldur,
  aidatDegerleri,
  antrenmanDegerleri,
} from "../../lib/whatsapp.js";

// WhatsApp mesaj şablonları (plan §13.2): dört şablon, yer tutucular, örnek oyuncuyla canlı önizleme, tek Kaydet.

const WA_ORNEK = {
  veli_ad: "Murat Yıldız",
  ad_soyad: "Kaan Yıldız",
  yil: 2026,
  ay: 9,
  tutar: 3500,
  kalan: 3500,
  odeme_donemi: "1-10",
  yas_grubu_ad: "U11",
};

const WA_ORNEK_ANT = {
  tarih: "2026-09-08",
  saat: "18:30",
  saha: "Saha 2",
  yas_grubu_ad: "U11",
  iptal_nedeni: "Yağmur nedeniyle.",
  degisiklik_notu: JSON.stringify({ eskiTarih: "2026-09-07", eskiSaat: "17:00" }),
};

export function WhatsAppAyar({ saltOkunur, onKirli }) {
  const TURLER = Object.keys(SABLON_ANAHTARLARI);
  const [kayitli, setKayitli] = useState(null); // tur → metin
  const [taslak, setTaslak] = useState({});
  const [kulup, setKulup] = useState(VARSAYILAN_KULUP);
  const [onizleme, setOnizleme] = useState("aidat");
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const yukle = useCallback(async () => {
    try {
      const m = {};
      for (const t of TURLER) m[t] = (await db("getSetting", SABLON_ANAHTARLARI[t])) || VARSAYILAN_SABLONLAR[t];
      setKayitli(m);
      setTaslak(m);
      setKulup((await db("getSetting", "kulup_adi")) || VARSAYILAN_KULUP);
    } catch (e) {
      toast("err", hataMetni(e));
    }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    yukle();
  }, [yukle]);
  const degisen = kayitli ? TURLER.filter((t) => taslak[t] !== kayitli[t]) : [];
  useEffect(() => {
    onKirli?.(degisen.length > 0);
  }, [degisen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onKirli?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const kaydet = async () => {
    setBekliyor(true);
    try {
      for (const t of degisen) {
        if (!String(taslak[t]).trim()) throw new Error(`${SABLON_ADLARI[t]} şablonu boş olamaz`);
        await db("setSetting", SABLON_ANAHTARLARI[t], taslak[t]);
      }
      toast("ok", `${degisen.length} şablon kaydedildi`);
      await yukle();
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  const ornekDegerler = (t) =>
    t === "aidat" || t === "genel" ? aidatDegerleri(WA_ORNEK, kulup) : antrenmanDegerleri(WA_ORNEK_ANT, WA_ORNEK, kulup);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>WhatsApp Mesajları</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Program mesajı hazırlar ve kulübün WhatsApp'ında açar; Gönder'e siz basarsınız. Ücretsizdir, WhatsApp hesabı ya da API gerekmez.
        Yalnız mesaj onayı verilmiş velilere açılır (Oyuncu kartı &gt; Aile). Değişiklikler alttaki Kaydet ile kaydedilir.
      </p>
      {kayitli && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {TURLER.map((t) => (
              <label key={t} style={{ display: "flex", flexDirection: "column", gap: 6 }} onFocus={() => setOnizleme(t)}>
                <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {SABLON_ADLARI[t]}
                  {taslak[t] !== kayitli[t] && <span style={{ color: "var(--mor)", marginLeft: 8 }}>· değişti</span>}
                </span>
                <textarea
                  aria-label={SABLON_ADLARI[t]}
                  value={taslak[t]}
                  onChange={(e) => setTaslak({ ...taslak, [t]: e.target.value })}
                  onFocus={() => setOnizleme(t)}
                  disabled={saltOkunur}
                  rows={t === "genel" ? 2 : 3}
                  style={{
                    border: "1px solid var(--cizgi)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14.5,
                    lineHeight: 1.45,
                    fontFamily: "inherit",
                    resize: "vertical",
                    background: taslak[t] !== kayitli[t] ? "var(--sari-acik)" : "#fff",
                  }}
                />
              </label>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: "var(--soluk)", marginRight: 4 }}>Yer tutucular:</span>
              {YER_TUTUCULAR.map((y) => (
                <code
                  key={y}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "var(--mor-acik)",
                    color: "var(--mor-koyu)",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >{`{${y}}`}</code>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Önizleme · {SABLON_ADLARI[onizleme]} · Kaan Yıldız (örnek)
            </span>
            <div style={{ background: "#ECE5DD", borderRadius: 12, padding: 16 }}>
              <div
                data-testid="wa-ayar-onizleme"
                style={{
                  background: "#DCF8C6",
                  borderRadius: "12px 12px 2px 12px",
                  padding: "10px 12px",
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  whiteSpace: "pre-line",
                }}
              >
                {sablonDoldur(taslak[onizleme] || "", ornekDegerler(onizleme))}
              </div>
            </div>
            {!saltOkunur && taslak[onizleme] !== VARSAYILAN_SABLONLAR[onizleme] && (
              <button
                type="button"
                onClick={() => setTaslak({ ...taslak, [onizleme]: VARSAYILAN_SABLONLAR[onizleme] })}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: 0,
                  padding: 0,
                  color: "var(--mor)",
                  cursor: "pointer",
                  fontSize: 13,
                  textDecoration: "underline",
                }}
              >
                Varsayılan metne dön
              </button>
            )}
            <div
              style={{
                border: "1px solid var(--sari)",
                background: "var(--sari-acik)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                lineHeight: 1.4,
                color: "var(--mor-koyu)",
              }}
            >
              <b>KVKK:</b> Veli kaydında "WhatsApp ile bilgilendirme onayı" işaretli olmalı; mevcut veliler onaylı kabul edildi (kulüp
              kararı). Kâğıt kayıt formuna bir onay satırı eklemeniz önerilir.
            </div>
          </div>
        </div>
      )}
      {!saltOkunur && degisen.length > 0 && (
        <div
          role="status"
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "#fff",
            border: "1px solid var(--sari)",
            borderRadius: 10,
            boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
          }}
        >
          <span style={{ flex: 1, fontWeight: 600 }}>{degisen.length} şablon kaydedilmedi</span>
          <Btn tur="ghost" onClick={() => setTaslak(kayitli)} disabled={bekliyor}>
            Vazgeç
          </Btn>
          <Btn onClick={kaydet} disabled={bekliyor}>
            Kaydet
          </Btn>
        </div>
      )}
    </div>
  );
}
