import { useEffect, useState } from "react";
import { Kart, Sekmeler, Sayfalama, useDene } from "./ui.jsx";
import { db, cikti, uygulama, bugun, ayAraligi } from "../lib/api.js";
import { paraTR } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { raporHtml } from "../lib/raporHtml.js";
import { sezonAyYili, guncelSezon, sezonAraligi, ayinSonGunu } from "../lib/sezon.js";
import { RaporFiltre } from "./RaporFiltre.jsx";

import {
  RAPORLAR,
  oyuncuListesiRaporu,
  borcluListesiRaporu,
  tahsilatRaporu,
  saglikRaporu,
  yoklamaOzetiRaporu,
  donemEtiketi,
  raporFiltreleri,
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
    const v = await hazirla();
    setVeri(v ? { ...v, filtreImzasi } : v);
  };
  const gorunenSatirlar = veri ? veri.satirlar.slice((sayfa - 1) * ONIZLEME_BOYU, sayfa * ONIZLEME_BOYU) : [];
  // Önizleme hangi rapor + filtreyle alındı? Değiştiyse "Yeniden Önizle" (plan §20.1)
  const filtreImzasi = JSON.stringify({ rapor, seciliSezon, ayS, grup, yoklamaMod, from, to });
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

  const kirli = veri && veri.filtreImzasi !== filtreImzasi;
  const seciliRapor = RAPORLAR.find((r) => r.kod === rapor);
  const gorunen = raporFiltreleri(rapor, { mod: yoklamaMod });
  const saglikNotu =
    rapor === "saglik"
      ? `${ayS ? "Seçilen ayın son günü itibarıyla" : "Bugünün tarihine göre"} hesaplanır; 30 gün içinde dolacak raporlar "Dolmak üzere" sayılır.`
      : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Kart style={{ padding: "0 8px" }}>
        <Sekmeler
          liste={RAPORLAR.map((r) => ({ kod: r.kod, ad: r.ad }))}
          aktif={rapor}
          onSec={(kod) => {
            setRapor(kod);
            if (kod === "saglik") setAyS(null); // sağlık raporu varsayılan: bugün itibarıyla (Ay: Tümü)
          }}
        />
        <div style={{ padding: "8px 12px 10px", fontSize: 13, color: "var(--soluk)" }}>{seciliRapor?.aciklama}</div>
      </Kart>
      <Kart style={{ padding: 14 }}>
        <RaporFiltre
          gorunen={gorunen}
          filtre={{ sezon: seciliSezon, ay: ayS, grup, mod: yoklamaMod, from, to }}
          onFiltre={(f) => {
            setSezonS(f.sezon);
            setAyS(f.ay);
            setGrup(f.grup);
            setYoklamaMod(f.mod);
            setFrom(f.from);
            setTo(f.to);
          }}
          sezonlar={sezonlar}
          aktifSezon={sezonDurum?.aktifSezon || seciliSezon}
          baslangicAyi={baslangicAyi}
          gruplar={gruplar}
          kirli={!!kirli}
          onOnizle={onizle}
          onExcel={excel}
          onPdf={pdf}
          not={saglikNotu}
        />
      </Kart>
      <Kart style={{ overflow: "hidden" }}>
        {!veri ? (
          <div style={{ padding: 32, color: "var(--soluk)", textAlign: "center" }}>Filtreleri seçip Önizle'ye basın.</div>
        ) : (
          <>
            <div style={{ padding: "16px 16px 8px" }}>
              <h3 style={{ fontSize: 22 }}>{veri.baslik}</h3>
              <div style={{ color: "var(--soluk)", fontSize: 13 }}>{veri.alt}</div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 340px)" }}>
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
                  {gorunenSatirlar.map((s, i) => (
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
