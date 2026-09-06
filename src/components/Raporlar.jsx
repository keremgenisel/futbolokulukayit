import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Secim, useToast, aidatEtiket } from "./ui.jsx";
import { db, cikti, uygulama, bugun, ayAraligi, hataMetni } from "../lib/api.js";
import { AY_ADLARI, ODEME_YONTEMLERI, UCRET_TIPLERI, DURUMLAR, tarihTR, paraTR } from "../lib/aidat.js";
import { raporHtml } from "../lib/raporHtml.js";
import { Ikon } from "./Ikon.jsx";

const RAPORLAR = [
  { kod: "oyuncu", ad: "Oyuncu Listesi", aciklama: "Tüm oyuncular, grup, durum, ücret tipi ve seçilen ayın aidat durumu" },
  { kod: "borclu", ad: "Borçlu Listesi", aciklama: "Seçilen ayda aidatı ödenmemiş oyuncular ve veli telefonları" },
  { kod: "tahsilat", ad: "Tahsilat Raporu", aciklama: "Tarih aralığında kesilen makbuzlar, yöntem ve toplam" },
  { kod: "yoklama", ad: "Yoklama Özeti", aciklama: "Tarih aralığında oyuncu bazında geldi / gelmedi / izinli" },
];

export function Raporlar() {
  const { yil, ay } = bugun();
  const [rapor, setRapor] = useState("oyuncu");
  const [ayS, setAyS] = useState(ay); const [yilS, setYilS] = useState(yil);
  const [from, setFrom] = useState(ayAraligi(yil, ay).from); const [to, setTo] = useState(ayAraligi(yil, ay).to);
  const [grup, setGrup] = useState("");
  const [gruplar, setGruplar] = useState([]);
  const [veri, setVeri] = useState(null);
  const toast = useToast();
  useEffect(() => { db("listAgeGroups").then(setGruplar).catch(() => {}); }, []);

  const hazirla = async () => {
    try {
      if (rapor === "oyuncu") {
        const l = await db("listPlayersWithDue", { yil: yilS, ay: ayS, yas_grubu_id: grup ? Number(grup) : null });
        return { baslik: "Oyuncu Listesi", alt: `${AY_ADLARI[ayS - 1]} ${yilS}${grup ? " · " + gruplar.find((g) => g.id === Number(grup))?.ad : ""}`, yatay: true,
          sutunlar: [{ baslik: "Ad Soyad", anahtar: "ad", genislik: 28 }, { baslik: "TC", anahtar: "tc", genislik: 14 }, { baslik: "Doğum", anahtar: "dogum", genislik: 12 }, { baslik: "Grup", anahtar: "grup", genislik: 8 }, { baslik: "Durum", anahtar: "durum", genislik: 10 }, { baslik: "Ücret tipi", anahtar: "ucret", genislik: 16 }, { baslik: "Aidat", anahtar: "aidat", genislik: 10, sag: true }, { baslik: "Aidat durumu", anahtar: "ad_durum", genislik: 14 }, { baslik: "GSM", anahtar: "gsm", genislik: 16 }],
          satirlar: l.map((o) => ({ ad: o.ad_soyad, tc: o.tc_no || "", dogum: tarihTR(o.dogum_tarihi), grup: o.yas_grubu_ad || "", durum: DURUMLAR.find((d) => d.kod === o.durum)?.ad, ucret: UCRET_TIPLERI.find((u) => u.kod === o.ucret_tipi)?.ad, aidat: o.aylik_aidat, ad_durum: aidatEtiket(o.aidat_durum), gsm: o.gsm || "" })) };
      }
      if (rapor === "borclu") {
        const l = await db("listUnpaid", yilS, ayS);
        const satirlar = [];
        for (const b of l) { const v = await db("listGuardians", b.player_id); const veli = v.find((x) => x.veli_mi) || v[0]; satirlar.push({ ad: b.ad_soyad, grup: b.yas_grubu_ad || "", tutar: b.tutar, donem: b.odeme_donemi, veli: veli?.ad_soyad || "", tel: veli?.whatsapp_no || veli?.gsm || "" }); }
        return { baslik: "Borçlu Listesi", alt: `${AY_ADLARI[ayS - 1]} ${yilS} · ${l.length} oyuncu · toplam ${paraTR(l.reduce((s, b) => s + b.tutar, 0))}`,
          sutunlar: [{ baslik: "Ad Soyad", anahtar: "ad", genislik: 28 }, { baslik: "Grup", anahtar: "grup", genislik: 8 }, { baslik: "Tutar", anahtar: "tutar", genislik: 10, sag: true }, { baslik: "Ödeme dönemi", anahtar: "donem", genislik: 14 }, { baslik: "Veli", anahtar: "veli", genislik: 24 }, { baslik: "Telefon", anahtar: "tel", genislik: 16 }], satirlar };
      }
      if (rapor === "tahsilat") {
        const l = await db("listReceiptsByDate", from, to);
        const toplam = l.reduce((s, m) => s + m.toplam, 0);
        const yontemOzet = ODEME_YONTEMLERI.map((y) => `${y.ad}: ${paraTR(l.filter((m) => m.odeme_yontemi === y.kod).reduce((s, m) => s + m.toplam, 0))}`).join(" · ");
        return { baslik: "Tahsilat Raporu", alt: `${tarihTR(from)} – ${tarihTR(to)} · ${l.length} makbuz · toplam ${paraTR(toplam)} · ${yontemOzet}`,
          sutunlar: [{ baslik: "Makbuz No", anahtar: "no", genislik: 12 }, { baslik: "Tarih", anahtar: "tarih", genislik: 12 }, { baslik: "Oyuncu", anahtar: "ad", genislik: 28 }, { baslik: "Tutar", anahtar: "tutar", genislik: 10, sag: true }, { baslik: "Yöntem", anahtar: "yontem", genislik: 14 }, { baslik: "Tahsil eden", anahtar: "eden", genislik: 18 }],
          satirlar: l.map((m) => ({ no: m.makbuz_no, tarih: tarihTR(m.tarih), ad: m.ad_soyad, tutar: m.toplam, yontem: ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad, eden: m.tahsil_eden })) };
      }
      const l = await db("attendanceReport", from, to, grup ? Number(grup) : null);
      return { baslik: "Yoklama Özeti", alt: `${tarihTR(from)} – ${tarihTR(to)}${grup ? " · " + gruplar.find((g) => g.id === Number(grup))?.ad : ""}`,
        sutunlar: [{ baslik: "Ad Soyad", anahtar: "ad", genislik: 28 }, { baslik: "Grup", anahtar: "grup", genislik: 8 }, { baslik: "Geldi", anahtar: "geldi", genislik: 8, sag: true }, { baslik: "Gelmedi", anahtar: "gelmedi", genislik: 8, sag: true }, { baslik: "İzinli", anahtar: "izinli", genislik: 8, sag: true }, { baslik: "Katılım %", anahtar: "oran", genislik: 10, sag: true }],
        satirlar: l.map((o) => { const t = o.geldi + o.gelmedi + o.izinli; return { ad: o.ad_soyad, grup: o.yas_grubu_ad || "", geldi: o.geldi, gelmedi: o.gelmedi, izinli: o.izinli, oran: t ? Math.round((o.geldi / t) * 100) : "" }; }) };
    } catch (e) { toast("err", hataMetni(e)); return null; }
  };

  const onizle = async () => setVeri(await hazirla());
  const excel = async () => { const v = veri || await hazirla(); if (!v) return; try { await cikti().excelKaydet({ sayfa: v.baslik, sutunlar: v.sutunlar, satirlar: v.satirlar }, `${rapor}.xlsx`); } catch (e) { toast("err", hataMetni(e)); } };
  const pdf = async () => { const v = veri || await hazirla(); if (!v) return; try { const logo = await uygulama().logo(); await cikti().pdfKaydet(raporHtml({ baslik: v.baslik, altBaslik: v.alt, sutunlar: v.sutunlar, satirlar: v.satirlar, logo, yatay: !!v.yatay }), `${rapor}.pdf`, !!v.yatay); } catch (e) { toast("err", hataMetni(e)); } };

  const aylik = rapor === "oyuncu" || rapor === "borclu";
  const yillar = [yil - 1, yil, yil + 1].map((y) => ({ kod: y, ad: String(y) }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {RAPORLAR.map((r) => <button key={r.kod} type="button" onClick={() => { setRapor(r.kod); setVeri(null); }} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${rapor === r.kod ? "var(--mor)" : "var(--cizgi)"}`, background: rapor === r.kod ? "var(--mor-acik)" : "#fff" }}><div style={{ fontWeight: 700, color: "var(--mor-koyu)" }}>{r.ad}</div><div style={{ fontSize: 12, color: "var(--soluk)", marginTop: 2 }}>{r.aciklama}</div></button>)}
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {aylik ? (
            <div style={{ display: "flex", gap: 8 }}><Alan etiket="Ay" style={{ flex: 1 }}><Secim secenekler={AY_ADLARI.map((a, i) => ({ kod: i + 1, ad: a }))} value={ayS} onChange={(e) => setAyS(Number(e.target.value))} /></Alan><Alan etiket="Yıl" style={{ width: 100 }}><Secim secenekler={yillar} value={yilS} onChange={(e) => setYilS(Number(e.target.value))} /></Alan></div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}><Alan etiket="Başlangıç" style={{ flex: 1 }}><Girdi type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Alan><Alan etiket="Bitiş" style={{ flex: 1 }}><Girdi type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Alan></div>
          )}
          {(rapor === "oyuncu" || rapor === "yoklama") && <Alan etiket="Yaş grubu"><Secim secenekler={gruplar} bos="Tümü" value={grup} onChange={(e) => setGrup(e.target.value)} /></Alan>}
          <Btn ikon={<Ikon ad="goz" />} onClick={onizle}>Önizle</Btn>
          <div style={{ display: "flex", gap: 8 }}><Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={excel} style={{ flex: 1 }}>Excel</Btn><Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={pdf} style={{ flex: 1 }}>PDF</Btn></div>
        </div>
      </Kart>
      <Kart style={{ overflow: "hidden" }}>
        {!veri ? <div style={{ padding: 32, color: "var(--soluk)", textAlign: "center" }}>Rapor seçip Önizle'ye basın.</div> : (
          <>
            <div style={{ padding: "16px 16px 8px" }}><h3 style={{ fontSize: 22 }}>{veri.baslik}</h3><div style={{ color: "var(--soluk)", fontSize: 13 }}>{veri.alt}</div></div>
            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
              <table><thead><tr>{veri.sutunlar.map((c) => <th key={c.anahtar} style={{ textAlign: c.sag ? "right" : "left" }}>{c.baslik}</th>)}</tr></thead>
                <tbody>{veri.satirlar.map((s, i) => <tr key={i}>{veri.sutunlar.map((c) => <td key={c.anahtar} style={{ textAlign: c.sag ? "right" : "left" }}>{typeof s[c.anahtar] === "number" && c.anahtar === "tutar" || c.anahtar === "aidat" ? paraTR(s[c.anahtar]) : s[c.anahtar]}</td>)}</tr>)}</tbody></table>
            </div>
          </>
        )}
      </Kart>
    </div>
  );
}
