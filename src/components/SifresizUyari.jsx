import { useEffect, useState } from "react";
import { db } from "../lib/api.js";

// Güvenlik incelemesi #7: safeStorage (Windows DPAPI / macOS Keychain) yoksa veritabanı ŞİFRESİZ kalır ve kimse fark etmezdi.
// Yöneticiye kalıcı kırmızı şerit; kullanıcı rolüne gösterilmez (yapabileceği bir şey yok).
export function SifresizUyari({ oturum }) {
  const [sifresiz, setSifresiz] = useState(false);
  useEffect(() => {
    if (!oturum || oturum.role !== "admin" || oturum.must_change_password) return;
    db("isEncrypted").then((v) => setSifresiz(v === false)).catch(() => {});
  }, [oturum]);
  if (!sifresiz) return null;
  return (
    <div role="alert" data-testid="sifresiz-uyari" style={{ background: "var(--kirmizi-acik)", border: "1.5px solid var(--kirmizi)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: "var(--kirmizi)" }}>Veritabanı şifreli değil</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>Bu bilgisayarda işletim sisteminin anahtar deposu kullanılamadığı için veriler şifrelenemiyor (TC ve sağlık bilgileri düz dosyada). Windows'ta oturum profilini ve DPAPI'yi kontrol edin; sorun sürerse yazılımcıya bildirin.</div>
    </div>
  );
}
