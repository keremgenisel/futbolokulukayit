// Ayarlar > Kullanıcılar (+ kurtarma kodları penceresi; ilk kurulum sihirbazı da kullanır)
import { useEffect, useState } from "react";
import { Btn, Alan, Girdi, Secim, Rozet, Onay, Modal, useToast, useDene } from "../ui.jsx";
import { db, hataMetni, hataHam } from "../../lib/api.js";
import { ParolaDegistir } from "../ParolaDegistir.jsx";
import { esc as htmlEsc } from "../../lib/metin.js";
import { Ikon } from "../Ikon.jsx";
import { VARSAYILAN_KULUP } from "../../lib/marka.js";

export function KullaniciAyar({ oturum, admin, saltOkunur }) {
  const [liste, setListe] = useState([]);
  const [yeni, setYeni] = useState({ username: "", ad_soyad: "", password: "", role: "kullanici" });
  const [parola, setParola] = useState(false);
  const [sifirla, setSifirla] = useState(null);
  const [sil, setSil] = useState(null);
  const [kodUret, setKodUret] = useState(null); // onay bekleyen kullanıcı
  const [kodlar, setKodlar] = useState(null); // { username, kodlar }
  const toast = useToast();
  const dene = useDene();
  // Yönetici tüm listeyi görür; kullanıcı yalnız kendi kaydını (kurtarma kodu sayısı için).
  const yukle = () => {
    db("listUsers")
      .then(setListe)
      .catch(() => {});
  };
  useEffect(yukle, [admin]);
  const ben = liste.find((u) => u.username === oturum.username);
  const kodUretOnay = async () => {
    const u = kodUret;
    setKodUret(null);
    return dene(async () => {
      const r = await window.okul.auth.kurtarmaUret(u.id);
      if (!r.ok) return toast("err", r.error);
      setKodlar({ username: u.username, kodlar: r.kodlar });
      yukle();
    });
  };
  const silOnay = () =>
    dene(
      async () => {
        const r = await db("deleteUser", sil.id);
        if (r?.error) toast("err", r.error);
        else toast("ok", `${sil.username} silindi`);
        setSil(null);
        yukle();
      },
      {
        hata: () => {
          setSil(null);
        },
      },
    );
  const ekle = async () => {
    if (!yeni.username.trim() || yeni.password.length < 8) return toast("err", "Kullanıcı adı ve en az 8 karakter parola gerekli");
    try {
      await db("createUser", { ...yeni, username: yeni.username.trim(), must_change_password: 1 });
      toast("ok", "Kullanıcı eklendi");
      setYeni({ username: "", ad_soyad: "", password: "", role: "kullanici" });
      yukle();
    } catch (e) {
      toast("err", hataHam(e).includes("UNIQUE") ? "Bu kullanıcı adı kullanımda" : hataMetni(e));
    }
  };
  const sifirlaOnay = () =>
    dene(async () => {
      const r = await db("resetUserPassword", sifirla.id);
      toast("ok", `Geçici parola: ${r.parola} (ilk girişte değiştirilecek)`);
      setSifirla(null);
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h3 style={{ fontSize: 22 }}>Hesabım</h3>
        <p style={{ color: "var(--soluk)", margin: "4px 0 10px" }}>
          {oturum.ad_soyad || oturum.username} · {oturum.role === "admin" ? "Yönetici" : "Kullanıcı"}
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Btn tur="ghost" onClick={() => setParola(true)}>
            Parolamı Değiştir
          </Btn>
          {ben && !saltOkunur && (
            <Btn tur="ghost" ikon={<Ikon ad="kilit" boyut={16} />} onClick={() => setKodUret(ben)}>
              {ben.kurtarma_kodu > 0 ? "Kurtarma Kodlarını Yenile" : "Kurtarma Kodları Üret"}
            </Btn>
          )}
          {ben &&
            (ben.kurtarma_kodu > 0 ? (
              <Rozet ton="green">{ben.kurtarma_kodu} kurtarma kodu</Rozet>
            ) : (
              <Rozet ton="red">Kurtarma kodu yok</Rozet>
            ))}
        </div>
        <p style={{ color: "var(--soluk)", fontSize: 13, margin: "8px 0 0" }}>
          Parolanızı unutursanız giriş ekranındaki "Parolamı unuttum" ile bu kodlardan biriyle yeni parola belirlersiniz. Her kod bir kez
          kullanılır; kodları yazdırıp güvenli bir yerde saklayın.
        </p>
      </div>
      {admin && (
        <>
          <div style={{ height: 1, background: "var(--cizgi)" }} />
          <h3 style={{ fontSize: 22 }}>Kullanıcılar</h3>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Kullanıcı adı</th>
                <th style={{ whiteSpace: "nowrap" }}>Ad Soyad</th>
                <th>Rol</th>
                <th>Durum</th>
                <th style={{ whiteSpace: "nowrap" }}>Kurtarma kodu</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((u) => (
                <tr key={u.id}>
                  <td className="tek-satir" style={{ fontWeight: 600 }}>
                    {u.username}
                  </td>
                  <td className="tek-satir">{u.ad_soyad}</td>
                  <td>{u.role === "admin" ? "Yönetici" : "Kullanıcı"}</td>
                  <td>{u.is_active ? <Rozet ton="green">Aktif</Rozet> : <Rozet ton="gray">Pasif</Rozet>}</td>
                  <td>{u.kurtarma_kodu > 0 ? <Rozet ton="green">{u.kurtarma_kodu}</Rozet> : <Rozet ton="red">Yok</Rozet>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      {u.username !== oturum.username && !saltOkunur && (
                        <>
                          <Btn kucuk tur="ghost" onClick={() => setSifirla(u)}>
                            Parola sıfırla
                          </Btn>
                          <Btn kucuk tur="ghost" onClick={() => setKodUret(u)}>
                            Kurtarma kodu
                          </Btn>
                          <Btn
                            kucuk
                            tur={u.is_active ? "danger" : "primary"}
                            onClick={async () => {
                              await db("setUserActive", u.id, !u.is_active);
                              yukle();
                            }}
                          >
                            {u.is_active ? "Pasif yap" : "Aktif yap"}
                          </Btn>
                          <Btn kucuk tur="danger" onClick={() => setSil(u)} aria-label={`${u.username} kullanıcısını sil`}>
                            Sil
                          </Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!saltOkunur && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Alan etiket="Kullanıcı adı" style={{ width: 160 }}>
                <Girdi value={yeni.username} onChange={(e) => setYeni({ ...yeni, username: e.target.value })} />
              </Alan>
              <Alan etiket="Ad Soyad" style={{ width: 200 }}>
                <Girdi value={yeni.ad_soyad} onChange={(e) => setYeni({ ...yeni, ad_soyad: e.target.value })} />
              </Alan>
              <Alan etiket="Geçici parola" style={{ width: 160 }}>
                <Girdi type="password" value={yeni.password} onChange={(e) => setYeni({ ...yeni, password: e.target.value })} />
              </Alan>
              <Alan etiket="Rol" style={{ width: 140 }}>
                <Secim
                  value={yeni.role}
                  onChange={(e) => setYeni({ ...yeni, role: e.target.value })}
                  secenekler={[
                    { kod: "kullanici", ad: "Kullanıcı" },
                    { kod: "admin", ad: "Yönetici" },
                  ]}
                  aria-label="Rol"
                />
              </Alan>
              <Btn onClick={ekle}>Kullanıcı Ekle</Btn>
            </div>
          )}
        </>
      )}
      {parola && <ParolaDegistir oturum={oturum} onTamam={() => setParola(false)} onKapat={() => setParola(false)} />}
      {sifirla && (
        <Onay
          mesaj={`${sifirla.username} için geçici parola üretilsin mi? Kullanıcı ilk girişte değiştirecek.`}
          onEvet={sifirlaOnay}
          onHayir={() => setSifirla(null)}
        />
      )}
      {sil && (
        <Onay
          tehlikeli
          mesaj={`${sil.username} kullanıcısı silinsin mi? Bu işlem geri alınamaz; kestiği makbuzlar ve kayıtlar kalır.`}
          onEvet={silOnay}
          onHayir={() => setSil(null)}
        />
      )}
      {kodUret && (
        <Onay
          mesaj={`${kodUret.username} için 8 yeni kurtarma kodu üretilsin mi?${kodUret.kurtarma_kodu > 0 ? " Eski kodlar geçersiz olur." : ""}`}
          onEvet={kodUretOnay}
          onHayir={() => setKodUret(null)}
        />
      )}
      {kodlar && <KurtarmaKodlari username={kodlar.username} kodlar={kodlar.kodlar} onKapat={() => setKodlar(null)} />}
    </div>
  );
}

// Üretilen kodlar YALNIZ bu pencerede görünür (DB'de şifreli). Kopyala / yazdır.

export function KurtarmaKodlari({ username, kodlar, onKapat, kapatMetni = "Kaydettim, Kapat" }) {
  const toast = useToast();
  const [kulup, setKulup] = useState(VARSAYILAN_KULUP);
  useEffect(() => {
    db("getSetting", "kulup_adi")
      .then((k) => k && setKulup(k))
      .catch(() => {});
  }, []);
  const metin = `${kulup} — ${username} parola kurtarma kodları\n${kodlar.join("\n")}\nHer kod bir kez kullanılır.`;
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(metin);
      toast("ok", "Kodlar panoya kopyalandı");
    } catch {
      toast("err", "Kopyalanamadı");
    }
  };
  const yazdir = async () => {
    const esc = htmlEsc;
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kurtarma kodları</title><style>body{font-family:sans-serif;padding:32px}h1{font-size:18px}code{display:block;font-size:18px;letter-spacing:.1em;margin:6px 0}</style></head><body><h1>${esc(kulup)} — ${esc(username)} parola kurtarma kodları</h1>${kodlar.map((k) => `<code>${esc(k)}</code>`).join("")}<p>Her kod bir kez kullanılır. Güvenli bir yerde saklayın.</p></body></html>`;
    const r = await window.okul.cikti.yazdir(html);
    if (!r?.ok) toast("err", r?.hata || "Yazdırılamadı");
  };
  return (
    <Modal
      baslik={`${username} — Kurtarma Kodları`}
      onKapat={onKapat}
      genislik={480}
      altBar={
        <>
          <Btn tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={yazdir}>
            Yazdır
          </Btn>
          <Btn tur="ghost" onClick={kopyala}>
            Kopyala
          </Btn>
          <Btn onClick={onKapat}>{kapatMetni}</Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          role="alert"
          style={{
            background: "var(--uyari-acik)",
            border: "1.5px solid var(--uyari)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          Bu kodlar yalnız şimdi görünür; kapattıktan sonra tekrar gösterilemez. Yazdırıp güvenli bir yerde saklayın.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {kodlar.map((k) => (
            <code
              key={k}
              style={{
                fontSize: 18,
                letterSpacing: ".1em",
                padding: "8px 12px",
                border: "1px solid var(--cizgi)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {k}
            </code>
          ))}
        </div>
      </div>
    </Modal>
  );
}
