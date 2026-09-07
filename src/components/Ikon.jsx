// Tasarım tuvalindeki (design/) çizgi ikon seti — 24px ızgara, stroke tabanlı, currentColor ile renklenir.
const YOLLAR = {
  pano: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  oyuncular: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.8 0 5 2.2 5 5"/>',
  gruplar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  tahsilat: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  yoklama: '<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
  raporlar: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  ayarlar: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  ara: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  yazdir: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  indir: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>',
  yukle: '<path d="M12 17V5M6 11l6-6 6 6M4 21h16"/>',
  onay: '<path d="M5 12l5 5L20 7"/>',
  kapat: '<path d="M6 6l12 12M18 6L6 18"/>',
  kilit: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  kullanici: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  dosya: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  takvim: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  uyari: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  sag: '<path d="M9 6l6 6-6 6"/>',
  sol: '<path d="M15 6l-6 6 6 6"/>',
  goz: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sunucu: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  yedek: '<path d="M12 3v11M8 10l4 4 4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  cikis: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6v18h-6"/>',
  whatsapp: '<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.2A8.5 8.5 0 1 0 12 3.5z"/><g transform="translate(12 12) scale(.72) translate(-11.8 -12)"><path d="M9.5 9.5c.2 1.6 1.8 3.4 3.5 3.8l1.2-1.2 2 .9c-.2 1.5-1.2 2.2-2.4 2-3-.5-6-3.5-6.5-6.5-.2-1.2.5-2.2 2-2.4l.9 2z"/></g>', // balon (12,12) merkezli; ahize merkeze göre küçültülmüş, çizgiye değmez
  geri: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
};

export function Ikon({ ad, boyut = 20, style }) {
  const yol = YOLLAR[ad];
  if (!yol) return null;
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} dangerouslySetInnerHTML={{ __html: yol }} />
  );
}
