# onehelsing.github.io

OneHelsing vitrini ve uygulamaların gizlilik sayfaları.

- Sayfaları üret: `python3 tools/build.py` (index.html ve her uygulamanın `/<slug>/` sayfası).
- Yeni uygulama: `data/apps.json`'a kayıt + `assets/apps/<slug>/` altına `icon.png`, `en_1..4.jpg`, `tr_1..4.jpg`.
- Yayınlanınca `appStore` / `googlePlay` alanlarına mağaza linkini yaz, betiği çalıştır.
- Gizlilik sayfaları (`/<slug>/privacy/`) elle yazılır; betik onlara dokunmaz.
