// Tahsilat › Kesilen Makbuzlar sekmesi (13.09.2026): tüm makbuzlar sezon / tarih aralığı / oyuncu adı-makbuz no / iptal dahil
// süzgeçleriyle, sayfalı (50). İşlemler: Yazdır, İptal (nedenli; mevcut kalıp), oyuncu kartı. Makbuz SİLİNMEZ (mali belge: numara
// sırası ve tahsilat raporu bozulmasın); yanlış kayıt için iptal, oyuncuyu kaldırmak için oyuncu kartındaki "Sil" (kişisel veri silme).
import { useCallback, useEffect, useState } from "react";
import { Kart, Btn, Rozet, Girdi, Secim, Bos, Sayfalama, useDene } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { db } from "../../lib/api.js";
import { ODEME_YONTEMLERI, paraTR, tarihTR } from "../../lib/aidat.js";

const SAYFA_BOYU = 50;

export function KesilenMakbuzlar({ saltOkunur, aktifSezon, yenileKey = 0, onYazdir, onIptal, onOyuncu }) {
  const [sezon, setSezon] = useState(aktifSezon || "");
  const [sezonlar, setSezonlar] = useState([]);
  const [bas, setBas] = useState("");
  const [son, setSon] = useState("");
  const [q, setQ] = useState("");
  const [iptalDahil, setIptalDahil] = useState(false);
  const [sayfa, setSayfa] = useState(1);
  const [veri, setVeri] = useState({ liste: [], toplam: 0, toplamTutar: 0 });
  const dene = useDene();

  useEffect(() => {
    if (aktifSezon && !sezon) setSezon(aktifSezon);
  }, [aktifSezon]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    db("sezonListesi")
      .then((l) => Array.isArray(l) && setSezonlar(l))
      .catch(() => {});
  }, []);
  const yukle = useCallback(
    () =>
      dene(async () => {
        const r = await db("makbuzListesi", {
          sezon: sezon || null,
          bas: bas || null,
          son: son || null,
          q,
          iptalDahil,
          sayfa,
          sayfaBoyu: SAYFA_BOYU,
        });
        setVeri(r);
        if (r.sayfa !== sayfa) setSayfa(r.sayfa);
      }),
    [sezon, bas, son, q, iptalDahil, sayfa], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    setSayfa(1);
  }, [sezon, bas, son, q, iptalDahil]);
  useEffect(() => {
    const t = setTimeout(yukle, 150);
    return () => clearTimeout(t);
  }, [yukle, yenileKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Kart style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Secim
          secenekler={[...new Set([aktifSezon, ...sezonlar])]
            .filter(Boolean)
            .map((s) => ({ kod: s, ad: s === aktifSezon ? `${s} (aktif sezon)` : s }))}
          bos="Tüm sezonlar"
          value={sezon}
          onChange={(e) => setSezon(e.target.value)}
          aria-label="Makbuz sezonu"
          style={{ width: 200 }}
        />
        <Girdi type="date" value={bas} onChange={(e) => setBas(e.target.value)} aria-label="Makbuz başlangıç" style={{ width: 160 }} />
        <Girdi type="date" value={son} onChange={(e) => setSon(e.target.value)} aria-label="Makbuz bitiş" style={{ width: 160 }} />
        <Girdi
          placeholder="Oyuncu adı ya da makbuz no"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Makbuz ara"
          style={{ width: 240 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={iptalDahil}
            onChange={(e) => setIptalDahil(e.target.checked)}
            aria-label="İptal edilenleri de göster"
          />
          İptal edilenleri de göster
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 14, color: "var(--soluk)" }} data-testid="makbuz-sayac">
          {veri.toplam} makbuz · {paraTR(veri.toplamTutar || 0)}
        </span>
      </Kart>
      <Kart style={{ overflow: "hidden" }}>
        {veri.liste.length === 0 ? (
          <Bos metin="Bu süzgeçte makbuz yok." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tarih</th>
                <th>Oyuncu</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Tahsil eden</th>
                <th>Durum</th>
                <th style={{ width: 260 }}></th>
              </tr>
            </thead>
            <tbody>
              {veri.liste.map((m) => (
                <tr key={m.id} style={{ opacity: m.iptal ? 0.6 : 1 }}>
                  <td className="tek-satir">{m.makbuz_no}</td>
                  <td className="tek-satir">{tarihTR(m.tarih)}</td>
                  <td className="tek-satir">
                    <button
                      type="button"
                      onClick={() => onOyuncu?.(m.player_id)}
                      title="Oyuncu kartını aç"
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        font: "inherit",
                        fontWeight: 600,
                        color: "var(--mor)",
                        cursor: "pointer",
                      }}
                    >
                      {m.ad_soyad}
                    </button>
                  </td>
                  <td className="tek-satir">{paraTR(m.toplam)}</td>
                  <td>{ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad || m.odeme_yontemi}</td>
                  <td>{m.tahsil_eden || "—"}</td>
                  <td>
                    {m.iptal ? (
                      <Rozet ton="red" title={`${m.iptal_nedeni || ""}${m.iptal_eden ? " · " + m.iptal_eden : ""}`}>
                        İptal{m.iptal_nedeni ? `: ${m.iptal_nedeni}` : ""}
                      </Rozet>
                    ) : (
                      <Rozet ton="green">Geçerli</Rozet>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn kucuk tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={() => onYazdir(m.id)}>
                        Yazdır
                      </Btn>
                      {!saltOkunur && !m.iptal && (
                        <Btn kucuk tur="danger" onClick={() => onIptal(m)}>
                          İptal
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Sayfalama sayfa={sayfa} toplam={veri.toplam} sayfaBoyu={SAYFA_BOYU} onSayfa={setSayfa} birim="makbuz" />
      </Kart>
    </div>
  );
}
