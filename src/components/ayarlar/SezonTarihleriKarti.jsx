import { Btn, Alan, Girdi, Rozet, AltBaslik } from "../ui.jsx";
import { sezonKalanGun, kisaAralik } from "../../lib/sezon.js";

/** Ayarlar > Sezon › "Sezon tarihleri" kartı (plan §37; refactor 2. tur §8.7 — SezonAyar.jsx'ten ayrıldı). */
export function SezonTarihleriKarti({ durum, tarih, onTarih, onKaydet, saltOkunur, iso }) {
  return (
    <div
      style={{
        border: "1px solid var(--cizgi)",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "#FAF8FD",
      }}
    >
      <AltBaslik>Sezon tarihleri</AltBaslik>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Alan etiket="Başlangıç" style={{ width: 170 }}>
          <Girdi
            type="date"
            value={tarih.baslangic}
            onChange={(e) => onTarih({ ...tarih, baslangic: e.target.value })}
            aria-label="Sezon başlangıcı"
            disabled={saltOkunur}
          />
        </Alan>
        <Alan etiket="Bitiş" style={{ width: 170 }}>
          <Girdi
            type="date"
            value={tarih.bitis}
            onChange={(e) => onTarih({ ...tarih, bitis: e.target.value })}
            aria-label="Sezon bitişi"
            disabled={saltOkunur}
          />
        </Alan>
        {!saltOkunur && (
          <Btn
            onClick={onKaydet}
            disabled={!durum.aktifSezon || (tarih.baslangic === durum.tarihler?.baslangic && tarih.bitis === durum.tarihler?.bitis)}
          >
            Tarihleri Kaydet
          </Btn>
        )}
        {durum.tarihler && (
          <Rozet ton="purple">
            {Math.max(0, sezonKalanGun(durum.tarihler.bitis, iso))} gün kaldı · {kisaAralik(durum.tarihler.baslangic, durum.tarihler.bitis)}
            {durum.tarihler.kayitli ? "" : " (varsayılan)"}
          </Rozet>
        )}
      </div>
      <div style={{ fontSize: 13, color: "var(--soluk)", lineHeight: 1.5 }}>
        Aidat sezon boyunca <b>12 ay</b> açılır; bu tarihler raporlar, "Sezon Sonuna Kadar" uzun dönem seçimi ve sezon sonu hatırlatması
        içindir. Bitişe 30 gün kala Pano'da hatırlatma çıkar.
      </div>
    </div>
  );
}
