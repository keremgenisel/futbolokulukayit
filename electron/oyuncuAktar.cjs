// Excel'den oyuncu aktarımı — SAF satır çözümleme (I/O yok, test edilebilir). exceljs okuma ipc/aktar.cjs'te.
// Başlıklar Türkçe ve toleranslı eşleşir (büyük/küçük harf, boşluk, noktalama). Zorunlu: Ad Soyad, Doğum Tarihi.
const SUTUNLAR = [
  { anahtar: "ad_soyad", basliklar: ["ad soyad", "adı soyadı", "ad", "isim"], zorunlu: true },
  { anahtar: "tc_no", basliklar: ["tc", "tc no", "tc kimlik", "tc kimlik no", "kimlik no"] },
  { anahtar: "pasaport_no", basliklar: ["pasaport", "pasaport no"] },
  { anahtar: "dogum_tarihi", basliklar: ["doğum tarihi", "dogum tarihi", "doğum", "d tarihi"], zorunlu: true },
  { anahtar: "dogum_yeri", basliklar: ["doğum yeri", "dogum yeri"] },
  { anahtar: "okul", basliklar: ["okul", "okulu"] },
  { anahtar: "gsm", basliklar: ["gsm", "telefon", "oyuncu telefon", "cep"] },
  { anahtar: "adres", basliklar: ["adres", "ev adresi"] },
  { anahtar: "kan_grubu", basliklar: ["kan grubu", "kan"] },
  { anahtar: "yas_grubu", basliklar: ["yaş grubu", "yas grubu", "grup", "takım", "takim"] },
  { anahtar: "durum", basliklar: ["durum"] },
  { anahtar: "ucret_tipi", basliklar: ["ücret tipi", "ucret tipi", "ücret", "burs"] },
  { anahtar: "aylik_aidat", basliklar: ["aylık aidat", "aylik aidat", "aidat"] },
  { anahtar: "odeme_donemi", basliklar: ["ödeme dönemi", "odeme donemi", "dönem"] },
  { anahtar: "kayit_tarihi", basliklar: ["kayıt tarihi", "kayit tarihi"] },
  { anahtar: "veli_ad", basliklar: ["veli", "veli adı", "veli ad soyad", "anne baba"] },
  { anahtar: "veli_tel", basliklar: ["veli telefonu", "veli tel", "veli gsm", "veli telefon"] },
  { anahtar: "notlar", basliklar: ["not", "notlar", "açıklama"] },
];
const DURUM = { aktif: "aktif", deneme: "deneme", pasif: "pasif", ayrıldı: "ayrildi", ayrildi: "ayrildi", sakat: "sakat", dondurma: "dondurma" };
const UCRET = { normal: "normal", burslu: "burslu", indirimli: "indirimli", kardeş: "kardes", kardes: "kardes", "kardeş indirimi": "kardes", ücretsiz: "ucretsiz", ucretsiz: "ucretsiz" };
const DONEM = new Set(["1-10", "11-20", "21-31"]);

const norm = (s) => String(s ?? "").trim().toLocaleLowerCase("tr-TR").replace(/[.:_-]+/g, " ").replace(/\s+/g, " ");

/** Başlık satırından sütun eşlemesi: { anahtar: sütunIndeksi } */
function basliklariEsle(baslikSatiri) {
  const map = {};
  baslikSatiri.forEach((b, i) => {
    const n = norm(b);
    if (!n) return;
    const s = SUTUNLAR.find((c) => c.basliklar.includes(n));
    if (s && map[s.anahtar] === undefined) map[s.anahtar] = i;
  });
  return map;
}

/** "02.11.2015" | "2015-11-02" | "2/11/2015" | Date | Excel seri no → "2015-11-02" ya da null */
function tarihCoz(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) { // Excel seri günü (1900 sistemi)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
const rakamlar = (v) => String(v ?? "").replace(/\D/g, "");
const gsmCoz = (v) => { let r = rakamlar(v); if (r.startsWith("90") && r.length === 12) r = r.slice(2); if (r.length === 10 && r.startsWith("5")) r = "0" + r; return r; };

/**
 * @param {any[][]} satirlar İlk satır başlık. Hücreler ham (string/number/Date).
 * @param {{ gruplar: {id:number, ad:string}[], mevcutTc?: Set<string>, mevcutPasaport?: Set<string> }} ctx
 * @returns {{ kayitlar: object[], hatalar: {satir:number, mesaj:string}[], uyarilar: {satir:number, mesaj:string}[], yeniGruplar: string[], eslesme: object }}
 */
function satirlariCoz(satirlar, { gruplar = [], mevcutTc = new Set(), mevcutPasaport = new Set(), ucretTipleri = [] } = {}) {
  // Ücret tipi: varsayılan sözlük + veritabanındaki tipler (ad ve kod ile; Ayarlar'dan eklenenler de tanınır)
  const ucretSozluk = { ...UCRET };
  for (const t of ucretTipleri) { ucretSozluk[norm(t.kod)] = t.kod; ucretSozluk[norm(t.ad)] = t.kod; }
  const hatalar = [], uyarilar = [], kayitlar = [], yeniGruplar = new Set();
  if (!satirlar.length) return { kayitlar, hatalar: [{ satir: 0, mesaj: "Dosya boş" }], uyarilar, yeniGruplar: [], eslesme: {} };
  const es = basliklariEsle(satirlar[0]);
  for (const c of SUTUNLAR) if (c.zorunlu && es[c.anahtar] === undefined) hatalar.push({ satir: 1, mesaj: `Başlık satırında "${c.basliklar[0]}" sütunu bulunamadı` });
  if (hatalar.length) return { kayitlar, hatalar, uyarilar, yeniGruplar: [], eslesme: es };
  const grupAdlari = new Map(gruplar.map((g) => [norm(g.ad).replace(/\s/g, ""), g.id]));
  const gorulenTc = new Set(), gorulenPas = new Set();
  const al = (row, k) => (es[k] === undefined ? undefined : row[es[k]]);
  for (let i = 1; i < satirlar.length; i++) {
    const row = satirlar[i] || []; const no = i + 1;
    if (row.every((h) => h === null || h === undefined || String(h).trim() === "")) continue;
    const ad = String(al(row, "ad_soyad") ?? "").trim();
    if (!ad) { hatalar.push({ satir: no, mesaj: "Ad soyad boş" }); continue; }
    const dogum = tarihCoz(al(row, "dogum_tarihi"));
    if (!dogum) { hatalar.push({ satir: no, mesaj: `${ad}: doğum tarihi okunamadı (gg.aa.yyyy bekleniyor)` }); continue; }
    const k = { ad_soyad: ad, dogum_tarihi: dogum, uyruk: "tc", tc_no: null, pasaport_no: null, durum: "aktif", ucret_tipi: "normal", odeme_donemi: "1-10", aylik_aidat: 0 };
    const tc = rakamlar(al(row, "tc_no")); const pas = String(al(row, "pasaport_no") ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
    if (tc) {
      if (tc.length !== 11) { hatalar.push({ satir: no, mesaj: `${ad}: TC 11 haneli değil (${tc})` }); continue; }
      if (mevcutTc.has(tc)) { uyarilar.push({ satir: no, mesaj: `${ad}: bu TC zaten kayıtlı, atlandı` }); continue; }
      if (gorulenTc.has(tc)) { uyarilar.push({ satir: no, mesaj: `${ad}: aynı TC dosyada iki kez, ikincisi atlandı` }); continue; }
      gorulenTc.add(tc); k.tc_no = tc;
    } else if (pas) {
      if (!/^[A-Z0-9]{5,15}$/.test(pas)) { hatalar.push({ satir: no, mesaj: `${ad}: pasaport no geçersiz (${pas})` }); continue; }
      if (mevcutPasaport.has(pas) || gorulenPas.has(pas)) { uyarilar.push({ satir: no, mesaj: `${ad}: bu pasaport zaten kayıtlı, atlandı` }); continue; }
      gorulenPas.add(pas); k.uyruk = "yabanci"; k.pasaport_no = pas;
    }
    for (const alan of ["dogum_yeri", "okul", "adres", "kan_grubu", "notlar"]) { const v = al(row, alan); if (v !== undefined && v !== null && String(v).trim()) k[alan] = String(v).trim(); }
    const gsm = al(row, "gsm"); if (gsm) k.gsm = gsmCoz(gsm);
    const grupHam = String(al(row, "yas_grubu") ?? "").trim();
    if (grupHam) {
      const anahtar = norm(grupHam).replace(/\s/g, "");
      if (grupAdlari.has(anahtar)) k.yas_grubu_id = grupAdlari.get(anahtar);
      else { k.yeni_grup = grupHam.toLocaleUpperCase("tr-TR").replace(/\s+/g, ""); yeniGruplar.add(k.yeni_grup); }
    }
    const durumHam = norm(al(row, "durum")); if (durumHam) { if (DURUM[durumHam]) k.durum = DURUM[durumHam]; else uyarilar.push({ satir: no, mesaj: `${ad}: durum "${durumHam}" tanınmadı, Aktif yazıldı` }); }
    const ucretHam = norm(al(row, "ucret_tipi")); if (ucretHam) { if (ucretSozluk[ucretHam]) k.ucret_tipi = ucretSozluk[ucretHam]; else uyarilar.push({ satir: no, mesaj: `${ad}: ücret tipi "${ucretHam}" tanınmadı, Normal yazıldı` }); }
    const aidatHam = al(row, "aylik_aidat"); if (aidatHam !== undefined && aidatHam !== null && String(aidatHam).trim() !== "") { const n = Number(rakamlar(aidatHam)); k.aylik_aidat = Number.isFinite(n) ? n : 0; }
    const donemHam = String(al(row, "odeme_donemi") ?? "").trim().replace(/\s/g, ""); if (donemHam) { if (DONEM.has(donemHam)) k.odeme_donemi = donemHam; else uyarilar.push({ satir: no, mesaj: `${ad}: ödeme dönemi "${donemHam}" tanınmadı (1-10, 11-20, 21-31), 1-10 yazıldı` }); }
    const kayit = tarihCoz(al(row, "kayit_tarihi")); if (kayit) k.kayit_tarihi = kayit;
    const veliAd = String(al(row, "veli_ad") ?? "").trim(); const veliTel = al(row, "veli_tel");
    if (veliAd || veliTel) k.veli = { ad_soyad: veliAd || "Veli", gsm: veliTel ? gsmCoz(veliTel) : "" };
    k.satir = no;
    kayitlar.push(k);
  }
  return { kayitlar, hatalar, uyarilar, yeniGruplar: [...yeniGruplar], eslesme: es };
}

/** Şablon başlıkları ve örnek satır (şablon indirme için). */
const SABLON_BASLIKLAR = ["Ad Soyad", "TC Kimlik No", "Pasaport No", "Doğum Tarihi", "Yaş Grubu", "Durum", "Ücret Tipi", "Aylık Aidat", "Ödeme Dönemi", "GSM", "Veli Adı", "Veli Telefonu", "Okul", "Doğum Yeri", "Adres", "Kan Grubu", "Kayıt Tarihi", "Notlar"];
const SABLON_ORNEK = ["Kaan Yıldız", "12345678901", "", "02.11.2015", "U11", "Aktif", "Normal", "3500", "1-10", "05321234567", "Ayşe Yıldız", "05329876543", "Eyüp İlkokulu", "İstanbul", "", "A Rh+", "01.09.2026", ""];

module.exports = { satirlariCoz, basliklariEsle, tarihCoz, gsmCoz, SUTUNLAR, SABLON_BASLIKLAR, SABLON_ORNEK };
