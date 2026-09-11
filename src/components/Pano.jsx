import { useEffect, useState } from "react";
import { Kart, Btn, Girdi, Avatar, Rozet, useToast, useDene, UyariSeridi } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { db, bugun } from "../lib/api.js";
import { useSezonDurumu } from "../lib/useSezonDurumu.js";
import { AY_ADLARI, gecikmeGunu, tesiseGirebilir, paraTR, tarihTR } from "../lib/aidat.js";
import { sezonSonuMu, guncelSezon, sezonKalanGun, kisaAralik } from "../lib/sezon.js";
import { uyariSirala } from "../lib/belge.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { SaglikUyarilari } from "./pano/SaglikUyarilari.jsx";
import { BugunkuAntrenmanlar } from "./pano/BugunkuAntrenmanlar.jsx";
import { BorcluListesi } from "./pano/BorcluListesi.jsx";
import { aidatDegerleri } from "../lib/whatsapp.js";

function Stat({ etiket, deger, renk, not }) {
  return (
    <Kart style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {etiket}
      </span>
      <span className="baslik" style={{ fontSize: 40, color: renk, lineHeight: 1 }}>
        {deger}
      </span>
      <span style={{ fontSize: 13, color: "var(--soluk)" }}>{not}</span>
    </Kart>
  );
}

export function Pano({ onOyuncu, onSekme, onMakbuzKes, saltOkunur, onSezon }) {
  const { durum: sezon } = useSezonDurumu();
  const [saglik, setSaglik] = useState(null); // sağlık raporu uyarıları
  const [wa, setWa] = useState(null); // WhatsApp hatırlatma penceresi: { alicilar, baslik }
  const [ozet, setOzet] = useState(null);
  const [borclular, setBorclular] = useState([]);
  // WhatsApp alıcısı: listUnpaid satırından (veli id/onay/numara + bu ayki hatırlatma bilgisi) (plan §13)
  const waAlici = (b) => ({
    key: String(b.player_id),
    player_id: b.player_id,
    guardian_id: b.veli_id || null,
    oyuncu_ad: b.ad_soyad,
    veli_ad: b.veli_ad,
    grup: b.yas_grubu_ad,
    numara: b.veli_wa || b.veli_tel || "",
    onay: b.veli_onay,
    mesaj_id: null,
    hatirlatma: b.hatirlatma || 0,
    son_hatirlatma: b.son_hatirlatma,
    ek: { kalan: paraTR(b.kalan ?? b.tutar), gecikme: gecikmeGunu(b.odeme_donemi, b.yil, b.ay, new Date()) },
    degerler: aidatDegerleri(b),
  });
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const toast = useToast();
  const dene = useDene();
  const { yil, ay, iso } = bugun();

  useEffect(() => {
    dene(() => db("panoOzet", { yil, ay, bugun: iso }).then(setOzet));
    db("listUnpaid", yil, ay)
      .then(setBorclular)
      .catch(() => {});
    db("saglikRaporuDurumu", iso)
      .then((d) => d && Array.isArray(d.uyarilar) && setSaglik({ ...d, uyarilar: uyariSirala(d.uyarilar) }))
      .catch(() => {});
  }, [yil, ay, iso, toast, dene]);
  const sezonUyari = sezon && sezon.aktifSezon && sezonSonuMu(sezon.aktifSezon, iso, sezon.baslangicAyi);
  // Sezon tarihleri (plan §37): başlıkta "Sezon · aralık · N gün kaldı"; bitişe ≤30 gün kala hatırlatma şeridi
  const tarihler = sezon?.tarihler?.baslangic && sezon?.tarihler?.bitis ? sezon.tarihler : null;
  const kalanGun = tarihler ? sezonKalanGun(tarihler.bitis, iso) : null;
  const bitisYakin = kalanGun !== null && kalanGun >= 0 && kalanGun <= 30 && !sezonUyari;

  useEffect(() => {
    if (!q.trim()) {
      setSonuc([]);
      return;
    }
    const t = setTimeout(
      () =>
        db("listPlayersWithDue", { q: q.trim(), yil, ay })
          .then((l) => setSonuc(l.slice(0, 6)))
          .catch(() => {}),
      150,
    );
    return () => clearTimeout(t);
  }, [q, yil, ay]);

  const gun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "var(--soluk)" }}>{gun}</span>
          {sezon?.aktifSezon && (
            <span
              data-test="sezon-satiri"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--soluk)" }}
            >
              <span aria-hidden="true">·</span>
              <b style={{ color: "var(--metin)" }}>Sezon {sezon.aktifSezon}</b>
              {tarihler && (
                <>
                  <span>{kisaAralik(tarihler.baslangic, tarihler.bitis)}</span>
                  <Rozet ton={kalanGun <= 30 ? "yellow" : "purple"}>{kalanGun < 0 ? "Sezon bitti" : `${kalanGun} gün kaldı`}</Rozet>
                </>
              )}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {!saltOkunur && (
            <>
              <Btn tur="sari" ikon={<Ikon ad="tahsilat" />} onClick={() => onSekme("tahsilat")}>
                Makbuz Kes
              </Btn>
              <Btn ikon={<Ikon ad="arti" />} onClick={() => onSekme("oyuncular", "yeni")}>
                Yeni Oyuncu
              </Btn>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat etiket="Aktif oyuncu" deger={ozet?.aktif ?? "—"} renk="var(--mor)" not={`${ozet?.grup ?? 0} yaş grubunda`} />
        <Stat etiket="Bu ay ödeyen" deger={ozet?.odeyen ?? "—"} renk="var(--yesil)" not={`${AY_ADLARI[ay - 1]} ${yil}`} />
        <Stat etiket="Aidat borcu olan" deger={ozet?.borclu ?? "—"} renk="var(--kirmizi)" not="Tesise giremez" />
        <Stat
          etiket="Bugün antrenman"
          deger={ozet?.antrenmanlar?.length ?? "—"}
          renk="#9A7D00"
          not={(ozet?.antrenmanlar || []).map((t) => t.yas_grubu_ad).join(" · ") || "Antrenman yok"}
        />
        <Stat
          etiket="Sağlık raporu"
          deger={saglik ? saglik.uyarilar.length : "—"}
          renk={saglik && saglik.uyarilar.length ? "var(--kirmizi)" : "var(--yesil)"}
          not={
            saglik
              ? saglik.uyarilar.length
                ? `${saglik.doldu} doldu · ${saglik.dolacak} dolacak · ${saglik.yok} yok${saglik.tarihsiz ? ` · ${saglik.tarihsiz} tarihsiz` : ""}`
                : "Hepsi geçerli"
              : ""
          }
        />
      </div>
      {saglik && saglik.uyarilar.length > 0 && <SaglikUyarilari saglik={saglik} iso={iso} onOyuncu={onOyuncu} onSekme={onSekme} />}
      {bitisYakin && (
        <UyariSeridi
          eylem={
            onSezon && (
              <Btn tur="ghost" onClick={onSezon} ikon={<Ikon ad="takvim" />}>
                Sezon Ayarları
              </Btn>
            )
          }
        >
          <b>
            {sezon.aktifSezon} sezonu {kalanGun === 0 ? "bugün bitiyor" : `${kalanGun} gün sonra bitiyor`} ({tarihTR(tarihler.bitis)}).
          </b>{" "}
          Yeni sezon tarihlerini ve yenileyen oyuncuları Ayarlar &gt; Sezon'dan hazırlayabilirsiniz.
        </UyariSeridi>
      )}
      {sezonUyari && (
        <UyariSeridi
          eylem={
            onSezon && (
              <Btn onClick={onSezon} ikon={<Ikon ad="takvim" />}>
                Yeni Sezona Geç
              </Btn>
            )
          }
        >
          <b>{sezon.aktifSezon} sezonu bitti.</b> {guncelSezon(iso, sezon.baslangicAyi)} sezonu başladı; yenileyen oyuncuları işaretleyip
          yenilemeyenleri pasife almak için yeni sezona geçin.
        </UyariSeridi>
      )}
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 22 }}>Tesise Giriş Kontrolü</h3>
          <span style={{ fontSize: 13, color: "var(--soluk)" }}>Ad, soyad, TC veya pasaport ile ara</span>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: 15, color: "var(--soluk)" }}>
            <Ikon ad="ara" boyut={22} />
          </span>
          <Girdi
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Oyuncu adı, TC veya pasaport no yazın"
            style={{ height: 52, fontSize: 17, paddingLeft: 48 }}
            aria-label="Tesise giriş araması"
          />
        </div>
        {sonuc.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {sonuc.map((o) => {
              const ok = tesiseGirebilir(o, o.aidat_durum ? { durum: o.aidat_durum } : null);
              return (
                <div
                  key={o.id}
                  onClick={() => onOyuncu(o.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--cizgi)",
                    background: ok ? "var(--yesil-acik)" : "var(--kirmizi-acik)",
                    cursor: "pointer",
                  }}
                >
                  <Avatar ad={o.ad_soyad} boyut={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{o.ad_soyad}</div>
                    <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                      {o.yas_grubu_ad || "Grup yok"} · {o.durum} · {AY_ADLARI[ay - 1]} aidatı{" "}
                      {o.aidat_durum === "odendi"
                        ? "ödendi"
                        : o.aidat_durum === "muaf"
                          ? "muaf"
                          : o.aidat_durum === "odenmedi"
                            ? "ödenmedi"
                            : "kaydı yok"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: ok ? "var(--yesil)" : "var(--kirmizi)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ikon ad={ok ? "onay" : "kapat"} />
                    {ok ? "GİREBİLİR" : o.aidat_durum === "odenmedi" ? "AİDAT BORCU" : "GİREMEZ"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Kart>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <BugunkuAntrenmanlar antrenmanlar={ozet?.antrenmanlar || []} onSekme={onSekme} />
        <BorcluListesi
          borclular={borclular}
          yil={yil}
          ay={ay}
          saltOkunur={saltOkunur}
          onOyuncu={onOyuncu}
          onSekme={onSekme}
          onMakbuzKes={onMakbuzKes}
          onWa={setWa}
          waAlici={waAlici}
        />
      </div>
      {wa && (
        <WhatsAppHatirlat
          tur="aidat"
          baslik={wa.baslik}
          altBaslik={wa.altBaslik}
          alicilar={wa.alicilar}
          kayit={{ yil, ay }}
          saltOkunur={saltOkunur}
          onKapat={() => {
            setWa(null);
            db("listUnpaid", yil, ay)
              .then(setBorclular)
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
