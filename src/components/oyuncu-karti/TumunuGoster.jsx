// "Son N kayıt gösteriliyor · Tümünü göster" satırı (oyuncu kartı sekmeleri)

export function TumunuGoster({ onClick, metin }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", fontSize: 13, color: "var(--soluk)" }}>
      <span>{metin}</span>
      <button
        type="button"
        onClick={onClick}
        style={{
          background: "none",
          border: 0,
          color: "var(--mor)",
          cursor: "pointer",
          fontSize: 13,
          textDecoration: "underline",
          padding: 0,
        }}
      >
        Tümünü göster
      </button>
    </div>
  );
}
