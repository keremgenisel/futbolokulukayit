// Kalıcı lisans-meta birleştirme (Faz B1) — SAF modül: I/O yok, node altında test edilir.
// Amaç: deneme-sıfırlama ve saat-geri-alma sertleştirmesi. Kurulum bilgisi iki yerde tutulur —
// DB meta (data.db içinde) ve safeStorage ile şifreli AYRI bir dosya (userData/lisans-meta.enc).
// data.db silinse bile şifreli dosya kalır → "DB'yi silip 30 günü sıfırlama" hilesi kapanır.
//   kurulumTarihi = GÖRÜLEN EN ERKEN tarih (hangi kaynakta en eskisi varsa o; gelecekteki tarih
//                   bugüne çekilir — saati ileri alıp deneme başlangıcını erteleme denemesi).
//   sonGorulen    = GÖRÜLEN EN İLERİ tarih (monotonik saat işareti; geri alma tespiti durumHesapla'da).
//   makineId      = ilk üretildiğinde sabit kalır; kaynaklardan biri taşıyorsa yenisi üretilmez.
// dosya / meta biçimi: { makineId?, kurulumTarihi?, sonGorulen? } (her alan null olabilir).
function enErken(a, b) {
  const v = [a, b].filter(Boolean);
  return v.length ? v.sort()[0] : null;
}
function enIleri(a, b) {
  const v = [a, b].filter(Boolean);
  return v.length ? v.sort().slice(-1)[0] : null;
}

function birlestir({ dosya = null, meta = null, bugun, yeniMakineId }) {
  const d = dosya || {},
    m = meta || {};
  const makineId = d.makineId || m.makineId || yeniMakineId;
  const clamp = (t) => (t && t > bugun ? bugun : t); // gelecekteki tarih → bugüne çek
  const kurulumTarihi = enErken(clamp(d.kurulumTarihi), clamp(m.kurulumTarihi)) || bugun;
  const sonGorulen = enIleri(d.sonGorulen, m.sonGorulen); // bugünü katma: ileri-akış durumHesapla'da
  const lease = d.lease ?? m.lease ?? null; // aktivasyon lease'i (şifreli dosyada tutulur, B2)
  return { makineId, kurulumTarihi, sonGorulen, lease };
}

module.exports = { birlestir, enErken, enIleri };
