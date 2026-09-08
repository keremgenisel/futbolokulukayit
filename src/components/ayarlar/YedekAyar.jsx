// Ayarlar > Yedekleme (yedek klasörü/sıklık, geri yükleme, taşıma paketi)
import { useEffect, useState } from "react";
import { Btn, Alan, Girdi, Secim, Onay, useToast, useDene } from "../ui.jsx";
import { yedek, hataMetni } from "../../lib/api.js";
import { tarihTR } from "../../lib/aidat.js";
import { Ikon } from "../Ikon.jsx";

export function YedekAyar({ admin }) {
  const [d, setD] = useState({ klasor: null, son: null });
  const [bekliyor, setBekliyor] = useState(false);
  const [aday, setAday] = useState(null); // seçilen yedeğin özeti (onay bekliyor)
  // Taşıma paketi (plan §14): parola korumalı, başka bilgisayarda açılır
  const [tp, setTp] = useState({ p1: "", p2: "" });
  const [tg, setTg] = useState({ yol: "", parola: "" }); // geri yükleme: seçilen paket + parola
  const [tAday, setTAday] = useState(null); // paket özeti (onay bekliyor)
  const toast = useToast();
  const dene = useDene();
  const tasimaOlustur = async () => {
    if (tp.p1.length < 10) return toast("err", "Parola en az 10 karakter olmalı");
    if (tp.p1 !== tp.p2) return toast("err", "Parolalar aynı değil");
    setBekliyor(true);
    try {
      const r = await yedek().tasimaOlustur(tp.p1);
      if (r.iptal) return;
      if (r.error) return toast("err", r.error);
      toast("ok", "Taşıma paketi kaydedildi: " + r.yol);
      setTp({ p1: "", p2: "" });
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  const tasimaSec = () =>
    dene(async () => {
      const r = await yedek().tasimaSec();
      if (r.iptal) return;
      if (r.error) return toast("err", r.error);
      setTg({ ...tg, yol: r.yol });
    });
  const tasimaKontrol = async () => {
    if (!tg.yol) return toast("err", "Önce paket dosyasını seçin");
    setBekliyor(true);
    try {
      const r = await yedek().tasimaBilgi(tg.yol, tg.parola);
      if (r.error) return toast("err", r.error);
      setTAday(r);
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  const tasimaGeriYukle = async () => {
    setBekliyor(true);
    try {
      const r = await yedek().tasimaGeriYukle(tAday.yol, tg.parola);
      if (r.error) toast("err", r.error);
      else toast("ok", "Taşıma paketi yüklendi, program yeniden başlatılıyor…");
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
      setTAday(null);
    }
  };
  const geriYukleSec = () =>
    dene(async () => {
      const r = await yedek().geriYukleSec();
      if (r.iptal) return;
      if (r.error) return toast("err", r.error);
      setAday(r);
    });
  const geriYukleOnayla = async () => {
    setBekliyor(true);
    try {
      const r = await yedek().geriYukle(aday.klasor);
      if (r.error) toast("err", r.error);
      else toast("ok", "Geri yüklendi, program yeniden başlatılıyor…");
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
      setAday(null);
    }
  };
  const yukle = () =>
    yedek()
      .durum()
      .then(setD)
      .catch(() => {});
  useEffect(() => {
    yukle();
  }, []);
  const sec = () =>
    dene(async () => {
      const r = await yedek().klasorSec();
      if (!r.iptal) {
        toast("ok", "Yedek klasörü ayarlandı");
        yukle();
      }
    });
  const siklikDegistir = async (e) => {
    const k = e.target.value;
    try {
      const r = await yedek().siklik(k);
      if (r.error) toast("err", r.error);
      else {
        toast("ok", "Yedekleme sıklığı kaydedildi");
        yukle();
      }
    } catch (err) {
      toast("err", hataMetni(err));
    }
  };
  const al = async () => {
    setBekliyor(true);
    try {
      const r = await yedek().al();
      if (r.error) toast("err", r.error);
      else toast("ok", "Yedek alındı: " + r.yol);
      yukle();
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <h3 style={{ fontSize: 22 }}>Yedekleme</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Veritabanı, vesikalık fotoğraflar, belgeler ve makbuz PDF'leri tek bir şifreli dosyaya (<code>eyupspor-yedek-tarih.eyupyedek</code>)
        yazılır; bulut klasöründe bile içerik okunamaz. Otomatik yedek uygulama açılışında, aşağıda seçtiğiniz sıklıkla alınır; en eski
        yedekler silinir, son 30 yedek saklanır. Klasör olarak harici disk veya bulut klasörü (OneDrive, Google Drive) seçebilirsiniz.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 15 }}>
        <div>
          <span style={{ color: "var(--soluk)" }}>Yedek klasörü:</span> <b>{d.klasor || "Seçilmedi"}</b>
        </div>
        <div>
          <span style={{ color: "var(--soluk)" }}>Son yedek:</span>{" "}
          <b>{d.son ? `${tarihTR(d.son)} ${d.son.slice(11, 16)}` : "Henüz alınmadı"}</b>
        </div>
      </div>
      {!d.istemci && d.sikliklar && (
        <Alan etiket="Otomatik yedekleme sıklığı" style={{ width: 320 }}>
          <Secim secenekler={d.sikliklar} value={d.siklik} onChange={siklikDegistir} aria-label="Otomatik yedekleme sıklığı" />
        </Alan>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn tur="ghost" onClick={sec}>
          Klasör Seç
        </Btn>
        <Btn ikon={<Ikon ad="yedek" />} onClick={al} disabled={!d.klasor || bekliyor}>
          Şimdi Yedek Al
        </Btn>
      </div>
      {admin && !d.istemci && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Yedekten geri yükle</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
            Bir yedek dosyası (<code>.eyupyedek</code> ya da eski <code>.zip</code>) seçin. Mevcut veriler silinmez,{" "}
            <code>.pre-restore</code> uzantısıyla kenara alınır. Geri yükleme bittiğinde program yeniden başlar. Yedek bu bilgisayarda
            alınmış olmalıdır.
          </p>
          <div>
            <Btn tur="danger" ikon={<Ikon ad="geri" />} onClick={geriYukleSec} disabled={bekliyor}>
              Yedek Dosyası Seç ve Geri Yükle
            </Btn>
          </div>
        </div>
      )}
      {admin && !d.istemci && (
        <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Yeni bilgisayara taşıma paketi</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
            Normal yedek yalnız bu bilgisayarda açılır (şifreleme anahtarı bu bilgisayara bağlıdır). Bilgisayar değişecekse ya da bozulma
            ihtimaline karşı, <b>parola korumalı</b> bir taşıma paketi (<code>eyupspor-tasima-tarih.eyupspor</code>) alın: veritabanı,
            belgeler ve makbuz PDF'leri tek dosyada, yalnız bu parolayla açılır. Parolayı ayrı bir yerde saklayın; unutulursa paket
            açılamaz.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Alan etiket="Paket parolası" style={{ width: 200 }}>
              <Girdi
                type="password"
                value={tp.p1}
                onChange={(e) => setTp({ ...tp, p1: e.target.value })}
                aria-label="Paket parolası"
                placeholder="en az 10 karakter"
              />
            </Alan>
            <Alan etiket="Parola (tekrar)" style={{ width: 200 }}>
              <Girdi
                type="password"
                value={tp.p2}
                onChange={(e) => setTp({ ...tp, p2: e.target.value })}
                aria-label="Paket parolası tekrar"
              />
            </Alan>
            <Btn ikon={<Ikon ad="indir" />} onClick={tasimaOlustur} disabled={bekliyor || !tp.p1}>
              Taşıma Paketi Oluştur
            </Btn>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>Taşıma paketinden geri yükle (yeni bilgisayarda)</div>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
            Paket dosyasını seçin, parolasını girin. Veriler bu bilgisayarın anahtarıyla yeniden şifrelenir; mevcut veriler{" "}
            <code>.pre-restore</code> ile kenara alınır ve program yeniden başlar.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Btn tur="ghost" onClick={tasimaSec} disabled={bekliyor}>
              Paket Dosyası Seç
            </Btn>
            <span
              style={{
                fontSize: 13,
                color: "var(--soluk)",
                alignSelf: "center",
                maxWidth: 260,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={tg.yol}
            >
              {tg.yol ? tg.yol.split(/[\\/]/).pop() : "Seçilmedi"}
            </span>
            <Alan etiket="Paketin parolası" style={{ width: 200 }}>
              <Girdi
                type="password"
                value={tg.parola}
                onChange={(e) => setTg({ ...tg, parola: e.target.value })}
                aria-label="Geri yükleme parolası"
              />
            </Alan>
            <Btn tur="danger" ikon={<Ikon ad="geri" />} onClick={tasimaKontrol} disabled={bekliyor || !tg.yol || !tg.parola}>
              Paketi Aç ve Geri Yükle
            </Btn>
          </div>
        </div>
      )}
      {aday && (
        <Onay
          tehlikeli
          mesaj={`Seçilen yedek: ${aday.oyuncu} oyuncu, ${aday.makbuz} makbuz${aday.sonMakbuz ? ", son makbuz " + tarihTR(aday.sonMakbuz) : ""}. Mevcut veriler kenara alınıp bu yedek yüklenecek ve program yeniden başlayacak. Devam edilsin mi?`}
          onEvet={geriYukleOnayla}
          onHayir={() => setAday(null)}
        />
      )}
      {tAday && (
        <Onay
          tehlikeli
          mesaj={`Taşıma paketi açıldı: ${tAday.oyuncu} oyuncu, ${tAday.makbuz} makbuz${tAday.sonMakbuz ? ", son makbuz " + tarihTR(tAday.sonMakbuz) : ""}. Mevcut veriler kenara alınıp paket bu bilgisayara yüklenecek ve program yeniden başlayacak. Devam edilsin mi?`}
          onEvet={tasimaGeriYukle}
          onHayir={() => setTAday(null)}
        />
      )}
    </div>
  );
}
