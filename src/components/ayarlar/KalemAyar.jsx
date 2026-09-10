// Ayarlar > Aidat Kalemleri (kalemler + ücret tipleri, tek Kaydet)
import { useEffect, useState, useCallback } from "react";
import { Btn, Girdi, ParaGirdi, Rozet, useToast, useDene } from "../ui.jsx";
import { db } from "../../lib/api.js";
import { paraTR, UCRET_TIPLERI, SABIT_INDIRIM, indirimYuzdesi, aidatHesapla } from "../../lib/aidat.js";
import { ucretTipleriYenile } from "../../lib/ucretTipleri.js";
import { Ikon } from "../Ikon.jsx";

// Aidat kalemleri + ücret tipi indirimleri: değişiklikler ekranda birikir, TEK Kaydet ile tek işlemde yazılır.

// (Satır başına Kaydet, kaydetme sonrası yenilemede diğer satırların girdisini siliyordu.)

export function KalemAyar({ saltOkunur, onKirli }) {
  // Kayıtlı listeler + ekranda biriken değişiklikler (düzenleme / yeni / silme); tek Kaydet tek işlemde yazar.
  const [kalemler, setKalemler] = useState([]); // kayıtlı kalemler
  const [taslak, setTaslak] = useState({}); // id → düzenlenen satır
  const [yeniKalemler, setYeniKalemler] = useState([]); // [{ tmp, ad, varsayilan_fiyat }]
  const [silKalem, setSilKalem] = useState(new Set()); // silinecek id'ler
  const [yeniKalem, setYeniKalem] = useState({ ad: "", fiyat: "" });
  const [tipler, setTipler] = useState(null); // kayıtlı ücret tipleri
  const [tipTaslak, setTipTaslak] = useState({}); // kod → { ad, indirim (metin), aktif }
  const [yeniTipler, setYeniTipler] = useState([]); // [{ tmp, ad, indirim }]
  const [silTip, setSilTip] = useState(new Set());
  const [yeniTip, setYeniTip] = useState({ ad: "", indirim: "0" });
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const dene = useDene();

  const tipSatiri = (t) => ({ ad: t.ad, indirim: String(indirimYuzdesi(t.kod, t.indirim)), aktif: t.aktif !== 0 });
  const yukle = useCallback(async () => {
    return dene(async () => {
      const l = await db("listFeeItems");
      const a = await db("aidatAyarlari");
      // Eski sürüm / test: ucretTipleri yoksa varsayılan tiplerden kur
      const tl = a.ucretTipleri?.length
        ? a.ucretTipleri
        : UCRET_TIPLERI.map((t) => ({
            ...t,
            indirim: indirimYuzdesi(t.kod, a.indirimler?.[t.kod]),
            aktif: 1,
            sabit: SABIT_INDIRIM.has(t.kod) ? 1 : 0,
          }));
      setKalemler(l);
      setTaslak(Object.fromEntries(l.map((k) => [k.id, { ...k }])));
      setYeniKalemler([]);
      setSilKalem(new Set());
      setTipler(tl);
      setTipTaslak(Object.fromEntries(tl.map((t) => [t.kod, tipSatiri(t)])));
      setYeniTipler([]);
      setSilTip(new Set());
    });
  }, [dene]);
  useEffect(() => {
    yukle();
  }, [yukle]);

  const satirDegisti = (k) => {
    const t = taslak[k.id];
    return (
      !!t && !silKalem.has(k.id) && (t.ad !== k.ad || Number(t.varsayilan_fiyat) !== Number(k.varsayilan_fiyat) || !!t.aktif !== !!k.aktif)
    );
  };
  const tipDegisti = (t) => {
    const d = tipTaslak[t.kod];
    if (!d || silTip.has(t.kod)) return false;
    const k = tipSatiri(t);
    return d.ad !== k.ad || d.indirim !== k.indirim || d.aktif !== k.aktif;
  };
  const degisenKalemler = kalemler.filter(satirDegisti);
  const degisenTipler = (tipler || []).filter(tipDegisti);
  const degisiklik = degisenKalemler.length + yeniKalemler.length + silKalem.size + degisenTipler.length + yeniTipler.length + silTip.size;
  useEffect(() => {
    onKirli?.(degisiklik > 0);
  }, [degisiklik]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onKirli?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const duzenle = (id, alan, deger) => setTaslak({ ...taslak, [id]: { ...taslak[id], [alan]: deger } });
  const tipDuzenle = (kod, alan, deger) => setTipTaslak({ ...tipTaslak, [kod]: { ...tipTaslak[kod], [alan]: deger } });
  const kumeToggle = (kume, setKume, anahtar) => {
    const n = new Set(kume);
    if (n.has(anahtar)) n.delete(anahtar);
    else n.add(anahtar);
    setKume(n);
  };
  const kalemEkle = () => {
    const ad = yeniKalem.ad.trim();
    if (!ad) return toast("err", "Kalem adı boş olamaz");
    setYeniKalemler([...yeniKalemler, { tmp: Date.now(), ad, varsayilan_fiyat: Number(yeniKalem.fiyat) || 0 }]);
    setYeniKalem({ ad: "", fiyat: "" });
  };
  const tipEkle = () => {
    const ad = yeniTip.ad.trim();
    if (!ad) return toast("err", "Ücret tipi adı boş olamaz");
    setYeniTipler([...yeniTipler, { tmp: Date.now(), ad, indirim: Math.min(100, Math.max(0, Number(yeniTip.indirim) || 0)) }]);
    setYeniTip({ ad: "", indirim: "0" });
  };
  const vazgec = () => {
    setTaslak(Object.fromEntries(kalemler.map((k) => [k.id, { ...k }])));
    setYeniKalemler([]);
    setSilKalem(new Set());
    setTipTaslak(Object.fromEntries((tipler || []).map((t) => [t.kod, tipSatiri(t)])));
    setYeniTipler([]);
    setSilTip(new Set());
  };
  const kaydet = async () => {
    setBekliyor(true);
    return dene(
      async () => {
        const r = await db("aidatAyarlariKaydet", {
          kalemler: [
            ...degisenKalemler.map((k) => {
              const t = taslak[k.id];
              return { id: k.id, ad: t.ad, varsayilan_fiyat: Number(t.varsayilan_fiyat) || 0, aktif: t.aktif ? 1 : 0 };
            }),
            ...yeniKalemler.map((k) => ({ yeni: true, ad: k.ad, varsayilan_fiyat: k.varsayilan_fiyat })),
            ...[...silKalem].map((id) => ({ id, sil: true })),
          ],
          ucretTipleri: [
            ...degisenTipler.map((t) => {
              const d = tipTaslak[t.kod];
              return { kod: t.kod, ad: d.ad, indirim: indirimYuzdesi(t.kod, d.indirim), aktif: d.aktif ? 1 : 0 };
            }),
            ...yeniTipler.map((t) => ({ yeni: true, ad: t.ad, indirim: t.indirim })),
            ...[...silTip].map((kod) => ({ kod, sil: true })),
          ],
        });
        if (r?.error) return toast("err", r.error);
        toast("ok", `${degisiklik} değişiklik kaydedildi`);
        ucretTipleriYenile();
        await yukle();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };

  const taban = Number(taslak[kalemler.find((k) => k.kod === "aidat")?.id]?.varsayilan_fiyat) || 0;
  const silStil = { opacity: 0.55, textDecoration: "line-through" };
  const baglanti = {
    background: "none",
    border: 0,
    padding: 0,
    color: "var(--mor)",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22 }}>Aidat Kalemleri ve Varsayılan Fiyatlar</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
        Aidat satırındaki fiyat aylık aidatın taban fiyatıdır; oyuncu kaydında ücret tipine göre indirim düşülerek gelir. Diğer kalemlerin
        fiyatı makbuz keserken gelir, makbuzda değiştirilebilir. Makbuzda kullanılmış kalem silinemez, pasife alınır. Değişiklikler alttaki
        Kaydet ile birlikte kaydedilir.
      </p>
      <table>
        <thead>
          <tr>
            <th>Kalem</th>
            <th>Fiyat (₺)</th>
            <th>Aktif</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {kalemler.map((k) => {
            const t = taslak[k.id] || k;
            const d = satirDegisti(k);
            const sil = silKalem.has(k.id);
            return (
              <tr key={k.id} style={{ background: d ? "var(--uyari-acik)" : sil ? "var(--kirmizi-acik, #fdecec)" : undefined }}>
                <td style={sil ? silStil : undefined}>
                  {k.kod === "aidat" ? (
                    <b>{k.ad}</b>
                  ) : (
                    <Girdi
                      value={t.ad}
                      onChange={(e) => duzenle(k.id, "ad", e.target.value)}
                      disabled={saltOkunur || sil}
                      aria-label={`${k.ad} adı`}
                      style={{ height: 36, width: 240 }}
                    />
                  )}
                </td>
                <td>
                  <ParaGirdi
                    value={t.varsayilan_fiyat}
                    onDegis={(v) => duzenle(k.id, "varsayilan_fiyat", v)}
                    disabled={saltOkunur || sil}
                    aria-label={`${k.ad} fiyatı`}
                    style={{ height: 36, width: 140 }}
                  />
                </td>
                <td>
                  {k.kod === "aidat" ? (
                    <Rozet ton="green">Aktif</Rozet>
                  ) : (
                    <input
                      type="checkbox"
                      checked={!!t.aktif}
                      onChange={(e) => duzenle(k.id, "aktif", e.target.checked)}
                      disabled={saltOkunur || sil}
                      aria-label={`${k.ad} aktif`}
                    />
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {k.kod !== "aidat" &&
                    !saltOkunur &&
                    (sil ? (
                      <button type="button" style={baglanti} onClick={() => kumeToggle(silKalem, setSilKalem, k.id)}>
                        Geri al
                      </button>
                    ) : (
                      <Btn tur="danger" kucuk onClick={() => kumeToggle(silKalem, setSilKalem, k.id)} aria-label={`${k.ad} sil`}>
                        Sil
                      </Btn>
                    ))}
                </td>
              </tr>
            );
          })}
          {yeniKalemler.map((k) => (
            <tr key={"y" + k.tmp} style={{ background: "var(--uyari-acik)" }}>
              <td>
                <b>{k.ad}</b> <Rozet ton="yellow">Yeni</Rozet>
              </td>
              <td>{paraTR(k.varsayilan_fiyat)}</td>
              <td>
                <Rozet ton="green">Aktif</Rozet>
              </td>
              <td style={{ textAlign: "right" }}>
                <button type="button" style={baglanti} onClick={() => setYeniKalemler(yeniKalemler.filter((x) => x.tmp !== k.tmp))}>
                  Kaldır
                </button>
              </td>
            </tr>
          ))}
          {!saltOkunur && (
            <tr>
              <td>
                <Girdi
                  value={yeniKalem.ad}
                  onChange={(e) => setYeniKalem({ ...yeniKalem, ad: e.target.value })}
                  placeholder="Yeni kalem adı"
                  aria-label="Yeni kalem adı"
                  style={{ height: 36, width: 240 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      kalemEkle();
                    }
                  }}
                />
              </td>
              <td>
                <ParaGirdi
                  value={yeniKalem.fiyat}
                  onDegis={(v) => setYeniKalem({ ...yeniKalem, fiyat: v })}
                  aria-label="Yeni kalem fiyatı"
                  style={{ height: 36, width: 140 }}
                />
              </td>
              <td></td>
              <td style={{ textAlign: "right" }}>
                <Btn tur="ghost" kucuk ikon={<Ikon ad="arti" />} onClick={kalemEkle}>
                  Kalem Ekle
                </Btn>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {tipler && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          <h3 style={{ fontSize: 22 }}>Ücret Tipleri ve İndirimler</h3>
          <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>
            Yeni oyuncu kaydında ücret tipi seçilince aylık aidat şöyle hesaplanır: taban fiyat − indirim yüzdesi. Tutar oyuncu kartında
            elle değiştirilebilir. %100 indirim aidattan muaf demektir. Normal ve Ücretsiz sabittir; oyuncusu olan tip silinemez, pasife
            alınır.
          </p>
          <table>
            <thead>
              <tr>
                <th>Ücret tipi</th>
                <th>İndirim (%)</th>
                <th>Hesaplanan aylık aidat</th>
                <th>Aktif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tipler.map((t) => {
                const sabit = !!t.sabit || SABIT_INDIRIM.has(t.kod);
                const d = tipTaslak[t.kod] || tipSatiri(t);
                const sil = silTip.has(t.kod);
                const hesap = aidatHesapla(taban, t.kod, { [t.kod]: d.indirim });
                return (
                  <tr
                    key={t.kod}
                    style={{ background: tipDegisti(t) ? "var(--uyari-acik)" : sil ? "var(--kirmizi-acik, #fdecec)" : undefined }}
                  >
                    <td style={sil ? silStil : undefined}>
                      <Girdi
                        value={d.ad}
                        onChange={(e) => tipDuzenle(t.kod, "ad", e.target.value)}
                        disabled={saltOkunur || sil}
                        aria-label={`${t.ad} adı`}
                        style={{ height: 36, width: 220, fontWeight: 600 }}
                      />
                    </td>
                    <td>
                      {sabit ? (
                        <span style={{ color: "var(--soluk)" }}>%{d.indirim}</span>
                      ) : (
                        <Girdi
                          type="number"
                          min="0"
                          max="100"
                          value={d.indirim}
                          onChange={(e) => tipDuzenle(t.kod, "indirim", e.target.value)}
                          disabled={saltOkunur || sil}
                          aria-label={`${t.ad} indirimi`}
                          style={{ height: 36, width: 110 }}
                        />
                      )}
                    </td>
                    <td>{hesap === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(hesap)}</b>}</td>
                    <td>
                      {sabit ? (
                        <Rozet ton="green">Aktif</Rozet>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!d.aktif}
                          onChange={(e) => tipDuzenle(t.kod, "aktif", e.target.checked)}
                          disabled={saltOkunur || sil}
                          aria-label={`${t.ad} aktif`}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {!sabit &&
                        !saltOkunur &&
                        (sil ? (
                          <button type="button" style={baglanti} onClick={() => kumeToggle(silTip, setSilTip, t.kod)}>
                            Geri al
                          </button>
                        ) : (
                          <Btn tur="danger" kucuk onClick={() => kumeToggle(silTip, setSilTip, t.kod)} aria-label={`${t.ad} sil`}>
                            Sil
                          </Btn>
                        ))}
                    </td>
                  </tr>
                );
              })}
              {yeniTipler.map((t) => {
                const hesap = aidatHesapla(taban, "yeni", { yeni: t.indirim });
                return (
                  <tr key={"y" + t.tmp} style={{ background: "var(--uyari-acik)" }}>
                    <td>
                      <b>{t.ad}</b> <Rozet ton="yellow">Yeni</Rozet>
                    </td>
                    <td>%{t.indirim}</td>
                    <td>{hesap === 0 ? <Rozet ton="gray">Muaf</Rozet> : <b>{paraTR(hesap)}</b>}</td>
                    <td>
                      <Rozet ton="green">Aktif</Rozet>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" style={baglanti} onClick={() => setYeniTipler(yeniTipler.filter((x) => x.tmp !== t.tmp))}>
                        Kaldır
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!saltOkunur && (
                <tr>
                  <td>
                    <Girdi
                      value={yeniTip.ad}
                      onChange={(e) => setYeniTip({ ...yeniTip, ad: e.target.value })}
                      placeholder="Yeni ücret tipi adı"
                      aria-label="Yeni ücret tipi adı"
                      style={{ height: 36, width: 220 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          tipEkle();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <Girdi
                      type="number"
                      min="0"
                      max="100"
                      value={yeniTip.indirim}
                      onChange={(e) => setYeniTip({ ...yeniTip, indirim: e.target.value })}
                      aria-label="Yeni ücret tipi indirimi"
                      style={{ height: 36, width: 110 }}
                    />
                  </td>
                  <td colSpan={2}></td>
                  <td style={{ textAlign: "right" }}>
                    <Btn tur="ghost" kucuk ikon={<Ikon ad="arti" />} onClick={tipEkle}>
                      Ücret Tipi Ekle
                    </Btn>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!saltOkunur && degisiklik > 0 && (
        <div
          role="status"
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "#fff",
            border: "1px solid var(--uyari)",
            borderRadius: 10,
            boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
          }}
        >
          <span style={{ flex: 1, fontWeight: 600 }}>{degisiklik} değişiklik kaydedilmedi</span>
          <Btn tur="ghost" onClick={vazgec} disabled={bekliyor}>
            Vazgeç
          </Btn>
          <Btn onClick={kaydet} disabled={bekliyor}>
            Kaydet
          </Btn>
        </div>
      )}
    </div>
  );
}
