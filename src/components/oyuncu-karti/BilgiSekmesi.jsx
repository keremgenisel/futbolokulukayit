// Oyuncu kartı > Bilgiler sekmesi (salt gösterim)
import { tarihTR, paraTR, kimlikBilgisi } from "../../lib/aidat.js";

function Bilgi({ etiket, deger, genis }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: genis ? "span 2" : undefined }}>
      <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {etiket}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{deger || "—"}</span>
    </div>
  );
}

export function BilgiSekmesi({ o, veliler, ucretAd, sonMesaj }) {
  const veliAd = veliler.find((v) => v.veli_mi)?.ad_soyad;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h3 style={{ fontSize: 22 }}>Öğrenci</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 20 }}>
        <Bilgi etiket={kimlikBilgisi(o).etiket} deger={kimlikBilgisi(o).deger} />
        <Bilgi etiket="Adı Soyadı" deger={o.ad_soyad} />
        <Bilgi etiket="Doğum Tarihi" deger={tarihTR(o.dogum_tarihi)} />
        <Bilgi etiket="Doğum Yeri" deger={o.dogum_yeri} />
        <Bilgi etiket="Okulu" deger={o.okul} />
        <Bilgi etiket="Kan Grubu" deger={o.kan_grubu} />
        <Bilgi etiket="GSM" deger={o.gsm} />
        <Bilgi etiket="Ev Adresi" deger={o.adres} genis />
      </div>
      <div style={{ height: 1, background: "var(--cizgi)" }} />
      <h3 style={{ fontSize: 22 }}>Kayıt ve Ücret</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 20 }}>
        <Bilgi etiket="Yaş Grubu" deger={o.yas_grubu_ad} />
        <Bilgi etiket="Ücret Tipi" deger={ucretAd(o.ucret_tipi)} />
        <Bilgi etiket="Aylık Aidat" deger={paraTR(o.aylik_aidat)} />
        <Bilgi etiket="Ödeme Dönemi" deger={`Her ayın ${o.odeme_donemi} arası`} />
        <Bilgi etiket="Veli" deger={veliAd} />
        <Bilgi etiket="Veli WhatsApp" deger={veliler.find((v) => v.veli_mi)?.whatsapp_no} />
        <Bilgi etiket="Kayıt Tarihi" deger={tarihTR(o.kayit_tarihi)} />
        <Bilgi etiket="Notlar" deger={o.notlar} />
        <Bilgi
          etiket="Son WhatsApp"
          deger={
            sonMesaj
              ? `${tarihTR(String(sonMesaj.tarih).slice(0, 10))} · ${{ aidat: "aidat hatırlatma", genel: "mesaj", iptal: "iptal bildirimi", degisiklik: "değişiklik bildirimi" }[sonMesaj.tur] || sonMesaj.tur}${sonMesaj.kullanici ? ` · ${sonMesaj.kullanici}` : ""}`
              : ""
          }
        />
      </div>
    </div>
  );
}
