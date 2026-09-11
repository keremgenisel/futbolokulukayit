// Ayarlar > Sunucu / Çoklu PC: bu bilgisayarı sunucu yap (diğer PC'ler bağlansın) veya başka PC'deki
// sunucuya bağlan. İstemci ilk bağlantıda sunucunun sertifika parmak izini onaylar (TOFU).
import { useEffect, useState } from "react";
import { Btn, Alan, Girdi, Rozet, Onay, useToast, useDene } from "./ui.jsx";

export function SettingsSunucu({ admin, onModDegisti }) {
  const [d, setD] = useState(null);
  const [port, setPort] = useState("3535");
  const [url, setUrl] = useState("");
  const [onay, setOnay] = useState(null); // { fp, mismatch, eskiFp }
  const [bekliyor, setBekliyor] = useState(false);
  const [kopar, setKopar] = useState(false);
  const toast = useToast();
  const dene = useDene();

  const yukle = () =>
    window.okul.mod
      .oku()
      .then((x) => {
        setD(x);
        setPort(String(x.port || 3535));
        if (x.serverUrl) setUrl(x.serverUrl);
      })
      .catch(() => {});
  useEffect(() => {
    yukle();
  }, []);

  const baslat = async () => {
    setBekliyor(true);
    return dene(
      async () => {
        const r = await window.okul.mod.sunucuBaslat(Number(port));
        if (r.error) toast("err", r.error);
        else {
          toast("ok", `Sunucu ${r.port} portunda açıldı`);
          onModDegisti?.();
        }
        yukle();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  const durdur = () =>
    dene(async () => {
      await window.okul.mod.sunucuDurdur();
      toast("ok", "Sunucu durduruldu");
      onModDegisti?.();
      yukle();
    });
  const baglan = async (secenek = {}) => {
    setBekliyor(true);
    return dene(
      async () => {
        const r = await window.okul.mod.istemciBaglan(url, secenek);
        if (r.error) toast("err", r.error);
        else if (r.needTrust) setOnay({ fp: r.fp });
        else if (r.mismatch) setOnay({ fp: r.fp, mismatch: true, eskiFp: r.eskiFp });
        else {
          setOnay(null);
          toast("ok", "Sunucuya bağlandı. Şimdi sunucudaki kullanıcı adı ve parolanızla giriş yapın.");
          onModDegisti?.("istemci");
        }
        yukle();
      },
      {
        sonunda: () => {
          setBekliyor(false);
        },
      },
    );
  };
  const koparOnayla = async () => {
    await window.okul.mod.istemciKopar();
    setKopar(false);
    toast("ok", "Yerel moda dönüldü");
    onModDegisti?.("yerel");
    yukle();
  };

  if (!d) return null;
  const s = d.sunucu || {};
  const ipler = s.adresler || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ fontSize: 22 }}>Sunucu ve Çoklu Bilgisayar</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14, lineHeight: 1.6 }}>
        Birden fazla bilgisayar aynı verileri kullanacaksa biri <b>sunucu</b> olur, diğerleri ona <b>bağlanır</b>. Veriler yalnızca sunucu
        bilgisayarda durur. Aynı ağda veya Tailscale ile bağlanılabilir. Sunucu bilgisayarda uygulama açık olmalıdır.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <Rozet ton={d.mode === "sunucu" ? "green" : d.mode === "istemci" ? "purple" : "gray"} style={{ fontSize: 13, padding: "6px 12px" }}>
          {d.mode === "sunucu"
            ? `Sunucu modu · ${s.calisiyor ? "çalışıyor" : "kapalı"}`
            : d.mode === "istemci"
              ? `İstemci modu · ${d.serverUrl}`
              : "Tek bilgisayar (yerel)"}
        </Rozet>
      </div>

      {d.mode !== "istemci" && (
        <div style={{ border: "1px solid var(--cizgi)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Bu bilgisayarı sunucu yap</div>
          {!admin ? (
            <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14 }}>Yalnızca yönetici açabilir.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <Alan etiket="Port" style={{ width: 120 }}>
                  <Girdi value={port} onChange={(e) => setPort(e.target.value)} disabled={s.calisiyor} />
                </Alan>
                {s.calisiyor ? (
                  <Btn tur="danger" onClick={durdur}>
                    Sunucuyu Durdur
                  </Btn>
                ) : (
                  <Btn onClick={baslat} disabled={bekliyor}>
                    Sunucuyu Başlat
                  </Btn>
                )}
              </div>
              {s.calisiyor && (
                <div style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ color: "var(--soluk)" }}>Diğer bilgisayarlarda "Sunucuya bağlan" alanına şu adreslerden birini yazın:</div>
                  {ipler.map((a) => (
                    <div key={a.ip} style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      https://{a.ip}:{s.port}{" "}
                      <span style={{ color: "var(--soluk)", fontWeight: 400, fontFamily: "inherit" }}>
                        ({a.tailscale ? "Tailscale" : a.ad})
                      </span>
                    </div>
                  ))}
                  <div style={{ color: "var(--soluk)" }}>Sertifika parmak izi (bağlanırken bu değer gösterilir, aynı olmalı):</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, userSelect: "all", wordBreak: "break-all" }}>{s.fp}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {d.mode !== "sunucu" && (
        <div style={{ border: "1px solid var(--cizgi)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {d.mode === "istemci" ? "Bağlı sunucu" : "Başka bilgisayardaki sunucuya bağlan"}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <Alan etiket="Sunucu adresi" style={{ flex: 1 }}>
              <Girdi value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://100.x.x.x:3535" aria-label="Sunucu adresi" />
            </Alan>
            <Btn onClick={() => baglan()} disabled={bekliyor || !url.trim()}>
              {d.mode === "istemci" ? "Yeniden Bağlan" : "Bağlan"}
            </Btn>
            {d.mode === "istemci" && (
              <Btn tur="danger" onClick={() => setKopar(true)}>
                Yerel Moda Dön
              </Btn>
            )}
          </div>
          {d.mode === "istemci" && d.serverCertFp && (
            <div style={{ fontSize: 12, color: "var(--soluk)", fontFamily: "monospace", wordBreak: "break-all" }}>
              Sabitlenmiş parmak izi: {d.serverCertFp}
            </div>
          )}
        </div>
      )}

      {onay && (
        <Onay
          tehlikeli={!!onay.mismatch}
          mesaj={
            onay.mismatch
              ? `DİKKAT: Bu sunucunun sertifikası daha önce kaydedilenden FARKLI. Sunucu yeniden kurulduysa normaldir; değilse biri araya girmiş olabilir. Yeni parmak izi: ${onay.fp}. Yine de güvenilsin mi?`
              : `Sunucu parmak izi: ${onay.fp}. Sunucu bilgisayarındaki Ayarlar > Sunucu ekranında aynı değer görünüyorsa onaylayın.`
          }
          onEvet={() => baglan(onay.mismatch ? { force: true } : { trust: true })}
          onHayir={() => setOnay(null)}
        />
      )}
      {kopar && (
        <Onay
          tehlikeli
          mesaj="Sunucu bağlantısı kesilip bu bilgisayardaki yerel veritabanına dönülecek. Emin misiniz?"
          onEvet={koparOnayla}
          onHayir={() => setKopar(false)}
        />
      )}
    </div>
  );
}
