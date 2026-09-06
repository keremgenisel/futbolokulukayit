// Lisans yönetimi (ÜRETİCİ) — aktivasyon sunucusunun /admin uçlarına konuşur. curl GEREKMEZ (Node fetch).
// Sunucu adresi electron/aktivasyonIstemci.cjs'ten (AKTIVASYON_URL) okunur. Admin token:
//   ortamdan EYUPSPOR_ADMIN_TOKEN, yoksa scripts/keys/admin-token.txt dosyasından (gitignore'da).
//
// Kullanım:
//   node scripts/lisans-yonet.cjs kaydet --anahtar "EYUPSPOR..." --kurulum 3   (yeni müşteri: kaydet + limit)
//   node scripts/lisans-yonet.cjs iptal  --anahtar "EYUPSPOR..."               (iptal: yenileme kesilir)
//   node scripts/lisans-yonet.cjs ac     --anahtar "EYUPSPOR..."               (iptali geri al)
//   node scripts/lisans-yonet.cjs liste  --anahtar "EYUPSPOR..."               (kurulumları göster)
const fs = require("fs");
const path = require("path");

const komut = process.argv[2];
const arg = (ad) => { const i = process.argv.indexOf("--" + ad); return i > -1 ? process.argv[i + 1] : null; };
const KOMUTLAR = ["kaydet", "iptal", "ac", "liste", "tumu"];

if (!KOMUTLAR.includes(komut)) {
  console.log([
    "Kullanım:",
    "  node scripts/lisans-yonet.cjs tumu                                    (TÜM lisansları listele)",
    '  node scripts/lisans-yonet.cjs kaydet --anahtar "EYUPSPOR..." --kurulum 3',
    '  node scripts/lisans-yonet.cjs iptal  --anahtar "EYUPSPOR..."',
    '  node scripts/lisans-yonet.cjs ac     --anahtar "EYUPSPOR..." [--kurulum 3]',
    '  node scripts/lisans-yonet.cjs liste  --anahtar "EYUPSPOR..."             (tek lisansın kurulumları)',
  ].join("\n"));
  process.exit(1);
}

const src = fs.readFileSync(path.join(__dirname, "..", "electron", "aktivasyonIstemci.cjs"), "utf8");
const SUNUCU = (src.match(/AKTIVASYON_URL\s*=\s*"([^"]+)"/) || [])[1];
if (!SUNUCU) { console.error("HATA: AKTIVASYON_URL boş (electron/aktivasyonIstemci.cjs). Önce sunucuyu deploy edip adresi göm."); process.exit(1); }

const tokenDosya = path.join(__dirname, "keys", "admin-token.txt");
const TOKEN = process.env.EYUPSPOR_ADMIN_TOKEN || (fs.existsSync(tokenDosya) ? fs.readFileSync(tokenDosya, "utf8").trim() : null);
if (!TOKEN) {
  console.error("HATA: Admin token yok. Bir kez şunu yap:\n  echo \"ADMIN_TOKEN_DEĞERİN\" > scripts/keys/admin-token.txt\n(veya EYUPSPOR_ADMIN_TOKEN ortam değişkenini ayarla)");
  process.exit(1);
}

const post = async (yol, govde) => {
  const r = await fetch(SUNUCU + yol, { method: "POST", headers: { "content-type": "application/json", "x-admin-token": TOKEN }, body: JSON.stringify(govde) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const get = async (yol) => {
  const r = await fetch(SUNUCU + yol, { headers: { "x-admin-token": TOKEN } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
// İptal/aç sırasında mevcut kurulum limitini KORU (admin/lisans upsert maksKurulum'u body'den yazar).
const mevcutKurulum = async (anahtar) => (await get("/admin/liste?anahtar=" + encodeURIComponent(anahtar))).body?.lisans?.maksKurulum ?? null;

(async () => {
  const anahtar = arg("anahtar");
  if (komut !== "tumu" && !anahtar) { console.error("HATA: --anahtar gerekli"); process.exit(1); }
  try {
    if (komut === "tumu") {
      const r = await get("/admin/hepsi");
      const list = r.body?.lisanslar || [];
      if (!list.length) { console.log("Kayıtlı lisans yok."); return; }
      console.log(`${list.length} lisans:\n`);
      console.log("FİRMA".padEnd(28) + "BİTİŞ".padEnd(13) + "KULLANICI".padEnd(11) + "KURULUM".padEnd(11) + "DURUM".padEnd(9) + "OLUŞTURULDU");
      console.log("-".repeat(88));
      for (const l of list) {
        console.log(
          String(l.firma || "-").slice(0, 27).padEnd(28) +
          String(l.bitis || "süresiz").padEnd(13) +
          String(l.maksKullanici ?? "∞").padEnd(11) +
          `${l.kurulumSayisi}/${l.maksKurulum ?? "∞"}`.padEnd(11) +
          (l.iptal ? "İPTAL" : "aktif").padEnd(9) +
          String(l.olusturuldu || ""));
      }
    } else if (komut === "kaydet") {
      const kurulum = arg("kurulum") ? Number(arg("kurulum")) : null;
      const r = await post("/admin/lisans", { anahtar, maksKurulum: kurulum, iptal: false });
      console.log(r.body.ok ? `✅ Kaydedildi (maksKurulum: ${kurulum ?? "sınırsız"})` : `❌ ${r.body.error || "hata " + r.status}`);
    } else if (komut === "iptal") {
      const r = await post("/admin/lisans", { anahtar, maksKurulum: await mevcutKurulum(anahtar), iptal: true });
      console.log(r.body.ok ? "✅ İptal edildi. Yenileme kesildi; mevcut lease penceresi (LEASE_GUN) dolunca uygulama salt-okunura düşer." : `❌ ${r.body.error || "hata " + r.status}`);
    } else if (komut === "ac") {
      const kurulum = arg("kurulum") ? Number(arg("kurulum")) : await mevcutKurulum(anahtar);
      const r = await post("/admin/lisans", { anahtar, maksKurulum: kurulum, iptal: false });
      console.log(r.body.ok ? `✅ İptal kaldırıldı (maksKurulum: ${kurulum ?? "sınırsız"}).` : `❌ ${r.body.error || "hata " + r.status}`);
    } else if (komut === "liste") {
      const r = await get("/admin/liste?anahtar=" + encodeURIComponent(anahtar));
      console.log(JSON.stringify(r.body, null, 2));
    }
  } catch (e) { console.error("Sunucuya ulaşılamadı:", e.message); process.exit(1); }
})();
