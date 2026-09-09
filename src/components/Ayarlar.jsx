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

// Menü grupları (plan §16). Bölüm kodları sabittir (App.jsx yönlendirmeleri, testler); "sihirbaz" bölüm değil eylemdir.
const GRUPLAR = [
  {
    baslik: "Kulüp",
    bolumler: [
      { kod: "kulup", ad: "Kulüp ve Makbuz", ikon: "tahsilat" },
      { kod: "kalem", ad: "Aidat Kalemleri", ikon: "raporlar" },
      { kod: "whatsapp", ad: "WhatsApp Mesajları", ikon: "whatsapp" },
    ],
  },
  {
    baslik: "Sezon ve Veri",
    bolumler: [
      { kod: "sezon", ad: "Yeni Sezon", ikon: "takvim" },
      { kod: "yedek", ad: "Yedekleme", ikon: "yedek" },
      { kod: "optimize", ad: "Resim ve Belge Optimizasyonu", ikon: "dosya" },
    ],
  },
  {
    baslik: "Kullanıcılar ve Erişim",
    bolumler: [
      { kod: "kullanici", ad: "Kullanıcılar", ikon: "kullanici" },
      ...(COKLU_PC_ACIK ? [{ kod: "sunucu", ad: "Sunucu / Çoklu PC", ikon: "sunucu" }] : []),
    ],
  },
  {
    baslik: "Uygulama",
    bolumler: [
      { kod: "sihirbaz", ad: "İlk Kurulum Sihirbazı", ikon: "onay", eylem: "kurulum" },
      { kod: "lisans", ad: "Lisans", ikon: "kilit" },
      { kod: "hakkinda", ad: "Hakkında", ikon: "uyari" },
    ],
  },
];

export function Ayarlar({ oturum, saltOkunur, onLisansDegisti, onModDegisti, baslangicBolum, onKurulumAc }) {
  const [bolum, setBolum] = useState(baslangicBolum || "kulup");
  const [kirli, setKirli] = useState(false); // açık bölümde kaydedilmemiş değişiklik var mı
  const [hedefBolum, setHedefBolum] = useState(null); // onay bekleyen bölüm geçişi
  const admin = oturum?.role === "admin";
  // Eylemli öğe (sihirbaz): bölüm değişmez, kirli kontrolünden sonra sihirbaz açılır
  const eylemYap = (b) => {
    if (b.eylem === "kurulum") onKurulumAc?.();
  };
  const bolumeGit = (b) => {
    if (!b.eylem && b.kod === bolum) return;
    if (kirli) setHedefBolum(b);
    else if (b.eylem) eylemYap(b);
    else setBolum(b.kod);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {GRUPLAR.filter((g) => g.bolumler.length).map((g, gi) => (
          <div key={g.baslik} style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: gi ? 10 : 0 }}>
            <div
              style={{
                padding: "6px 14px 4px",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--soluk)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {g.baslik}
            </div>
            {g.bolumler
              .filter((b) => !b.eylem || (admin && onKurulumAc))
              .map((b) => (
                <button
                  key={b.kod}
                  type="button"
                  onClick={() => bolumeGit(b)}
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
          </div>
        ))}
      </Kart>
      <Kart style={{ padding: 24 }}>
        {bolum === "kulup" && <KulupAyar saltOkunur={saltOkunur} admin={admin} />}
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
            if (hedefBolum.eylem) eylemYap(hedefBolum);
            else setBolum(hedefBolum.kod);
            setHedefBolum(null);
          }}
          onHayir={() => setHedefBolum(null)}
        />
      )}
    </div>
  );
}

export { KurtarmaKodlari, Guncelleme, paraTR };
