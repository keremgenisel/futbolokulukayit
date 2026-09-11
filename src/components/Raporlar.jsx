import { useEffect, useState } from "react";
import { Kart, Sayfalama, useDene } from "./ui.jsx";
import { db, cikti, bugun, ayAraligi } from "../lib/api.js";
import { paraTR, tarihTR } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { raporHtml } from "../lib/raporHtml.js";
import { ciktiMarkasi } from "../lib/yazdir.js";
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
  tarihAyAraligi,
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
  const [yoklamaMod, setYoklamaMod] = useState("sezon"); // Dönem seçimi (her raporda): "sezon" (sezon + ay) | "tarih" (aralık)
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
  // Yaş grubu kutusu: sezon modunda seçili sezonun grupları, tarih modunda hepsi (plan §21.3)
  const grupSezonu = yoklamaMod === "tarih" ? null : seciliSezon;
  useEffect(() => {
    db("listAgeGroups", { sezon: grupSezonu || null })
      .then((l) => Array.isArray(l) && setGruplar(l))
      .catch(() => {});
  }, [grupSezonu]);
  useEffect(() => {
    db("sezonDurumu")
      .then((d) => d && setSezonDurum(d))
      .catch(() => {});
    db("sezonListesi")
      .then((l) => Array.isArray(l) && setSezonlar(l))
      .catch(() => {});
  }, []);

  const grupEk = grup ? " · " + gruplar.find((g) => g.id === Number(grup))?.ad : "";
  const grupId = grup ? Number(grup) : null;
  // Dönem (plan §20, her raporda aynı): "sezon" modunda sezon + ay (Tümü = sezon), "tarih" modunda Başlangıç – Bitiş.
  // Rapor sorguları hep aralık + (sezon | null) alır; tarih modunda oyuncu kümesi sezona bağlanmaz.
  const donem = () => {
    if (yoklamaMod === "tarih") {
      const [bas, son] = tarihAyAraligi(from, to);
      return { from, to, bas, son, sezon: null, ay: null, yil: null, etiket: `${tarihTR(from)} – ${tarihTR(to)}`, referans: to };
    }
    const a = donemAraligi();
    const [bas, son] = tarihAyAraligi(a.from, a.to);
    return {
      ...a,
      bas,
      son,
      sezon: seciliSezon,
      ay: ayS,
      yil: yilS,
      etiket: donemEtiketi({ yil: yilS, ay: ayS, sezon: seciliSezon }),
      referans: ayS ? ayinSonGunu(yilS, ayS) : bugun().iso,
    };
  };
  const hazirla = () =>
    dene(async () => {
      const d = donem();
      if (rapor === "oyuncu") {
        const liste = await db("listPlayersWithDue", { yil: d.yil ?? 0, ay: d.ay ?? 0, yas_grubu_id: grupId, sezon: d.sezon });
        const ozet = d.ay ? {} : (await db("aidatOzeti", d.bas, d.son)) || {};
        return oyuncuListesiRaporu({
          liste,
          yil: d.yil,
          ay: d.ay,
          grupEk,
          ucretAd,
          sezon: d.sezon || "",
          ozet,
          donem: d.sezon ? "" : d.etiket,
        });
      }
      if (rapor === "borclu") {
        if (!d.ay) {
          const liste = (await db("listUnpaidAralik", d.bas, d.son, d.sezon, grupId)) || [];
          return borcluListesiRaporu({ liste, ay: null, sezon: d.sezon || "", donem: d.sezon ? "" : d.etiket, grupEk });
        }
        const liste = await db("listUnpaid", d.yil, d.ay, d.sezon, grupId);
        const veliler = {};
        for (const b of liste) veliler[b.player_id] = await db("listGuardians", b.player_id);
        return borcluListesiRaporu({ liste, veliler, yil: d.yil, ay: d.ay, sezon: d.sezon || "", grupEk });
      }
      if (rapor === "tahsilat") {
        const makbuzlar = await db("listReceiptsByDate", d.from, d.to, null, grupId);
        const iptaller = await db("listCancelledReceipts", d.from, d.to, null, grupId);
        return tahsilatRaporu({ makbuzlar, iptaller, from: d.from, to: d.to, donem: d.sezon ? d.etiket : "", grupEk });
      }
      if (rapor === "saglik") {
        // Sezon modunda ay seçiliyse ayın son günü, Tümü ise bugün; tarih modunda bitiş tarihi itibarıyla (plan §19.5)
        const liste = await db("saglikRaporuListesi", d.referans, grupId, 30, d.sezon, !d.sezon); // tarih modunda tüm oyuncular
        return saglikRaporu({ liste, bugunIso: d.referans, grupEk, sezon: d.sezon || "" });
      }
      const liste = await db("attendanceReport", d.from, d.to, grupId, d.sezon, !d.sezon); // tarih modunda tüm oyuncular
      return yoklamaOzetiRaporu({ liste, from: d.from, to: d.to, grupEk, donem: d.sezon ? d.etiket : "" });
    });

  const onizle = async () => {
    setSayfa(1);
    const v = await hazirla();
    setVeri(v ? { ...v, filtreImzasi, rapor } : v);
  };
  const gorunenSatirlar = veri ? veri.satirlar.slice((sayfa - 1) * ONIZLEME_BOYU, sayfa * ONIZLEME_BOYU) : [];
  // Önizleme hangi rapor + filtreyle alındı? Değiştiyse "Yeniden Önizle" (plan §20.1)
  const filtreImzasi = JSON.stringify({ seciliSezon, ayS, grup, yoklamaMod, from, to }); // rapor ayrı izlenir (mesaj için)
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
      const { logo, kulup, tema } = await ciktiMarkasi();
      await cikti().pdfKaydet(
        raporHtml({
          baslik: v.baslik,
          altBaslik: v.alt,
          sutunlar: v.disaSutunlar || v.sutunlar,
          satirlar: v.satirlar,
          logo,
          kulup,
          tema,
          yatay: !!v.yatay,
        }),
        `${rapor}.pdf`,
        !!v.yatay,
      );
    });
  };

  // Önizlemeden sonra ne değişti? "Filtre değişti" | "Rapor değişti" | "Filtre ve rapor değişti" (Önizle'nin üstünde kırmızı pil)
  const filtreDegisti = !!veri && veri.filtreImzasi !== filtreImzasi;
  const raporDegisti = !!veri && veri.rapor !== rapor;
  const kirli =
    filtreDegisti && raporDegisti ? "Filtre ve rapor değişti" : filtreDegisti ? "Filtre değişti" : raporDegisti ? "Rapor değişti" : "";
  const gorunen = raporFiltreleri(rapor, { mod: yoklamaMod });
  const saglikNotu =
    rapor === "saglik"
      ? `${yoklamaMod === "tarih" ? "Bitiş tarihi itibarıyla" : ayS ? "Seçilen ayın son günü itibarıyla" : "Bugünün tarihine göre"} hesaplanır; 30 gün içinde dolacak raporlar "Dolmak üzere" sayılır.`
      : "";
  const raporSec = (kod) => {
    setRapor(kod);
    if (kod === "saglik") setAyS(null); // sağlık raporu varsayılan: bugün itibarıyla (Ay: Tümü)
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Kart style={{ padding: 16 }}>
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
          kirli={kirli}
          onOnizle={onizle}
          onExcel={excel}
          onPdf={pdf}
          not={saglikNotu}
        />
      </Kart>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {RAPORLAR.map((r) => (
            <button
              key={r.kod}
              type="button"
              onClick={() => raporSec(r.kod)}
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
                        <th key={c.anahtar} className="tek-satir" style={{ textAlign: c.sag ? "right" : "left" }}>
                          {c.baslik}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gorunenSatirlar.map((s, i) => (
                      <tr key={(sayfa - 1) * ONIZLEME_BOYU + i}>
                        {veri.sutunlar.map((c) => (
                          <td key={c.anahtar} className="tek-satir" style={{ textAlign: c.sag ? "right" : "left" }}>
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
    </div>
  );
}
