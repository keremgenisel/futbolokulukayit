import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Sayfalama, useDene } from "./ui.jsx";
import { db, cikti, uygulama, bugun, ayAraligi } from "../lib/api.js";
import { paraTR } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { raporHtml } from "../lib/raporHtml.js";
import { sezonAyYili, guncelSezon, sezonAraligi, ayinSonGunu } from "../lib/sezon.js";
import { Ikon } from "./Ikon.jsx";
import { SezonAySecim } from "./SezonAySecim.jsx";

import {
  RAPORLAR,
  oyuncuListesiRaporu,
  borcluListesiRaporu,
  tahsilatRaporu,
  saglikRaporu,
  yoklamaOzetiRaporu,
  donemEtiketi,
} from "../lib/raporlar.js";

export function Raporlar() {
  const { yil, ay } = bugun();
  const { ad: ucretAd } = useUcretTipleri();
  const [rapor, setRapor] = useState("oyuncu");
  // Sezon + Ay süzgeci (plan §19): ay null = Tümü; yıl sezon + aydan türetilir
  const [ayS, setAyS] = useState(ay);
  const [sezonDurum, setSezonDurum] = useState(null); // { aktifSezon, baslangicAyi }
  const [sezonlar, setSezonlar] = useState([]);
  const [sezonS, setSezonS] = useState("");
  const [yoklamaMod, setYoklamaMod] = useState("sezon"); // Yoklama Özeti: "sezon" (sezon + ay) | "tarih" (aralık)
  const baslangicAyi = sezonDurum?.baslangicAyi || 9;
  const seciliSezon = sezonS || sezonDurum?.aktifSezon || guncelSezon(bugun().iso, baslangicAyi);
  const yilS = ayS ? (sezonAyYili(seciliSezon, ayS, baslangicAyi) ?? yil) : null;
  // Seçime göre tarih aralığı: ay → o ay; Tümü → sezon aralığı
  const donemAraligi = () => (ayS ? ayAraligi(yilS, ayS) : sezonAraligi(seciliSezon, baslangicAyi) || ayAraligi(yil, ay));
  const [from, setFrom] = useState(ayAraligi(yil, ay).from);
  const [to, setTo] = useState(ayAraligi(yil, ay).to);
  const [grup, setGrup] = useState("");
  const [gruplar, setGruplar] = useState([]);
  const [veri, setVeri] = useState(null);
  const [sayfa, setSayfa] = useState(1);
  const ONIZLEME_BOYU = 100; // önizleme sayfası; Excel/PDF tam liste
  const dene = useDene();
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

  const grupEk = grup ? " · " + gruplar.find((g) => g.id === Number(grup))?.ad : "";
  const hazirla = () =>
    dene(async () => {
      if (rapor === "oyuncu") {
        const liste = await db("listPlayersWithDue", {
          yil: yilS ?? 0,
          ay: ayS ?? 0,
          yas_grubu_id: grup ? Number(grup) : null,
          sezon: seciliSezon,
        });
        const ozet = ayS ? {} : (await db("sezonAidatOzeti", seciliSezon, baslangicAyi)) || {};
        return oyuncuListesiRaporu({ liste, yil: yilS, ay: ayS, grupEk, ucretAd, sezon: seciliSezon, ozet });
      }
      if (rapor === "borclu") {
        if (!ayS) {
          const liste = (await db("listUnpaidSezon", seciliSezon, baslangicAyi)) || [];
          return borcluListesiRaporu({ liste, ay: null, sezon: seciliSezon });
        }
        const liste = await db("listUnpaid", yilS, ayS, seciliSezon);
        const veliler = {};
        for (const b of liste) veliler[b.player_id] = await db("listGuardians", b.player_id);
        return borcluListesiRaporu({ liste, veliler, yil: yilS, ay: ayS, sezon: seciliSezon });
      }
      if (rapor === "tahsilat") {
        const makbuzlar = await db("listReceiptsByDate", from, to);
        const iptaller = await db("listCancelledReceipts", from, to);
        return tahsilatRaporu({ makbuzlar, iptaller, from, to });
      }
      if (rapor === "saglik") {
        // Ay seçiliyse o ayın son günü itibarıyla ("Ekim sonunda kimin raporu dolmuş olacak"), Tümü ise bugün (plan §19.5)
        const referans = ayS ? ayinSonGunu(yilS, ayS) : bugun().iso;
        const liste = await db("saglikRaporuListesi", referans, grup ? Number(grup) : null, 30, seciliSezon);
        return saglikRaporu({ liste, bugunIso: referans, grupEk, sezon: seciliSezon });
      }
      if (yoklamaMod === "sezon") {
        const a = donemAraligi();
        const liste = await db("attendanceReport", a.from, a.to, grup ? Number(grup) : null, seciliSezon);
        return yoklamaOzetiRaporu({
          liste,
          from: a.from,
          to: a.to,
          grupEk,
          donem: donemEtiketi({ yil: yilS, ay: ayS, sezon: seciliSezon }),
        });
      }
      const liste = await db("attendanceReport", from, to, grup ? Number(grup) : null);
      return yoklamaOzetiRaporu({ liste, from, to, grupEk });
    });

  const onizle = async () => {
    setSayfa(1);
    setVeri(await hazirla());
  };
  const gorunen = veri ? veri.satirlar.slice((sayfa - 1) * ONIZLEME_BOYU, sayfa * ONIZLEME_BOYU) : [];
  const excel = async () => {
    const v = veri || (await hazirla());
    if (!v) return;
    return dene(async () => {
      await cikti().excelKaydet({ sayfa: v.baslik, sutunlar: v.disaSutunlar || v.sutunlar, satirlar: v.satirlar }, `${rapor}.xlsx`);
    });
  };
  const pdf = async () => {
    const v = veri || (await hazirla());
    if (!v) return;
    return dene(async () => {
      const logo = await uygulama().logo();
      await cikti().pdfKaydet(
        raporHtml({
          baslik: v.baslik,
          altBaslik: v.alt,
          sutunlar: v.disaSutunlar || v.sutunlar,
          satirlar: v.satirlar,
          logo,
          yatay: !!v.yatay,
        }),
        `${rapor}.pdf`,
        !!v.yatay,
      );
    });
  };

  const sezonAy = rapor === "oyuncu" || rapor === "borclu" || rapor === "saglik" || (rapor === "yoklama" && yoklamaMod === "sezon");
  const sezonAyKutusu = (
    <SezonAySecim
      sezonlar={sezonlar}
      aktifSezon={sezonDurum?.aktifSezon || seciliSezon}
      baslangicAyi={baslangicAyi}
      sezon={seciliSezon}
      ay={ayS}
      onChange={(v) => {
        setSezonS(v.sezon);
        setAyS(v.ay);
      }}
    />
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {RAPORLAR.map((r) => (
          <button
            key={r.kod}
            type="button"
            onClick={() => {
              setRapor(r.kod);
              setVeri(null);
              if (r.kod === "saglik") setAyS(null); // sağlık raporu varsayılan: bugün itibarıyla (Ay: Tümü)
            }}
            style={{
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 10,
              cursor: "pointer",
              border: `1px solid ${rapor === r.kod ? "var(--mor)" : "var(--cizgi)"}`,
              background: rapor === r.kod ? "var(--mor-acik)" : "#fff",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--mor-koyu)" }}>{r.ad}</div>
            <div style={{ fontSize: 12, color: "var(--soluk)", marginTop: 2 }}>{r.aciklama}</div>
          </button>
        ))}
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {rapor === "yoklama" && (
            <Alan etiket="Dönem seçimi">
              <Secim
                secenekler={[
                  { kod: "sezon", ad: "Sezon ve ay" },
                  { kod: "tarih", ad: "Tarih aralığı" },
                ]}
                value={yoklamaMod}
                onChange={(e) => setYoklamaMod(e.target.value)}
                aria-label="Dönem seçimi"
              />
            </Alan>
          )}
          {sezonAy ? (
            <>
              {sezonAyKutusu}
              {rapor === "saglik" && (
                <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                  {ayS ? "Seçilen ayın son günü itibarıyla hesaplanır" : "Bugünün tarihine göre hesaplanır"}; 30 gün içinde dolacak raporlar
                  "Dolmak üzere" sayılır.
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Alan etiket="Başlangıç" style={{ flex: 1 }}>
                <Girdi type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Alan>
              <Alan etiket="Bitiş" style={{ flex: 1 }}>
                <Girdi type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Alan>
            </div>
          )}
          {(rapor === "oyuncu" || rapor === "yoklama" || rapor === "saglik") && (
            <Alan etiket="Yaş grubu">
              <Secim secenekler={gruplar} bos="Tümü" value={grup} onChange={(e) => setGrup(e.target.value)} />
            </Alan>
          )}
          <Btn ikon={<Ikon ad="goz" />} onClick={onizle}>
            Önizle
          </Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={excel} style={{ flex: 1 }}>
              Excel
            </Btn>
            <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={pdf} style={{ flex: 1 }}>
              PDF
            </Btn>
          </div>
        </div>
      </Kart>
      <Kart style={{ overflow: "hidden" }}>
        {!veri ? (
          <div style={{ padding: 32, color: "var(--soluk)", textAlign: "center" }}>Rapor seçip Önizle'ye basın.</div>
        ) : (
          <>
            <div style={{ padding: "16px 16px 8px" }}>
              <h3 style={{ fontSize: 22 }}>{veri.baslik}</h3>
              <div style={{ color: "var(--soluk)", fontSize: 13 }}>{veri.alt}</div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
              <table>
                <thead>
                  <tr>
                    {veri.sutunlar.map((c) => (
                      <th key={c.anahtar} style={{ textAlign: c.sag ? "right" : "left" }}>
                        {c.baslik}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gorunen.map((s, i) => (
                    <tr key={(sayfa - 1) * ONIZLEME_BOYU + i}>
                      {veri.sutunlar.map((c) => (
                        <td key={c.anahtar} style={{ textAlign: c.sag ? "right" : "left" }}>
                          {(typeof s[c.anahtar] === "number" && c.anahtar === "tutar") || c.anahtar === "aidat"
                            ? paraTR(s[c.anahtar])
                            : s[c.anahtar]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Sayfalama sayfa={sayfa} toplam={veri.satirlar.length} sayfaBoyu={ONIZLEME_BOYU} onSayfa={setSayfa} birim="satır" />
          </>
        )}
      </Kart>
    </div>
  );
}
