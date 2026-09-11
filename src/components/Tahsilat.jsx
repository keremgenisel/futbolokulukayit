import { useEffect, useState, useCallback } from "react";
import { Kart, Rozet, useToast, useDene } from "./ui.jsx";
import { db, cikti, bugun } from "../lib/api.js";
import { useSezonDurumu } from "../lib/useSezonDurumu.js";
import { paraTR, AY_ADLARI, aidatKalan } from "../lib/aidat.js";
import {
  ayAnahtar,
  baslangicAySecimi,
  donemSecenekleri,
  seciliAylar,
  toplamlar,
  makbuzSatirlari,
  uzunDonemSecimi,
} from "../lib/tahsilat.js";
import { makbuzHtmlUret, makbuzYazdir } from "../lib/yazdir.js";
import { UzunDonemModal } from "./UzunDonemModal.jsx";
import { OyuncuSecici } from "./tahsilat/OyuncuSecici.jsx";
import { AidatAySecimi } from "./tahsilat/AidatAySecimi.jsx";
import { KalemListesi } from "./tahsilat/KalemListesi.jsx";
import { OdemePaneli } from "./tahsilat/OdemePaneli.jsx";
import { BugunKesilenler } from "./tahsilat/BugunKesilenler.jsx";
import { MakbuzIptalModal } from "./tahsilat/MakbuzIptalModal.jsx";

// Tahsilat ekranı (refactor 2. tur §8.2): durum + veri + işlemler burada; çizim tahsilat/ altındaki bileşenlerde, hesaplar
// src/lib/tahsilat.js'te (saf).
export function Tahsilat({ oturum, saltOkunur, onOyuncu, secilenOyuncuId, onSecildi }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [oyuncu, setOyuncu] = useState(null);
  const [aidatlar, setAidatlar] = useState([]);
  const [kalemler, setKalemler] = useState([]);
  const [secili, setSecili] = useState({}); // fee_item_id → tutar (string) — aidat dışı kalemler
  const [aidatAylar, setAidatAylar] = useState({}); // "yil-ay" → tutar (string): tek makbuzda birden fazla ay
  const [yontem, setYontem] = useState("nakit");
  const [tarih, setTarih] = useState(bugun().iso);
  const [tahsilEden, setTahsilEden] = useState(oturum?.ad_soyad || "");
  const [not_, setNot] = useState("");
  const [bugunku, setBugunku] = useState([]);
  const [iptal, setIptal] = useState(null);
  const [iptalNedeni, setIptalNedeni] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [uzunDonemAcik, setUzunDonemAcik] = useState(false); // Uzun Dönem Seç modalı (plan §24)
  const { aktifSezon, tarihler: sezonTarihleri } = useSezonDurumu();
  const sezonBitis = sezonTarihleri?.bitis || ""; // kayıtlı sezon bitişi (plan §37)
  const toast = useToast();
  const dene = useDene();
  const { yil, ay } = bugun();

  const bugunkuYukle = useCallback(async () => {
    try {
      // Bugün kesilenler: yalnız aktif sezonun makbuzları (plan §17.2); sezon yüklenince yeniden çekilir
      setBugunku(await db("listReceiptsByDate", bugun().iso, bugun().iso, aktifSezon || null));
    } catch {}
  }, [aktifSezon]);
  useEffect(() => {
    db("listFeeItems")
      .then(setKalemler)
      .catch(() => {});
    // Ayarlar > Kulüp ve Makbuz > "Varsayılan tahsil eden" ÖNCELİKLİ (Kerem, 09.09.2026); boşsa giriş yapan kullanıcının adı.
    // Kutu makbuz kesmeden önce elle değiştirilebilir; makbuza kutudaki değer yazılır.
    db("getSetting", "tahsil_eden")
      .then((v) => {
        if (v) setTahsilEden(v);
      })
      .catch(() => {});
    bugunkuYukle();
  }, [bugunkuYukle, oturum]);

  useEffect(() => {
    if (!q.trim()) {
      setSonuc([]);
      return;
    }
    const t = setTimeout(
      () =>
        db("listPlayersWithDue", { q: q.trim(), yil, ay })
          .then((l) => setSonuc(l.slice(0, 8)))
          .catch(() => {}),
      150,
    );
    return () => clearTimeout(t);
  }, [q, yil, ay]);

  const oyuncuSec = useCallback(
    async (id) => {
      return dene(async () => {
        const p = await db("getPlayer", id);
        setOyuncu(p);
        setQ("");
        setSonuc([]);
        const d = await db("listDues", id);
        setAidatlar(d);
        setAidatAylar(baslangicAySecimi(p, d, yil, ay));
        setSecili({});
      });
    },
    [yil, ay, dene],
  );

  useEffect(() => {
    if (secilenOyuncuId && kalemler.length) {
      oyuncuSec(secilenOyuncuId);
      onSecildi?.();
    }
  }, [secilenOyuncuId, kalemler, oyuncuSec, onSecildi]);

  const secenekler = donemSecenekleri(aidatlar, aidatAylar, yil, ay);
  const aidatKalem = kalemler.find((k) => k.kod === "aidat");
  const { aidat: aidatToplam, toplam } = toplamlar(aidatAylar, secili);
  const aidatSecili = Object.keys(aidatAylar).length > 0;
  const ayToggle = (d) => {
    const k = ayAnahtar(d.yil, d.ay);
    const n = { ...aidatAylar };
    if (n[k] !== undefined) delete n[k];
    else {
      const a = aidatlar.find((x) => x.yil === d.yil && x.ay === d.ay && (x.durum === "odenmedi" || x.durum === "kismi"));
      n[k] = String(a ? aidatKalan(a) : oyuncu?.aylik_aidat || "");
    }
    setAidatAylar(n);
  };
  const kalemToggle = (k) => {
    if (k.kod === "aidat") {
      if (aidatSecili) setAidatAylar({});
      else if (secenekler[0]) ayToggle(secenekler[0]);
      return;
    }
    if (secili[k.id] !== undefined) {
      const n = { ...secili };
      delete n[k.id];
      setSecili(n);
    } else setSecili({ ...secili, [k.id]: String(k.varsayilan_fiyat || "") });
  };
  const secliAylar = seciliAylar(aidatAylar);
  const aidatEtiket = secliAylar.length ? "Aidat · " + secliAylar.map((d) => `${AY_ADLARI[d.ay - 1]} ${d.yil}`).join(", ") : "Aidat";
  // Uzun Dönem Seç (plan §24): aralıktaki tüm ayları tek çağrıda garanti et, seçimi TAMAMEN bu aralıkla değiştir
  // (mevcut tek tük seçimler yerine — modal genelde boş seçimden açılır); aidatlar de tazelenir ki sonraki
  // elle aç/kapa (ayToggle) doğru "kalan" tutarı bulsun. Ödenmiş/muaf aylar aralığa girmez (Kerem, 10.09.2026).
  const odenmisAylar = new Set(aidatlar.filter((a) => a.durum === "odendi" || a.durum === "muaf").map((a) => ayAnahtar(a.yil, a.ay)));
  const uzunDonemUygula = (aylar) =>
    dene(async () => {
      await db("ensureMonthlyDuesAraligi", oyuncu.id, aylar);
      const d = await db("listDues", oyuncu.id);
      setAidatlar(d);
      const n = uzunDonemSecimi(aylar, d, oyuncu.aylik_aidat);
      const sayi = Object.keys(n).length;
      setAidatAylar(n);
      setUzunDonemAcik(false);
      toast(sayi ? "ok" : "err", sayi ? `${sayi} ay seçildi` : "Seçilen aralıkta ödenmemiş ay yok");
    });
  // Modala varsayılan başlangıç: en eski ödenmemiş/kısmi ay (borç varsa önce o kapanmalı), yoksa bugün.
  const enEskiBorc = [...aidatlar].reverse().find((a) => a.durum === "odenmedi" || a.durum === "kismi");

  const kaydet = async (yazdir) => {
    if (!oyuncu) return toast("err", "Önce oyuncu seçin");
    const satirlar = makbuzSatirlari(aidatAylar, secili, kalemler, aidatKalem);
    if (!satirlar.length) return toast("err", "En az bir kalem seçin");
    setBekliyor(true);
    return dene(
      async () => {
        const r = await db("createReceipt", {
          player_id: oyuncu.id,
          tarih,
          odeme_yontemi: yontem,
          tahsil_eden: tahsilEden,
          not_,
          satirlar,
        });
        const html = await makbuzHtmlUret(r.id);
        await cikti().makbuzPdf(r.id, html);
        toast("ok", `Makbuz ${r.makbuz_no} kaydedildi`);
        if (yazdir) {
          const y = await makbuzYazdir(r.id, html);
          if (!y.ok) toast("err", y.mesaj);
        }
        setOyuncu(null);
        setSecili({});
        setAidatAylar({});
        setNot("");
        setAidatlar([]);
        bugunkuYukle();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };

  const yazdir = (id) =>
    dene(async () => {
      const y = await makbuzYazdir(id);
      if (!y.ok) toast("err", y.mesaj);
    });
  const iptalKapat = () => {
    setIptal(null);
    setIptalNedeni("");
  };
  const iptalEt = async () => {
    if (!iptalNedeni.trim()) return toast("err", "İptal nedeni yazın");
    return dene(async () => {
      await db("cancelReceipt", iptal.id, iptalNedeni.trim());
      toast("ok", "Makbuz iptal edildi");
      iptalKapat();
      bugunkuYukle();
    });
  };

  const bugunToplam = bugunku.reduce((s, m) => s + m.toplam, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Rozet ton="purple" style={{ fontSize: 14, padding: "8px 14px" }}>
          Bugünkü tahsilat: {paraTR(bugunToplam)}
        </Rozet>
      </div>
      {saltOkunur ? (
        <Kart style={{ padding: 20, color: "var(--kirmizi)", fontWeight: 600 }}>Lisans salt okunur modda: makbuz kesilemez.</Kart>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, alignItems: "start" }}>
          <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 22 }}>Oyuncu</h3>
            <OyuncuSecici
              oyuncu={oyuncu}
              q={q}
              onQ={setQ}
              sonuc={sonuc}
              onSec={oyuncuSec}
              onKart={onOyuncu}
              onDegistir={() => {
                setOyuncu(null);
                setSecili({});
                setAidatlar([]);
              }}
            />
            {oyuncu && aidatKalem && (
              <AidatAySecimi
                secenekler={secenekler}
                aidatAylar={aidatAylar}
                onToggle={ayToggle}
                onUzunDonem={() => setUzunDonemAcik(true)}
                saltOkunur={saltOkunur}
              />
            )}
            <h3 style={{ fontSize: 22 }}>Kalemler</h3>
            <KalemListesi
              kalemler={kalemler}
              oyuncu={oyuncu}
              donemVar={secenekler.length > 0}
              aidatSecili={aidatSecili}
              aidatEtiket={aidatEtiket}
              aidatToplam={aidatToplam}
              secliAylar={secliAylar}
              aidatAylar={aidatAylar}
              onAidatAylar={setAidatAylar}
              secili={secili}
              onSecili={setSecili}
              onToggle={kalemToggle}
            />
          </Kart>
          <OdemePaneli
            yontem={yontem}
            onYontem={setYontem}
            tarih={tarih}
            onTarih={setTarih}
            tahsilEden={tahsilEden}
            onTahsilEden={setTahsilEden}
            not_={not_}
            onNot={setNot}
            secliAylar={secliAylar}
            aidatAylar={aidatAylar}
            secili={secili}
            kalemler={kalemler}
            toplam={toplam}
            bekliyor={bekliyor}
            oyuncuVar={!!oyuncu}
            onKaydet={kaydet}
          />
        </div>
      )}
      <BugunKesilenler bugunku={bugunku} saltOkunur={saltOkunur} onYazdir={yazdir} onIptal={setIptal} />
      {iptal && <MakbuzIptalModal makbuz={iptal} neden={iptalNedeni} onNeden={setIptalNedeni} onIptalEt={iptalEt} onKapat={iptalKapat} />}
      {uzunDonemAcik && oyuncu && (
        <UzunDonemModal
          oyuncuAdi={oyuncu.ad_soyad}
          aylikAidat={oyuncu.aylik_aidat}
          baslangic={enEskiBorc ? { yil: enEskiBorc.yil, ay: enEskiBorc.ay } : undefined}
          sezon={aktifSezon}
          sezonBitis={sezonBitis}
          odenmisAylar={odenmisAylar}
          onUygula={uzunDonemUygula}
          onKapat={() => setUzunDonemAcik(false)}
        />
      )}
    </div>
  );
}
