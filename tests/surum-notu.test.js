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
  it("iç içe ve bozuk etiketler sabit noktaya kadar silinir (19.09.2026: tek geçiş '<>' bırakıyordu)", () => {
    expect(surumNotuMetni("<<b>>Kalın<</b>>")).toBe("Kalın");
    expect(surumNotuMetni("<p>Bir <<i>>iki</i></p>")).toBe("Bir iki");
    expect(surumNotuMetni("<div><span>a</span></div>")).toBe("a");
    expect(surumNotuMetni("a < b ve c > d")).toBe("a < b ve c > d"); // düz metindeki < > korunur
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

describe("commit imzası süzme (13.09.2026: boş gövdeli eski yayında GitHub akışa tag commit mesajını koymuştu)", () => {
  it("Co-Authored-By / Claude-Session satırları ve oturum bağlantısı düşer, sürüm satırı kalır", () => {
    const html =
      '<p>Sürüm 1.1.0</p>\n\n<p>Co-Authored-By: Claude Fable 5.1 &lt;noreply@anthropic.com&gt;\n<br />Claude-Session: <a href="https://claude.ai/code/session_x">https://claude.ai/code/session_x</a></p>';
    expect(surumNotuMetni(html)).toBe("Sürüm 1.1.0");
  });
});
