// Oyuncu kartı: durum, yükleme ve üst şerit burada; sekmeler src/components/oyuncu-karti/ altında (refactor §3.4).
import { useEffect, useState, useCallback } from "react";
import { Modal, Btn, Rozet, Avatar, Sekmeler, Onay, useToast, useDene, OYUNCU_MODAL } from "./ui.jsx";
import { db, files, bugun } from "../lib/api.js";
import { DURUMLAR, tarihTR, AY_ADLARI, aidatKalan, gelecekAcikAidatMi, gorunenAidatDurumu } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { aidatDegerleri } from "../lib/whatsapp.js";
import { OyuncuForm } from "./OyuncuForm.jsx";
import { makbuzYazdir as makbuzYazdirAkis, htmlYazdir } from "../lib/yazdir.js";
import { Ikon } from "./Ikon.jsx";
import { BilgiSekmesi } from "./oyuncu-karti/BilgiSekmesi.jsx";
import { AileSekmesi } from "./oyuncu-karti/AileSekmesi.jsx";
import { BelgeSekmesi } from "./oyuncu-karti/BelgeSekmesi.jsx";
import { OdemeSekmesi } from "./oyuncu-karti/OdemeSekmesi.jsx";
import { girisKartiHtml } from "../lib/kartHtml.js";
import { kartAyarlariOku, kartOyuncusu } from "../lib/kartVeri.js";
import { YoklamaSekmesi } from "./oyuncu-karti/YoklamaSekmesi.jsx";

const SEKMELER = [
  { kod: "bilgi", ad: "Bilgiler" },
  { kod: "aile", ad: "Aile ve Acil Kişiler" },
  { kod: "belge", ad: "Belgeler" },
  { kod: "odeme", ad: "Ödemeler" },
  { kod: "yoklama", ad: "Yoklama" },
];

export function OyuncuKarti({ oyuncuId, oturum, gruplar, saltOkunur, onKapat, onMakbuzKes }) {
  const { ad: ucretAd } = useUcretTipleri();
  const [o, setO] = useState(null);
  const [sekme, setSekme] = useState("bilgi");
  const [duzenle, setDuzenle] = useState(false);
  const [foto, setFoto] = useState(null);
  const [veliler, setVeliler] = useState([]);
  const [acil, setAcil] = useState([]);
  const [belgeler, setBelgeler] = useState([]);
  const [aidatlar, setAidatlar] = useState([]);
  const [makbuzlar, setMakbuzlar] = useState([]);
  const [yoklama, setYoklama] = useState([]);
  const [yoklamaOzet, setYoklamaOzet] = useState({}); // durum → sayı (tüm geçmiş, iptal hariç)
  const [tumu, setTumu] = useState({ aidat: false, makbuz: false, yoklama: false }); // "Tümünü göster"
  const SON = { aidat: 12, makbuz: 12, yoklama: 40 };
  const [sil, setSil] = useState(null); // { tip, id, mesaj }
  const [mesajlar, setMesajlar] = useState([]); // WhatsApp hatırlatma/bildirim kayıtları (son 12)
  const [wa, setWa] = useState(null); // { tur, alicilar, baslik, altBaslik, kayit, duzenlenebilir }
  const [basimlar, setBasimlar] = useState([]); // giriş kartı basım kayıtları (plan §40.7; yeniden eskiye)
  const toast = useToast();
  const dene = useDene();

  const yukle = useCallback(async () => {
    return dene(async () => {
      const p = await db("getPlayer", oyuncuId);
      setO(p);
      if (p?.foto_yolu)
        files()
          .dataUrl(p.foto_yolu)
          .then(setFoto)
          .catch(() => {});
      else setFoto(null);
      setVeliler(await db("listGuardians", oyuncuId));
      setBasimlar(await db("kartBasimlari", oyuncuId).catch(() => []));
      setAcil(await db("listEmergency", oyuncuId));
      setBelgeler(await db("listDocuments", oyuncuId));
      // İleri tarihli hiç ödenmemiş aylar (iptal edilen uzun dönem makbuzundan kalan) vadesi gelmediği için gösterilmez;
      // "son 12 dönem" penceresini onlar doldurmasın diye biraz fazla çekilip süzülür (plan §24.3c).
      const { yil: buYil, ay: buAy } = bugun();
      const dues = (await db("listDues", oyuncuId, tumu.aidat ? null : SON.aidat + 24)).filter((a) => !gelecekAcikAidatMi(a, buYil, buAy));
      setAidatlar(tumu.aidat ? dues : dues.slice(0, SON.aidat));
      setMakbuzlar(await db("listReceipts", oyuncuId, tumu.makbuz ? null : SON.makbuz));
      setYoklama(
        tumu.yoklama
          ? [...(await db("playerAttendance", oyuncuId, "1900-01-01", "2999-12-31"))].reverse()
          : await db("playerAttendanceSon", oyuncuId, SON.yoklama),
      );
      const oz = {};
      for (const r of await db("attendanceSummary", oyuncuId, "1900-01-01", "2999-12-31")) oz[r.durum] = r.n;
      setYoklamaOzet(oz);
      try {
        setMesajlar(await db("sonMesajlar", oyuncuId, 12));
      } catch {
        setMesajlar([]);
      }
    });
  }, [oyuncuId, tumu, toast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    yukle();
  }, [yukle]);

  const durumDegistir = (d) =>
    dene(async () => {
      await db("updatePlayer", o.id, { durum: d });
      toast("ok", "Durum güncellendi");
      yukle();
    });
  const belgeYukle = (tip, gecerlilik) =>
    dene(async () => {
      const r = await files().addDocument(o.id, tip, gecerlilik || null);
      if (!r.iptal) {
        toast("ok", "Belge yüklendi");
        yukle();
      }
    });
  const silOnayla = () =>
    dene(async () => {
      if (sil.tip === "veli") await db("deleteGuardian", sil.id);
      if (sil.tip === "acil") await db("deleteEmergency", sil.id);
      if (sil.tip === "belge") await files().deleteDocument(sil.id);
      if (sil.tip === "oyuncu") {
        await db("deletePlayer", sil.id);
        toast("ok", "Oyuncu silindi");
        onKapat();
        return;
      }
      if (sil.tip === "kisisel") {
        // Makbuzlu oyuncu: kişisel veriler ve dosyalar silinir, makbuzlar tutar/numarasıyla kalır (plan §31)
        await files().oyuncuKisiselVeriSil(sil.id);
        toast("ok", "Oyuncunun kişisel verileri silindi; makbuzlar korundu");
        onKapat();
        return;
      }
      setSil(null);
      yukle();
    });
  const makbuzYazdir = (id) =>
    dene(async () => {
      const y = await makbuzYazdirAkis(id);
      if (!y.ok) toast("err", y.mesaj);
    });

  const belgeTarihKaydet = (id, g) =>
    dene(async () => {
      await db("updateDocument", id, { gecerlilik_tarihi: g });
      toast("ok", "Geçerlilik tarihi kaydedildi");
      yukle();
    });
  const tumunuGoster = (k) => setTumu({ ...tumu, [k]: true });

  if (!o) return null;
  // WhatsApp (plan §13): birincil veliye aidat hatırlatma / serbest mesaj
  const birincilVeli = veliler.find((v) => v.veli_mi) || veliler[0] || null;
  const waAlici = (v, degerler) => ({
    key: String(v?.id || "yok"),
    player_id: o.id,
    guardian_id: v?.id || null,
    oyuncu_ad: o.ad_soyad,
    veli_ad: v?.ad_soyad || "",
    grup: o.yas_grubu_ad,
    numara: v ? v.whatsapp_no || v.gsm || "" : "",
    onay: v?.mesaj_onayi,
    degerler,
  });
  // WhatsApp hatırlatma: önce vadesi geçmiş açık ay; hiç yoksa vadesi gelmemiş (plan §38)
  const acikAidat =
    aidatlar.find((a) => ["odenmedi", "kismi"].includes(gorunenAidatDurumu(a.durum, a.vade_gecti))) ||
    aidatlar.find((a) => a.durum === "odenmedi" || a.durum === "kismi") ||
    null;
  const aidatHatirlat = () =>
    acikAidat &&
    setWa({
      tur: "aidat",
      baslik: "WhatsApp ile Aidat Hatırlat",
      altBaslik: `${AY_ADLARI[acikAidat.ay - 1]} ${acikAidat.yil}`,
      kayit: { yil: acikAidat.yil, ay: acikAidat.ay },
      alicilar: [
        waAlici(
          birincilVeli,
          aidatDegerleri({
            veli_ad: birincilVeli?.ad_soyad,
            ad_soyad: o.ad_soyad,
            yil: acikAidat.yil,
            ay: acikAidat.ay,
            tutar: acikAidat.tutar,
            kalan: aidatKalan(acikAidat),
            odeme_donemi: o.odeme_donemi,
            yas_grubu_ad: o.yas_grubu_ad,
          }),
        ),
      ],
    });
  const veliyeMesaj = (v) =>
    setWa({
      tur: "genel",
      baslik: "WhatsApp Mesajı",
      altBaslik: v.ad_soyad,
      duzenlenebilir: true,
      kayit: {},
      alicilar: [
        waAlici(
          v,
          aidatDegerleri({
            veli_ad: v.ad_soyad,
            ad_soyad: o.ad_soyad,
            yil: bugun().yil,
            ay: bugun().ay,
            tutar: o.aylik_aidat,
            odeme_donemi: o.odeme_donemi,
            yas_grubu_ad: o.yas_grubu_ad,
          }),
        ),
      ],
    });
  // Giriş kartı (plan §40): ön + arka yüz, A4 yatay; makbuzla aynı akış (yazıcı yoksa PDF açılır)
  const girisKartiYazdir = () =>
    dene(async () => {
      const { ayar, qr } = await kartAyarlariOku();
      const kart = await kartOyuncusu(o, { sezon: ayar.sezon, qr, foto: foto || "", veliler });
      const y = await htmlYazdir(
        girisKartiHtml({ oyuncular: [kart], ayar, duzen: "tek" }),
        `giris-karti-${o.ad_soyad.replace(/\s+/g, "-")}`,
        true,
      );
      if (!y.ok && !y.pdfAcildi) return toast("err", y.mesaj);
      if (y.pdfAcildi) toast("info", y.mesaj); // yazıcı yok: PDF açıldı, yine de üretildi sayılır
      if (!saltOkunur) {
        await db("kartBasimKaydet", [o.id], ayar.sezon, "tek"); // basım kaydı (plan §40.7); salt okunurda tutulmaz
        setBasimlar(await db("kartBasimlari", oyuncuId).catch(() => []));
      }
    });
  // "Basılmadı say": son basım kaydını siler (yalnız yönetici; yanlış basım için)
  const basimGeriAl = () =>
    dene(async () => {
      if (!basimlar[0]) return;
      await db("kartBasimSil", basimlar[0].id);
      setBasimlar(await db("kartBasimlari", oyuncuId).catch(() => []));
      toast("ok", "Son basım kaydı silindi");
    });
  const sonMesaj = mesajlar[0] || null;
  const ust = (
    <div
      style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 26px", background: "var(--mor)", color: "var(--ana-ustu)" }}
    >
      <Avatar ad={o.ad_soyad} boyut={72} foto={foto} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="baslik" style={{ color: "var(--ana-ustu)", fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
          {o.ad_soyad}
        </div>
        <div style={{ color: "var(--ana-ustu-soluk, #d8cce9)", fontSize: 14, marginTop: 6 }}>
          {o.yas_grubu_ad || "Grup yok"} · {tarihTR(o.dogum_tarihi)} · Kayıt {tarihTR(o.kayit_tarihi)}
        </div>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,.14)",
          borderRadius: 8,
          padding: "0 12px",
          height: 40,
          fontSize: 14,
        }}
      >
        <span style={{ color: "var(--ana-ustu-soluk, #d8cce9)" }}>Durum:</span>
        <select
          value={o.durum}
          disabled={saltOkunur}
          onChange={(e) => durumDegistir(e.target.value)}
          style={{ background: "transparent", color: "var(--ana-ustu)", border: 0, fontWeight: 700, fontSize: 14 }}
        >
          {DURUMLAR.map((d) => (
            <option key={d.kod} value={d.kod} style={{ color: "var(--metin)" }}>
              {d.ad}
            </option>
          ))}
        </select>
      </label>
      <Btn
        tur="ghost"
        ikon={<Ikon ad="yazdir" />}
        onClick={girisKartiYazdir}
        title="11 × 6 cm giriş kartı: ön ve arka yüz A4 yatay sayfada; yazıcı yoksa PDF açılır (plan §40)"
        style={{ background: "rgba(255,255,255,.14)", color: "var(--ana-ustu)", borderColor: "rgba(255,255,255,.35)" }}
      >
        Giriş Kartı
      </Btn>
      {!saltOkunur && (
        <Btn tur="sari" ikon={<Ikon ad="tahsilat" />} onClick={() => onMakbuzKes(o.id)}>
          Makbuz Kes
        </Btn>
      )}
      <button
        type="button"
        onClick={onKapat}
        aria-label="Kapat"
        style={{ background: "none", border: 0, color: "var(--ana-ustu-soluk, #d8cce9)", cursor: "pointer", display: "flex" }}
      >
        <Ikon ad="kapat" boyut={24} />
      </button>
    </div>
  );

  return (
    <Modal
      ust={ust}
      onKapat={onKapat}
      genislik={OYUNCU_MODAL.genislik}
      yukseklik={OYUNCU_MODAL.yukseklik}
      altBar={
        <>
          <span style={{ flex: 1, alignSelf: "center", color: "var(--soluk)", fontSize: 13 }}>Son güncelleme {tarihTR(o.updated_at)}</span>
          {!saltOkunur && oturum?.role === "admin" && (
            <Btn
              tur="danger"
              onClick={() =>
                makbuzlar.length > 0
                  ? setSil({
                      tip: "kisisel",
                      id: o.id,
                      mesaj: `${o.ad_soyad} adına ${makbuzlar.length} makbuz kesilmiş. Makbuzlar adı, tutarı ve numarasıyla olduğu gibi korunur (tahsilat raporu bozulmaz); oyuncunun diğer kişisel verileri — kimlik, iletişim, veli ve acil kişiler, belgeler, fotoğraf, aidat ve yoklama kayıtları — kalıcı olarak silinir ve oyuncu kaydı "${"Silinmiş Oyuncu #" + o.id}" olarak kalır. Bu işlem geri alınamaz. Emin misiniz? (Sadece ayrıldıysa "Ayrıldı" durumu yeterlidir.)`,
                    })
                  : setSil({
                      tip: "oyuncu",
                      id: o.id,
                      mesaj: `${o.ad_soyad} kaydı tüm belgeleri, aidat ve yoklama kayıtlarıyla silinecek. Emin misiniz? (Ayrılan oyuncular için "Ayrıldı" durumu önerilir.)`,
                    })
              }
            >
              Sil
            </Btn>
          )}
          <Btn tur="ghost" onClick={onKapat}>
            Kapat
          </Btn>
          {!saltOkunur && <Btn onClick={() => setDuzenle(true)}>Düzenle</Btn>}
        </>
      }
    >
      {basimlar.length > 0 && (
        <div
          data-testid="kart-basim-seridi"
          style={{
            margin: "-24px -24px 0",
            padding: "8px 24px",
            background: "var(--zemin)",
            borderBottom: "1px solid var(--cizgi)",
            fontSize: 13,
            color: "var(--soluk)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>
            Giriş kartı basımı:{" "}
            {basimlar
              .slice(0, 3)
              .map(
                (b) =>
                  `${tarihTR(String(b.basim_zamani).slice(0, 10))} (${b.tur === "toplu" ? "toplu" : "tek"}${b.kullanici ? ", " + b.kullanici : ""})`,
              )
              .join(" · ")}
            {basimlar.length > 3 ? ` · +${basimlar.length - 3}` : ""}
          </span>
          <span style={{ flex: 1 }} />
          {!saltOkunur && oturum?.role === "admin" && (
            <button
              type="button"
              onClick={basimGeriAl}
              title="Son basım kaydını siler (yanlış basım): kart yeniden 'Basılmadı' sayılır"
              style={{
                background: "none",
                border: 0,
                color: "var(--kirmizi)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Basılmadı say
            </button>
          )}
        </div>
      )}
      <div style={{ margin: basimlar.length ? "0 -24px 20px" : "-24px -24px 20px" }}>
        <Sekmeler
          liste={SEKMELER.map((s) =>
            s.kod === "odeme" && aidatlar.some((a) => gorunenAidatDurumu(a.durum, a.vade_gecti) === "odenmedi")
              ? {
                  ...s,
                  ek: (
                    <Rozet ton="red">{aidatlar.filter((a) => gorunenAidatDurumu(a.durum, a.vade_gecti) === "odenmedi").length} borç</Rozet>
                  ),
                }
              : s,
          )}
          aktif={sekme}
          onSec={setSekme}
        />
      </div>

      {sekme === "bilgi" && <BilgiSekmesi o={o} veliler={veliler} ucretAd={ucretAd} sonMesaj={sonMesaj} />}

      {sekme === "aile" && (
        <AileSekmesi
          oyuncu={o}
          veliler={veliler}
          acil={acil}
          saltOkunur={saltOkunur}
          onDegisti={yukle}
          onSil={setSil}
          onWhatsApp={veliyeMesaj}
        />
      )}

      {sekme === "belge" && (
        <BelgeSekmesi belgeler={belgeler} saltOkunur={saltOkunur} onYukle={belgeYukle} onTarihKaydet={belgeTarihKaydet} onSil={setSil} />
      )}

      {sekme === "odeme" && (
        <OdemeSekmesi
          donem={o.odeme_donemi}
          aidatlar={aidatlar}
          makbuzlar={makbuzlar}
          tumu={tumu}
          son={SON}
          onTumu={tumunuGoster}
          acikAidat={acikAidat}
          birincilVeli={birincilVeli}
          onAidatHatirlat={aidatHatirlat}
          onMakbuzYazdir={makbuzYazdir}
        />
      )}

      {sekme === "yoklama" && <YoklamaSekmesi yoklama={yoklama} yoklamaOzet={yoklamaOzet} tumu={tumu} son={SON} onTumu={tumunuGoster} />}

      {duzenle && (
        <OyuncuForm
          oyuncu={o}
          gruplar={gruplar}
          onKapat={() => setDuzenle(false)}
          onKaydedildi={() => {
            setDuzenle(false);
            yukle();
          }}
        />
      )}
      {wa && (
        <WhatsAppHatirlat
          tur={wa.tur}
          baslik={wa.baslik}
          altBaslik={wa.altBaslik}
          alicilar={wa.alicilar}
          kayit={wa.kayit}
          duzenlenebilir={wa.duzenlenebilir}
          saltOkunur={saltOkunur}
          onKapat={() => {
            setWa(null);
            yukle();
          }}
        />
      )}
      {sil && <Onay tehlikeli mesaj={sil.mesaj} onEvet={silOnayla} onHayir={() => setSil(null)} />}
    </Modal>
  );
}
