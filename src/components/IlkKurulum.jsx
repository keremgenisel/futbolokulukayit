import { useEffect, useState } from "react";
import { Modal, Btn, Alan, Girdi, ParaGirdi, Rozet, useToast, useDene } from "./ui.jsx";
import { db, yedek, hataMetni, bugun } from "../lib/api.js";
import { UCRET_TIPLERI, SABIT_INDIRIM, VARSAYILAN_INDIRIM, aidatHesapla, paraTR } from "../lib/aidat.js";
import { guncelSezon, sezonGecerliMi } from "../lib/sezon.js";
import { KurtarmaKodlari } from "./Ayarlar.jsx";
import { Ikon } from "./Ikon.jsx";

// İlk kurulum sihirbazı: ilk parola değişiminden sonra, hiç oyuncu yokken bir kez. Kulüp adı → aidat ve
// indirimler → yaş grupları ve sezon → yedek klasörü → kurtarma kodları → Excel'den aktarım. Her adım atlanabilir;
// bitince kurulum_tamam=1 yazılır (Ayarlar'dan hepsi sonradan değiştirilebilir).
const ADIMLAR = ["Kulüp", "Aidat", "Yaş grupları", "Yedek", "Kurtarma kodları", "Bitti"];
const HAZIR_GRUPLAR = ["U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15"];

export function IlkKurulum({ oturum, onBitti, onAktar }) {
  const [adim, setAdim] = useState(0);
  const [kulup, setKulup] = useState({ kulup_adi: "", tahsil_eden: oturum?.ad_soyad || "" });
  const [taban, setTaban] = useState("");
  const [tipler, setTipler] = useState(UCRET_TIPLERI);
  const [ind, setInd] = useState(Object.fromEntries(UCRET_TIPLERI.map((t) => [t.kod, String(VARSAYILAN_INDIRIM[t.kod] ?? 0)])));
  const [gruplar, setGruplar] = useState(new Set(["U9", "U10", "U11", "U12", "U13"]));
  const [ekGrup, setEkGrup] = useState("");
  const [sezon, setSezon] = useState(guncelSezon(bugun().iso, 9));
  const [yedekDurum, setYedekDurum] = useState(null);
  const [kodlar, setKodlar] = useState(null); // üretilen kodlar (bir kez gösterilir)
  const [kodPencere, setKodPencere] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const dene = useDene();

  useEffect(() => {
    yedek()
      .durum()
      .then(setYedekDurum)
      .catch(() => {});
  }, []);
  // Ücret tipleri veritabanından (varsayılanlar tohumlu; daha önce eklenmiş tip varsa o da görünsün)
  useEffect(() => {
    db("listFeeTypes")
      .then((l) => {
        if (Array.isArray(l) && l.length) {
          setTipler(l);
          setInd(Object.fromEntries(l.map((t) => [t.kod, String(t.indirim ?? 0)])));
        }
      })
      .catch(() => {});
  }, []);
  // Zaten grup varsa (Excel'den geldi vb.) hazır listeyi dolu göstermeyelim
  useEffect(() => {
    db("listAgeGroups")
      .then((g) => {
        if (g.length) setGruplar(new Set());
      })
      .catch(() => {});
  }, []);

  const kaydetKulup = async () => {
    for (const [k, v] of Object.entries(kulup)) if (v.trim()) await db("setSetting", k, v.trim());
  };
  const kaydetAidat = async () => {
    const aidat = (await db("listFeeItems")).find((k) => k.kod === "aidat");
    const kalemler = aidat && Number(taban) > 0 ? [{ id: aidat.id, varsayilan_fiyat: Number(taban) }] : [];
    const indirimler = Object.fromEntries(
      tipler.filter((t) => !SABIT_INDIRIM.has(t.kod) && !t.sabit).map((t) => [t.kod, Math.min(100, Math.max(0, Number(ind[t.kod]) || 0))]),
    );
    await db("aidatAyarlariKaydet", { kalemler, indirimler });
  };
  const kaydetGruplar = async () => {
    if (!sezonGecerliMi(sezon)) throw new Error("Sezon 2026-2027 biçiminde olmalı");
    const mevcut = new Set((await db("listAgeGroups")).map((g) => g.ad.toLocaleUpperCase("tr-TR")));
    let sira = mevcut.size;
    for (const ad of [...gruplar].sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))))
      if (!mevcut.has(ad)) await db("createAgeGroup", { ad, sezon, sira: ++sira });
    await db("setSetting", "aktif_sezon", sezon);
  };
  const ileri = async () => {
    setBekliyor(true);
    try {
      if (adim === 0) await kaydetKulup();
      else if (adim === 1) await kaydetAidat();
      else if (adim === 2) await kaydetGruplar();
      setAdim(adim + 1);
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  const bitir = async (birDahaGosterme = true) => {
    try {
      if (birDahaGosterme) await db("setSetting", "kurulum_tamam", "1");
    } catch {
      /* yoksay */
    }
    onBitti?.();
  };
  const klasorSec = () =>
    dene(async () => {
      const r = await yedek().klasorSec();
      if (r.error) toast("err", r.error);
      else if (!r.iptal) setYedekDurum(await yedek().durum());
    });
  const kodUret = async () => {
    setBekliyor(true);
    try {
      const ben = (await db("listUsers")).find((u) => u.username === oturum.username);
      const r = await window.okul.auth.kurtarmaUret(ben.id);
      if (!r.ok) toast("err", r.error);
      else {
        setKodlar(r.kodlar);
        setKodPencere(true);
      }
    } catch (e) {
      toast("err", hataMetni(e));
    } finally {
      setBekliyor(false);
    }
  };
  const grupToggle = (ad) => {
    const n = new Set(gruplar);
    if (n.has(ad)) n.delete(ad);
    else n.add(ad);
    setGruplar(n);
  };
  const ekGrupEkle = () => {
    const ad = ekGrup.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
    if (ad) {
      setGruplar(new Set([...gruplar, ad]));
      setEkGrup("");
    }
  };

  const son = adim === ADIMLAR.length - 1;
  return (
    <Modal
      baslik="Hoş geldiniz — İlk Kurulum"
      genislik={760}
      onKapat={() => bitir(false)}
      altBar={
        <>
          {!son && (
            <Btn tur="ghost" onClick={() => bitir(false)}>
              Şimdi değil
            </Btn>
          )}
          {adim > 0 && !son && (
            <Btn tur="ghost" onClick={() => setAdim(adim - 1)} disabled={bekliyor}>
              Geri
            </Btn>
          )}
          {!son && adim >= 3 && (
            <Btn tur="ghost" onClick={() => setAdim(adim + 1)} disabled={bekliyor}>
              Atla
            </Btn>
          )}
          {!son && (
            <Btn onClick={ileri} disabled={bekliyor} ikon={<Ikon ad="sag" />}>
              {adim >= 3 ? "Devam" : "Kaydet ve Devam"}
            </Btn>
          )}
          {son && <Btn onClick={() => bitir(true)}>Bitir, Pano'ya Git</Btn>}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ADIMLAR.map((a, i) => (
            <span
              key={a}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 999,
                background: i === adim ? "var(--mor)" : i < adim ? "var(--mor-acik)" : "var(--zemin)",
                color: i === adim ? "#fff" : "var(--mor-koyu)",
              }}
            >
              {i + 1}. {a}
            </span>
          ))}
        </div>

        {adim === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--soluk)" }}>
              Programı birkaç adımda kullanıma hazırlayalım. Her şey sonradan Ayarlar'dan değiştirilebilir.
            </p>
            <Alan etiket="Makbuzda görünen kulüp adı">
              <Girdi
                value={kulup.kulup_adi}
                onChange={(e) => setKulup({ ...kulup, kulup_adi: e.target.value })}
                placeholder="EYÜPSPOR FUTBOL OKULU"
                aria-label="Kulüp adı"
                autoFocus
              />
            </Alan>
            <Alan etiket="Makbuzu kesen (varsayılan tahsil eden)">
              <Girdi
                value={kulup.tahsil_eden}
                onChange={(e) => setKulup({ ...kulup, tahsil_eden: e.target.value })}
                aria-label="Tahsil eden"
              />
            </Alan>
          </div>
        )}

        {adim === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Alan etiket="Aylık aidat taban fiyatı (₺)" style={{ width: 220 }}>
              <ParaGirdi value={taban} onDegis={setTaban} aria-label="Aidat taban fiyatı" autoFocus />
            </Alan>
            <div style={{ fontSize: 13, color: "var(--soluk)" }}>
              Ücret tipine göre indirim yüzdesi. Yeni oyuncu kaydında aidat otomatik hesaplanır, elle değiştirilebilir.
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ücret tipi</th>
                  <th>İndirim (%)</th>
                  <th>Aylık aidat</th>
                </tr>
              </thead>
              <tbody>
                {tipler.map((t) => {
                  const sabit = SABIT_INDIRIM.has(t.kod) || !!t.sabit;
                  const h = aidatHesapla(Number(taban) || 0, t.kod, { [t.kod]: ind[t.kod] });
                  return (
                    <tr key={t.kod}>
                      <td>
                        <b>{t.ad}</b>
                      </td>
                      <td>
                        {sabit ? (
                          <span style={{ color: "var(--soluk)" }}>%{ind[t.kod]}</span>
                        ) : (
                          <Girdi
                            type="number"
                            min="0"
                            max="100"
                            value={ind[t.kod]}
                            onChange={(e) => setInd({ ...ind, [t.kod]: e.target.value })}
                            aria-label={`${t.ad} indirimi`}
                            style={{ width: 100, height: 36 }}
                          />
                        )}
                      </td>
                      <td>{h === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(h)}</b>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {adim === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Alan etiket="Aktif sezon" style={{ width: 180 }}>
              <Girdi value={sezon} onChange={(e) => setSezon(e.target.value.trim())} aria-label="Aktif sezon" />
            </Alan>
            <div style={{ fontSize: 13, color: "var(--soluk)" }}>
              Okulda hangi yaş grupları var? Seçin ya da ekleyin. Oyuncular bu gruplara kaydedilir.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[...new Set([...HAZIR_GRUPLAR, ...gruplar])].map((ad) => (
                <button
                  key={ad}
                  type="button"
                  onClick={() => grupToggle(ad)}
                  aria-pressed={gruplar.has(ad)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 700,
                    border: `1.5px solid ${gruplar.has(ad) ? "var(--mor)" : "var(--cizgi)"}`,
                    background: gruplar.has(ad) ? "var(--mor)" : "#fff",
                    color: gruplar.has(ad) ? "#fff" : "var(--mor-koyu)",
                  }}
                >
                  {ad}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Girdi
                value={ekGrup}
                onChange={(e) => setEkGrup(e.target.value)}
                placeholder="Başka grup (ör. U16, Minikler)"
                aria-label="Başka grup"
                style={{ width: 260, height: 40 }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ekGrupEkle())}
              />
              <Btn kucuk tur="ghost" onClick={ekGrupEkle}>
                Ekle
              </Btn>
            </div>
            <div style={{ fontSize: 13 }}>
              Açılacak gruplar: <b>{[...gruplar].join(", ") || "—"}</b>
            </div>
            <div
              data-testid="kalabalik-grup-ipucu"
              style={{
                fontSize: 13,
                color: "var(--mor-koyu)",
                background: "var(--sari-acik)",
                border: "1px solid var(--sari)",
                borderRadius: 10,
                padding: "10px 14px",
                lineHeight: 1.45,
              }}
            >
              <b>Bir yaşta çok oyuncu varsa</b> (örnek: iki U11 grubu): o yaşı "U11 A" ve "U11 B" gibi iki ayrı grup olarak açın; programda
              ek bir alt grup alanı yoktur. Her grubun kendi haftalık programı ve yoklaması olur; oyuncu kaydında doğum yılı ipucu "U11 A
              seç / U11 B seç" gösterir. Yeni sezonda "U11 A" için "U12 A" önerilir, yoksa "U12". Kalabalık yıl geçince grubu silmeyin,
              pasife alın: silinen grubun antrenman ve yoklama kayıtları da silinir. Bu grupları şimdi "Başka grup" kutusundan ya da sonra
              Yaş Grupları sekmesinden ekleyebilirsiniz.
            </div>
          </div>
        )}

        {adim === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--soluk)" }}>
              Program her gün otomatik yedek alır. Yedek klasörü olarak harici disk ya da OneDrive/Google Drive klasörü seçin; bilgisayar
              bozulursa verileriniz orada olur.
            </p>
            <div>
              <span style={{ color: "var(--soluk)" }}>Yedek klasörü:</span> <b>{yedekDurum?.klasor || "Seçilmedi"}</b>
            </div>
            <div>
              <Btn ikon={<Ikon ad="yedek" />} onClick={klasorSec}>
                Klasör Seç
              </Btn>
            </div>
          </div>
        )}

        {adim === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--soluk)" }}>
              Parolanızı unutursanız giriş ekranındaki "Parolamı unuttum" ile bu kodlardan biriyle yeni parola belirlersiniz. Kodlar bir kez
              gösterilir; yazdırıp güvenli bir yerde saklayın.
            </p>
            {!kodlar && (
              <div>
                <Btn ikon={<Ikon ad="kilit" />} onClick={kodUret} disabled={bekliyor}>
                  Kurtarma Kodlarını Üret
                </Btn>
              </div>
            )}
            {kodlar && <Rozet ton="green">8 kurtarma kodu üretildi</Rozet>}
          </div>
        )}

        {son && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0 }}>
              <b>Kurulum tamam.</b> Şimdi oyuncuları ekleyebilirsiniz.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn
                tur="ghost"
                ikon={<Ikon ad="yukle" />}
                onClick={async () => {
                  await bitir(true);
                  onAktar?.();
                }}
              >
                Excel'den Oyuncu Aktar
              </Btn>
            </div>
            <p style={{ margin: 0, color: "var(--soluk)", fontSize: 13 }}>
              Kulübün elinde bir liste yoksa Oyuncular &gt; Yeni Oyuncu ile tek tek ekleyin. Tüm ayarlar Ayarlar menüsünden
              değiştirilebilir.
            </p>
          </div>
        )}
      </div>
      {kodPencere && kodlar && (
        <KurtarmaKodlari username={oturum.username} kodlar={kodlar} onKapat={() => setKodPencere(false)} kapatMetni="Kaydettim" />
      )}
    </Modal>
  );
}
