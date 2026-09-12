// Oyuncu kartı > Ödemeler sekmesi: aylık aidat dönemleri (+WhatsApp hatırlat) ve makbuzlar (yazdır)
import { Btn, Rozet, Bos, aidatTonu, aidatEtiket } from "../ui.jsx";
import { ODEME_YONTEMLERI, tarihTR, paraTR, AY_ADLARI, aidatKalan, gorunenAidatDurumu, vadeTarihi } from "../../lib/aidat.js";
import { hatirlatmaUygunMu } from "../../lib/whatsapp.js";
import { Ikon } from "../Ikon.jsx";

// tumu: { aidat, makbuz } "Tümünü göster" durumu; son: { aidat, makbuz } liste sınırı; onTumu("aidat"|"makbuz")
import { TumunuGoster } from "./TumunuGoster.jsx";

// donem: oyuncunun ödeme dönemi ("1-10" …) — vadesi gelmemiş ayda vade tarihi yazılır (plan §38)
export function OdemeSekmesi({
  aidatlar,
  makbuzlar,
  tumu,
  son,
  onTumu,
  acikAidat,
  birincilVeli,
  onAidatHatirlat,
  onMakbuzYazdir,
  donem = "1-10",
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
          <h3 style={{ fontSize: 22 }}>Aylık Aidat</h3>
          {acikAidat &&
            (() => {
              const u = hatirlatmaUygunMu({
                numara: birincilVeli ? birincilVeli.whatsapp_no || birincilVeli.gsm : "",
                onay: birincilVeli?.mesaj_onayi,
              });
              return (
                <Btn
                  kucuk
                  tur={u.ok ? "yesil" : "ghost"}
                  ikon={<Ikon ad="whatsapp" boyut={16} />}
                  disabled={!u.ok}
                  title={u.ok ? "" : u.neden}
                  onClick={onAidatHatirlat}
                >
                  Aidat Hatırlat
                </Btn>
              );
            })()}
        </div>
        {aidatlar.length === 0 ? (
          <Bos metin="Aidat kaydı yok." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dönem</th>
                <th>Tutar</th>
                <th>Ödenen</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {aidatlar.map((a) => (
                <tr key={a.id}>
                  <td>
                    {AY_ADLARI[a.ay - 1]} {a.yil}
                  </td>
                  <td>{paraTR(a.tutar)}</td>
                  <td>{a.durum === "muaf" ? "—" : paraTR(a.odenen || 0)}</td>
                  <td>
                    <Rozet ton={aidatTonu(gorunenAidatDurumu(a.durum, a.vade_gecti))}>
                      {aidatEtiket(gorunenAidatDurumu(a.durum, a.vade_gecti))}
                    </Rozet>
                    {gorunenAidatDurumu(a.durum, a.vade_gecti) === "bekliyor" && (
                      <span style={{ fontSize: 12, color: "var(--soluk)", marginLeft: 6 }}>
                        vade {tarihTR(vadeTarihi(donem, a.yil, a.ay))}
                      </span>
                    )}
                    {a.durum === "kismi" && (
                      <span style={{ fontSize: 12, color: "var(--kirmizi)", marginLeft: 6 }}>kalan {paraTR(aidatKalan(a))}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!tumu.aidat && aidatlar.length >= son.aidat && (
          <TumunuGoster onClick={() => onTumu("aidat")} metin={`Son ${son.aidat} dönem gösteriliyor`} />
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 22, marginBottom: 12 }}>Makbuzlar</h3>
        {makbuzlar.length === 0 ? (
          <Bos metin="Makbuz yok." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tarih</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {makbuzlar.map((m) => (
                <tr key={m.id} style={{ opacity: m.iptal ? 0.5 : 1 }}>
                  <td>
                    {m.makbuz_no}
                    {m.iptal ? (
                      <span
                        title={`${m.iptal_nedeni || ""}${m.iptal_eden ? " · " + m.iptal_eden : ""}`}
                        style={{ color: "var(--kirmizi)", fontSize: 12 }}
                      >
                        {" "}
                        · iptal{m.iptal_nedeni ? `: ${m.iptal_nedeni}` : ""}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>{tarihTR(m.tarih)}</td>
                  <td>{paraTR(m.toplam)}</td>
                  <td>{ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad}</td>
                  <td>
                    <Btn kucuk tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={() => onMakbuzYazdir(m.id)}>
                      Yazdır
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!tumu.makbuz && makbuzlar.length >= son.makbuz && (
          <TumunuGoster onClick={() => onTumu("makbuz")} metin={`Son ${son.makbuz} makbuz gösteriliyor`} />
        )}
      </div>
    </div>
  );
}
