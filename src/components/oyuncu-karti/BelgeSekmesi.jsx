// Oyuncu kartı > Belgeler sekmesi: tip başına yükle/değiştir, geçerlilik tarihi, sil
import { useState } from "react";
import { Btn, Rozet, Girdi, Bos } from "../ui.jsx";
import { files, bugun } from "../../lib/api.js";
import { tarihTR } from "../../lib/aidat.js";
import { Ikon } from "../Ikon.jsx";
import { belgeGecerlilik, belgeEtiketi, onerilenGecerlilik, BELGE_TIPLERI } from "../../lib/belge.js";

// Mevcut belgenin geçerlilik tarihi: "Tarih gir" / "Tarihi değiştir" → satır içi tarih kutusu + Kaydet (dosyayı yeniden yüklemeden).
function BelgeTarihDuzenle({ belge, onKaydet }) {
  const [acik, setAcik] = useState(false);
  const [g, setG] = useState(belge.gecerlilik_tarihi || onerilenGecerlilik(bugun().iso));
  if (!acik)
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        style={{
          background: "none",
          border: 0,
          color: belge.gecerlilik_tarihi ? "var(--mor)" : "var(--kirmizi)",
          cursor: "pointer",
          fontSize: 12,
          textDecoration: "underline",
        }}
      >
        {belge.gecerlilik_tarihi ? "Tarihi değiştir" : "Tarih gir"}
      </button>
    );
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Girdi
        type="date"
        value={g}
        onChange={(e) => setG(e.target.value)}
        aria-label="Belge geçerlilik tarihi"
        style={{ width: 150, height: 32 }}
      />
      <Btn
        kucuk
        onClick={async () => {
          if (!g) return;
          await onKaydet(g);
          setAcik(false);
        }}
        disabled={!g}
      >
        Kaydet
      </Btn>
      <Btn kucuk tur="ghost" onClick={() => setAcik(false)}>
        Vazgeç
      </Btn>
    </span>
  );
}

// Tekil tiplerde (vesikalık) ikinci dosya eklenmez; "Değiştir" eskisinin yerine koyar (asıl kural main süreçte, db.belgeEkle).
// Geçerlilik isteyen belgede (sağlık raporu) tarih ZORUNLU: kutu bir yıl sonrasıyla dolu gelir, değiştirilebilir; boşsa yükleme yapılmaz
// (tarihsiz rapor pano/filtrede "raporsuz" sayılıyordu — 08.09.2026).
// Rapor zaten varken tarih kutusu hep görünmesin (mevcut raporun "Tarihi değiştir" kutusuyla karışıyordu — 08.09.2026):
// ilk yüklemede kutu açık gelir; rapor varken önce "Yeni Rapor Yükle", tıklanınca tarih + Yükle açılır.
function BelgeYukleDugmesi({ tip, mevcut = 0, onYukle }) {
  const [gecerlilik, setGecerlilik] = useState(() => (tip.gecerlilik ? onerilenGecerlilik(bugun().iso) : ""));
  const [acik, setAcik] = useState(false);
  const degistir = tip.tekil && mevcut > 0;
  const tarihEksik = !!tip.gecerlilik && !gecerlilik;
  const tarihGoster = !!tip.gecerlilik && (mevcut === 0 || acik);
  if (tip.gecerlilik && mevcut > 0 && !acik)
    return (
      <Btn kucuk tur="ghost" ikon={<Ikon ad="yukle" boyut={16} />} onClick={() => setAcik(true)}>
        Yeni Rapor Yükle
      </Btn>
    );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {tarihGoster && (
        <Girdi
          type="date"
          value={gecerlilik}
          onChange={(e) => setGecerlilik(e.target.value)}
          style={{ width: 150, height: 36, borderColor: tarihEksik ? "var(--kirmizi)" : undefined }}
          title="Yeni raporun geçerlilik tarihi (zorunlu; öneri: bir yıl)"
          aria-label={`${tip.ad} geçerlilik tarihi`}
        />
      )}
      <Btn
        kucuk
        tur="ghost"
        ikon={<Ikon ad="yukle" boyut={16} />}
        onClick={async () => {
          await onYukle(tip.kod, gecerlilik);
          setAcik(false);
        }}
        disabled={tarihEksik}
        title={
          tarihEksik ? "Önce geçerlilik tarihini girin" : degistir ? "Vesikalık tek dosya olur; yenisi eskisinin yerine geçer" : undefined
        }
      >
        {degistir ? "Değiştir" : "Yükle"}
      </Btn>
      {acik && (
        <Btn kucuk tur="ghost" onClick={() => setAcik(false)}>
          Vazgeç
        </Btn>
      )}
    </div>
  );
}

// onYukle(tip, gecerlilik) · onTarihKaydet(belgeId, tarih) · onSil({ tip: "belge", id, mesaj })
export function BelgeSekmesi({ belgeler, saltOkunur, onYukle, onTarihKaydet, onSil }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {BELGE_TIPLERI.map((t) => {
        const mevcut = belgeler.filter((b) => b.tip === t.kod);
        return (
          <div
            key={t.kod}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              border: "1px solid var(--cizgi)",
              borderRadius: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.ad}</div>
              {mevcut.length === 0 ? (
                <Bos kucuk metin="Henüz yüklenmedi" />
              ) : (
                mevcut.map((b) => (
                  <div key={b.id} style={{ fontSize: 13, display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        files().open(b.dosya_yolu);
                      }}
                    >
                      {b.orijinal_ad || b.dosya_yolu}
                    </a>
                    <span style={{ color: "var(--soluk)" }}>
                      {tarihTR(b.yuklenme_tarihi)}
                      {b.gecerlilik_tarihi ? ` · geçerlilik ${tarihTR(b.gecerlilik_tarihi)}` : t.gecerlilik ? " · tarih girilmemiş" : ""}
                    </span>
                    {t.gecerlilik && !saltOkunur && <BelgeTarihDuzenle belge={b} onKaydet={(g) => onTarihKaydet(b.id, g)} />}
                    {!saltOkunur && (
                      <button
                        type="button"
                        onClick={() => onSil({ tip: "belge", id: b.id, mesaj: "Belge silinsin mi?" })}
                        style={{ background: "none", border: 0, color: "var(--kirmizi)", cursor: "pointer", fontSize: 12 }}
                      >
                        sil
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {mevcut.length ? (
              t.gecerlilik ? (
                (() => {
                  const g = belgeGecerlilik(mevcut[0].gecerlilik_tarihi, bugun().iso);
                  return <Rozet ton={g.durum === "gecerli" ? "green" : g.durum === "dolacak" ? "yellow" : "red"}>{belgeEtiketi(g)}</Rozet>;
                })()
              ) : (
                <Rozet ton="green">Yüklü</Rozet>
              )
            ) : t.istege ? (
              <Rozet ton="gray">İsteğe bağlı</Rozet>
            ) : (
              <Rozet ton="red">Eksik</Rozet>
            )}
            {!saltOkunur && <BelgeYukleDugmesi tip={t} mevcut={mevcut.length} onYukle={onYukle} />}
          </div>
        );
      })}
    </div>
  );
}
