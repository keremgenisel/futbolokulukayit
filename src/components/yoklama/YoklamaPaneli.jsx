import { Btn, Avatar, Rozet, Bos } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { saatAraligi } from "../../lib/program.js";
import { AntrenmanDuzenle } from "./AntrenmanDuzenle.jsx";

/** Geldi / Gelmedi / İzinli düğmesi; seçiliye yeniden tıklamak işareti kaldırır (plan §26). */
function IsaretDugmesi({ on, durum, etiket, kapali, onTikla }) {
  const renk = { geldi: "var(--yesil)", gelmedi: "var(--kirmizi)", izinli: "#7A6300" }[durum];
  return (
    <button
      type="button"
      onClick={onTikla}
      disabled={kapali}
      aria-pressed={on}
      title={on ? "Tekrar tıklayınca işaret kaldırılır" : ""}
      style={{
        height: 36,
        width: 96,
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: on ? 700 : 600,
        fontSize: 13,
        border: `1px solid ${on ? renk : "var(--cizgi)"}`,
        background: on ? renk : "#fff",
        color: on ? "#fff" : "var(--soluk)",
      }}
    >
      {etiket}
    </button>
  );
}

/**
 * Seçili antrenmanın yoklama paneli: başlık (sayaçlar, rozetler, eylem düğmeleri), düzenleme çubuğu, oyuncu satırları.
 * Veri ve işlemler üst bileşende (Yoklama.jsx); burası yalnız çizer. Refactor 2. tur §8.1.
 */
export function YoklamaPaneli({
  aktif,
  oyuncular,
  yoklama,
  saltOkunur,
  duzen,
  onDuzen,
  onDuzenKaydet,
  onIsaretle,
  onTumuGeldi,
  onFormYazdir,
  onFormPdf,
  onIptal,
  onBildir,
  onGrupGeriAl,
}) {
  if (!aktif) return <Bos metin="Yoklama almak için yukarıdan bir antrenman seçin." />;
  const say = (d) => oyuncular.filter((o) => yoklama[o.id] === d).length;
  const borclu = oyuncular.filter((o) => o.aidat_durum === "odenmedi").length;
  const kapali = saltOkunur || !!aktif.iptal;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--cizgi)",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 22 }}>
            {aktif.yas_grubu_ad} Yoklama{aktif.saat ? ` · ${saatAraligi(aktif.saat, aktif.bitis_saat || "")}` : ""}
          </h3>
          <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
            {[
              ["Toplam", oyuncular.length, ""],
              ["Geldi", say("geldi"), "var(--yesil)"],
              ["Gelmedi", say("gelmedi"), "var(--kirmizi)"],
              ["İzinli", say("izinli"), ""],
              ["İşaretlenmedi", oyuncular.length - say("geldi") - say("gelmedi") - say("izinli"), ""],
            ].map(([e, n, c]) => (
              <span key={e}>
                <span style={{ color: "var(--soluk)" }}>{e} </span>
                <b style={{ color: c || "inherit" }}>{n}</b>
              </span>
            ))}
          </div>
          {borclu > 0 && <Rozet ton="red">{borclu} aidat borcu</Rozet>}
          {aktif.iptal ? <Rozet ton="red">İptal edildi</Rozet> : null}
          {aktif.grup_bildirim ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Rozet ton="green">Veli grubuna bildirildi</Rozet>
              {!saltOkunur && (
                <button
                  type="button"
                  onClick={onGrupGeriAl}
                  aria-label="Grup bildirimini geri al"
                  style={{
                    background: "none",
                    border: 0,
                    color: "var(--soluk)",
                    cursor: "pointer",
                    fontSize: 12.5,
                    textDecoration: "underline",
                  }}
                >
                  Geri al
                </button>
              )}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {aktif.bildirim_gerekli ? (
            <Btn
              tur="yesil"
              ikon={<Ikon ad="whatsapp" />}
              onClick={() => onBildir(aktif, aktif.iptal ? "iptal" : "degisiklik")}
              title="Grubun velilerine WhatsApp ile iptal/değişiklik bildir"
            >
              Velilere Bildir
            </Btn>
          ) : null}
          {!aktif.iptal && (
            <>
              <Btn
                tur="ghost"
                ikon={<Ikon ad="yazdir" />}
                onClick={onFormYazdir}
                title="Sahada elle doldurulacak A4 yoklama formu; programda işaretli olanlar dolu gelir"
              >
                Formu Yazdır
              </Btn>
              <Btn tur="ghost" ikon={<Ikon ad="indir" />} onClick={onFormPdf} title="Yoklama formunu PDF olarak kaydet">
                PDF
              </Btn>
              {!saltOkunur && (
                <Btn tur="ghost" ikon={<Ikon ad="onay" />} onClick={onTumuGeldi}>
                  Kalanları Geldi İşaretle
                </Btn>
              )}
              {!saltOkunur && !duzen && (
                <Btn
                  tur="ghost"
                  ikon={<Ikon ad="takvim" />}
                  onClick={() =>
                    onDuzen({ tarih: aktif.tarih, saat: aktif.saat || "", bitis: aktif.bitis_saat || "", saha: aktif.saha || "" })
                  }
                >
                  Düzenle
                </Btn>
              )}
              {!saltOkunur && (
                <Btn tur="danger" ikon={<Ikon ad="kapat" />} onClick={() => onIptal(aktif)}>
                  İptal Et
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
      {duzen && (
        <AntrenmanDuzenle
          duzen={duzen}
          onDegis={onDuzen}
          onKaydet={onDuzenKaydet}
          onVazgec={() => onDuzen(null)}
          tarihKilitli={aktif.isaretli > 0}
        />
      )}
      {oyuncular.length === 0 ? (
        <Bos metin="Bu grupta aktif oyuncu yok." />
      ) : (
        oyuncular.map((o) => (
          <div
            key={o.id}
            style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderBottom: "1px solid var(--cizgi)" }}
          >
            <Avatar ad={o.ad_soyad} boyut={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}>
                {o.ad_soyad}
                {o.aidat_durum === "odenmedi" && <Rozet ton="red">Aidat</Rozet>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                ["geldi", "Geldi"],
                ["gelmedi", "Gelmedi"],
                ["izinli", "İzinli"],
              ].map(([durum, etiket]) => (
                <IsaretDugmesi
                  key={durum}
                  on={yoklama[o.id] === durum}
                  durum={durum}
                  etiket={etiket}
                  kapali={kapali}
                  onTikla={() => onIsaretle(o.id, durum)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
