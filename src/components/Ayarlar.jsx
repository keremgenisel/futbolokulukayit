// Ayarlar kabuğu: bölüm menüsü, kaydedilmemiş değişiklik uyarısı (onKirli). Bölümler src/components/ayarlar/ altında.
import { useState } from "react";
import { Kart, Onay } from "./ui.jsx";
import { SettingsLisans } from "./SettingsLisans.jsx";
import { SettingsSunucu } from "./SettingsSunucu.jsx";
import { COKLU_PC_ACIK } from "../lib/ozellikler.js";
import { Ikon } from "./Ikon.jsx";
import { WhatsAppAyar } from "./ayarlar/WhatsAppAyar.jsx";
import { KulupAyar } from "./ayarlar/KulupAyar.jsx";
import { KalemAyar } from "./ayarlar/KalemAyar.jsx";
import { KullaniciAyar, KurtarmaKodlari } from "./ayarlar/KullaniciAyar.jsx";
import { OptimizeAyar } from "./ayarlar/OptimizeAyar.jsx";
import { SezonAyar } from "./ayarlar/SezonAyar.jsx";
import { YedekAyar } from "./ayarlar/YedekAyar.jsx";
import { Hakkinda, Guncelleme } from "./ayarlar/Hakkinda.jsx";
import { paraTR } from "../lib/aidat.js";

const BOLUMLER = [
  { kod: "kulup", ad: "Kulüp ve Makbuz", ikon: "tahsilat" },
  { kod: "kalem", ad: "Aidat Kalemleri", ikon: "raporlar" },
  { kod: "kullanici", ad: "Kullanıcılar", ikon: "kullanici" },
  { kod: "sezon", ad: "Yeni Sezon", ikon: "takvim" },
  { kod: "yedek", ad: "Yedekleme", ikon: "yedek" },
  { kod: "optimize", ad: "Resim ve Belge Optimizasyonu", ikon: "dosya" },
  { kod: "whatsapp", ad: "WhatsApp Mesajları", ikon: "whatsapp" },
  ...(COKLU_PC_ACIK ? [{ kod: "sunucu", ad: "Sunucu / Çoklu PC", ikon: "sunucu" }] : []),
  { kod: "lisans", ad: "Lisans", ikon: "kilit" },
  { kod: "hakkinda", ad: "Hakkında", ikon: "uyari" },
];

export function Ayarlar({ oturum, saltOkunur, onLisansDegisti, onModDegisti, baslangicBolum, onKurulumAc }) {
  const [bolum, setBolum] = useState(baslangicBolum || "kulup");
  const [kirli, setKirli] = useState(false); // açık bölümde kaydedilmemiş değişiklik var mı
  const [hedefBolum, setHedefBolum] = useState(null); // onay bekleyen bölüm geçişi
  const admin = oturum?.role === "admin";
  const bolumeGit = (kod) => {
    if (kod === bolum) return;
    if (kirli) setHedefBolum(kod);
    else setBolum(kod);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {BOLUMLER.map((b) => (
          <button
            key={b.kod}
            type="button"
            onClick={() => bolumeGit(b.kod)}
            style={{
              textAlign: "left",
              padding: "11px 14px",
              borderRadius: 8,
              cursor: "pointer",
              border: 0,
              background: bolum === b.kod ? "var(--mor-acik)" : "transparent",
              color: bolum === b.kod ? "var(--mor-koyu)" : "var(--metin)",
              fontWeight: bolum === b.kod ? 700 : 500,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ikon ad={b.ikon} />
            <span>{b.ad}</span>
          </button>
        ))}
      </Kart>
      <Kart style={{ padding: 24 }}>
        {bolum === "kulup" && <KulupAyar saltOkunur={saltOkunur} admin={admin} onKurulumAc={onKurulumAc} />}
        {bolum === "kalem" && <KalemAyar saltOkunur={saltOkunur} onKirli={setKirli} />}
        {bolum === "whatsapp" && <WhatsAppAyar saltOkunur={saltOkunur} onKirli={setKirli} />}
        {bolum === "kullanici" && <KullaniciAyar oturum={oturum} admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "yedek" && <YedekAyar admin={admin} />}
        {bolum === "sezon" && <SezonAyar admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "optimize" && <OptimizeAyar admin={admin} saltOkunur={saltOkunur} />}
        {bolum === "sunucu" && COKLU_PC_ACIK && <SettingsSunucu admin={admin} onModDegisti={onModDegisti} />}
        {bolum === "lisans" && <SettingsLisans admin={admin} onLisansDegisti={onLisansDegisti} />}
        {bolum === "hakkinda" && <Hakkinda admin={admin} />}
      </Kart>
      {hedefBolum && (
        <Onay
          tehlikeli
          mesaj="Bu bölümde kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı? (Değişiklikler kaybolur.)"
          onEvet={() => {
            setKirli(false);
            setBolum(hedefBolum);
            setHedefBolum(null);
          }}
          onHayir={() => setHedefBolum(null)}
        />
      )}
    </div>
  );
}

export { KurtarmaKodlari, Guncelleme, paraTR };
