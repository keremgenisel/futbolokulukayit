import { Kart, Rozet } from "../ui.jsx";
import { tarihTR } from "../../lib/aidat.js";
import { belgeGecerlilik, belgeEtiketi } from "../../lib/belge.js";

const SAGLIK_KISA = 8; // panoda en acil 8 uyarı; "Tümü (n)" Oyuncular > "Sağlık raporu olmayanlar" filtresini açar (borçlular gibi)

/** Sağlık Raporu Uyarıları kartı (plan §25; refactor 2. tur §8.7 — Pano.jsx'ten ayrıldı). */
export function SaglikUyarilari({ saglik, iso, onOyuncu, onSekme }) {
  return (
    <Kart style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 22 }}>
          Sağlık Raporu Uyarıları <span style={{ color: "var(--soluk)", fontSize: 15, fontWeight: 500 }}>({saglik.uyarilar.length})</span>
        </h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "var(--soluk)", fontSize: 13 }}>
            Süresi dolan, 30 gün içinde dolacak ya da hiç yüklenmemiş · en acil önce
          </span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSekme("oyuncular", "saglik");
            }}
            style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Tümü ({saglik.uyarilar.length})
          </a>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Oyuncu</th>
            <th>Grup</th>
            <th>Geçerlilik</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {saglik.uyarilar.slice(0, SAGLIK_KISA).map((u) => {
            const d = u.durum === "yok" ? { durum: "yok", kalanGun: null } : belgeGecerlilik(u.gecerlilik, iso);
            return (
              <tr key={u.player_id} onClick={() => onOyuncu(u.player_id)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{u.ad_soyad}</td>
                <td>{u.yas_grubu_ad || "—"}</td>
                <td>{u.gecerlilik ? tarihTR(u.gecerlilik) : "—"}</td>
                <td>
                  <Rozet ton={u.durum === "dolacak" ? "yellow" : "red"}>
                    {u.durum === "yok" ? "Rapor yok" : u.durum === "tarihsiz" ? "Rapor tarihsiz" : belgeEtiketi(d)}
                  </Rozet>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Kart>
  );
}
