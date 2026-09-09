import { useEffect, useState, useCallback } from "react";
import {
  Kart,
  Btn,
  Rozet,
  Girdi,
  Secim,
  Avatar,
  Bos,
  useToast,
  useDene,
  durumTonu,
  aidatTonu,
  aidatEtiket,
  Sayfalama,
  Telefon,
} from "./ui.jsx";
import { db, cikti, uygulama, bugun } from "../lib/api.js";
import { DURUMLAR, tarihTR, AY_ADLARI, kimlikKisa } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { belgeGecerlilik, belgeEtiketi } from "../lib/belge.js";
import { OyuncuForm } from "./OyuncuForm.jsx";
import { OyuncuAktar } from "./OyuncuAktar.jsx";
import { OyuncuKarti } from "./OyuncuKarti.jsx";
import { raporHtml } from "../lib/raporHtml.js";
import { Ikon } from "./Ikon.jsx";
import { guncelSezon } from "../lib/sezon.js";

export function Oyuncular({ oturum, saltOkunur, onMakbuzKes, acilacakOyuncu, onAcildi }) {
  const [liste, setListe] = useState([]);
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const SAYFA_BOYU = 50;
  const [gruplar, setGruplar] = useState([]);
  const [q, setQ] = useState("");
  // Sezon filtresi (plan §18): varsayılan aktif sezon; "" = tüm sezonlar
  const [sezonDurum, setSezonDurum] = useState(null);
  const [sezonlar, setSezonlar] = useState([]);
  const [sezon, setSezon] = useState(null); // null: henüz seçilmedi → aktif sezon
  const [grup, setGrup] = useState("");
  const [durum, setDurum] = useState("aktifler"); // varsayılan: aktif + deneme + sakat (sahadaki herkes); pasif/ayrıldı/dondurma filtreyle görülür
  const [odemeyen, setOdemeyen] = useState(false);
  const [saglik, setSaglik] = useState(false); // sağlık raporu yok / tarihsiz / süresi dolmuş
  const [yeni, setYeni] = useState(false);
  const [aktarAcik, setAktarAcik] = useState(false);
  const [acik, setAcik] = useState(null);
  const toast = useToast();
  const dene = useDene();
  const { yil, ay, iso } = bugun();
  const aktifSezon = sezonDurum?.aktifSezon || guncelSezon(iso, sezonDurum?.baslangicAyi || 9);
  const seciliSezon = sezon === null ? aktifSezon : sezon;

  const filtre = () => ({
    q,
    sezon: seciliSezon || null,
    yas_grubu_id: grup ? Number(grup) : null,
    durum: durum || null,
    yil,
    ay,
    sadeceOdemeyen: odemeyen,
    saglikSorunlu: saglik,
    bugun: iso,
  });
  const yukle = useCallback(async () => {
    return dene(async () => {
      const r = await db("playersPage", { ...filtre(), sayfa, sayfaBoyu: SAYFA_BOYU });
      setListe(r.liste);
      setToplam(r.toplam);
      if (r.sayfa !== sayfa) setSayfa(r.sayfa); // sayfa taşarsa sunucu son sayfaya çeker
    });
  }, [q, seciliSezon, grup, durum, odemeyen, saglik, yil, ay, sayfa, toast]); // eslint-disable-line react-hooks/exhaustive-deps
  // Filtre değişince ilk sayfaya dön.
  useEffect(() => {
    setSayfa(1);
  }, [q, seciliSezon, grup, durum, odemeyen, saglik]);

  useEffect(() => {
    db("listAgeGroups")
      .then(setGruplar)
      .catch(() => {});
    db("sezonDurumu")
      .then((d) => d && setSezonDurum(d))
      .catch(() => {});
    db("sezonListesi")
      .then((l) => Array.isArray(l) && setSezonlar(l))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(yukle, 150);
    return () => clearTimeout(t);
  }, [yukle]);
  useEffect(() => {
    if (acilacakOyuncu === "yeni") {
      setYeni(true);
      onAcildi?.();
    } else if (acilacakOyuncu === "aktar") {
      setAktarAcik(true);
      onAcildi?.();
    } else if (acilacakOyuncu) {
      setAcik(acilacakOyuncu);
      onAcildi?.();
    }
  }, [acilacakOyuncu, onAcildi]);

  const { tipler: ucretTipleri, ad: ucretAd } = useUcretTipleri();
  const ucretTonu = (k) =>
    k === "normal"
      ? "gray"
      : (ucretTipleri.find((u) => u.kod === k)?.indirim ?? (k === "ucretsiz" || k === "burslu" ? 100 : 0)) >= 100
        ? "purple"
        : "yellow";
  const durumAd = (k) => DURUMLAR.find((d) => d.kod === k)?.ad || k;

  // Dışa aktarım her zaman TAM listeyi alır (ekrandaki sayfa değil).
  const raporVerisi = async () => ({
    sayfa: "Oyuncular",
    sutunlar: [
      { baslik: "Ad Soyad", anahtar: "ad_soyad", genislik: 28 },
      { baslik: "TC / Pasaport", anahtar: "tc", genislik: 16 },
      { baslik: "Doğum", anahtar: "dogum", genislik: 12 },
      { baslik: "Grup", anahtar: "grup", genislik: 8 },
      { baslik: "Durum", anahtar: "durumAd", genislik: 10 },
      { baslik: "Ücret tipi", anahtar: "ucret", genislik: 16 },
      { baslik: "Aidat", anahtar: "aidat", genislik: 10, sag: true },
      { baslik: `${AY_ADLARI[ay - 1]} aidatı`, anahtar: "aidatDurum", genislik: 14 },
      { baslik: "GSM", anahtar: "gsm", genislik: 16 },
    ],
    satirlar: (await db("listPlayersWithDue", filtre())).map((o) => ({
      ad_soyad: o.ad_soyad,
      tc: o.uyruk === "yabanci" ? "P: " + (o.pasaport_no || "") : o.tc_no || "",
      dogum: tarihTR(o.dogum_tarihi),
      grup: o.yas_grubu_ad || "",
      durumAd: durumAd(o.durum),
      ucret: ucretAd(o.ucret_tipi),
      aidat: o.aylik_aidat,
      aidatDurum: aidatEtiket(o.aidat_durum),
      gsm: o.gsm || "",
    })),
  });
  const excel = () =>
    dene(async () => {
      await cikti().excelKaydet(await raporVerisi(), "oyuncular.xlsx");
    });
  const pdf = () =>
    dene(async () => {
      const v = await raporVerisi();
      const logo = await uygulama().logo();
      await cikti().pdfKaydet(
        raporHtml({
          baslik: "Oyuncu Listesi",
          altBaslik: `${v.satirlar.length} oyuncu${seciliSezon ? ` · ${seciliSezon} sezonu` : ""} · ${tarihTR(bugun().iso)}`,
          sutunlar: v.sutunlar,
          satirlar: v.satirlar,
          logo,
          yatay: true,
        }),
        "oyuncular.pdf",
        true,
      );
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", width: 320 }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: "var(--soluk)" }}>
            <Ikon ad="ara" />
          </span>
          <Girdi
            placeholder="Ad, soyad, TC veya pasaport ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ height: 40, paddingLeft: 40 }}
            aria-label="Ara"
          />
        </div>
        <div style={{ flex: 1 }} />
        {oturum?.role === "admin" && !saltOkunur && (
          <Btn tur="ghost" ikon={<Ikon ad="yukle" />} onClick={() => setAktarAcik(true)}>
            İçe Aktar
          </Btn>
        )}
        <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={excel}>
          Excel
        </Btn>
        <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={pdf}>
          PDF
        </Btn>
        {!saltOkunur && (
          <Btn ikon={<Ikon ad="arti" />} onClick={() => setYeni(true)}>
            Yeni Oyuncu
          </Btn>
        )}
      </div>
      <Kart style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Secim
          secenekler={[...new Set([aktifSezon, ...sezonlar])].map((s) => ({ kod: s, ad: s === aktifSezon ? `${s} (aktif sezon)` : s }))}
          bos="Tüm sezonlar"
          value={seciliSezon}
          onChange={(e) => setSezon(e.target.value)}
          style={{ width: 200, height: 40 }}
          aria-label="Sezon"
        />
        <Secim
          secenekler={gruplar}
          bos="Tüm gruplar"
          value={grup}
          onChange={(e) => setGrup(e.target.value)}
          style={{ width: 160, height: 40 }}
          aria-label="Yaş grubu"
        />
        <Secim
          secenekler={[{ kod: "aktifler", ad: "Aktif, deneme ve sakat" }, ...DURUMLAR]}
          bos="Tüm durumlar"
          value={durum}
          onChange={(e) => setDurum(e.target.value)}
          style={{ width: 190, height: 40 }}
          aria-label="Durum"
        />
        <Btn kucuk tur={odemeyen ? "danger" : "ghost"} onClick={() => setOdemeyen(!odemeyen)} style={{ height: 40 }}>
          {odemeyen ? "✕ " : ""}Bu ay ödemeyenler
        </Btn>
        <Btn
          kucuk
          tur={saglik ? "danger" : "ghost"}
          onClick={() => setSaglik(!saglik)}
          style={{ height: 40 }}
          title="Sağlık raporu hiç yüklenmemiş, tarihsiz ya da süresi dolmuş oyuncular"
        >
          {saglik ? "✕ " : ""}Sağlık raporu olmayanlar
        </Btn>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--soluk)", fontSize: 14 }}>{toplam} oyuncu</span>
      </Kart>
      <Kart>
        {liste.length === 0 ? (
          <Bos metin="Kayıt bulunamadı." />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Oyuncu</th>
                <th>Doğum tarihi</th>
                <th>Grup</th>
                <th>Veli</th>
                <th>Durum</th>
                <th>Ücret tipi</th>
                <th>{AY_ADLARI[ay - 1]} aidatı</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((o) => (
                <tr key={o.id} onClick={() => setAcik(o.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar ad={o.ad_soyad} />
                      <div>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                          {o.ad_soyad}
                          {(() => {
                            if (o.saglik_adet === undefined) return null;
                            const g = o.saglik_adet === 0 ? { durum: "yok" } : belgeGecerlilik(o.saglik_gecerlilik, iso);
                            return g.durum === "gecerli" ? null : (
                              <Rozet ton={g.durum === "dolacak" ? "yellow" : "red"}>
                                {o.saglik_adet === 0 ? "Sağlık raporu yok" : g.durum === "yok" ? "Rapor tarihsiz" : belgeEtiketi(g)}
                              </Rozet>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--soluk)" }}>{kimlikKisa(o)}</div>
                      </div>
                    </div>
                  </td>
                  <td>{tarihTR(o.dogum_tarihi)}</td>
                  <td>
                    {o.yas_grubu_ad ? <Rozet ton="purple">{o.yas_grubu_ad}</Rozet> : <span style={{ color: "var(--soluk)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {o.veli_ad ? <div>{o.veli_ad}</div> : null}
                    <Telefon no={o.veli_tel} etiket={o.veli_ad} />
                  </td>
                  <td>
                    <Rozet ton={durumTonu(o.durum)}>{durumAd(o.durum)}</Rozet>
                  </td>
                  <td>
                    <Rozet ton={ucretTonu(o.ucret_tipi)}>{ucretAd(o.ucret_tipi)}</Rozet>
                  </td>
                  <td>
                    <Rozet ton={aidatTonu(o.aidat_durum)}>{aidatEtiket(o.aidat_durum)}</Rozet>
                  </td>
                  <td style={{ color: "var(--soluk)" }}>
                    <Ikon ad="sag" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Sayfalama sayfa={sayfa} toplam={toplam} sayfaBoyu={SAYFA_BOYU} onSayfa={setSayfa} birim="oyuncu" />
      </Kart>
      {aktarAcik && <OyuncuAktar onKapat={() => setAktarAcik(false)} onAktarildi={yukle} />}
      {yeni && (
        <OyuncuForm
          gruplar={gruplar}
          onKapat={() => setYeni(false)}
          onKaydedildi={(k) => {
            setYeni(false);
            yukle();
            setAcik(k.id);
          }}
        />
      )}
      {acik && (
        <OyuncuKarti
          oyuncuId={acik}
          oturum={oturum}
          gruplar={gruplar}
          saltOkunur={saltOkunur}
          onKapat={() => {
            setAcik(null);
            yukle();
          }}
          onMakbuzKes={onMakbuzKes}
        />
      )}
    </div>
  );
}
