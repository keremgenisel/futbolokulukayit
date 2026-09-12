// Giriş Kartları penceresi (plan §40.7): Oyuncular › Kartları Yazdır. Süzgeçler (Kart: Basılmamış varsayılan), satır seçimi,
// başlıktaki kutu süzgeçtekilerin tümünü seçer, alt şeritte sayaç + sayfa + Yazdır (N). Ayrı onay penceresi yok: bu pencere onaydır.
// Basım başarılıysa kayıt düşer (kartBasimKaydet; salt okunurda yazılmaz), pencere açık kalır, liste yenilenir.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Btn, Rozet, Girdi, Secim, Avatar, Bos, useToast, useDene } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { db } from "../lib/api.js";
import { htmlYazdir } from "../lib/yazdir.js";
import { girisKartiHtml } from "../lib/kartHtml.js";
import { kartAyarlariOku, kartOyuncusu } from "../lib/kartVeri.js";
import { DURUMLAR } from "../lib/aidat.js";
import {
  KART_SINIR,
  KART_SUZGECLERI,
  sayfaSayisi,
  secimDegistir,
  tumunuSec,
  bastakiKutu,
  listedeOlmayan,
  basimEtiketi,
  basilmisSecilenler,
  basilmisNotu,
} from "../lib/kartSecim.js";

export function KartBasim({ onKapat, saltOkunur, sezon, sezonlar = [], grup: ilkGrup = "", durum: ilkDurum = "aktifler" }) {
  const [q, setQ] = useState("");
  const [sz, setSz] = useState(sezon);
  const [grup, setGrup] = useState(ilkGrup || "");
  const [durum, setDurum] = useState(ilkDurum || "aktifler");
  const [kart, setKart] = useState("basilmamis");
  const [liste, setListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [gruplar, setGruplar] = useState([]);
  const [secili, setSecili] = useState(() => new Set());
  const bilinen = useRef(new Map()); // id → satır (süzgeç değişse de seçili oyuncunun verisi elde kalsın)
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const dene = useDene();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    await dene(async () => {
      const l = await db("kartBasimListesi", { sezon: sz, q, yas_grubu_id: grup ? Number(grup) : null, durum: durum || null, kart });
      for (const o of l) bilinen.current.set(o.id, o);
      setListe(l);
    });
    setYukleniyor(false);
  }, [sz, q, grup, durum, kart]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(yukle, 120);
    return () => clearTimeout(t);
  }, [yukle]);
  useEffect(() => {
    db("listAgeGroups", { sezon: sz || null })
      .then((l) => Array.isArray(l) && setGruplar(l))
      .catch(() => {});
  }, [sz]);

  const ids = useMemo(() => liste.map((o) => o.id), [liste]);
  const bas = bastakiKutu(secili, ids);
  const disarida = listedeOlmayan(secili, ids);
  const basilmis = basilmisSecilenler(secili, bilinen.current);
  const n = secili.size;

  const yazdir = () =>
    dene(
      async () => {
        if (!n) return;
        if (n > KART_SINIR) return toast("err", `${n} oyuncu çok fazla; bir seferde en çok ${KART_SINIR} kart basılır`);
        setBekliyor(true);
        const { ayar, qr } = await kartAyarlariOku();
        const secilenler = [...secili].map((id) => bilinen.current.get(id)).filter(Boolean);
        const kartlar = [];
        for (const o of secilenler)
          kartlar.push(
            await kartOyuncusu(o, {
              sezon: sz,
              qr,
              veliler: o.veli_ad ? [{ ad_soyad: o.veli_ad, gsm: o.veli_tel || "", whatsapp_no: "", veli_mi: 1 }] : [],
            }),
          );
        const y = await htmlYazdir(
          girisKartiHtml({ oyuncular: kartlar, ayar: { ...ayar, sezon: sz }, duzen: "toplu" }),
          `giris-kartlari-${kartlar.length}`,
          true,
        );
        if (!y.ok) return toast("err", y.mesaj);
        if (saltOkunur) toast("info", `${kartlar.length} kart basıma gönderildi; lisans salt okunur: basım kaydı tutulmadı`);
        else {
          await db(
            "kartBasimKaydet",
            secilenler.map((o) => o.id),
            sz,
            "toplu",
          );
          toast("ok", `${kartlar.length} kart, ${sayfaSayisi(kartlar.length)} sayfa (ön + arka) basıma gönderildi`);
        }
        setSecili(new Set());
        await yukle();
      },
      { sonunda: () => setBekliyor(false) },
    );

  return (
    <Modal
      onKapat={onKapat}
      genislik={1120}
      yukseklik="min(760px, 92vh)"
      ust={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            background: "var(--mor)",
            color: "var(--ana-ustu)",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="baslik" style={{ color: "var(--ana-ustu)", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
              Giriş Kartları
            </span>
            <span style={{ color: "var(--ana-ustu-soluk, #d8cce9)", fontSize: 13 }}>
              Basılacak oyuncuları seçin · A4 yatay, sayfada 6 kart, arka yüzler sonraki sayfada
            </span>
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Pencereyi kapat"
            style={{ background: "none", border: 0, color: "var(--ana-ustu-soluk, #d8cce9)", fontSize: 22, cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      }
      altBar={
        <>
          <span style={{ flex: 1, alignSelf: "center", fontSize: 15, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>
              <b>{n} oyuncu seçildi</b>
              {n > 0 && <span style={{ color: "var(--soluk)" }}> · {sayfaSayisi(n)} sayfa (ön + arka)</span>}
              {disarida.length > 0 && <span style={{ color: "var(--soluk)" }}> · {disarida.length}'i şu an listede değil</span>}
            </span>
            {basilmis.length > 0 && <Rozet ton="yellow">{basilmisNotu(basilmis)}</Rozet>}
          </span>
          {n > 0 && (
            <Btn tur="ghost" ikon={<Ikon ad="kapat" />} onClick={() => setSecili(new Set())} disabled={bekliyor}>
              Temizle
            </Btn>
          )}
          <Btn tur="ghost" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Btn>
          <Btn
            ikon={<Ikon ad="yazdir" />}
            onClick={yazdir}
            disabled={!n || bekliyor}
            title="Seçili oyuncuların kartlarını basıma gönderir; başarılıysa basım kaydı düşer"
          >
            Yazdır{n > 0 ? ` (${n})` : ""}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", minHeight: 0, margin: -24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px 0", flexWrap: "wrap" }}>
          <Girdi placeholder="Ad soyad ara" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kart ara" style={{ width: 220 }} />
          <Secim
            secenekler={[...new Set([sezon, ...sezonlar])]
              .filter(Boolean)
              .map((s) => ({ kod: s, ad: s === sezon ? `${s} (aktif sezon)` : s }))}
            value={sz}
            onChange={(e) => setSz(e.target.value)}
            aria-label="Kart sezonu"
            style={{ width: 200 }}
          />
          <Secim
            secenekler={gruplar.map((g) => ({ kod: String(g.id), ad: g.ad }))}
            bos="Tüm yaş grupları"
            value={grup}
            onChange={(e) => setGrup(e.target.value)}
            aria-label="Kart yaş grubu"
            style={{ width: 180 }}
          />
          <Secim
            secenekler={[{ kod: "aktifler", ad: "Aktif, deneme ve sakat" }, ...DURUMLAR]}
            bos="Tüm durumlar"
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            aria-label="Kart durum"
            style={{ width: 200 }}
          />
          <Secim
            secenekler={KART_SUZGECLERI}
            value={kart}
            onChange={(e) => setKart(e.target.value)}
            aria-label="Kart süzgeci"
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 14, color: "var(--soluk)" }} data-testid="kart-sayac">
            {liste.length} oyuncu
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", borderTop: "1px solid var(--cizgi)" }}>
          {!yukleniyor && !liste.length ? (
            <Bos metin={kart === "basilmamis" ? "Bu süzgeçte basılmamış kartı olan oyuncu yok" : "Bu süzgeçte oyuncu yok"} />
          ) : (
            <table style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <tr>
                  <th style={{ width: 44, paddingRight: 0, paddingLeft: 24 }}>
                    <input
                      type="checkbox"
                      aria-label="Süzgeçtekilerin tümünü seç"
                      checked={bas === "hepsi"}
                      ref={(el) => el && (el.indeterminate = bas === "kismi")}
                      onChange={(e) => setSecili(tumunuSec(secili, ids, e.target.checked))}
                      style={{ width: 18, height: 18 }}
                    />
                  </th>
                  <th style={{ width: "46%" }}>
                    Oyuncu{" "}
                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--soluk)" }}>
                      — başlıktaki kutu süzgeçtekilerin tümünü seçer
                    </span>
                  </th>
                  <th>Grup</th>
                  <th>Son basım</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((o) => {
                  const sec = secili.has(o.id);
                  const e = basimEtiketi(o);
                  return (
                    <tr
                      key={o.id}
                      style={{ background: sec ? "var(--mor-acik)" : undefined, cursor: "pointer" }}
                      onClick={() => setSecili(secimDegistir(secili, o.id))}
                    >
                      <td style={{ width: 44, paddingRight: 0, paddingLeft: 24 }}>
                        <input
                          type="checkbox"
                          aria-label={`Seç: ${o.ad_soyad}`}
                          checked={sec}
                          onChange={() => setSecili(secimDegistir(secili, o.id))}
                          onClick={(ev) => ev.stopPropagation()}
                          style={{ width: 18, height: 18 }}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar ad={o.ad_soyad} boyut={32} />
                          <span className="tek-satir" style={{ fontWeight: 700 }}>
                            {o.ad_soyad}
                          </span>
                        </div>
                      </td>
                      <td>{o.yas_grubu_ad ? <Rozet ton="purple">{o.yas_grubu_ad}</Rozet> : "—"}</td>
                      <td>
                        <Rozet ton={e.ton}>{e.metin}</Rozet>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
