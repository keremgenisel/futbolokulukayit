import { useEffect, useMemo, useState } from "react";
import { Modal, Btn, Rozet, useToast, useDene } from "./ui.jsx";
import { db, uygulama } from "../lib/api.js";
import { Ikon } from "./Ikon.jsx";
import { tarihTR } from "../lib/aidat.js";
import {
  SABLON_ANAHTARLARI,
  VARSAYILAN_SABLONLAR,
  VARSAYILAN_KULUP,
  sablonDoldur,
  hatirlatmaUygunMu,
  grupDegerleri,
} from "../lib/whatsapp.js";

/** Şablon + kulüp adı (ayarlardan; boşsa varsayılan). Bileşen dışında da kullanılır (Ayarlar önizlemesi). */
export async function sablonOku(tur) {
  const [s, k] = await Promise.all([db("getSetting", SABLON_ANAHTARLARI[tur]), db("getSetting", "kulup_adi")]);
  return { sablon: s || VARSAYILAN_SABLONLAR[tur], kulup: k || VARSAYILAN_KULUP };
}

/**
 * WhatsApp "tıkla ve yaz" toplu penceresi (plan §13). API yok: her satır için bağlantı açılır, kullanıcı Gönder'e basar.
 * alicilar: [{ key, player_id, guardian_id, oyuncu_ad, veli_ad, grup, numara, onay, mesaj_id, hatirlatma, son_hatirlatma, ek, degerler }]
 * degerler: şablon yer tutucuları (aidatDegerleri / antrenmanDegerleri); kulup burada eklenir.
 * kayit: { yil, ay, training_id } — message_log'a yazılacak dönem/antrenman.
 * grup: { ad, training_id, gonderildi } — verilirse üstte "veli WhatsApp grubuna tek mesaj" bloğu (iptal/değişiklik; plan §13.7).
 */
export function WhatsAppHatirlat({ baslik, altBaslik, tur, alicilar, kayit = {}, grup, saltOkunur, onKapat, onDegisti, duzenlenebilir }) {
  const [grupGonderildi, setGrupGonderildi] = useState(() => !!grup?.gonderildi);
  const [ayar, setAyar] = useState(null);
  const [durum, setDurum] = useState(() => Object.fromEntries(alicilar.map((a) => [a.key, a.mesaj_id || null]))); // key → mesaj_id
  const [secili, setSecili] = useState(() => alicilar.find((a) => !a.mesaj_id && hatirlatmaUygunMu(a).ok)?.key ?? alicilar[0]?.key ?? null);
  const [metinDuzen, setMetinDuzen] = useState(null); // düzenlenebilir modda kullanıcının metni
  const [bekliyor, setBekliyor] = useState(false);
  const toast = useToast();
  const dene = useDene();
  useEffect(() => {
    dene(() => sablonOku(tur).then(setAyar));
  }, [tur]); // eslint-disable-line react-hooks/exhaustive-deps

  const satir = (a) => ({ ...a, uygun: hatirlatmaUygunMu(a), mesaj_id: durum[a.key] });
  const satirlar = useMemo(() => alicilar.map(satir), [alicilar, durum]); // eslint-disable-line react-hooks/exhaustive-deps
  const uygunlar = satirlar.filter((s) => s.uygun.ok);
  const yapilan = uygunlar.filter((s) => s.mesaj_id).length;
  const engelli = satirlar.length - uygunlar.length;
  const seciliSatir = satirlar.find((s) => s.key === secili) || null;
  const metin = (a) =>
    duzenlenebilir && metinDuzen !== null ? metinDuzen : sablonDoldur(ayar?.sablon || "", { ...a.degerler, kulup: ayar?.kulup });
  const siradaki = uygunlar.find((s) => !s.mesaj_id) || null;

  const ac = async (a) => {
    if (!ayar) return;
    setBekliyor(true);
    return dene(
      async () => {
        const m = metin(a);
        const r = await uygulama().whatsappAc(a.uygun.numara, m);
        if (r?.error) return toast("err", r.error);
        if (!saltOkunur) {
          const k = await db("mesajKaydet", {
            player_id: a.player_id,
            guardian_id: a.guardian_id || null,
            tur,
            yil: kayit.yil ?? null,
            ay: kayit.ay ?? null,
            training_id: kayit.training_id ?? null,
            metin: m,
          });
          setDurum((d) => ({ ...d, [a.key]: k.id }));
          onDegisti?.();
        } else setDurum((d) => ({ ...d, [a.key]: -1 })); // salt okunurda kayıt yok, ekranda işaretli kalsın
        const sonraki = uygunlar.find((s) => s.key !== a.key && !s.mesaj_id && !durum[s.key]);
        if (sonraki) setSecili(sonraki.key);
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  const geriAl = (a) =>
    dene(async () => {
      if (a.mesaj_id > 0) await db("mesajSil", a.mesaj_id);
      setDurum((d) => ({ ...d, [a.key]: null }));
      setSecili(a.key);
      onDegisti?.();
    });
  // Veli grubuna tek mesaj: numarasız bağlantı WhatsApp'ta "sohbet seç" ekranını metin hazır açar; kullanıcı grubu seçer.
  const grupMetni = () => sablonDoldur(ayar?.sablon || "", grupDegerleri({ ...(alicilar[0]?.degerler || {}), kulup: ayar?.kulup }));
  const grubaGonder = async () => {
    if (!ayar) return;
    setBekliyor(true);
    return dene(
      async () => {
        const r = await uygulama().whatsappAc("", grupMetni());
        if (r?.error) return toast("err", r.error);
        if (!saltOkunur && grup?.training_id) await db("grupBildirimKaydet", grup.training_id);
        setGrupGonderildi(true);
        onDegisti?.();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  const grupGeriAl = () =>
    dene(async () => {
      if (!saltOkunur && grup?.training_id) await db("grupBildirimSil", grup.training_id);
      setGrupGonderildi(false);
      onDegisti?.();
    });
  const TUR_ETIKET = { aidat: "hatırlatıldı", genel: "gönderildi", iptal: "bildirildi", degisiklik: "bildirildi" };
  const etiket = TUR_ETIKET[tur] || "açıldı";
  const Etiket = etiket.charAt(0).toLocaleUpperCase("tr-TR") + etiket.slice(1);

  return (
    <Modal
      onKapat={onKapat}
      genislik={1120}
      yukseklik="min(760px, 92vh)"
      ust={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            background: "var(--mor)",
            color: "#fff",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span className="baslik" style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>
              {baslik}
            </span>
            {altBaslik && <span style={{ color: "#D8CCE9", fontSize: 14 }}>{altBaslik}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {uygunlar.length > 1 && (
              <span
                data-testid="wa-sayac"
                style={{
                  background: "var(--sari)",
                  color: "var(--mor-koyu)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "6px 12px",
                  borderRadius: 999,
                }}
              >
                {yapilan} / {uygunlar.length} {etiket}
              </span>
            )}
            <button
              type="button"
              onClick={onKapat}
              aria-label="Pencereyi kapat"
              style={{ background: "none", border: 0, color: "#D8CCE9", fontSize: 22, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        </div>
      }
      altBar={
        <>
          <span style={{ flex: 1, alignSelf: "center", color: "var(--soluk)", fontSize: 13 }}>
            {engelli > 0
              ? `${engelli} veliye açılamaz: ${
                  satirlar
                    .filter((s) => !s.uygun.ok)
                    .map((s) => s.uygun.neden)
                    .reduce((m, n) => ({ ...m, [n]: (m[n] || 0) + 1 }), {}) &&
                  Object.entries(
                    satirlar.filter((s) => !s.uygun.ok).reduce((m, s) => ({ ...m, [s.uygun.neden]: (m[s.uygun.neden] || 0) + 1 }), {}),
                  )
                    .map(([n, c]) => `${c} ${n.toLocaleLowerCase("tr-TR")}`)
                    .join(", ")
                }`
              : ""}
          </span>
          <Btn tur="ghost" onClick={onKapat}>
            Kapat
          </Btn>
          {siradaki && (
            <Btn tur="yesil" ikon={<Ikon ad="whatsapp" />} onClick={() => ac(siradaki)} disabled={bekliyor || !ayar}>
              {uygunlar.length > 1 ? "Sıradakini Aç" : "WhatsApp'ta Aç"}
            </Btn>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
        {grup && ayar && (
          <div
            data-testid="wa-grup"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 16px",
              borderRadius: 10,
              border: `1px solid ${grupGonderildi ? "var(--yesil)" : "var(--sari)"}`,
              background: grupGonderildi ? "#EAF7EE" : "var(--sari-acik)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Toplu: {grup.ad} veli WhatsApp grubuna tek mesaj</div>
              <div style={{ fontSize: 13, color: "var(--soluk)" }}>
                {grupGonderildi
                  ? "Gruba gönderildi olarak işaretlendi. Ulaşmayan veliler için aşağıdan tek tek açabilirsiniz."
                  : "WhatsApp'ta sohbet seçme ekranı metin hazır açılır; grubu seçip Gönder'e basın. Gruba üye olmayan veliler için aşağıdaki tek tek liste kullanılır."}
              </div>
            </div>
            {grupGonderildi ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Rozet ton="green">Gruba gönderildi</Rozet>
                {!saltOkunur && (
                  <button
                    type="button"
                    onClick={grupGeriAl}
                    aria-label="Grup gönderimini geri al"
                    style={{
                      background: "none",
                      border: 0,
                      color: "var(--soluk)",
                      cursor: "pointer",
                      fontSize: 12.5,
                      textDecoration: "underline",
                    }}
                  >
                    Geri al
                  </button>
                )}
              </span>
            ) : (
              <Btn tur="yesil" ikon={<Ikon ad="whatsapp" />} onClick={grubaGonder} disabled={bekliyor}>
                Veli Grubuna Gönder
              </Btn>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 20, minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Veli · Oyuncu</th>
                  <th>Numara</th>
                  {tur === "aidat" && <th>Kalan</th>}
                  {tur === "aidat" && <th>Gecikme</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr
                    key={s.key}
                    onClick={() => setSecili(s.key)}
                    style={{
                      cursor: "pointer",
                      opacity: s.uygun.ok ? 1 : 0.6,
                      background: secili === s.key ? "var(--mor-acik)" : undefined,
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.veli_ad || "Veli yok"}</div>
                      <div style={{ fontSize: 12.5, color: "var(--soluk)" }}>
                        {s.oyuncu_ad}
                        {s.grup ? ` · ${s.grup}` : ""}
                      </div>
                      {!s.uygun.ok && <div style={{ fontSize: 12, color: "var(--kirmizi)" }}>{s.uygun.neden}</div>}
                      {s.uygun.ok && s.hatirlatma > 0 && !s.mesaj_id && (
                        <div style={{ fontSize: 12, color: "var(--kirmizi)" }}>bu ay {s.hatirlatma + 1}. kez</div>
                      )}
                    </td>
                    <td>{s.numara || "—"}</td>
                    {tur === "aidat" && <td style={{ fontWeight: 700 }}>{s.ek?.kalan}</td>}
                    {tur === "aidat" && (
                      <td style={{ color: s.ek?.gecikme > 0 ? "var(--kirmizi)" : "var(--soluk)" }}>
                        {s.ek?.gecikme > 0 ? `${s.ek.gecikme} gün` : "—"}
                      </td>
                    )}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {s.mesaj_id ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Rozet ton="green">{Etiket}</Rozet>
                          {s.mesaj_id > 0 && !saltOkunur && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                geriAl(s);
                              }}
                              style={{
                                background: "none",
                                border: 0,
                                color: "var(--soluk)",
                                cursor: "pointer",
                                fontSize: 12.5,
                                textDecoration: "underline",
                              }}
                            >
                              Geri al
                            </button>
                          )}
                        </span>
                      ) : (
                        <Btn
                          kucuk
                          tur={s.uygun.ok ? "yesil" : "ghost"}
                          ikon={<Ikon ad="whatsapp" boyut={16} />}
                          disabled={!s.uygun.ok || bekliyor || !ayar}
                          onClick={(e) => {
                            e.stopPropagation();
                            ac(s);
                          }}
                          aria-label={`${s.veli_ad || s.oyuncu_ad} WhatsApp'ta aç`}
                        >
                          WhatsApp'ta Aç
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              width: 340,
              flexShrink: 0,
              borderLeft: "1px solid var(--cizgi)",
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Mesaj önizlemesi{seciliSatir ? ` · ${seciliSatir.veli_ad || seciliSatir.oyuncu_ad}` : ""}
            </span>
            {seciliSatir &&
              ayar &&
              (duzenlenebilir ? (
                <textarea
                  aria-label="Mesaj metni"
                  value={metin(seciliSatir)}
                  onChange={(e) => setMetinDuzen(e.target.value)}
                  rows={9}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid var(--cizgi)",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    lineHeight: 1.45,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              ) : (
                <div
                  data-testid="wa-onizleme"
                  style={{
                    background: "#DCF8C6",
                    borderRadius: "12px 12px 12px 2px",
                    padding: "12px 14px",
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-line",
                  }}
                >
                  {metin(seciliSatir)}
                </div>
              ))}
            {seciliSatir?.son_hatirlatma && (
              <span style={{ fontSize: 12.5, color: "var(--soluk)" }}>
                Son hatırlatma {tarihTR(String(seciliSatir.son_hatirlatma).slice(0, 10))}
              </span>
            )}
            <span style={{ fontSize: 12.5, color: "var(--soluk)" }}>
              Metin kulübün WhatsApp'ında açılır, Gönder'e siz basarsınız. Program gönderimi göremez; "{Etiket}" işareti tıkladığınız anda
              düşer. Şablon: Ayarlar &gt; WhatsApp Mesajları.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
