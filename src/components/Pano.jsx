import { useEffect, useState } from "react";
import { Kart, Btn, Girdi, Avatar, Rozet, Telefon, useToast, useDene } from "./ui.jsx";
import { Ikon } from "./Ikon.jsx";
import { db, bugun } from "../lib/api.js";
import { AY_ADLARI, gecikmeGunu, tesiseGirebilir, paraTR, tarihTR } from "../lib/aidat.js";
import { sezonSonuMu, guncelSezon } from "../lib/sezon.js";
import { belgeGecerlilik, belgeEtiketi, uyariSirala } from "../lib/belge.js";
import { WhatsAppHatirlat } from "./WhatsAppHatirlat.jsx";
import { aidatDegerleri, hatirlatmaUygunMu } from "../lib/whatsapp.js";

const SAGLIK_KISA = 8; // panoda en acil 8 uyarı; "Tümü (n)" Oyuncular > "Sağlık raporu olmayanlar" filtresini açar (borçlular gibi)

function Stat({ etiket, deger, renk, not }) {
  return (
    <Kart style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {etiket}
      </span>
      <span className="baslik" style={{ fontSize: 40, color: renk, lineHeight: 1 }}>
        {deger}
      </span>
      <span style={{ fontSize: 13, color: "var(--soluk)" }}>{not}</span>
    </Kart>
  );
}

export function Pano({ onOyuncu, onSekme, onMakbuzKes, saltOkunur, onSezon }) {
  const [sezon, setSezon] = useState(null);
  const [saglik, setSaglik] = useState(null); // sağlık raporu uyarıları
  const [wa, setWa] = useState(null); // WhatsApp hatırlatma penceresi: { alicilar, baslik }
  const [ozet, setOzet] = useState(null);
  const [borclular, setBorclular] = useState([]);
  // WhatsApp alıcısı: listUnpaid satırından (veli id/onay/numara + bu ayki hatırlatma bilgisi) (plan §13)
  const waAlici = (b) => ({
    key: String(b.player_id),
    player_id: b.player_id,
    guardian_id: b.veli_id || null,
    oyuncu_ad: b.ad_soyad,
    veli_ad: b.veli_ad,
    grup: b.yas_grubu_ad,
    numara: b.veli_wa || b.veli_tel || "",
    onay: b.veli_onay,
    mesaj_id: null,
    hatirlatma: b.hatirlatma || 0,
    son_hatirlatma: b.son_hatirlatma,
    ek: { kalan: paraTR(b.kalan ?? b.tutar), gecikme: gecikmeGunu(b.odeme_donemi, b.yil, b.ay, new Date()) },
    degerler: aidatDegerleri(b),
  });
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const toast = useToast();
  const dene = useDene();
  const { yil, ay, iso } = bugun();

  useEffect(() => {
    dene(() => db("panoOzet", { yil, ay, bugun: iso }).then(setOzet));
    db("listUnpaid", yil, ay)
      .then(setBorclular)
      .catch(() => {});
    db("sezonDurumu")
      .then((d) => d && setSezon(d))
      .catch(() => {});
    db("saglikRaporuDurumu", iso)
      .then((d) => d && Array.isArray(d.uyarilar) && setSaglik({ ...d, uyarilar: uyariSirala(d.uyarilar) }))
      .catch(() => {});
  }, [yil, ay, iso, toast, dene]);
  const sezonUyari = sezon && sezon.aktifSezon && sezonSonuMu(sezon.aktifSezon, iso, sezon.baslangicAyi);

  useEffect(() => {
    if (!q.trim()) {
      setSonuc([]);
      return;
    }
    const t = setTimeout(
      () =>
        db("listPlayersWithDue", { q: q.trim(), yil, ay })
          .then((l) => setSonuc(l.slice(0, 6)))
          .catch(() => {}),
      150,
    );
    return () => clearTimeout(t);
  }, [q, yil, ay]);

  const gun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--soluk)" }}>{gun}</span>
        <div style={{ display: "flex", gap: 10 }}>
          {!saltOkunur && (
            <>
              <Btn tur="sari" ikon={<Ikon ad="tahsilat" />} onClick={() => onSekme("tahsilat")}>
                Makbuz Kes
              </Btn>
              <Btn ikon={<Ikon ad="arti" />} onClick={() => onSekme("oyuncular", "yeni")}>
                Yeni Oyuncu
              </Btn>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat etiket="Aktif oyuncu" deger={ozet?.aktif ?? "—"} renk="var(--mor)" not={`${ozet?.grup ?? 0} yaş grubunda`} />
        <Stat etiket="Bu ay ödeyen" deger={ozet?.odeyen ?? "—"} renk="var(--yesil)" not={`${AY_ADLARI[ay - 1]} ${yil}`} />
        <Stat etiket="Aidat borcu olan" deger={ozet?.borclu ?? "—"} renk="var(--kirmizi)" not="Tesise giremez" />
        <Stat
          etiket="Bugün antrenman"
          deger={ozet?.antrenmanlar?.length ?? "—"}
          renk="#9A7D00"
          not={(ozet?.antrenmanlar || []).map((t) => t.yas_grubu_ad).join(" · ") || "Antrenman yok"}
        />
        <Stat
          etiket="Sağlık raporu"
          deger={saglik ? saglik.uyarilar.length : "—"}
          renk={saglik && saglik.uyarilar.length ? "var(--kirmizi)" : "var(--yesil)"}
          not={
            saglik
              ? saglik.uyarilar.length
                ? `${saglik.doldu} doldu · ${saglik.dolacak} dolacak · ${saglik.yok} yok${saglik.tarihsiz ? ` · ${saglik.tarihsiz} tarihsiz` : ""}`
                : "Hepsi geçerli"
              : ""
          }
        />
      </div>
      {saglik && saglik.uyarilar.length > 0 && (
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 22 }}>
              Sağlık Raporu Uyarıları{" "}
              <span style={{ color: "var(--soluk)", fontSize: 15, fontWeight: 500 }}>({saglik.uyarilar.length})</span>
            </h3>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ color: "var(--soluk)", fontSize: 13 }}>
                Süresi dolan, 30 gün içinde dolacak ya da hiç yüklenmemiş · en acil önce
              </span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onSekme("oyuncular", "saglik");
                }}
                style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                Tümü ({saglik.uyarilar.length})
              </a>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Grup</th>
                <th>Geçerlilik</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {saglik.uyarilar.slice(0, SAGLIK_KISA).map((u) => {
                const d = u.durum === "yok" ? { durum: "yok", kalanGun: null } : belgeGecerlilik(u.gecerlilik, iso);
                return (
                  <tr key={u.player_id} onClick={() => onOyuncu(u.player_id)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 600 }}>{u.ad_soyad}</td>
                    <td>{u.yas_grubu_ad || "—"}</td>
                    <td>{u.gecerlilik ? tarihTR(u.gecerlilik) : "—"}</td>
                    <td>
                      <Rozet ton={u.durum === "dolacak" ? "yellow" : "red"}>
                        {u.durum === "yok" ? "Rapor yok" : u.durum === "tarihsiz" ? "Rapor tarihsiz" : belgeEtiketi(d)}
                      </Rozet>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Kart>
      )}
      {sezonUyari && (
        <div
          role="alert"
          style={{
            background: "var(--uyari-acik)",
            border: "1.5px solid var(--uyari)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1 }}>
            <b>{sezon.aktifSezon} sezonu bitti.</b> {guncelSezon(iso, sezon.baslangicAyi)} sezonu başladı; yenileyen oyuncuları işaretleyip
            yenilemeyenleri pasife almak için yeni sezona geçin.
          </div>
          {onSezon && (
            <Btn onClick={onSezon} ikon={<Ikon ad="takvim" />}>
              Yeni Sezona Geç
            </Btn>
          )}
        </div>
      )}
      <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 22 }}>Tesise Giriş Kontrolü</h3>
          <span style={{ fontSize: 13, color: "var(--soluk)" }}>Ad, soyad, TC veya pasaport ile ara</span>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: 15, color: "var(--soluk)" }}>
            <Ikon ad="ara" boyut={22} />
          </span>
          <Girdi
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Oyuncu adı, TC veya pasaport no yazın"
            style={{ height: 52, fontSize: 17, paddingLeft: 48 }}
            aria-label="Tesise giriş araması"
          />
        </div>
        {sonuc.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {sonuc.map((o) => {
              const ok = tesiseGirebilir(o, o.aidat_durum ? { durum: o.aidat_durum } : null);
              return (
                <div
                  key={o.id}
                  onClick={() => onOyuncu(o.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--cizgi)",
                    background: ok ? "var(--yesil-acik)" : "var(--kirmizi-acik)",
                    cursor: "pointer",
                  }}
                >
                  <Avatar ad={o.ad_soyad} boyut={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{o.ad_soyad}</div>
                    <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                      {o.yas_grubu_ad || "Grup yok"} · {o.durum} · {AY_ADLARI[ay - 1]} aidatı{" "}
                      {o.aidat_durum === "odendi"
                        ? "ödendi"
                        : o.aidat_durum === "muaf"
                          ? "muaf"
                          : o.aidat_durum === "odenmedi"
                            ? "ödenmedi"
                            : "kaydı yok"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: ok ? "var(--yesil)" : "var(--kirmizi)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ikon ad={ok ? "onay" : "kapat"} />
                    {ok ? "GİREBİLİR" : o.aidat_durum === "odenmedi" ? "AİDAT BORCU" : "GİREMEZ"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Kart>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 22 }}>Bugünkü Antrenmanlar</h3>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSekme("yoklama");
              }}
              style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              Yoklama
            </a>
          </div>
          {(ozet?.antrenmanlar || []).length === 0 ? (
            <div style={{ color: "var(--soluk)" }}>Bugün antrenman yok.</div>
          ) : (
            ozet.antrenmanlar.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--cizgi)",
                  opacity: t.iptal ? 0.6 : 1,
                }}
              >
                <span className="baslik" style={{ fontSize: 22, color: "var(--mor)", width: 64 }}>
                  {t.saat || "—"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {t.yas_grubu_ad}
                    {t.saha ? ` · ${t.saha}` : ""}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                    {t.oyuncu} oyuncu{t.isaretli ? ` · ${t.geldi} geldi` : ""}
                  </div>
                </div>
                {t.iptal ? (
                  <Rozet ton="red">İptal</Rozet>
                ) : t.isaretli >= t.oyuncu && t.oyuncu > 0 ? (
                  <Rozet ton="green">Yoklama alındı</Rozet>
                ) : t.isaretli > 0 ? (
                  <Rozet ton="yellow">Devam ediyor</Rozet>
                ) : (
                  <Rozet ton="yellow">Yoklama bekliyor</Rozet>
                )}
              </div>
            ))
          )}
        </Kart>
        <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 22 }}>{AY_ADLARI[ay - 1]} Aidatı Ödemeyenler</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {borclular.length > 0 && (
                <Btn
                  kucuk
                  tur="yesil"
                  ikon={<Ikon ad="whatsapp" boyut={16} />}
                  onClick={() =>
                    setWa({
                      baslik: "Borçlulara WhatsApp ile Hatırlat",
                      altBaslik: `${AY_ADLARI[ay - 1]} ${yil} · ${borclular.length} borçlu`,
                      alicilar: borclular.map(waAlici),
                    })
                  }
                >
                  Borçlulara Hatırlat
                </Btn>
              )}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onSekme("oyuncular", "borclu");
                }}
                style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                Tümü ({borclular.length})
              </a>
            </div>
          </div>
          {borclular.length === 0 ? (
            <div style={{ color: "var(--soluk)" }}>Borçlu oyuncu yok.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Oyuncu</th>
                  <th>Grup</th>
                  <th>Veli telefonu</th>
                  <th>Ödeme dönemi</th>
                  <th>Gecikme</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {borclular.slice(0, 8).map((b) => {
                  const g = gecikmeGunu(b.odeme_donemi, b.yil, b.ay, new Date());
                  return (
                    <tr key={b.id} onClick={() => onOyuncu(b.player_id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600 }}>{b.ad_soyad}</td>
                      <td>{b.yas_grubu_ad || "—"}</td>
                      <td>
                        <Telefon no={b.veli_tel} etiket={b.veli_ad} />
                      </td>
                      <td>{b.odeme_donemi}</td>
                      <td style={{ color: g > 0 ? "var(--kirmizi)" : "var(--soluk)" }}>
                        {g > 0 ? `${g} gün` : "—"}
                        {b.durum === "kismi" && <span style={{ display: "block", fontSize: 12 }}>kalan {paraTR(b.kalan)}</span>}
                        {b.hatirlatma > 0 && (
                          <span style={{ display: "block", fontSize: 12, color: "var(--soluk)" }}>
                            hatırlatıldı {tarihTR(String(b.son_hatirlatma).slice(0, 10))}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {(() => {
                            const u = hatirlatmaUygunMu({ numara: b.veli_wa || b.veli_tel, onay: b.veli_onay });
                            return (
                              <Btn
                                kucuk
                                tur="ghost"
                                ikon={<Ikon ad="whatsapp" boyut={16} />}
                                disabled={!u.ok}
                                title={u.ok ? "WhatsApp ile aidat hatırlat" : u.neden}
                                aria-label={`${b.ad_soyad} WhatsApp`}
                                style={{ color: u.ok ? "var(--yesil)" : undefined, padding: "0 8px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWa({
                                    baslik: "WhatsApp ile Aidat Hatırlat",
                                    altBaslik: `${AY_ADLARI[ay - 1]} ${yil}`,
                                    alicilar: [waAlici(b)],
                                  });
                                }}
                              />
                            );
                          })()}
                          {!saltOkunur && (
                            <Btn
                              kucuk
                              tur="sari"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMakbuzKes(b.player_id);
                              }}
                            >
                              Makbuz
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Kart>
      </div>
      {wa && (
        <WhatsAppHatirlat
          tur="aidat"
          baslik={wa.baslik}
          altBaslik={wa.altBaslik}
          alicilar={wa.alicilar}
          kayit={{ yil, ay }}
          saltOkunur={saltOkunur}
          onKapat={() => {
            setWa(null);
            db("listUnpaid", yil, ay)
              .then(setBorclular)
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
