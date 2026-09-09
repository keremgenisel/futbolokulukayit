import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Sayfalama, useDene } from "./ui.jsx";
import { db, cikti, uygulama, bugun, ayAraligi } from "../lib/api.js";
import { AY_ADLARI, paraTR } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { raporHtml } from "../lib/raporHtml.js";
import { sezonAyYili, guncelSezon } from "../lib/sezon.js";
import { Ikon } from "./Ikon.jsx";

import { RAPORLAR, oyuncuListesiRaporu, borcluListesiRaporu, tahsilatRaporu, saglikRaporu, yoklamaOzetiRaporu } from "../lib/raporlar.js";

export function Raporlar() {
  const { yil, ay } = bugun();
  const { ad: ucretAd } = useUcretTipleri();
  const [rapor, setRapor] = useState("oyuncu");
  const [ayS, setAyS] = useState(ay);
  // Aylık raporlar sezon + ay ile süzülür (plan §17.5); yıl sezondan türetilir
  const [sezonDurum, setSezonDurum] = useState(null); // { aktifSezon, baslangicAyi }
  const [sezonlar, setSezonlar] = useState([]);
  const [sezonS, setSezonS] = useState("");
  const baslangicAyi = sezonDurum?.baslangicAyi || 9;
  const seciliSezon = sezonS || sezonDurum?.aktifSezon || guncelSezon(bugun().iso, baslangicAyi);
  const yilS = sezonAyYili(seciliSezon, ayS, baslangicAyi) ?? yil;
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
        const liste = await db("listPlayersWithDue", { yil: yilS, ay: ayS, yas_grubu_id: grup ? Number(grup) : null, sezon: seciliSezon });
        return oyuncuListesiRaporu({ liste, yil: yilS, ay: ayS, grupEk, ucretAd, sezon: seciliSezon });
      }
      if (rapor === "borclu") {
        const liste = await db("listUnpaid", yilS, ayS);
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
        const bugunIso = bugun().iso;
        const liste = await db("saglikRaporuListesi", bugunIso, grup ? Number(grup) : null);
        return saglikRaporu({ liste, bugunIso, grupEk });
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
      await cikti().excelKaydet({ sayfa: v.baslik, sutunlar: v.sutunlar, satirlar: v.satirlar }, `${rapor}.xlsx`);
    });
  };
  const pdf = async () => {
    const v = veri || (await hazirla());
    if (!v) return;
    return dene(async () => {
      const logo = await uygulama().logo();
      await cikti().pdfKaydet(
        raporHtml({ baslik: v.baslik, altBaslik: v.alt, sutunlar: v.sutunlar, satirlar: v.satirlar, logo, yatay: !!v.yatay }),
        `${rapor}.pdf`,
        !!v.yatay,
      );
    });
  };

  const aylik = rapor === "oyuncu" || rapor === "borclu";
  const tarihsiz = rapor === "saglik"; // bugüne göre; tarih filtresi yok
  const sezonSecenekleri = [...new Set([seciliSezon, ...sezonlar])].map((s) => ({
    kod: s,
    ad: s === sezonDurum?.aktifSezon ? `${s} (aktif)` : s,
  }));
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
          {tarihsiz ? (
            <div style={{ fontSize: 13, color: "var(--soluk)" }}>
              Bugünün tarihine göre hesaplanır; 30 gün içinde dolacak raporlar "Dolmak üzere" sayılır.
            </div>
          ) : aylik ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Alan etiket="Ay" style={{ flex: 1 }}>
                <Secim
                  secenekler={AY_ADLARI.map((a, i) => ({ kod: i + 1, ad: a }))}
                  aria-label="Ay"
                  value={ayS}
                  onChange={(e) => setAyS(Number(e.target.value))}
                />
              </Alan>
              <Alan etiket="Sezon" style={{ width: 150 }}>
                <Secim secenekler={sezonSecenekleri} value={seciliSezon} onChange={(e) => setSezonS(e.target.value)} aria-label="Sezon" />
              </Alan>
            </div>
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
