// Oyuncu kartı > Yoklama sekmesi: geldi/gelmedi/izinli özeti ve son kayıtlar
import { Rozet, Bos } from "../ui.jsx";
import { tarihTR } from "../../lib/aidat.js";

import { TumunuGoster } from "./TumunuGoster.jsx";

export function YoklamaSekmesi({ yoklama, yoklamaOzet, tumu, son, onTumu }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
        {["geldi", "gelmedi", "izinli"].map((d) => (
          <div key={d}>
            <div style={{ fontSize: 12, color: "var(--soluk)", textTransform: "uppercase", fontWeight: 600 }}>{d}</div>
            <div className="baslik" style={{ fontSize: 32 }}>
              {yoklamaOzet[d] || 0}
            </div>
          </div>
        ))}
      </div>
      {yoklama.length === 0 ? (
        <Bos metin="Yoklama kaydı yok." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Saat</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {yoklama.map((y, i) => (
              <tr key={i}>
                <td>{tarihTR(y.tarih)}</td>
                <td>{y.saat}</td>
                <td>
                  <Rozet ton={y.durum === "geldi" ? "green" : y.durum === "gelmedi" ? "red" : "yellow"}>{y.durum}</Rozet>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!tumu.yoklama && yoklama.length >= son.yoklama && (
        <TumunuGoster onClick={() => onTumu("yoklama")} metin={`Son ${son.yoklama} yoklama gösteriliyor`} />
      )}
    </div>
  );
}
