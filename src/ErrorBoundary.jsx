import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }
  static getDerivedStateFromError(hata) {
    return { hata };
  }
  componentDidCatch(hata, bilgi) {
    console.error("Arayüz hatası:", hata, bilgi);
  }
  render() {
    if (!this.state.hata) return this.props.children;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 12,
          padding: 32,
        }}
      >
        <h1 style={{ fontSize: 28 }}>Bir sorun oluştu</h1>
        <p style={{ color: "var(--soluk)", maxWidth: 480, textAlign: "center" }}>{String(this.state.hata?.message || this.state.hata)}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "var(--mor)", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700 }}
        >
          Yeniden Başlat
        </button>
      </div>
    );
  }
}
