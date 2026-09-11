import { useEffect, useState } from "react";
import { db } from "../lib/api.js";
import { UyariSeridi } from "./ui.jsx";

// Güvenlik incelemesi #7: safeStorage (Windows DPAPI / macOS Keychain) yoksa veritabanı ŞİFRESİZ kalır ve kimse fark etmezdi.
// Yöneticiye kalıcı kırmızı şerit; kullanıcı rolüne gösterilmez (yapabileceği bir şey yok).
export function SifresizUyari({ oturum }) {
  const [sifresiz, setSifresiz] = useState(false);
  useEffect(() => {
    if (!oturum || oturum.role !== "admin" || oturum.must_change_password) return;
    db("isEncrypted")
      .then((v) => setSifresiz(v === false))
      .catch(() => {});
  }, [oturum]);
  if (!sifresiz) return null;
  return (
    <UyariSeridi ton="kirmizi" data-testid="sifresiz-uyari" style={{ marginBottom: 20 }} baslik="Veritabanı şifreli değil">
      Bu bilgisayarda işletim sisteminin anahtar deposu kullanılamadığı için veriler şifrelenemiyor (TC ve sağlık bilgileri düz dosyada).
      Windows'ta oturum profilini ve DPAPI'yi kontrol edin; sorun sürerse yazılımcıya bildirin.
    </UyariSeridi>
  );
}
