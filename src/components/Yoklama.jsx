import { useEffect, useState, useCallback } from "react";
import { Kart, Btn, Rozet, Onay, useToast, useDene } from "./ui.jsx";
import { db, cikti, bugun } from "../lib/api.js";
import { useSezonDurumu } from "../lib/useSezonDurumu.js";
import { yoklamaFormuHtml } from "../lib/yoklamaFormuHtml.js";
import { htmlYazdir, ciktiMarkasi } from "../lib/yazdir.js";
import { Ikon } from "./Ikon.jsx";
import { TakvimSeridi, SERIT_GUN } from "./TakvimSeridi.jsx";
import { gunKaydir, varsayilanBaslangic, uzunTarih, haftaBasi, sezonDisiMi, haftaSezonDisiMi } from "../lib/takvim.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { antrenmanDegerleri, hatirlatmaUygunMu } from "../lib/whatsapp.js";
import { saatAraligi, saatAraligiDogrula } from "../lib/program.js";
import { AntrenmanKarti } from "./yoklama/AntrenmanKarti.jsx";
import { AntrenmanEkleFormu } from "./yoklama/AntrenmanEkleFormu.jsx";
import { YoklamaPaneli } from "./yoklama/YoklamaPaneli.jsx";

// Şerit kaydırıldıkça ±4 haftalık pencere tek sorguda yüklenir (plan §9.2).
const PENCERE_GUN = 28;

export function Yoklama({ saltOkunur }) {
  const bugunIso = bugun().iso;
  const [tarih, setTarih] = useState(bugunIso);
  const [baslangic, setBaslangic] = useState(() => varsayilanBaslangic(bugunIso));
  const [gruplar, setGruplar] = useState([]);
  const [takvim, setTakvim] = useState({}); // iso → antrenman özetleri (pencere içi)
  const [aktif, setAktif] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [yoklama, setYoklama] = useState({}); // player_id → durum
  const [formAcik, setFormAcik] = useState(false);
  const [yeni, setYeni] = useState({ age_group_id: "", saat: "", bitis: "", saha: "" }); // bitiş isteğe bağlı (plan §37)
  const [iptal, setIptal] = useState(null);
  const [duzen, setDuzen] = useState(null); // antrenman düzenleme formu { tarih, saat, bitis, saha }
  const [bildir, setBildir] = useState(null); // "Velilere bildirilsin mi?" sorusu { t, tur }
  const [waAnt, setWaAnt] = useState(null); // açık bildirim penceresi { t, tur, alicilar }
  const { tarihler: sezonTarih } = useSezonDurumu(); // aktif sezonun tarihleri (plan §37.6; yoksa null)
  const toast = useToast();
  const dene = useDene();

  const takvimYukle = useCallback(async () => {
    return dene(async () => {
      const l = await db("trainingCalendar", gunKaydir(baslangic, -PENCERE_GUN), gunKaydir(baslangic, SERIT_GUN - 1 + PENCERE_GUN));
      const m = {};
      for (const t of l) (m[t.tarih] ||= []).push(t);
      setTakvim(m);
      setAktif((a) => (a ? l.find((t) => t.id === a.id) || a : a)); // seçili antrenmanın sayaçlarını tazele
    });
  }, [baslangic, dene]);
  useEffect(() => {
    db("listAgeGroups")
      .then((g) => setGruplar(g.filter((x) => x.aktif)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    takvimYukle();
  }, [takvimYukle]);
  useEffect(() => {
    setAktif(null);
    setFormAcik(false);
  }, [tarih]);

  const antrenmanlar = takvim[tarih] || [];

  const antrenmanSec = useCallback(
    async (t) => {
      setAktif(t);
      return dene(async () => {
        const { yil, ay } = bugun();
        const l = await db("listPlayersWithDue", { yas_grubu_id: t.age_group_id, yil, ay });
        setOyuncular(l.filter((o) => ["aktif", "deneme", "sakat"].includes(o.durum)));
        const a = await db("listAttendance", t.id);
        setYoklama(Object.fromEntries(a.map((x) => [x.player_id, x.durum])));
      });
    },
    [dene],
  );

  // Seçili düğmeye yeniden tıklamak işareti kaldırır (işaretlenmedi); aksi halde yeni durum yazılır.
  const isaretle = async (pid, durum) => {
    if (saltOkunur || aktif.iptal) return;
    const kaldir = yoklama[pid] === durum;
    const n = { ...yoklama };
    if (kaldir) delete n[pid];
    else n[pid] = durum;
    setYoklama(n);
    return dene(async () => {
      await db("setAttendance", aktif.id, pid, kaldir ? null : durum);
      takvimYukle();
    });
  };
  // Kalanları Geldi İşaretle: işaretlenmemiş HERKES kaydedilir (10.09.2026 düzeltmesi: döngü ilk oyuncuda return ediyordu —
  // yalnız ilk oyuncu yazılıyor, ekran/sayaç güncellenmiyordu; gerçek pencere testinde bulundu).
  const tumuGeldi = () =>
    dene(async () => {
      const n = { ...yoklama };
      let sayi = 0;
      for (const o of oyuncular)
        if (!n[o.id]) {
          n[o.id] = "geldi";
          await db("setAttendance", aktif.id, o.id, "geldi");
          sayi++;
        }
      setYoklama(n);
      takvimYukle();
      toast("ok", sayi ? `${sayi} oyuncu geldi olarak kaydedildi` : "İşaretlenmemiş oyuncu yok");
    });
  const antrenmanEkle = async () => {
    if (!yeni.age_group_id) return toast("err", "Yaş grubu seçin");
    const dg = saatAraligiDogrula(yeni.saat, yeni.bitis);
    if (!dg.gecerli) return toast("err", dg.neden);
    return dene(async () => {
      const t = await db("createTraining", {
        age_group_id: Number(yeni.age_group_id),
        tarih,
        saat: yeni.saat,
        bitis_saat: yeni.bitis,
        saha: yeni.saha,
      });
      toast("ok", "Antrenman eklendi");
      setYeni({ age_group_id: "", saat: "", bitis: "", saha: "" });
      setFormAcik(false);
      await takvimYukle();
      antrenmanSec({ ...t, yas_grubu_ad: gruplar.find((g) => g.id === t.age_group_id)?.ad, iptal: 0, oyuncu: 0, isaretli: 0 });
    });
  };
  const haftayiDoldur = () =>
    dene(async () => {
      const r = await db("haftayiProgramdanDoldur", haftaBasi(tarih));
      if (r?.error) return toast("err", r.error);
      if (r.eklenen === 0 && r.programsiz > 0 && r.atlanan === 0)
        toast("err", "Hiçbir yaş grubunun haftalık programı yok. Yaş Grupları > Düzenle'den gün ve saat girin.");
      else
        toast(
          "ok",
          `${r.eklenen} antrenman eklendi${r.atlanan ? `, ${r.atlanan} zaten vardı` : ""}${r.programsiz ? `, ${r.programsiz} grubun programı yok` : ""}${haftaSezonDisiMi(haftaBasi(tarih), sezonTarih) ? " · bu hafta sezon dışında" : ""}`,
        );
      await takvimYukle();
    });
  const iptalEt = () =>
    dene(async () => {
      await db("cancelTraining", iptal.id, "İptal");
      toast("ok", "Antrenman iptal edildi");
      const t = { ...iptal, iptal: 1, iptal_nedeni: "İptal", bildirim_gerekli: 1 };
      setIptal(null);
      setAktif(null);
      await takvimYukle();
      setBildir({ t, tur: "iptal" });
    });
  // Antrenman düzenleme (plan §13): tarih/saat/saha; değiştiyse velilere bildirim sorulur
  const duzenKaydet = () =>
    dene(async () => {
      const dg = saatAraligiDogrula(duzen.saat, duzen.bitis);
      if (!dg.gecerli) throw new Error(dg.neden);
      const t = await db("updateTraining", aktif.id, { tarih: duzen.tarih, saat: duzen.saat, bitis_saat: duzen.bitis, saha: duzen.saha });
      setDuzen(null);
      if (!t.degisti) return toast("ok", "Değişiklik yok");
      toast("ok", "Antrenman güncellendi");
      if (t.tarih !== tarih) setTarih(t.tarih); // başka güne taşındıysa o güne git
      await takvimYukle();
      setAktif((a) => (a ? { ...a, ...t } : a));
      setBildir({ t: { ...aktif, ...t }, tur: "degisiklik" });
    });
  // Bildirim penceresi: grubun aktif oyuncularının birincil velileri (onay + numara) ve bu antrenman için açılmış kayıtlar
  const bildirimAc = async (t0, tur) => {
    setBildir(null);
    return dene(async () => {
      // Antrenmanı taze oku: iptal/değişiklik yeni olay açar (grup_bildirim sıfırlanır); ekrandaki eski kopya yanıltmasın
      const t = (await db("trainingCalendar", t0.tarih, t0.tarih)).find((x) => x.id === t0.id) || t0;
      const l = await db("antrenmanVelileri", t.id);
      setWaAnt({
        t,
        tur,
        alicilar: l.map((v) => ({
          key: String(v.player_id),
          player_id: v.player_id,
          guardian_id: v.guardian_id,
          oyuncu_ad: v.ad_soyad,
          veli_ad: v.veli_ad || "",
          grup: t.yas_grubu_ad,
          numara: v.veli_wa || "",
          onay: v.veli_onay,
          mesaj_id: v.mesaj_id,
          degerler: antrenmanDegerleri(t, { veli_ad: v.veli_ad, ad_soyad: v.ad_soyad }),
        })),
      });
    });
  };
  const bildirimKapat = async () => {
    const t = waAnt.t;
    setWaAnt(null);
    try {
      // Uygun velilerin hepsine açıldıysa bayrak iner; kalan varsa kartta "x/y veli bildirildi" sürer
      const l = await db("antrenmanVelileri", t.id);
      const uygun = l.filter((v) => hatirlatmaUygunMu({ numara: v.veli_wa, onay: v.veli_onay }).ok);
      if (!saltOkunur && uygun.length > 0 && uygun.every((v) => v.mesaj_id)) await db("bildirimGerekliAyarla", t.id, 0);
    } catch {
      /* yalnız bayrak */
    }
    takvimYukle();
  };
  // Veli grubuna gönderim geri al (kart başlığından; pencere kapalıyken de): bildirim gereği yeniden açılır
  const grupGeriAl = () =>
    dene(async () => {
      await db("grupBildirimSil", aktif.id);
      toast("ok", "Grup bildirimi geri alındı");
      takvimYukle();
    });

  // Saha yoklama formu (plan §12): ekrandaki liste + işaretler; programda işaretli olanlar dolu, kalanlar boş kutu.
  const formHtml = async () => {
    const { logo, kulup, tema } = await ciktiMarkasi(); // kanal yoksa logosuz, varsayılan ad/renk
    return yoklamaFormuHtml({
      grup: aktif.yas_grubu_ad || "",
      tarih: aktif.tarih,
      saat: saatAraligi(aktif.saat || "", aktif.bitis_saat || ""), // "17:00–18:30"
      saha: aktif.saha,
      logo,
      kulup,
      tema,
      oyuncular: oyuncular.map((o) => ({ ad_soyad: o.ad_soyad, durum: o.durum, isaret: yoklama[o.id] })),
    });
  };
  const formAdi = () => `yoklama-${(aktif.yas_grubu_ad || "grup").replace(/\s+/g, "")}-${aktif.tarih}`;
  // Yazıcı yoksa / yazdırma başarısızsa form PDF olarak açılır (makbuzla aynı davranış); kullanıcı sessiz kalmaz.
  const formYazdir = () =>
    dene(async () => {
      const y = await htmlYazdir(await formHtml(), formAdi());
      if (!y.ok) toast("err", y.mesaj);
    });
  const formPdf = () =>
    dene(async () => {
      await cikti().pdfKaydet(await formHtml(), formAdi() + ".pdf", false);
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TakvimSeridi
        secili={tarih}
        bugun={bugunIso}
        baslangic={baslangic}
        onSec={setTarih}
        onBaslangic={setBaslangic}
        gunOzetleri={takvim}
        sezon={sezonTarih}
      />

      <Kart style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h3 style={{ fontSize: 22 }}>{uzunTarih(tarih)}</h3>
            <span style={{ color: "var(--soluk)", fontSize: 14 }}>
              {antrenmanlar.length === 0 ? "antrenman yok" : `${antrenmanlar.length} antrenman`}
            </span>
            {sezonDisiMi(tarih, sezonTarih) && (
              <Rozet ton="gray" title="Sezon tarihleri Ayarlar > Sezon'da; antrenman yine de eklenebilir">
                Sezon dışı
              </Rozet>
            )}
          </div>
          {!saltOkunur && !formAcik && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                tur="ghost"
                ikon={<Ikon ad="takvim" />}
                onClick={haftayiDoldur}
                title="Yaş gruplarının haftalık programındaki antrenmanları bu haftaya ekler (var olanlar atlanır)"
              >
                Haftayı Programdan Doldur
              </Btn>
              <Btn ikon={<Ikon ad="arti" />} onClick={() => setFormAcik(true)}>
                Antrenman Ekle
              </Btn>
            </div>
          )}
        </div>
        {antrenmanlar.length === 0 && !formAcik ? (
          <div style={{ color: "var(--soluk)", fontSize: 14 }}>
            Bu tarihte antrenman yok.{!saltOkunur && " Eklemek için sağdaki düğmeyi kullanın."}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {antrenmanlar.map((t) => (
              <AntrenmanKarti key={t.id} t={t} on={aktif?.id === t.id} onSec={antrenmanSec} />
            ))}
          </div>
        )}
        {formAcik && !saltOkunur && (
          <AntrenmanEkleFormu
            gruplar={gruplar}
            yeni={yeni}
            onDegis={setYeni}
            onEkle={antrenmanEkle}
            onVazgec={() => setFormAcik(false)}
            antrenmanlar={antrenmanlar}
          />
        )}
      </Kart>

      <Kart>
        <YoklamaPaneli
          aktif={aktif}
          oyuncular={oyuncular}
          yoklama={yoklama}
          saltOkunur={saltOkunur}
          duzen={duzen}
          onDuzen={setDuzen}
          onDuzenKaydet={duzenKaydet}
          onIsaretle={isaretle}
          onTumuGeldi={tumuGeldi}
          onFormYazdir={formYazdir}
          onFormPdf={formPdf}
          onIptal={setIptal}
          onBildir={bildirimAc}
          onGrupGeriAl={grupGeriAl}
        />
      </Kart>
      {iptal && (
        <Onay
          tehlikeli
          mesaj={`${iptal.yas_grubu_ad} ${iptal.saat} antrenmanı iptal edilsin mi?`}
          onEvet={iptalEt}
          onHayir={() => setIptal(null)}
        />
      )}
      {bildir && (
        <Onay
          mesaj={`${bildir.t.yas_grubu_ad} grubunun velilerine WhatsApp ile ${bildir.tur === "iptal" ? "iptal" : "değişiklik"} bildirilsin mi? Her veli için WhatsApp açılır, Gönder'e siz basarsınız.`}
          onEvet={() => bildirimAc(bildir.t, bildir.tur)}
          onHayir={() => setBildir(null)}
        />
      )}
      {waAnt && (
        <WhatsAppHatirlat
          grup={{ ad: waAnt.t.yas_grubu_ad, training_id: waAnt.t.id, gonderildi: !!waAnt.t.grup_bildirim }}
          tur={waAnt.tur}
          baslik={waAnt.tur === "iptal" ? "Antrenman İptali — Velilere Bildir" : "Antrenman Değişikliği — Velilere Bildir"}
          altBaslik={`${waAnt.t.yas_grubu_ad} · ${uzunTarih(waAnt.t.tarih)}${waAnt.t.saat ? " · " + saatAraligi(waAnt.t.saat, waAnt.t.bitis_saat || "") : ""}`}
          alicilar={waAnt.alicilar}
          kayit={{ training_id: waAnt.t.id }}
          saltOkunur={saltOkunur}
          onKapat={bildirimKapat}
        />
      )}
    </div>
  );
}
