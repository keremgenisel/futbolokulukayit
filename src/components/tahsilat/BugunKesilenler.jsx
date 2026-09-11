import { Kart, Btn, Bos } from "../ui.jsx";
import { Ikon } from "../Ikon.jsx";
import { ODEME_YONTEMLERI, paraTR } from "../../lib/aidat.js";

/** Bugün Kesilen Makbuzlar (plan §17.2/§22: sabit yükseklik, yapışık başlık, sayaç; refactor 2. tur §8.2). */
export function BugunKesilenler({ bugunku, saltOkunur, onYazdir, onIptal }) {
  return (
    <Kart>
      <div style={{ padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 22 }}>Bugün Kesilen Makbuzlar</h3>
        <span style={{ color: "var(--soluk)", fontSize: 14 }}>{bugunku.length} makbuz</span>
      </div>
      {bugunku.length === 0 ? (
        <Bos metin="Bugün henüz makbuz kesilmedi." />
      ) : (
        <div style={{ overflow: "auto", maxHeight: 460 }}>
          <table>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff" }}>
              <tr>
                <th>No</th>
                <th>Oyuncu</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Tahsil eden</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {bugunku.map((m) => (
                <tr key={m.id}>
                  <td>{m.makbuz_no}</td>
                  <td style={{ fontWeight: 600 }}>{m.ad_soyad}</td>
                  <td>{paraTR(m.toplam)}</td>
                  <td>{ODEME_YONTEMLERI.find((y) => y.kod === m.odeme_yontemi)?.ad}</td>
                  <td>{m.tahsil_eden}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn kucuk tur="ghost" ikon={<Ikon ad="yazdir" boyut={16} />} onClick={() => onYazdir(m.id)}>
                        Yazdır
                      </Btn>
                      {!saltOkunur && (
                        <Btn kucuk tur="danger" onClick={() => onIptal(m)}>
                          İptal
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Kart>
  );
}
