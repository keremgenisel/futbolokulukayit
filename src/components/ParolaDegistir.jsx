import { useState } from "react";
import { Modal, Btn, Alan, Girdi, useToast } from "./ui.jsx";
import { hataMetni } from "../lib/api.js";

// İlk girişte (must_change_password) veya Ayarlar'dan parola değişimi.
export function ParolaDegistir({ oturum, zorunlu = false, onTamam, onKapat }) {
  const [eski, setEski] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [hata, setHata] = useState("");
  const toast = useToast();

  const kaydet = async () => {
    if (!zorunlu && !eski) return setHata("Mevcut parolanızı girin");
    if (p1.length < 8) return setHata("Parola en az 8 karakter olmalı");
    if (p1 !== p2) return setHata("Parolalar aynı değil");
    try {
      const r = await window.okul.auth.changePassword(oturum.username, p1, zorunlu ? undefined : eski);
      if (!r.ok) return setHata(r.error || "Kaydedilemedi");
      toast("ok", "Parola değiştirildi");
      onTamam?.();
    } catch (e) {
      setHata(hataMetni(e));
    }
  };

  return (
    <Modal
      baslik={zorunlu ? "Yeni Parola Belirleyin" : "Parola Değiştir"}
      onKapat={zorunlu ? undefined : onKapat}
      genislik={480}
      altBar={
        <>
          {!zorunlu && (
            <Btn tur="ghost" onClick={onKapat}>
              Vazgeç
            </Btn>
          )}
          <Btn onClick={kaydet}>Kaydet</Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {zorunlu && <p style={{ margin: 0, color: "var(--soluk)" }}>İlk girişte güvenlik için parolanızı değiştirmeniz gerekiyor.</p>}
        {!zorunlu && (
          <Alan etiket="Mevcut parola">
            <Girdi type="password" value={eski} onChange={(e) => setEski(e.target.value)} autoFocus aria-label="Mevcut parola" />
          </Alan>
        )}
        <Alan etiket="Yeni parola">
          <Girdi type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus={zorunlu} aria-label="Yeni parola" />
        </Alan>
        <Alan etiket="Yeni parola (tekrar)">
          <Girdi
            type="password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && kaydet()}
            aria-label="Yeni parola (tekrar)"
          />
        </Alan>
        {hata && (
          <div role="alert" style={{ color: "var(--kirmizi)", fontWeight: 600 }}>
            {hata}
          </div>
        )}
      </div>
    </Modal>
  );
}
