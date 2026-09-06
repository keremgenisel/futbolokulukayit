# Güvenlik ve Kod Kalitesi Araçları

| Araç | Komut | Ne yapar |
|------|-------|----------|
| ESLint 9 (flat config) | `npm run lint` | Gerçek hataları yakalar; hata sayısı 0 tutulur |
| TypeScript (`tsc --noEmit`) | `npm run typecheck` | `// @ts-check` işaretli dosyalarda tip denetimi |
| Vitest + Testing Library + jsdom | `npm test` | Saf mantık, bileşen ve Electron altında SQLite testleri |
| gitleaks | `npm run scan:secrets` + pre-commit hook | Sızmış sır taraması (`.gitleaks.toml`) |
| npm audit | `npm run audit` | Bağımlılık zafiyet taraması (high/critical) |
| package overrides | — | Geçişli bağımlılıkları güvenli sürümlere sabitler |

## Çalışma zamanı güvenlik kütüphaneleri
- **bcryptjs** — parola hash'leme
- **jsonwebtoken** — JWT oturum (çoklu PC modunda)
- **otplib + qrcode** — 2FA (Faz 2)
- **selfsigned** — LAN/Tailscale için TLS sertifikası (Faz 2)
- **better-sqlite3-multiple-ciphers** — veritabanı at-rest şifreleme, anahtar OS anahtarlığında (safeStorage)

## CI (GitHub Actions)
`lint`, `typecheck`, `audit`, `gitleaks` her push ve PR'de çalışır. `audit` ayrıca haftalık koşar.

## Git hook
`npm install` sonrası `scripts/install-git-hooks.cjs` pre-commit hook'unu kurar; her commit
öncesi staged içerik gitleaks ile taranır. gitleaks kurulu değilse sessizce atlanır.
