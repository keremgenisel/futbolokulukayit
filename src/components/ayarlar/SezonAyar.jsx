// Ayarlar > Yeni Sezon sihirbazı (docs/plan.md §10)
import { useEffect, useState, useCallback } from "react";
import { Btn, Alan, Girdi, Secim, Rozet, Onay, Bos, useToast, useDene } from "../ui.jsx";
import { db, bugun } from "../../lib/api.js";
import { paraTR, tarihTR, AY_ADLARI } from "../../lib/aidat.js";
import {
  guncelSezon,
  sonrakiSezon,
  sezonGecerliMi,
  sezonSonuMu,
  ustGrupOner,
  sezonTarihDogrula,
  sezonKalanGun,
  kisaAralik,
} from "../../lib/sezon.js";
import { AltBaslik } from "../ui.jsx";
import { araEslesir } from "../../lib/metin.js";
import { Ikon } from "../Ikon.jsx";

// Yeni sezon sihirbazı (plan §10): yenileyenleri işaretle → yenilemeyenler pasif, yenileyenler yeni sezon (+ üst grup).

export function SezonAyar({ admin, saltOkunur }) {
  const [durum, setDurum] = useState(null); // sezonDurumu
  const [adaylar, setAdaylar] = useState(null);
  const [gruplar, setGruplar] = useState([]);
  const [secim, setSecim] = useState({}); // id → { yeniledi, yas_grubu_id }
  const [yeniSezon, setYeniSezon] = useState("");
  const [eskiBorcSil, setEskiBorcSil] = useState(false);
  const [onay, setOnay] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [tarih, setTarih] = useState({ baslangic: "", bitis: "" }); // aktif sezonun tarihleri (plan §37)
  const [yeniTarih, setYeniTarih] = useState({ baslangic: "", bitis: "" }); // geçilecek sezonun tarihleri
  const toast = useToast();
  const dene = useDene();
  const iso = bugun().iso;

  const yukle = useCallback(async () => {
    return dene(async () => {
      const d = await db("sezonDurumu");
      setDurum(d);
      const g = await db("listAgeGroups");
      setGruplar(g);
      const l = await db("sezonAdayListesi");
      setAdaylar(l);
      setSecim(Object.fromEntries(l.map((o) => [o.id, { yeniledi: false, yas_grubu_id: ustGrupOner(g, o.yas_grubu_id) }])));
      setYeniSezon(d.aktifSezon ? sonrakiSezon(d.aktifSezon) : guncelSezon(iso, d.baslangicAyi));
      const t = d.tarihler || { baslangic: "", bitis: "" };
      setTarih({ baslangic: t.baslangic || "", bitis: t.bitis || "" });
      // geçilecek sezon: bir yıl kaydırılmış öneri
      const kaydir = (x) => (x ? String(Number(x.slice(0, 4)) + 1) + x.slice(4) : "");
      setYeniTarih({ baslangic: kaydir(t.baslangic), bitis: kaydir(t.bitis) });
    });
  }, [dene, iso]);
  useEffect(() => {
    yukle();
  }, [yukle]);

  const ayKaydet = (ay) =>
    dene(async () => {
      await db("setSetting", "sezon_baslangic_ayi", String(ay));
      toast("ok", "Sezon başlangıç ayı kaydedildi");
      yukle();
    });
  const tarihKaydet = () =>
    dene(async () => {
      const d = sezonTarihDogrula(durum.aktifSezon, tarih.baslangic, tarih.bitis);
      if (!d.gecerli) return toast("err", d.neden);
      await db("sezonTarihKaydet", durum.aktifSezon, tarih.baslangic, tarih.bitis);
      toast("ok", "Sezon tarihleri kaydedildi");
      yukle();
    });
  const aktifSezonKaydet = async (sz) => {
    if (!sezonGecerliMi(sz)) return toast("err", "Sezon 2026-2027 biçiminde olmalı");
    return dene(async () => {
      await db("setSetting", "aktif_sezon", sz);
      toast("ok", "Aktif sezon kaydedildi");
      yukle();
    });
  };
  const [grupFiltre, setGrupFiltre] = useState("");
  const [ara, setAra] = useState("");
  // Filtre yalnız GÖRÜNÜMÜ daraltır; işaretler ve alttaki özet tüm liste üzerinden hesaplanır.
  const gorunen = (adaylar || []).filter(
    (o) => (!grupFiltre || String(o.yas_grubu_id) === grupFiltre) && (!ara.trim() || araEslesir(o.ad_soyad, ara)),
  );
  const filtreli = !!grupFiltre || !!ara.trim();
  const hepsi = (deger) => {
    const ids = new Set(gorunen.map((o) => String(o.id)));
    setSecim(Object.fromEntries(Object.entries(secim).map(([id, v]) => [id, ids.has(id) ? { ...v, yeniledi: deger } : v])));
  };
  const yenileyenler = adaylar ? adaylar.filter((o) => secim[o.id]?.yeniledi) : [];
  const yenilemeyenler = adaylar ? adaylar.filter((o) => !secim[o.id]?.yeniledi) : [];
  const eskiBorc = yenilemeyenler.reduce((t, o) => t + (o.borc_tutar || 0), 0);
  const gec = async () => {
    setOnay(false);
    setBekliyor(true);
    return dene(
      async () => {
        const r = await db("yeniSezonaGec", {
          sezon: yeniSezon,
          baslangic: yeniTarih.baslangic,
          bitis: yeniTarih.bitis,
          eskiBorcSil,
          yenileyenler: yenileyenler.map((o) => ({ id: o.id, yas_grubu_id: secim[o.id].yas_grubu_id })),
        });
        if (r?.error) return toast("err", r.error);
        setSonuc(r);
        toast("ok", `${r.sezon} sezonuna geçildi`);
        yukle();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };

  if (!admin) return <div style={{ color: "var(--soluk)" }}>Bu bölüm yalnız yöneticiler içindir.</div>;
  if (!durum || !adaylar) return null;
  const sezonSonu = durum.aktifSezon && sezonSonuMu(durum.aktifSezon, iso, durum.baslangicAyi);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ fontSize: 22 }}>Yeni Sezon</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Sezon bitince yılda bir kez çalıştırılır. Yenileyen oyuncular yeni sezona geçer (isteğe bağlı bir üst yaş grubuna), yenilemeyenler{" "}
        <b>silinmez</b>, "Pasif" olur: aidat borcu açılmaz, listelerde görünmez; makbuz, yoklama ve belgeleri kalır. Geri dönerse kartından
        durumu Aktif yapmak yeter.
      </p>
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
              onChange={(e) => setTarih({ ...tarih, baslangic: e.target.value })}
              aria-label="Sezon başlangıcı"
              disabled={saltOkunur}
            />
          </Alan>
          <Alan etiket="Bitiş" style={{ width: 170 }}>
            <Girdi
              type="date"
              value={tarih.bitis}
              onChange={(e) => setTarih({ ...tarih, bitis: e.target.value })}
              aria-label="Sezon bitişi"
              disabled={saltOkunur}
            />
          </Alan>
          {!saltOkunur && (
            <Btn
              onClick={tarihKaydet}
              disabled={!durum.aktifSezon || (tarih.baslangic === durum.tarihler?.baslangic && tarih.bitis === durum.tarihler?.bitis)}
            >
              Tarihleri Kaydet
            </Btn>
          )}
          {durum.tarihler && (
            <Rozet ton="purple">
              {Math.max(0, sezonKalanGun(durum.tarihler.bitis, iso))} gün kaldı ·{" "}
              {kisaAralik(durum.tarihler.baslangic, durum.tarihler.bitis)}
              {durum.tarihler.kayitli ? "" : " (varsayılan)"}
            </Rozet>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--soluk)", lineHeight: 1.5 }}>
          Aidat sezon boyunca <b>12 ay</b> açılır; bu tarihler raporlar, "Sezon Sonuna Kadar" uzun dönem seçimi ve sezon sonu hatırlatması
          içindir. Bitişe 30 gün kala Pano'da hatırlatma çıkar.
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Alan etiket="Aktif sezon" style={{ width: 160 }}>
          <Girdi
            defaultValue={durum.aktifSezon}
            placeholder="2026-2027"
            aria-label="Aktif sezon"
            onBlur={(e) => e.target.value !== durum.aktifSezon && aktifSezonKaydet(e.target.value.trim())}
            disabled={saltOkunur}
          />
        </Alan>
        <Alan etiket="Sezon başlangıç ayı" style={{ width: 180 }}>
          <Secim
            secenekler={AY_ADLARI.map((a, i) => ({ kod: i + 1, ad: a }))}
            value={durum.baslangicAyi}
            onChange={(e) => ayKaydet(Number(e.target.value))}
            aria-label="Sezon başlangıç ayı"
            disabled={saltOkunur}
          />
        </Alan>
        <div style={{ fontSize: 13, color: "var(--soluk)", paddingBottom: 10 }}>
          {durum.sonGecis ? `Son geçiş: ${tarihTR(durum.sonGecis)}` : "Henüz sezon geçişi yapılmadı"}
          {sezonSonu ? " · " : ""}
          {sezonSonu && <b style={{ color: "var(--kirmizi)" }}>{durum.aktifSezon} sezonu bitti, geçiş bekliyor</b>}
        </div>
      </div>

      {sonuc && (
        <div
          role="status"
          style={{ background: "var(--yesil-acik)", border: "1.5px solid var(--yesil)", borderRadius: 10, padding: "12px 16px" }}
        >
          <b>{sonuc.sezon} sezonuna geçildi.</b> {sonuc.yenilenen} oyuncu yeniledi
          {sonuc.grupDegisen ? ` (${sonuc.grupDegisen} üst gruba taşındı)` : ""}, {sonuc.pasif} oyuncu pasife alındı
          {sonuc.borcSilinen ? `, ${sonuc.borcSilinen} eski aidat kaydı silindi` : ""}.
          {sonuc.ilkAy
            ? ` Yeni sezonun ilk ayı (${AY_ADLARI[sonuc.ilkAy.ay - 1]} ${sonuc.ilkAy.yil}) için ${sonuc.ilkAyBorcu} aidat kaydı açıldı.`
            : ""}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            position: "sticky",
            top: -24,
            zIndex: 2,
            background: "#fff",
            padding: "8px 0",
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Alan etiket="Geçilecek sezon" style={{ width: 150 }}>
            <Girdi
              value={yeniSezon}
              onChange={(e) => setYeniSezon(e.target.value.trim())}
              aria-label="Geçilecek sezon"
              disabled={saltOkunur}
            />
          </Alan>
          <Alan etiket="Başlangıç" style={{ width: 160 }}>
            <Girdi
              type="date"
              value={yeniTarih.baslangic}
              onChange={(e) => setYeniTarih({ ...yeniTarih, baslangic: e.target.value })}
              aria-label="Yeni sezon başlangıcı"
              disabled={saltOkunur}
            />
          </Alan>
          <Alan etiket="Bitiş" style={{ width: 160 }}>
            <Girdi
              type="date"
              value={yeniTarih.bitis}
              onChange={(e) => setYeniTarih({ ...yeniTarih, bitis: e.target.value })}
              aria-label="Yeni sezon bitişi"
              disabled={saltOkunur}
            />
          </Alan>
          <Alan etiket="Yaş grubu" style={{ width: 160 }}>
            <Secim
              secenekler={gruplar}
              bos="Tüm gruplar"
              value={grupFiltre}
              onChange={(e) => setGrupFiltre(e.target.value)}
              aria-label="Yaş grubu filtresi"
            />
          </Alan>
          <Alan etiket="Ara" style={{ width: 180 }}>
            <Girdi value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Ad soyad" aria-label="Oyuncu ara" />
          </Alan>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8, paddingBottom: 4, whiteSpace: "nowrap" }}>
            <Btn kucuk tur="ghost" onClick={() => hepsi(true)} disabled={saltOkunur || gorunen.length === 0}>
              {filtreli ? "Görünenleri yeniledi işaretle" : "Tümünü yeniledi işaretle"}
            </Btn>
            <Btn kucuk tur="ghost" onClick={() => hepsi(false)} disabled={saltOkunur || gorunen.length === 0}>
              {filtreli ? "Görünenleri kaldır" : "Tümünü kaldır"}
            </Btn>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--soluk)" }}>
          {filtreli
            ? `${gorunen.length} / ${adaylar.length} oyuncu gösteriliyor · işaretler ve özet tüm liste için geçerli`
            : `${adaylar.length} oyuncu`}
        </div>
        {adaylar.length === 0 ? (
          <Bos metin="Aktif oyuncu yok." />
        ) : (
          <div
            style={{
              overflow: "auto",
              maxHeight: "calc(100vh - 420px)",
              minHeight: 240,
              border: "1px solid var(--cizgi)",
              borderRadius: 10,
            }}
          >
            <table>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff" }}>
                <tr>
                  <th>Yeniledi</th>
                  <th>Oyuncu</th>
                  <th>Mevcut grup</th>
                  <th>Yeni sezon grubu</th>
                  <th>Ödenmemiş aidat</th>
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--soluk)" }}>
                      Filtreye uyan oyuncu yok.
                    </td>
                  </tr>
                )}
                {gorunen.map((o) => {
                  const sc = secim[o.id];
                  return (
                    <tr key={o.id} style={{ background: sc?.yeniledi ? "var(--yesil-acik)" : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!sc?.yeniledi}
                          onChange={(e) => setSecim({ ...secim, [o.id]: { ...sc, yeniledi: e.target.checked } })}
                          aria-label={`${o.ad_soyad} yeniledi`}
                          disabled={saltOkunur}
                          style={{ width: 20, height: 20 }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {o.ad_soyad}
                        {o.durum !== "aktif" && (
                          <span style={{ color: "var(--soluk)", fontWeight: 400 }}> · {o.durum === "deneme" ? "Deneme" : "Sakat"}</span>
                        )}
                      </td>
                      <td>{o.yas_grubu_ad || "—"}</td>
                      <td>
                        {sc?.yeniledi ? (
                          <Secim
                            secenekler={gruplar.filter((g) => g.aktif)}
                            bos="Grup yok"
                            value={sc.yas_grubu_id || ""}
                            onChange={(e) =>
                              setSecim({ ...secim, [o.id]: { ...sc, yas_grubu_id: e.target.value ? Number(e.target.value) : null } })
                            }
                            aria-label={`${o.ad_soyad} yeni grup`}
                            style={{ height: 36, width: 150 }}
                          />
                        ) : (
                          <span style={{ color: "var(--soluk)" }}>Pasife alınacak</span>
                        )}
                      </td>
                      <td>
                        {o.borc_adet > 0 ? (
                          <Rozet ton="red">
                            {o.borc_adet} ay · {paraTR(o.borc_tutar)}
                          </Rozet>
                        ) : (
                          <span style={{ color: "var(--soluk)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {adaylar.length > 0 && (
          <div
            style={{
              background: "var(--zemin)",
              border: "1px solid var(--cizgi)",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 14,
            }}
          >
            <div data-testid="sezon-ozet">
              <b>{yenileyenler.length}</b> oyuncu {yeniSezon || "yeni"} sezonuna geçecek · <b>{yenilemeyenler.length}</b> oyuncu pasife
              alınacak
            </div>
            {eskiBorc > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={eskiBorcSil} onChange={(e) => setEskiBorcSil(e.target.checked)} disabled={saltOkunur} />{" "}
                Yenilemeyenlerin ödenmemiş eski aidatını ({paraTR(eskiBorc)}) sil (kayıt "muaf" olur; işaretlenmezse borç kayıtta kalır,
                raporlarda görünür)
              </label>
            )}
            {!saltOkunur && (
              <div>
                <Btn
                  ikon={<Ikon ad="takvim" />}
                  onClick={() => {
                    if (!sezonGecerliMi(yeniSezon)) return toast("err", "Geçilecek sezon 2027-2028 biçiminde olmalı");
                    if (yeniTarih.baslangic || yeniTarih.bitis) {
                      const td = sezonTarihDogrula(yeniSezon, yeniTarih.baslangic, yeniTarih.bitis);
                      if (!td.gecerli) return toast("err", td.neden);
                    }
                    setOnay(true);
                  }}
                  disabled={bekliyor}
                >
                  Yeni Sezona Geç
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>
      {onay && (
        <Onay
          tehlikeli
          mesaj={`${yeniSezon} sezonuna geçilsin mi? ${yenileyenler.length} oyuncu yeni sezona geçecek, ${yenilemeyenler.length} oyuncu pasife alınacak${eskiBorcSil ? ", eski borçlar silinecek" : ""}. Pasife alınanlar silinmez, kartından yeniden aktif yapılabilir.`}
          onEvet={gec}
          onHayir={() => setOnay(false)}
        />
      )}
    </div>
  );
}
