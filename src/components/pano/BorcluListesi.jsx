import { Kart, Btn, Bos, Telefon } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { AY_ADLARI, gecikmeGunu, paraTR, tarihTR } from "../../lib/aidat.js";
import { hatirlatmaUygunMu } from "../../lib/whatsapp.js";

/** "<Ay> Aidatı Ödemeyenler" kartı: ilk 8 borçlu, satır WhatsApp/Makbuz düğmeleri, toplu hatırlatma (plan §13; refactor 2. tur §8.7). */
export function BorcluListesi({ borclular, yil, ay, saltOkunur, onOyuncu, onSekme, onMakbuzKes, onWa, waAlici }) {
  return (
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
                onWa({
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
        <Bos kucuk metin="Borçlu oyuncu yok." />
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
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
                              onWa({
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
  );
}
