# Sürüm notları

Her yayından ÖNCE `docs/surum-notlari/<sürüm>.md` yazılıp commit edilir; `scripts/publish-release.cjs` release gövdesini bu dosyadan alır
(dosya yoksa "Sürüm <v>" yazar — gövde ASLA boş bırakılmaz: GitHub boş gövdeli yayında akışa tag commit mesajını koyar ve
uygulamanın Hakkında ekranı bunu sürüm notu diye gösterir; 13.09.2026). Metin Türkçe, kullanıcıya dönük; commit imzası, oturum
bağlantısı ya da araç adı yazılmaz.
