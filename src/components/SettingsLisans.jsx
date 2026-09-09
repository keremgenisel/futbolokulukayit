// Ayarlar > Lisans: durum kartı + anahtar girişi + lease (docs/plan.md §7). GenCRM SettingsLisans'ın uyarlaması.
import { useState, useEffect } from "react";
import { Btn, useToast, useDene } from "./ui.jsx";
import { lisans } from "../lib/api.js";
import { tarihTR } from "../lib/aidat.js";

const MOD = {
  lisansli: { ad: "Lisanslı", renk: "var(--yesil)", zemin: "var(--yesil-acik)" },
  deneme: { ad: "Deneme sürümü", renk: "#7A6300", zemin: "var(--sari-acik)" },
  saltOkunur: { ad: "Salt okunur (lisans gerekli)", renk: "var(--kirmizi)", zemin: "var(--kirmizi-acik)" },
};
const alanStili = {
  width: "100%",
  fontFamily: "monospace",
  fontSize: 12,
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--cizgi)",
  resize: "vertical",
};

export function SettingsLisans({ admin, onLisansDegisti }) {
  const [durum, setDurum] = useState(null);
  const [anahtar, setAnahtar] = useState("");
  const [lease, setLease] = useState("");
  const [bekliyor, setBekliyor] = useState("");
  const toast = useToast();
  const dene = useDene();
  const yenile = () =>
    lisans()
      .durum()
      .then((r) => {
        if (r?.ok) setDurum(r.durum);
      })
      .catch(() => {});
  useEffect(() => {
    yenile();
  }, []);

  const islem = async (ad, fn) => {
    setBekliyor(ad);
    return dene(
      async () => {
        const r = await fn();
        if (r?.ok) {
          setDurum(r.durum);
          toast("ok", "Kaydedildi");
          onLisansDegisti?.();
        } else toast("err", r?.error || "İşlem başarısız");
      },
      {
        sonunda: () => {
          setBekliyor("");
        },
      },
    );
  };

  const m = MOD[durum?.mod];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ fontSize: 22 }}>Lisans</h3>
      <p style={{ margin: 0, color: "var(--soluk)", fontSize: 14, lineHeight: 1.6 }}>
        Lisans anahtarınızı satıcınızdan alıp aşağıya yapıştırın. Süre dolduğunda uygulama <b>salt okunur</b> moda geçer: veriler güvende
        kalır, görüntüleme ve dışa aktarma açık, değişiklik kapalı olur.
      </p>
      {durum && m && (
        <div style={{ background: m.zemin, border: `1.5px solid ${m.renk}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: m.renk, marginBottom: 6 }}>{m.ad}</div>
          <div style={{ fontSize: 13.5, display: "grid", gap: 3 }}>
            {durum.firma && (
              <div>
                Lisans sahibi: <b>{durum.firma}</b>
              </div>
            )}
            {durum.mod === "deneme" && (
              <div>
                Kalan deneme süresi: <b>{durum.kalanGun} gün</b>
              </div>
            )}
            {durum.mod === "lisansli" && (
              <div>
                Bitiş: <b>{durum.bitis ? `${tarihTR(durum.bitis)} (${durum.kalanGun} gün)` : "Süresiz"}</b>
              </div>
            )}
            {durum.mod === "saltOkunur" && durum.neden === "aktivasyonGerekli" && (
              <div>
                Bu lisans <b>online aktivasyon</b> gerektiriyor; geçerli bir aktivasyon (lease) yok. İnternet yoksa makine kimliğini
                satıcınıza iletip aldığınız lease'i yapıştırın.
              </div>
            )}
            {durum.mod === "saltOkunur" && durum.neden === "makineUyumsuz" && (
              <div>
                Bu anahtar <b>başka bir bilgisayara</b> kilitli.
              </div>
            )}
            {durum.mod === "saltOkunur" && !["aktivasyonGerekli", "makineUyumsuz"].includes(durum.neden) && (
              <div>
                {durum.neden === "denemeBitti" ? "Deneme süresi doldu." : "Lisans süresi doldu veya anahtar geçersiz."} Yeni anahtar girince
                kilit anında kalkar.
              </div>
            )}
            {durum.saatGeriAlindi && (
              <div style={{ color: "var(--kirmizi)" }}>
                Sistem saati geri alınmış görünüyor; süre en son görülen tarihe göre hesaplanıyor.
              </div>
            )}
            <div>
              Kullanıcı sınırı: <b>{durum.maksKullanici ?? "Sınırsız"}</b>
            </div>
            {durum.makineId && (
              <div style={{ marginTop: 4 }}>
                Makine kimliği: <b style={{ fontFamily: "monospace", fontSize: 12, userSelect: "all" }}>{durum.makineId}</b>
              </div>
            )}
          </div>
        </div>
      )}
      {admin ? (
        <>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--soluk)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}
            >
              Lisans anahtarı
            </div>
            <textarea
              value={anahtar}
              onChange={(e) => setAnahtar(e.target.value)}
              rows={4}
              placeholder="FOKLISANS. ile başlayan anahtarı buraya yapıştırın"
              style={alanStili}
              aria-label="Lisans anahtarı"
            />
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Btn onClick={() => islem("anahtar", () => lisans().kaydet(anahtar.trim()))} disabled={!!bekliyor || !anahtar.trim()}>
                {bekliyor === "anahtar" ? "Doğrulanıyor..." : "Anahtarı Kaydet"}
              </Btn>
              <Btn tur="ghost" onClick={() => islem("aktif", () => lisans().aktiflestir())} disabled={!!bekliyor}>
                {bekliyor === "aktif" ? "Aktive ediliyor..." : "Aktive Et (online)"}
              </Btn>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--cizgi)", paddingTop: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--soluk)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}
            >
              Aktivasyon (lease)
            </div>
            <p style={{ margin: "0 0 8px", color: "var(--soluk)", fontSize: 13.5 }}>
              Yalnızca online aktivasyon gerektiren lisanslarda. İnternet yoksa makine kimliğini satıcınıza iletin, verilen dizeyi
              (FOKLEASE…) buraya yapıştırın.
            </p>
            <textarea
              value={lease}
              onChange={(e) => setLease(e.target.value)}
              rows={3}
              placeholder="FOKLEASE. ile başlayan dizeyi buraya yapıştırın"
              style={alanStili}
              aria-label="Lease"
            />
            <div style={{ marginTop: 10 }}>
              <Btn
                tur="ghost"
                onClick={() => islem("lease", () => lisans().leaseYapistir(lease.trim()))}
                disabled={!!bekliyor || !lease.trim()}
              >
                Lease Kaydet
              </Btn>
            </div>
          </div>
        </>
      ) : (
        <p style={{ color: "var(--soluk)", fontSize: 14 }}>Lisans anahtarını yalnızca yönetici girebilir.</p>
      )}
    </div>
  );
}
