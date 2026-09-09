import { useEffect, useState } from "react";
import { Kart, Btn, Alan, Girdi, Secim, Rozet, Onay, Bos, useToast, useDene } from "./ui.jsx";
import { db } from "../lib/api.js";
import { programCoz, programOzeti, GUN_ADLARI } from "../lib/program.js";
import { SezonSecim } from "./SezonSecim.jsx";
import { Ikon } from "./Ikon.jsx";
import { sezonSecenekleri } from "../lib/sezon.js";
import { bugun } from "../lib/api.js";

export function YasGruplari({ saltOkunur }) {
  const [gruplar, setGruplar] = useState([]);
  const [oyuncular, setOyuncular] = useState([]);
  const [sezonDurum, setSezonDurum] = useState(null); // { aktifSezon, baslangicAyi } — sezon kutusu bununla dolu gelir (plan §15)
  const [yeni, setYeni] = useState({ ad: "", sezon: "" }); // sezon boş = aktif sezon (SezonSecim ilk seçeneği)
  const [duzenle, setDuzenle] = useState(null); // { id, ad, sezon, sira, aktif }
  const [sil, setSil] = useState(null);
  const [pasifGoster, setPasifGoster] = useState(false); // varsayılan: yalnız aktif gruplar (plan §17.1)
  const [sezonF, setSezonF] = useState(null); // sezon süzgeci (plan §21): null → aktif sezon, "" → tüm sezonlar
  const [sezonlar, setSezonlar] = useState([]);
  const toast = useToast();
  const dene = useDene();

  const aktifSezon = sezonSecenekleri({
    aktifSezon: sezonDurum?.aktifSezon || "",
    bugunIso: bugun().iso,
    baslangicAyi: sezonDurum?.baslangicAyi || 9,
  })[0].kod;
  const seciliSezon = sezonF === null ? aktifSezon : sezonF; // "" = tüm sezonlar
  const aktifSezonda = seciliSezon === aktifSezon;
  const yukle = () =>
    dene(async () => {
      setGruplar(await db("listAgeGroups", { sezon: seciliSezon || null }));
      setOyuncular(await db("listPlayers"));
      setSezonDurum((await db("sezonDurumu")) || null);
      setSezonlar((await db("sezonListesi")) || []);
    });
  useEffect(() => {
    yukle();
  }, [seciliSezon]); // eslint-disable-line react-hooks/exhaustive-deps

  const sayi = (id) => oyuncular.filter((o) => o.yas_grubu_id === id && ["aktif", "deneme", "sakat"].includes(o.durum)).length;

  const ekle = async () => {
    if (!yeni.ad.trim()) return;
    return dene(async () => {
      const eklenenSezon = yeni.sezon || aktifSezon;
      await db("createAgeGroup", { ad: yeni.ad.trim(), sezon: eklenenSezon, sira: gruplar.length + 1 });
      setYeni({ ad: "", sezon: "" }); // sezon yine aktif sezona döner
      toast("ok", "Grup eklendi");
      // Eklenen grup seçili sezonun süzgecine girmiyorsa (örn. sonraki sezon için açıldı) süzgeç o sezona geçer ki grup görünsün
      if (seciliSezon && eklenenSezon !== seciliSezon) setSezonF(eklenenSezon);
      else yukle();
    });
  };
  const kaydet = () =>
    dene(async () => {
      await db("updateAgeGroup", duzenle.id, {
        ad: duzenle.ad,
        sezon: duzenle.sezon || aktifSezon,
        sira: Number(duzenle.sira) || 0,
        aktif: duzenle.aktif ? 1 : 0,
        program: (duzenle.programListe || []).filter((p) => p.saat),
      });
      setDuzenle(null);
      toast("ok", "Kaydedildi");
      yukle();
    });
  // Durum rozeti tek tıkla Aktif ↔ Pasif (plan §17.1); Düzenle'ye girmeden
  const durumDegistir = (g) =>
    dene(async () => {
      await db("updateAgeGroup", g.id, { aktif: g.aktif ? 0 : 1 });
      toast("ok", g.aktif ? `${g.ad} pasife alındı` : `${g.ad} aktif`);
      yukle();
    });
  // Aktif sezonda yalnız aktifler (+ onay kutusu); geçmiş sezon / tüm sezonlarda o sezonun tüm grupları (bugün pasif olabilir)
  const gorunen = gruplar.filter((g) => g.aktif || pasifGoster || !aktifSezonda);
  const pasifSayisi = gruplar.filter((g) => !g.aktif).length;
  const silOnayla = () =>
    dene(async () => {
      const r = await db("deleteAgeGroup", sil.id);
      if (r?.error) toast("err", r.error);
      else toast("ok", "Grup silindi");
      setSil(null);
      yukle();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!saltOkunur && (
        <Kart style={{ padding: 20, display: "flex", gap: 12, alignItems: "flex-end" }}>
          <Alan etiket="Grup adı" style={{ width: 200 }}>
            <Girdi
              value={yeni.ad}
              onChange={(e) => setYeni({ ...yeni, ad: e.target.value })}
              placeholder="U11"
              onKeyDown={(e) => e.key === "Enter" && ekle()}
            />
          </Alan>
          <Alan etiket="Sezon" style={{ width: 220 }}>
            <SezonSecim durum={sezonDurum} value={yeni.sezon} onChange={(v) => setYeni({ ...yeni, sezon: v })} aria-label="Sezon" />
          </Alan>
          <Btn onClick={ekle} disabled={!yeni.ad.trim()}>
            Grup Ekle
          </Btn>
        </Kart>
      )}
      <Kart>
        {/* Liste süzgeci: üstteki "Grup Ekle" formundan ayrışsın diye gri zeminli, ikonlu, kompakt bir çubuk (form beyaz kart + etiketli alanlar) */}
        <div
          data-testid="grup-suzgec"
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "10px 16px",
            background: "var(--zemin)",
            borderBottom: "1px solid var(--cizgi)",
            borderRadius: "12px 12px 0 0",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--soluk)",
            }}
          >
            <Ikon ad="filtre" boyut={16} />
            Süzgeç
          </span>
          <Secim
            secenekler={[...new Set([aktifSezon, seciliSezon, ...sezonlar].filter(Boolean))].map((s) => ({
              kod: s,
              ad: s === aktifSezon ? `${s} (aktif sezon)` : s,
            }))}
            bos="Tüm sezonlar"
            value={seciliSezon}
            onChange={(e) => setSezonF(e.target.value)}
            style={{ width: 200, height: 34, fontSize: 14 }}
            aria-label="Sezon süzgeci"
          />
          {aktifSezonda && pasifSayisi > 0 && (
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 13.5,
                color: "var(--mor-koyu)",
                background: "#fff",
                border: "1px solid var(--cizgi)",
                borderRadius: 999,
                padding: "6px 12px 6px 10px",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={pasifGoster} onChange={(e) => setPasifGoster(e.target.checked)} style={{ margin: 0 }} />
              Pasif grupları da göster ({pasifSayisi})
            </label>
          )}
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--soluk)" }}>
            {gorunen.length} grup{gorunen.length !== gruplar.length ? ` · ${gruplar.length - gorunen.length} gizli` : ""}
          </span>
        </div>
        {gruplar.length === 0 ? (
          <Bos metin={aktifSezonda ? "Henüz yaş grubu yok. Yukarıdan ekleyin." : "Bu sezonda grup yok."} />
        ) : gorunen.length === 0 ? (
          <Bos metin="Aktif grup yok. Pasif grupları göstermek için yukarıdaki kutuyu işaretleyin." />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Sıra</th>
                <th>Grup</th>
                <th>Sezon</th>
                <th>Aktif oyuncu</th>
                <th>Haftalık program</th>
                <th>Durum</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map((g) =>
                duzenle?.id === g.id ? (
                  <tr key={g.id}>
                    <td>
                      <Girdi
                        value={duzenle.sira}
                        onChange={(e) => setDuzenle({ ...duzenle, sira: e.target.value })}
                        style={{ width: 56, height: 36 }}
                      />
                    </td>
                    <td>
                      <Girdi value={duzenle.ad} onChange={(e) => setDuzenle({ ...duzenle, ad: e.target.value })} style={{ height: 36 }} />
                    </td>
                    <td>
                      <SezonSecim
                        durum={sezonDurum}
                        value={duzenle.sezon}
                        onChange={(v) => setDuzenle({ ...duzenle, sezon: v })}
                        aria-label="Sezon"
                        style={{ height: 36 }}
                      />
                    </td>
                    <td>{sayi(g.id)}</td>
                    <td>
                      <ProgramDuzenle liste={duzenle.programListe || []} onDegis={(l) => setDuzenle({ ...duzenle, programListe: l })} />
                    </td>
                    <td>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={!!duzenle.aktif}
                          onChange={(e) => setDuzenle({ ...duzenle, aktif: e.target.checked })}
                        />{" "}
                        Aktif
                      </label>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Btn kucuk tur="ghost" onClick={() => setDuzenle(null)}>
                          Vazgeç
                        </Btn>
                        <Btn kucuk onClick={kaydet}>
                          Kaydet
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id}>
                    <td style={{ color: "var(--soluk)" }}>{g.sira}</td>
                    <td>
                      <Rozet ton="purple">{g.ad}</Rozet>
                    </td>
                    <td>
                      {g.sezon || "—"}
                      {g.sezon && g.sezon !== aktifSezon && (
                        <span style={{ color: "var(--soluk)", fontSize: 12, marginLeft: 6 }}>
                          {g.sezon > aktifSezon ? "(gelecek)" : "(eski)"}
                        </span>
                      )}
                    </td>
                    <td>
                      <b>{sayi(g.id)}</b>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {programOzeti(programCoz(g.program)) || <span style={{ color: "var(--soluk)" }}>—</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => durumDegistir(g)}
                        disabled={saltOkunur}
                        aria-label={`${g.ad} durum: ${g.aktif ? "Aktif" : "Pasif"}`}
                        title={saltOkunur ? "" : g.aktif ? "Tıklayınca pasife alınır" : "Tıklayınca aktif olur"}
                        style={{ background: "none", border: 0, padding: 0, cursor: saltOkunur ? "default" : "pointer" }}
                      >
                        {g.aktif ? <Rozet ton="green">Aktif</Rozet> : <Rozet ton="gray">Pasif</Rozet>}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {!saltOkunur && (
                          <>
                            <Btn kucuk tur="ghost" onClick={() => setDuzenle({ ...g, programListe: programCoz(g.program) })}>
                              Düzenle
                            </Btn>
                            <Btn kucuk tur="danger" onClick={() => setSil(g)}>
                              Sil
                            </Btn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </Kart>
      {sil && (
        <Onay
          tehlikeli
          mesaj={`"${sil.ad}" grubunu silmek istiyor musunuz? Grupta oyuncu varsa silinemez.`}
          onEvet={silOnayla}
          onHayir={() => setSil(null)}
        />
      )}
    </div>
  );
}

// Haftalık program düzenleyici: gün başına saat ve saha; saat boşsa o gün program dışı.
function ProgramDuzenle({ liste, onDegis }) {
  const satir = (gun) => liste.find((p) => p.gun === gun) || { gun, saat: "", saha: "" };
  const degis = (gun, alan, deger) => {
    const yeni = liste.filter((p) => p.gun !== gun);
    const s = { ...satir(gun), [alan]: deger };
    if (s.saat || s.saha) yeni.push(s);
    onDegis(yeni.sort((a, b) => a.gun - b.gun));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {GUN_ADLARI.map((ad, i) => {
        const p = satir(i + 1);
        return (
          <div key={ad} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ width: 70, color: "var(--soluk)" }}>{ad.slice(0, 3)}</span>
            <input
              type="time"
              value={p.saat}
              onChange={(e) => degis(i + 1, "saat", e.target.value)}
              aria-label={`${ad} saati`}
              style={{ height: 30, borderRadius: 6, border: "1px solid var(--cizgi)", padding: "0 6px" }}
            />
            <input
              value={p.saha}
              onChange={(e) => degis(i + 1, "saha", e.target.value)}
              placeholder="Saha"
              aria-label={`${ad} sahası`}
              style={{ height: 30, width: 90, borderRadius: 6, border: "1px solid var(--cizgi)", padding: "0 6px" }}
            />
          </div>
        );
      })}
    </div>
  );
}
