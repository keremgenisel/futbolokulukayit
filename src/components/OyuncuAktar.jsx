import { useState } from "react";
import { Modal, Btn, Rozet, useToast } from "./ui.jsx";
import { aktar, hataMetni } from "../lib/api.js";
import { tarihTR, paraTR } from "../lib/aidat.js";
import { Ikon } from "./Ikon.jsx";

// Excel'den oyuncu aktarımı: 1) şablon indir 2) dosya seç → önizleme (hata/uyarı/yeni grup) 3) aktar.
export function OyuncuAktar({ onKapat, onAktarildi }) {
  const [onizleme, setOnizleme] = useState(null); // { dosya, kayitlar, hatalar, uyarilar, yeniGruplar }
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const toast = useToast();

  const sablon = async () => { try { const r = await aktar().sablon(); if (r.error) toast("err", r.error); else if (!r.iptal) toast("ok", "Şablon kaydedildi ve açıldı"); } catch (e) { toast("err", hataMetni(e)); } };
  const sec = async () => {
    setBekliyor(true);
    try { const r = await aktar().onizle(); if (r.error) toast("err", r.error); else if (!r.iptal) { setOnizleme(r); setSonuc(null); } }
    catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };
  const uygula = async () => {
    setBekliyor(true);
    try {
      const r = await aktar().uygula(onizleme.kayitlar);
      if (r.error) return toast("err", r.error);
      setSonuc(r); toast("ok", `${r.eklenen} oyuncu aktarıldı`); onAktarildi?.();
    } catch (e) { toast("err", hataMetni(e)); } finally { setBekliyor(false); }
  };
  const dosyaAdi = onizleme?.dosya ? onizleme.dosya.split(/[\\/]/).pop() : "";

  return (
    <Modal baslik="Excel'den Oyuncu Aktar" onKapat={onKapat} genislik={960}
      altBar={<>
        <Btn tur="ghost" onClick={onKapat}>{sonuc ? "Kapat" : "Vazgeç"}</Btn>
        {onizleme && !sonuc && <Btn onClick={uygula} disabled={bekliyor || onizleme.kayitlar.length === 0} ikon={<Ikon ad="yukle" />}>{onizleme.kayitlar.length} Oyuncuyu Aktar</Btn>}
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 320, color: "var(--soluk)", fontSize: 14 }}>
            İlk satır başlık olmalı: <b>Ad Soyad</b> ve <b>Doğum Tarihi</b> zorunlu; TC Kimlik No, Pasaport No, Yaş Grubu, Durum, Ücret Tipi, Aylık Aidat, Ödeme Dönemi, GSM, Veli Adı, Veli Telefonu, Okul, Adres isteğe bağlı. Şablonu indirip doldurmanız en kolayı. Tanınmayan yaş grubu adları otomatik açılır; kayıtlı TC'ler atlanır.
          </div>
          <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={sablon}>Şablon İndir</Btn>
          <Btn ikon={<Ikon ad="dosya" />} onClick={sec} disabled={bekliyor}>{onizleme ? "Başka Dosya Seç" : "Excel Dosyası Seç"}</Btn>
        </div>

        {sonuc && <div role="status" style={{ background: "var(--yesil-acik)", border: "1.5px solid var(--yesil)", borderRadius: 10, padding: "12px 16px" }}><b>{sonuc.eklenen} oyuncu aktarıldı.</b>{sonuc.yeniGrup ? ` ${sonuc.yeniGrup} yeni yaş grubu açıldı.` : ""} Bu ayın aidat kayıtları açıldı.</div>}

        {onizleme && !sonuc && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>{dosyaAdi}</span>
              <Rozet ton="green">{onizleme.kayitlar.length} aktarılacak</Rozet>
              {onizleme.uyarilar.length > 0 && <Rozet ton="yellow">{onizleme.uyarilar.length} uyarı</Rozet>}
              {onizleme.hatalar.length > 0 && <Rozet ton="red">{onizleme.hatalar.length} hatalı satır</Rozet>}
              {onizleme.yeniGruplar.length > 0 && <Rozet ton="purple">Yeni grup: {onizleme.yeniGruplar.join(", ")}</Rozet>}
            </div>
            {(onizleme.hatalar.length > 0 || onizleme.uyarilar.length > 0) && (
              <div style={{ background: "var(--sari-acik)", border: "1px solid var(--sari)", borderRadius: 10, padding: "10px 14px", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
                {onizleme.hatalar.map((h, i) => <div key={"h" + i} style={{ color: "var(--kirmizi)", fontWeight: 600 }}>Satır {h.satir}: {h.mesaj} (aktarılmayacak)</div>)}
                {onizleme.uyarilar.map((u, i) => <div key={"u" + i}>Satır {u.satir}: {u.mesaj}</div>)}
              </div>
            )}
            {onizleme.kayitlar.length === 0 ? <div style={{ color: "var(--soluk)" }}>Aktarılacak geçerli satır yok.</div> : (
              <div style={{ overflow: "auto", maxHeight: 360, border: "1px solid var(--cizgi)", borderRadius: 10 }}>
                <table><thead style={{ position: "sticky", top: 0, background: "#fff" }}><tr><th>Satır</th><th>Ad Soyad</th><th>Kimlik</th><th>Doğum</th><th>Grup</th><th>Durum</th><th>Ücret</th><th>Aidat</th><th>Veli</th></tr></thead><tbody>
                  {onizleme.kayitlar.map((k) => <tr key={k.satir}><td style={{ color: "var(--soluk)" }}>{k.satir}</td><td style={{ fontWeight: 600 }}>{k.ad_soyad}</td><td>{k.tc_no || (k.pasaport_no ? "P: " + k.pasaport_no : "—")}</td><td>{tarihTR(k.dogum_tarihi)}</td><td>{k.yeni_grup ? <Rozet ton="purple">{k.yeni_grup} (yeni)</Rozet> : (k.yas_grubu_id ? "Mevcut" : "—")}</td><td>{k.durum}</td><td>{k.ucret_tipi}</td><td>{paraTR(k.aylik_aidat)}</td><td>{k.veli ? `${k.veli.ad_soyad}${k.veli.gsm ? " · " + k.veli.gsm : ""}` : "—"}</td></tr>)}
                </tbody></table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
