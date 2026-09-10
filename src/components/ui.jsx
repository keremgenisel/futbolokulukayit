// Arayüz ilkelleri. Tüm stil inline; kulüp renkleri ui.css'teki CSS değişkenlerinden.
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { sayiAyikla, sayiBicimle } from "../lib/aidat.js";
import { hataMetni } from "../lib/api.js";

export function Btn({ tur = "primary", children, ikon, style, kucuk, ...rest }) {
  const turler = {
    primary: { background: "var(--mor)", color: "var(--ana-ustu, #fff)", border: "1px solid var(--mor)" },
    sari: { background: "var(--sari)", color: "var(--vurgu-ustu, var(--mor-koyu))", border: "1px solid var(--sari)" },
    ghost: { background: "#fff", color: "var(--mor-koyu)", border: "1px solid var(--cizgi)" },
    danger: { background: "#fff", color: "var(--kirmizi)", border: "1px solid var(--kirmizi)" },
    yesil: { background: "var(--yesil)", color: "#fff", border: "1px solid var(--yesil)" },
  };
  return (
    <button
      type="button"
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: kucuk ? 32 : 40,
        padding: kucuk ? "0 12px" : "0 16px",
        borderRadius: 8,
        fontSize: kucuk ? 13 : 14,
        fontWeight: 600,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        ...turler[tur],
        ...style,
      }}
    >
      {ikon}
      {children}
    </button>
  );
}

export function Rozet({ ton = "gray", children, style, ...rest }) {
  const tonlar = {
    green: ["var(--yesil-acik)", "var(--yesil)"],
    red: ["var(--kirmizi-acik)", "var(--kirmizi)"],
    yellow: ["var(--uyari-acik)", "var(--uyari-metin)"], // uyarı anlamı: temayla değişmez
    purple: ["var(--mor-acik)", "var(--mor)"],
    gray: ["#EEECF2", "var(--soluk)"],
  };
  const [bg, fg] = tonlar[ton] || tonlar.gray;
  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Kart({ children, style }) {
  return <div style={{ background: "#fff", border: "1px solid var(--cizgi)", borderRadius: 12, ...style }}>{children}</div>;
}

export function Alan({ etiket, children, style }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      <span style={{ fontSize: 12, color: "var(--soluk)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {etiket}
      </span>
      {children}
    </label>
  );
}

export const girisStili = {
  height: 42,
  padding: "0 12px",
  border: "1px solid var(--cizgi)",
  borderRadius: 8,
  background: "#fff",
  fontSize: 15,
  width: "100%",
};

export function Girdi(props) {
  return <input {...props} style={{ ...girisStili, ...props.style }} />;
}
export function Secim({ secenekler, bos, ...props }) {
  return (
    <select {...props} style={{ ...girisStili, ...props.style }}>
      {bos !== undefined && <option value="">{bos}</option>}
      {secenekler.map((s) => (
        <option key={s.kod ?? s.id} value={s.kod ?? s.id}>
          {s.ad}
        </option>
      ))}
    </select>
  );
}

/** Oyuncu kartı ve oyuncu formu aynı boyda açılır (kullanıcı isteği 07.09.2026). */
export const OYUNCU_MODAL = { genislik: 1120, yukseklik: "min(880px, 92vh)" };

export function Modal({ baslik, ust, children, altBar, onKapat, genislik = 900, yukseklik }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onKapat?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKapat]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={baslik}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKapat?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(27,21,48,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: genislik,
          maxWidth: "94vw",
          height: yukseklik,
          maxHeight: "92vh",
          background: "#fff",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(27,21,48,.35)",
        }}
      >
        {ust ?? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 24px",
              background: "var(--mor)",
              color: "var(--ana-ustu, #fff)",
            }}
          >
            <span className="baslik" style={{ color: "var(--ana-ustu, #fff)", fontSize: 26, fontWeight: 700 }}>
              {baslik}
            </span>
            <button
              type="button"
              onClick={onKapat}
              aria-label="Kapat"
              style={{ background: "none", border: 0, color: "var(--ana-ustu-soluk, #d8cce9)", fontSize: 22, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>{children}</div>
        {altBar && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 24px",
              borderTop: "1px solid var(--cizgi)",
              background: "var(--zemin)",
            }}
          >
            {altBar}
          </div>
        )}
      </div>
    </div>
  );
}

export function Onay({ mesaj, onEvet, onHayir, tehlikeli }) {
  return (
    <Modal
      baslik="Onay"
      onKapat={onHayir}
      genislik={440}
      altBar={
        <>
          <Btn tur="ghost" onClick={onHayir}>
            Vazgeç
          </Btn>
          <Btn tur={tehlikeli ? "danger" : "primary"} onClick={onEvet}>
            Evet
          </Btn>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 15 }}>{mesaj}</p>
    </Modal>
  );
}

// ── Bildirim (toast) ──
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
// Hata yakalayıp toast'a yazan sarmalayıcı (refactor §3.4): `const dene = useDene(); const kaydet = () => dene(async () => { ... })`.
// Başarıda fn'in dönüşünü, hatada undefined döner; hata metni hataMetni ile kullanıcı diline çevrilir.
// Seçenekler: `sonunda` her durumda (finally), `hata(e)` toast'tan sonra ek iş (durum sıfırlama vb.).
export function useDene() {
  const toast = useToast();
  return useCallback(
    async (fn, { sonunda, hata } = {}) => {
      try {
        return await fn();
      } catch (e) {
        toast("err", hataMetni(e));
        hata?.(e);
      } finally {
        sonunda?.();
      }
    },
    [toast],
  );
}
export function ToastSaglayici({ children }) {
  const [liste, setListe] = useState([]);
  const goster = useCallback((tur, metin) => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l, { id, tur, metin }]);
    setTimeout(() => setListe((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={goster}>
      {children}
      {/* Bildirimler en üstte ortada (kullanıcı isteği 08.09.2026; sağ alt gözden kaçıyordu). Modal'ların (zIndex 50) üstünde. */}
      <div
        data-testid="toast-kapsayici"
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        {liste.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              color: "#fff",
              background: t.tur === "err" ? "var(--kirmizi)" : t.tur === "ok" ? "var(--yesil)" : "var(--mor-koyu)",
              fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,.2)",
              maxWidth: 560,
              textAlign: "center",
              pointerEvents: "auto",
            }}
          >
            {t.metin}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Avatar({ ad, boyut = 36, foto }) {
  const bas = String(ad || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (foto)
    return <img src={foto} alt="" style={{ width: boyut, height: boyut, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div
      style={{
        width: boyut,
        height: boyut,
        borderRadius: "50%",
        background: "var(--mor-acik)",
        color: "var(--mor)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.round(boyut * 0.38),
        flexShrink: 0,
      }}
    >
      {bas}
    </div>
  );
}

export function Bos({ metin }) {
  return <div style={{ padding: 32, textAlign: "center", color: "var(--soluk)" }}>{metin}</div>;
}

export function Sekmeler({ liste, aktif, onSec }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cizgi)" }}>
      {liste.map((s) => (
        <button
          key={s.kod}
          type="button"
          onClick={() => onSec(s.kod)}
          style={{
            padding: "12px 16px",
            background: "none",
            border: 0,
            borderBottom: `3px solid ${aktif === s.kod ? "var(--sari)" : "transparent"}`,
            color: aktif === s.kod ? "var(--mor)" : "var(--soluk)",
            fontWeight: aktif === s.kod ? 700 : 400,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {s.ad}
          {s.ek}
        </button>
      ))}
    </div>
  );
}

export const durumTonu = (d) =>
  ({ aktif: "green", deneme: "yellow", sakat: "red", pasif: "gray", ayrildi: "gray", dondurma: "gray" })[d] || "gray";
export const aidatTonu = (d) => ({ odendi: "green", odenmedi: "red", kismi: "yellow", muaf: "gray" })[d] || "gray";
export { aidatEtiket } from "../lib/aidat.js"; // saf mantık lib/aidat.js'te; eski içe aktarımlar için yeniden dışa

// Ortak sayfalama çubuğu: "1–50 / 312" + önceki/sonraki. Tek sayfaysa hiç çizilmez.
export function Sayfalama({ sayfa, toplam, sayfaBoyu, onSayfa, birim = "kayıt" }) {
  const son = Math.max(1, Math.ceil((toplam || 0) / sayfaBoyu));
  if (son <= 1) return null;
  const bas = (sayfa - 1) * sayfaBoyu + 1,
    bit = Math.min(toplam, sayfa * sayfaBoyu);
  const dugme = {
    height: 32,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid var(--cizgi)",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    color: "var(--mor-koyu)",
  };
  return (
    <nav
      aria-label="Sayfalama"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        padding: "10px 16px",
        borderTop: "1px solid var(--cizgi)",
        fontSize: 13,
        color: "var(--soluk)",
      }}
    >
      <span>
        {bas}–{bit} / {toplam} {birim}
      </span>
      <button
        type="button"
        onClick={() => onSayfa(sayfa - 1)}
        disabled={sayfa <= 1}
        style={{ ...dugme, opacity: sayfa <= 1 ? 0.4 : 1 }}
        aria-label="Önceki sayfa"
      >
        ‹ Önceki
      </button>
      <span>
        Sayfa <b>{sayfa}</b> / {son}
      </span>
      <button
        type="button"
        onClick={() => onSayfa(sayfa + 1)}
        disabled={sayfa >= son}
        style={{ ...dugme, opacity: sayfa >= son ? 0.4 : 1 }}
        aria-label="Sonraki sayfa"
      >
        Sonraki ›
      </button>
    </nav>
  );
}

// Para girdisi: ekranda "5.000" görünür, dışarı rakam dizisi ("5000") verir. Tam lira; ondalık yok.
// value: sayı ya da rakam dizisi; onDegis(rakamlar: string). Girdi ile aynı stil.
export function ParaGirdi({ value, onDegis, style, ...rest }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={sayiBicimle(value)}
      onChange={(e) => onDegis(sayiAyikla(e.target.value))}
      style={{ ...girisStili, textAlign: "right", ...style }}
    />
  );
}

// Telefon numarası: tıklayınca panoya kopyalar (arama yapılacak cihaza yazmak için). Boşsa "—".
export function Telefon({ no, etiket }) {
  const toast = useToast();
  if (!no) return <span style={{ color: "var(--soluk)" }}>—</span>;
  const kopyala = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(no);
      toast("ok", `${etiket ? etiket + " " : ""}${no} kopyalandı`);
    } catch {
      toast("err", "Kopyalanamadı");
    }
  };
  return (
    <button
      type="button"
      onClick={kopyala}
      title="Kopyalamak için tıklayın"
      aria-label={`${no} kopyala`}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        color: "var(--mor-koyu)",
        fontWeight: 600,
        fontFamily: "inherit",
        fontSize: "inherit",
        textDecoration: "underline dotted",
      }}
    >
      {no}
    </button>
  );
}
