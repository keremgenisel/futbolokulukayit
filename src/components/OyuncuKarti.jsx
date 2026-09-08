import { useEffect, useState, useCallback } from "react";
import { Modal, Btn, Rozet, Alan, Girdi, Secim, Avatar, Sekmeler, Onay, Bos, useToast, aidatTonu, aidatEtiket, OYUNCU_MODAL } from "./ui.jsx";
import { db, files, hataMetni, bugun } from "../lib/api.js";
import { DURUMLAR, ODEME_YONTEMLERI, tarihTR, paraTR, AY_ADLARI, kimlikBilgisi, aidatKalan } from "../lib/aidat.js";
import { useUcretTipleri } from "../lib/ucretTipleri.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { aidatDegerleri, hatirlatmaUygunMu } from "../lib/whatsapp.js";
import { OyuncuForm } from "./OyuncuForm.jsx";
import { makbuzYazdir as makbuzYazdirAkis } from "../lib/yazdir.js";
import { Ikon } from "./Ikon.jsx";
import { belgeGecerlilik, belgeEtiketi, onerilenGecerlilik } from "../lib/belge.js";

const BELGE_TIPLERI = [
  { kod: "saglik", ad: "Sağlık raporu", gecerlilik: true }, { kod: "foto", ad: "Vesikalık fotoğraf", tekil: true },
  { kod: "sporcu_kimlik", ad: "Sporcu kimlik fotokopisi" }, { kod: "veli_kimlik", ad: "Veli kimlik fotokopisi" },
  { kod: "kayit_formu", ad: "İmzalı kayıt formu" }, { kod: "diger", ad: "Diğer" },
];
const SEKMELER = [{ kod: "bilgi", ad: "Bilgiler" }, { kod: "aile", ad: "Aile ve Acil Kişiler" }, { kod: "belge", ad: "Belgeler" }, { kod: "odeme", ad: "Ödemeler" }, { kod: "yoklama", ad: "Yoklama" }];

function Bilgi({ etiket, deger, genis }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: genis ? "span 2" : undefined }}><span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{etiket}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{deger || "—"}</span></div>;
}

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
  const toast = useToast();

  const yukle = useCallback(async () => {
    try {
      const p = await db("getPlayer", oyuncuId); setO(p);
      if (p?.foto_yolu) files().dataUrl(p.foto_yolu).then(setFoto).catch(() => {}); else setFoto(null);
      setVeliler(await db("listGuardians", oyuncuId)); setAcil(await db("listEmergency", oyuncuId));
      setBelgeler(await db("listDocuments", oyuncuId));
      setAidatlar(await db("listDues", oyuncuId, tumu.aidat ? null : SON.aidat));
      setMakbuzlar(await db("listReceipts", oyuncuId, tumu.makbuz ? null : SON.makbuz));
      setYoklama(tumu.yoklama ? [...(await db("playerAttendance", oyuncuId, "1900-01-01", "2999-12-31"))].reverse() : await db("playerAttendanceSon", oyuncuId, SON.yoklama));
      const oz = {}; for (const r of await db("attendanceSummary", oyuncuId, "1900-01-01", "2999-12-31")) oz[r.durum] = r.n;
      setYoklamaOzet(oz);
      try { setMesajlar(await db("sonMesajlar", oyuncuId, 12)); } catch { setMesajlar([]); }
    } catch (e) { toast("err", hataMetni(e)); }
  }, [oyuncuId, tumu, toast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { yukle(); }, [yukle]);

  const durumDegistir = async (d) => { try { await db("updatePlayer", o.id, { durum: d }); toast("ok", "Durum güncellendi"); yukle(); } catch (e) { toast("err", hataMetni(e)); } };
  const belgeYukle = async (tip, gecerlilik) => {
    try { const r = await files().addDocument(o.id, tip, gecerlilik || null); if (!r.iptal) { toast("ok", "Belge yüklendi"); yukle(); } }
    catch (e) { toast("err", hataMetni(e)); }
  };
  const silOnayla = async () => {
    try {
      if (sil.tip === "veli") await db("deleteGuardian", sil.id);
      if (sil.tip === "acil") await db("deleteEmergency", sil.id);
      if (sil.tip === "belge") await files().deleteDocument(sil.id);
      if (sil.tip === "oyuncu") { await db("deletePlayer", sil.id); toast("ok", "Oyuncu silindi"); onKapat(); return; }
      setSil(null); yukle();
    } catch (e) { toast("err", hataMetni(e)); }
  };
  const makbuzYazdir = async (id) => {
    try { const y = await makbuzYazdirAkis(id); if (!y.ok) toast("err", y.mesaj); } catch (e) { toast("err", hataMetni(e)); }
  };

  if (!o) return null;
  const veliAd = veliler.find((v) => v.veli_mi)?.ad_soyad;
  // WhatsApp (plan §13): birincil veliye aidat hatırlatma / serbest mesaj
  const birincilVeli = veliler.find((v) => v.veli_mi) || veliler[0] || null;
  const waAlici = (v, degerler) => ({ key: String(v?.id || "yok"), player_id: o.id, guardian_id: v?.id || null, oyuncu_ad: o.ad_soyad, veli_ad: v?.ad_soyad || "", grup: o.yas_grubu_ad, numara: v ? (v.whatsapp_no || v.gsm || "") : "", onay: v?.mesaj_onayi, degerler });
  const acikAidat = aidatlar.find((a) => a.durum === "odenmedi" || a.durum === "kismi") || null;
  const aidatHatirlat = () => acikAidat && setWa({ tur: "aidat", baslik: "WhatsApp ile Aidat Hatırlat", altBaslik: `${AY_ADLARI[acikAidat.ay - 1]} ${acikAidat.yil}`, kayit: { yil: acikAidat.yil, ay: acikAidat.ay }, alicilar: [waAlici(birincilVeli, aidatDegerleri({ veli_ad: birincilVeli?.ad_soyad, ad_soyad: o.ad_soyad, yil: acikAidat.yil, ay: acikAidat.ay, tutar: acikAidat.tutar, kalan: aidatKalan(acikAidat), odeme_donemi: o.odeme_donemi, yas_grubu_ad: o.yas_grubu_ad }))] });
  const veliyeMesaj = (v) => setWa({ tur: "genel", baslik: "WhatsApp Mesajı", altBaslik: v.ad_soyad, duzenlenebilir: true, kayit: {}, alicilar: [waAlici(v, aidatDegerleri({ veli_ad: v.ad_soyad, ad_soyad: o.ad_soyad, yil: bugun().yil, ay: bugun().ay, tutar: o.aylik_aidat, odeme_donemi: o.odeme_donemi, yas_grubu_ad: o.yas_grubu_ad }))] });
  const sonMesaj = mesajlar[0] || null;
  const ust = (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 26px", background: "var(--mor)", color: "#fff" }}>
      <Avatar ad={o.ad_soyad} boyut={72} foto={foto} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="baslik" style={{ color: "#fff", fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{o.ad_soyad}</div>
        <div style={{ color: "#D8CCE9", fontSize: 14, marginTop: 6 }}>{o.yas_grubu_ad || "Grup yok"} · {tarihTR(o.dogum_tarihi)} · Kayıt {tarihTR(o.kayit_tarihi)}</div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.14)", borderRadius: 8, padding: "0 12px", height: 40, fontSize: 14 }}>
        <span style={{ color: "#D8CCE9" }}>Durum:</span>
        <select value={o.durum} disabled={saltOkunur} onChange={(e) => durumDegistir(e.target.value)} style={{ background: "transparent", color: "#fff", border: 0, fontWeight: 700, fontSize: 14 }}>
          {DURUMLAR.map((d) => <option key={d.kod} value={d.kod} style={{ color: "#1B1530" }}>{d.ad}</option>)}
        </select>
      </label>
      {!saltOkunur && <Btn tur="sari" ikon={<Ikon ad="tahsilat" />} onClick={() => onMakbuzKes(o.id)}>Makbuz Kes</Btn>}
      <button type="button" onClick={onKapat} aria-label="Kapat" style={{ background: "none", border: 0, color: "#D8CCE9", cursor: "pointer", display: "flex" }}><Ikon ad="kapat" boyut={24} /></button>
    </div>
  );

  return (
    <Modal ust={ust} onKapat={onKapat} genislik={OYUNCU_MODAL.genislik} yukseklik={OYUNCU_MODAL.yukseklik}
      altBar={<>
        <span style={{ flex: 1, alignSelf: "center", color: "var(--soluk)", fontSize: 13 }}>Son güncelleme {tarihTR(o.updated_at)}</span>
        {!saltOkunur && oturum?.role === "admin" && <Btn tur="danger" onClick={() => setSil({ tip: "oyuncu", id: o.id, mesaj: `${o.ad_soyad} kaydı tüm belgeleri ve makbuzlarıyla silinecek. Emin misiniz? (Ayrılan oyuncular için "Ayrıldı" durumu önerilir.)` })}>Sil</Btn>}
        <Btn tur="ghost" onClick={onKapat}>Kapat</Btn>
        {!saltOkunur && <Btn onClick={() => setDuzenle(true)}>Düzenle</Btn>}
      </>}>
      <div style={{ margin: "-24px -24px 20px" }}>
        <Sekmeler liste={SEKMELER.map((s) => s.kod === "odeme" && aidatlar.some((a) => a.durum === "odenmedi") ? { ...s, ek: <Rozet ton="red">{aidatlar.filter((a) => a.durum === "odenmedi").length} borç</Rozet> } : s)} aktif={sekme} onSec={setSekme} />
      </div>

      {sekme === "bilgi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <h3 style={{ fontSize: 20 }}>Öğrenci</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 18 }}>
            <Bilgi etiket={kimlikBilgisi(o).etiket} deger={kimlikBilgisi(o).deger} /><Bilgi etiket="Adı Soyadı" deger={o.ad_soyad} /><Bilgi etiket="Doğum Tarihi" deger={tarihTR(o.dogum_tarihi)} />
            <Bilgi etiket="Doğum Yeri" deger={o.dogum_yeri} /><Bilgi etiket="Okulu" deger={o.okul} /><Bilgi etiket="Kan Grubu" deger={o.kan_grubu} />
            <Bilgi etiket="GSM" deger={o.gsm} /><Bilgi etiket="Ev Adresi" deger={o.adres} genis />
          </div>
          <div style={{ height: 1, background: "var(--cizgi)" }} />
          <h3 style={{ fontSize: 20 }}>Kayıt ve Ücret</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 18 }}>
            <Bilgi etiket="Yaş Grubu" deger={o.yas_grubu_ad} /><Bilgi etiket="Ücret Tipi" deger={ucretAd(o.ucret_tipi)} /><Bilgi etiket="Aylık Aidat" deger={paraTR(o.aylik_aidat)} /><Bilgi etiket="Ödeme Dönemi" deger={`Her ayın ${o.odeme_donemi} arası`} />
            <Bilgi etiket="Veli" deger={veliAd} /><Bilgi etiket="Veli WhatsApp" deger={veliler.find((v) => v.veli_mi)?.whatsapp_no} /><Bilgi etiket="Kayıt Tarihi" deger={tarihTR(o.kayit_tarihi)} /><Bilgi etiket="Notlar" deger={o.notlar} /><Bilgi etiket="Son WhatsApp" deger={sonMesaj ? `${tarihTR(String(sonMesaj.tarih).slice(0, 10))} · ${{ aidat: "aidat hatırlatma", genel: "mesaj", iptal: "iptal bildirimi", degisiklik: "değişiklik bildirimi" }[sonMesaj.tur] || sonMesaj.tur}${sonMesaj.kullanici ? ` · ${sonMesaj.kullanici}` : ""}` : ""} />
          </div>
        </div>
      )}

      {sekme === "aile" && <AileSekmesi oyuncu={o} veliler={veliler} acil={acil} saltOkunur={saltOkunur} onDegisti={yukle} onSil={setSil} onWhatsApp={veliyeMesaj} />}

      {sekme === "belge" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {BELGE_TIPLERI.map((t) => {
            const mevcut = belgeler.filter((b) => b.tip === t.kod);
            return (
              <div key={t.kod} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--cizgi)", borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.ad}</div>
                  {mevcut.length === 0 ? <div style={{ fontSize: 12, color: "var(--soluk)" }}>Henüz yüklenmedi</div> : mevcut.map((b) => (
                    <div key={b.id} style={{ fontSize: 13, display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); files().open(b.dosya_yolu); }}>{b.orijinal_ad || b.dosya_yolu}</a>
                      <span style={{ color: "var(--soluk)" }}>{tarihTR(b.yuklenme_tarihi)}{b.gecerlilik_tarihi ? ` · geçerlilik ${tarihTR(b.gecerlilik_tarihi)}` : t.gecerlilik ? " · tarih girilmemiş" : ""}</span>
                      {t.gecerlilik && !saltOkunur && <BelgeTarihDuzenle belge={b} onKaydet={async (g) => { try { await db("updateDocument", b.id, { gecerlilik_tarihi: g }); toast("ok", "Geçerlilik tarihi kaydedildi"); yukle(); } catch (e) { toast("err", hataMetni(e)); } }} />}
                      {!saltOkunur && <button type="button" onClick={() => setSil({ tip: "belge", id: b.id, mesaj: "Belge silinsin mi?" })} style={{ background: "none", border: 0, color: "var(--kirmizi)", cursor: "pointer", fontSize: 12 }}>sil</button>}
                    </div>
                  ))}
                </div>
                {mevcut.length ? (t.gecerlilik ? (() => { const g = belgeGecerlilik(mevcut[0].gecerlilik_tarihi, bugun().iso); return <Rozet ton={g.durum === "gecerli" ? "green" : g.durum === "dolacak" ? "yellow" : "red"}>{belgeEtiketi(g)}</Rozet>; })() : <Rozet ton="green">Yüklü</Rozet>) : <Rozet ton="red">Eksik</Rozet>}
                {!saltOkunur && <BelgeYukleDugmesi tip={t} mevcut={mevcut.length} onYukle={belgeYukle} />}
              </div>
            );
          })}
        </div>
      )}

      {sekme === "odeme" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}><h3 style={{ fontSize: 20 }}>Aylık Aidat</h3>{acikAidat && (() => { const u = hatirlatmaUygunMu({ numara: birincilVeli ? (birincilVeli.whatsapp_no || birincilVeli.gsm) : "", onay: birincilVeli?.mesaj_onayi }); return <Btn kucuk tur={u.ok ? "yesil" : "ghost"} ikon={<Ikon ad="whatsapp" boyut={16} />} disabled={!u.ok} title={u.ok ? "" : u.neden} onClick={aidatHatirlat}>Aidat Hatırlat</Btn>; })()}</div>
            {aidatlar.length === 0 ? <Bos metin="Aidat kaydı yok." /> : (
              <table><thead><tr><th>Dönem</th><th>Tutar</th><th>Ödenen</th><th>Durum</th></tr></thead><tbody>
                {aidatlar.map((a) => <tr key={a.id}><td>{AY_ADLARI[a.ay - 1]} {a.yil}</td><td>{paraTR(a.tutar)}</td><td>{a.durum === "muaf" ? "—" : paraTR(a.odenen || 0)}</td><td><Rozet ton={aidatTonu(a.durum)}>{aidatEtiket(a.durum)}</Rozet>{a.durum === "kismi" && <span style={{ fontSize: 12, color: "var(--kirmizi)", marginLeft: 6 }}>kalan {paraTR(aidatKalan(a))}</span>}</td></tr>)}
              </tbody></table>
            )}
            {!tumu.aidat && aidatlar.length >= SON.aidat && <TumunuGoster onClick={() => setTumu({ ...tumu, aidat: true })} metin={`Son ${SON.aidat} dönem gösteriliyor`} />}
          </div>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Makbuzlar</h3>
            {makbuzlar.length === 0 ? <Bos metin="Makbuz yok." /> : (
              <table><thead><tr><th>No</th><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th></th></tr></thead><tbody>
                {makbuzlar.map((m) => <tr key={m.id} style={{ opacity: m.iptal ? .5 : 1 }}><td>{m.makbuz_no}{m.iptal ? <span title={`${m.iptal_nedeni || ""}${m.iptal_eden ? " · " + m.iptal_eden : ""}`} style={{ color: "var(--kirmizi)", fontSize: 12 }}> · iptal{m.iptal_nedeni ? `: ${m.iptal_nedeni}` : ""}</span> : ""}</td><td>{tarihTR(m.tarih)}</td><td>{paraTR(m.toplam)}</td><td>{ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad}</td><td><Btn kucuk tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={() => makbuzYazdir(m.id)}>Yazdır</Btn></td></tr>)}
              </tbody></table>
            )}
            {!tumu.makbuz && makbuzlar.length >= SON.makbuz && <TumunuGoster onClick={() => setTumu({ ...tumu, makbuz: true })} metin={`Son ${SON.makbuz} makbuz gösteriliyor`} />}
          </div>
        </div>
      )}

      {sekme === "yoklama" && (
        <div>
          <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
            {["geldi", "gelmedi", "izinli"].map((d) => <div key={d}><div style={{ fontSize: 12, color: "var(--soluk)", textTransform: "uppercase", fontWeight: 600 }}>{d}</div><div className="baslik" style={{ fontSize: 32 }}>{yoklamaOzet[d] || 0}</div></div>)}
          </div>
          {yoklama.length === 0 ? <Bos metin="Yoklama kaydı yok." /> : (
            <table><thead><tr><th>Tarih</th><th>Saat</th><th>Durum</th></tr></thead><tbody>
              {yoklama.map((y, i) => <tr key={i}><td>{tarihTR(y.tarih)}</td><td>{y.saat}</td><td><Rozet ton={y.durum === "geldi" ? "green" : y.durum === "gelmedi" ? "red" : "yellow"}>{y.durum}</Rozet></td></tr>)}
            </tbody></table>
          )}
          {!tumu.yoklama && yoklama.length >= SON.yoklama && <TumunuGoster onClick={() => setTumu({ ...tumu, yoklama: true })} metin={`Son ${SON.yoklama} yoklama gösteriliyor`} />}
        </div>
      )}

      {duzenle && <OyuncuForm oyuncu={o} gruplar={gruplar} onKapat={() => setDuzenle(false)} onKaydedildi={() => { setDuzenle(false); yukle(); }} />}
      {wa && <WhatsAppHatirlat tur={wa.tur} baslik={wa.baslik} altBaslik={wa.altBaslik} alicilar={wa.alicilar} kayit={wa.kayit} duzenlenebilir={wa.duzenlenebilir} saltOkunur={saltOkunur} onKapat={() => { setWa(null); yukle(); }} />}
      {sil && <Onay tehlikeli mesaj={sil.mesaj} onEvet={silOnayla} onHayir={() => setSil(null)} />}
    </Modal>
  );
}

// Mevcut belgenin geçerlilik tarihi: "Tarih gir" / "Tarihi değiştir" → satır içi tarih kutusu + Kaydet (dosyayı yeniden yüklemeden).
function BelgeTarihDuzenle({ belge, onKaydet }) {
  const [acik, setAcik] = useState(false);
  const [g, setG] = useState(belge.gecerlilik_tarihi || onerilenGecerlilik(bugun().iso));
  if (!acik) return <button type="button" onClick={() => setAcik(true)} style={{ background: "none", border: 0, color: belge.gecerlilik_tarihi ? "var(--mor)" : "var(--kirmizi)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>{belge.gecerlilik_tarihi ? "Tarihi değiştir" : "Tarih gir"}</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <Girdi type="date" value={g} onChange={(e) => setG(e.target.value)} aria-label="Belge geçerlilik tarihi" style={{ width: 150, height: 32 }} />
      <Btn kucuk onClick={async () => { if (!g) return; await onKaydet(g); setAcik(false); }} disabled={!g}>Kaydet</Btn>
      <Btn kucuk tur="ghost" onClick={() => setAcik(false)}>Vazgeç</Btn>
    </span>
  );
}

// Tekil tiplerde (vesikalık) ikinci dosya eklenmez; "Değiştir" eskisinin yerine koyar (asıl kural main süreçte, db.belgeEkle).
// Geçerlilik isteyen belgede (sağlık raporu) tarih ZORUNLU: kutu bir yıl sonrasıyla dolu gelir, değiştirilebilir; boşsa yükleme yapılmaz
// (tarihsiz rapor pano/filtrede "raporsuz" sayılıyordu — 08.09.2026).
function BelgeYukleDugmesi({ tip, mevcut = 0, onYukle }) {
  const [gecerlilik, setGecerlilik] = useState(() => (tip.gecerlilik ? onerilenGecerlilik(bugun().iso) : ""));
  const degistir = tip.tekil && mevcut > 0;
  const tarihEksik = !!tip.gecerlilik && !gecerlilik;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {tip.gecerlilik && <Girdi type="date" value={gecerlilik} onChange={(e) => setGecerlilik(e.target.value)} style={{ width: 150, height: 36, borderColor: tarihEksik ? "var(--kirmizi)" : undefined }} title="Geçerlilik tarihi (zorunlu; öneri: bir yıl)" aria-label={`${tip.ad} geçerlilik tarihi`} />}
      <Btn kucuk tur="ghost" ikon={<Ikon ad="yukle" boyut={16} />} onClick={() => onYukle(tip.kod, gecerlilik)} disabled={tarihEksik} title={tarihEksik ? "Önce geçerlilik tarihini girin" : degistir ? "Vesikalık tek dosya olur; yenisi eskisinin yerine geçer" : undefined}>{degistir ? "Değiştir" : "Yükle"}</Btn>
    </div>
  );
}

function AileSekmesi({ oyuncu, veliler, acil, saltOkunur, onDegisti, onSil, onWhatsApp }) {
  const [v, setV] = useState({ tip: "baba", ad_soyad: "", gsm: "", whatsapp_no: "", veli_mi: false, mesaj_onayi: true });
  const onayDegistir = async (x, deger) => { try { await db("updateGuardian", x.id, { mesaj_onayi: deger ? 1 : 0 }); onDegisti(); } catch (e) { toast("err", hataMetni(e)); } };
  const [a, setA] = useState({ ad_soyad: "", yakinlik: "", telefon: "" });
  const toast = useToast();
  const veliEkle = async () => {
    if (!v.ad_soyad.trim()) return;
    try { await db("addGuardian", oyuncu.id, { ...v, whatsapp_no: v.whatsapp_no || v.gsm, veli_mi: v.veli_mi ? 1 : 0, mesaj_onayi: v.mesaj_onayi ? 1 : 0 }); setV({ tip: "anne", ad_soyad: "", gsm: "", whatsapp_no: "", veli_mi: false, mesaj_onayi: true }); onDegisti(); } catch (e) { toast("err", hataMetni(e)); }
  };
  const acilEkle = async () => {
    if (!a.ad_soyad.trim()) return;
    try { await db("addEmergency", oyuncu.id, a); setA({ ad_soyad: "", yakinlik: "", telefon: "" }); onDegisti(); } catch (e) { toast("err", hataMetni(e)); }
  };
  const TIP = [{ kod: "baba", ad: "Baba" }, { kod: "anne", ad: "Anne" }, { kod: "veli", ad: "Diğer veli" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 12 }}>Aile Bilgileri</h3>
        {veliler.length === 0 ? <Bos metin="Henüz veli eklenmedi." /> : (
          <table><thead><tr><th>Yakınlık</th><th>Ad Soyad</th><th>GSM</th><th>WhatsApp</th><th>Veli</th><th title="WhatsApp ile bilgilendirme onayı (KVKK)">Mesaj onayı</th><th></th></tr></thead><tbody>
            {veliler.map((x) => { const u = hatirlatmaUygunMu({ numara: x.whatsapp_no || x.gsm, onay: x.mesaj_onayi }); return <tr key={x.id}><td>{TIP.find((t) => t.kod === x.tip)?.ad}</td><td style={{ fontWeight: 600 }}>{x.ad_soyad}</td><td>{x.gsm}</td><td>{x.whatsapp_no}</td><td>{x.veli_mi ? <Rozet ton="purple">Veli</Rozet> : ""}</td><td><input type="checkbox" checked={x.mesaj_onayi !== 0} onChange={(e) => onayDegistir(x, e.target.checked)} disabled={saltOkunur} aria-label={`${x.ad_soyad} mesaj onayı`} /></td><td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><Btn kucuk tur={u.ok ? "yesil" : "ghost"} ikon={<Ikon ad="whatsapp" boyut={16} />} disabled={!u.ok} title={u.ok ? "WhatsApp'ta mesaj yaz" : u.neden} onClick={() => onWhatsApp(x)} aria-label={`${x.ad_soyad} WhatsApp`}>WhatsApp</Btn>{!saltOkunur && <Btn kucuk tur="danger" onClick={() => onSil({ tip: "veli", id: x.id, mesaj: `${x.ad_soyad} silinsin mi?` })}>Sil</Btn>}</div></td></tr>; })}
          </tbody></table>
        )}
        {!saltOkunur && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
            <Alan etiket="Yakınlık" style={{ width: 130 }}><Secim secenekler={TIP} value={v.tip} onChange={(e) => setV({ ...v, tip: e.target.value })} /></Alan>
            <Alan etiket="Ad Soyad" style={{ flex: 1, minWidth: 160 }}><Girdi value={v.ad_soyad} onChange={(e) => setV({ ...v, ad_soyad: e.target.value })} /></Alan>
            <Alan etiket="GSM" style={{ width: 150 }}><Girdi value={v.gsm} onChange={(e) => setV({ ...v, gsm: e.target.value })} /></Alan>
            <Alan etiket="WhatsApp" style={{ width: 150 }}><Girdi value={v.whatsapp_no} onChange={(e) => setV({ ...v, whatsapp_no: e.target.value })} placeholder="GSM ile aynıysa boş" /></Alan>
            <label style={{ display: "flex", gap: 6, alignItems: "center", height: 42 }}><input type="checkbox" checked={v.veli_mi} onChange={(e) => setV({ ...v, veli_mi: e.target.checked })} /> Veli</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", height: 42 }} title="WhatsApp ile bilgilendirme onayı (KVKK)"><input type="checkbox" checked={v.mesaj_onayi} onChange={(e) => setV({ ...v, mesaj_onayi: e.target.checked })} /> Mesaj onayı</label>
            <Btn onClick={veliEkle} disabled={!v.ad_soyad.trim()}>Ekle</Btn>
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 12 }}>Acil Durumda Veli Dışında Ulaşılacak Kişiler</h3>
        {acil.length === 0 ? <Bos metin="Henüz kişi eklenmedi." /> : (
          <table><thead><tr><th>Ad Soyad</th><th>Yakınlık</th><th>Telefon</th><th></th></tr></thead><tbody>
            {acil.map((x) => <tr key={x.id}><td style={{ fontWeight: 600 }}>{x.ad_soyad}</td><td>{x.yakinlik}</td><td>{x.telefon}</td><td>{!saltOkunur && <Btn kucuk tur="danger" onClick={() => onSil({ tip: "acil", id: x.id, mesaj: `${x.ad_soyad} silinsin mi?` })}>Sil</Btn>}</td></tr>)}
          </tbody></table>
        )}
        {!saltOkunur && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
            <Alan etiket="Ad Soyad" style={{ flex: 1 }}><Girdi value={a.ad_soyad} onChange={(e) => setA({ ...a, ad_soyad: e.target.value })} /></Alan>
            <Alan etiket="Yakınlık" style={{ width: 160 }}><Girdi value={a.yakinlik} onChange={(e) => setA({ ...a, yakinlik: e.target.value })} /></Alan>
            <Alan etiket="Telefon" style={{ width: 160 }}><Girdi value={a.telefon} onChange={(e) => setA({ ...a, telefon: e.target.value })} /></Alan>
            <Btn onClick={acilEkle} disabled={!a.ad_soyad.trim()}>Ekle</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function TumunuGoster({ onClick, metin }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", fontSize: 13, color: "var(--soluk)" }}>
      <span>{metin}</span>
      <button type="button" onClick={onClick} style={{ background: "none", border: 0, color: "var(--mor)", cursor: "pointer", fontSize: 13, textDecoration: "underline", padding: 0 }}>Tümünü göster</button>
    </div>
  );
}
