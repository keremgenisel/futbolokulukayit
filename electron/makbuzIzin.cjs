// SAF: makbuz PDF yazma izni (güvenlik incelemesi 08.09.2026 #4). salt okunurda yazılmaz; iptal edilmiş makbuz için yazılmaz; PDF'i zaten olan
// makbuzu yalnız yönetici yeniden üretebilir (arşiv kopyası değiştirilemesin).
function makbuzPdfIzni(oturum, makbuz, saltOkunur) {
  if (!oturum) return { ok: false, neden: "Oturum gerekli" };
  if (saltOkunur) return { ok: false, neden: "Lisans salt okunur modda" };
  if (!makbuz) return { ok: false, neden: "Makbuz bulunamadı" };
  if (makbuz.iptal) return { ok: false, neden: "İptal edilmiş makbuz için PDF üretilmez" };
  if (makbuz.pdf_yolu && oturum.role !== "admin")
    return { ok: false, neden: "Makbuz PDF'i zaten var; yeniden üretim yönetici yetkisi ister" };
  return { ok: true };
}
module.exports = { makbuzPdfIzni };
