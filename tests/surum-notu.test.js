// Sürüm notları düz metin (13.09.2026): GitHub HTML'i etiketsiz, liste öğeleri madde, varlıklar çözülmüş; Markdown da temizlenir.
import { describe, it, expect } from "vitest";
import { surumNotuMetni } from "../src/lib/surumNotu.js";

describe("surumNotuMetni", () => {
  it("HTML notu: başlık satır olur, li madde olur, etiket kalmaz, varlıklar çözülür", () => {
    const html =
      "<h2>Düzeltme</h2>\n<ul>\n<li><strong>Makbuz:</strong> &quot;Tahsil eden&quot; &gt; ad soyad</li>\n<li>İkinci</li>\n</ul>\n<p>1.2.2: lisans &amp; sınama</p>";
    const t = surumNotuMetni(html);
    expect(t).toBe('Düzeltme\n• Makbuz: "Tahsil eden" > ad soyad\n• İkinci\n1.2.2: lisans & sınama');
    expect(t).not.toMatch(/<[a-z]/i);
  });
  it("Markdown notu: ## ve ** ve ` işaretleri kalkar, - madde olur; düz metin olduğu gibi", () => {
    expect(surumNotuMetni("## Oyuncu giriş kartı\n\n- **11 × 6 cm:** `kart`\n- ikinci\n\n\n1.2.3: x")).toBe(
      "Oyuncu giriş kartı\n• 11 × 6 cm: kart\n• ikinci\n1.2.3: x",
    );
    expect(surumNotuMetni("WhatsApp hatırlatma eklendi")).toBe("WhatsApp hatırlatma eklendi");
    expect(surumNotuMetni("")).toBe("");
    expect(surumNotuMetni(null)).toBe("");
  });
});
