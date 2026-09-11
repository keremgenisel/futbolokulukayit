import { Btn, Alan, Girdi, Modal } from "../ui.jsx";
import { paraTR } from "../../lib/aidat.js";

/** Makbuz iptali: neden zorunlu (plan §7 göçü; refactor 2. tur §8.2). */
export function MakbuzIptalModal({ makbuz, neden, onNeden, onIptalEt, onKapat }) {
  return (
    <Modal
      baslik="Makbuz İptali"
      genislik={480}
      onKapat={onKapat}
      altBar={
        <>
          <Btn tur="ghost" onClick={onKapat}>
            Vazgeç
          </Btn>
          <Btn tur="danger" onClick={onIptalEt}>
            İptal Et
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0 }}>
          <b>{makbuz.makbuz_no}</b> numaralı makbuz ({makbuz.ad_soyad}, {paraTR(makbuz.toplam)}) iptal edilecek; ödenen aidat tutarı geri
          düşülür. İptal, neden ve iptal edenle birlikte kayıtta kalır, raporda ayrı görünür.
        </p>
        <Alan etiket="İptal nedeni *">
          <Girdi
            value={neden}
            onChange={(e) => onNeden(e.target.value)}
            placeholder="Yanlış oyuncu, yanlış tutar, ödeme iade edildi…"
            aria-label="İptal nedeni"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onIptalEt()}
          />
        </Alan>
      </div>
    </Modal>
  );
}
