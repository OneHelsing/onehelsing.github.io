#!/usr/bin/env python3
"""OneHelsing vitrinini üretir: index.html ve her uygulamanın /<slug>/ sayfası.

    python3 tools/build.py

Uygulamalar data/apps.json'da. Yeni uygulama: kaydı ekle, görselleri
assets/apps/<slug>/ altına koy (icon.png, en_1..4.jpg, tr_1..4.jpg), betiği
çalıştır. Mağaza linkleri (appStore, googlePlay) boşsa "Yakında" görünür.
Gizlilik sayfaları (<slug>/privacy/) elle yazılır; betik onlara dokunmaz.
"""
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://onehelsing.github.io"
EMAIL = "onehelsingstudio@gmail.com"


def esc(s):
    return html.escape(s, quote=True)


def both(en, tr, tag="span"):
    """İki dilli metin: etkin olmayan dil CSS ile gizlenir."""
    return f'<{tag} lang="en">{en}</{tag}><{tag} lang="tr">{tr}</{tag}>'


LOGO = """<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs>
<rect width="64" height="64" rx="18" fill="url(#g)"/><circle cx="25" cy="32" r="11" fill="none" stroke="#fff" stroke-width="6"/>
<path d="M42 19v26M42 32h9M51 19v26" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>"""


def head(title, desc, path, image=None):
    image = image or f"{SITE}/assets/og.png"
    return f"""<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js"></script>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">{LOGO}OneHelsing</a>
  <nav class="nav">
    <a class="hide-sm" href="/#apps">{both("Apps", "Uygulamalar")}</a>
    <a class="hide-sm" href="/#build">{both("What we build", "Neler yapıyoruz")}</a>
    <a href="/#contact">{both("Work with us", "Birlikte çalışalım")}</a>
    <div class="lang"><button data-set="en">EN</button><button data-set="tr">TR</button></div>
  </nav>
</div></header>
"""


FOOT = f"""<footer><div class="wrap">
  <div>© OneHelsing · <a href="mailto:{EMAIL}">{EMAIL}</a></div>
  <div>{{privacy}}</div>
</div></footer>
</body>
</html>
"""


def status_chip():
    return f'<span class="chip soon">{both("Coming soon", "Yakında")}</span>'


def app_card(a):
    en, tr = a["en"], a["tr"]
    return f"""<a class="app" href="/{a['slug']}/" style="--accent:{a['accent']}">
  <img class="icon" src="/assets/apps/{a['slug']}/icon.png" alt="" width="72" height="72" loading="lazy">
  <div><h3>{both(esc(en['name']), esc(tr['name']))}</h3>
  <p>{both(esc(en['tagline']), esc(tr['tagline']))}</p></div>
  <div class="chips">{status_chip()}<span class="chip">iOS</span><span class="chip">Android</span>
  <span class="chip">{both(esc(en['category']), esc(tr['category']))}</span>
  <span class="chip">{both(f"{a['languages']} languages", f"{a['languages']} dil")}</span></div>
</a>"""


CAPS = [
    ("📱", "Apps and games for every screen", "Her ekran için uygulama ve oyun",
     "iPhone, Android, tablet and web. Native-quality Flutter apps, games with real physics and sound, tools people open every day.",
     "iPhone, Android, tablet ve web. Yerel kalitede Flutter uygulamaları, gerçek fizik ve sesle oyunlar, insanların her gün açtığı araçlar."),
    ("✨", "AI where it changes the game", "Oyunu değiştirdiği yerde yapay zekâ",
     "Not AI for its own sake: assistants, generated content, smart tutoring, vision and voice — wherever they make something possible that wasn't before.",
     "Moda diye değil: asistanlar, üretilen içerik, akıllı öğretim, görüntü ve ses; daha önce mümkün olmayanı mümkün kıldığı her yerde."),
    ("🌍", "Any language, any market", "Her dil, her pazar",
     "Our apps already speak English, Turkish, German, Spanish, Portuguese, Russian and Kurmanji. We localise for any language — including the ones big companies skip.",
     "Uygulamalarımız İngilizce, Türkçe, Almanca, İspanyolca, Portekizce, Rusça ve Kurmancî konuşuyor. Her dile uyarlıyoruz; büyük şirketlerin atladığı diller dahil."),
    ("🧭", "From idea to the store", "Fikirden mağazaya",
     "Product design, development, testing, store listings, privacy, ads and in-app purchases, App Store and Google Play publishing — end to end.",
     "Ürün tasarımı, geliştirme, test, mağaza sayfaları, gizlilik, reklam ve uygulama içi satın alma, App Store ve Google Play yayını; uçtan uca."),
    ("🔭", "Finding the gap", "Boşluğu bulmak",
     "Somewhere there is always a need nobody has met. We look for it — a niche, a language, a community, a better way — and build for it.",
     "Bir yerde mutlaka kimsenin karşılamadığı bir ihtiyaç vardır. Onu ararız (bir niş, bir dil, bir topluluk, daha iyi bir yol) ve onun için üretiriz."),
    ("⚡", "Fast, careful, many", "Hızlı, özenli, çok",
     "A studio built to ship: hundreds of products is the plan, each one tested, polished and cared for after launch.",
     "Üretmek için kurulmuş bir stüdyo: hedef yüzlerce ürün; her biri test edilmiş, cilalanmış ve yayından sonra da bakılan."),
]

STEPS = [
    ("Tell us the idea", "Fikri anlat", "A sentence is enough. Or tell us the problem and we'll propose the idea.",
     "Bir cümle yeter. Ya da sorunu anlat, fikri biz önerelim."),
    ("We shape it", "Biçimlendiririz", "Scope, design, languages, monetisation — a clear plan before a line of code.",
     "Kapsam, tasarım, diller, gelir modeli: kod yazmadan önce net bir plan."),
    ("We build and test", "Yapar ve test ederiz", "Real devices, real languages, small screens, dark mode, accessibility.",
     "Gerçek cihaz, gerçek diller, dar ekran, koyu tema, erişilebilirlik."),
    ("We launch together", "Birlikte yayınlarız", "Store pages, screenshots, privacy, review — and updates after launch.",
     "Mağaza sayfaları, ekran görüntüleri, gizlilik, inceleme; ve yayından sonra güncellemeler."),
]


def index(apps):
    cards = "\n".join(app_card(a) for a in apps)
    caps = "\n".join(
        f'<div class="cap"><div class="ic">{ic}</div><h3>{both(t_en, t_tr)}</h3><p>{both(d_en, d_tr)}</p></div>'
        for ic, t_en, t_tr, d_en, d_tr in CAPS
    )
    steps = "\n".join(
        f'<div class="step"><h4>{both(a, b)}</h4><p>{both(c, d)}</p></div>' for a, b, c, d in STEPS
    )
    mail = f"mailto:{EMAIL}?subject=Project%20idea%20%2F%20Proje%20fikri"
    privacy = " ".join(
        f'<a href="/{a["slug"]}/privacy/">{both(esc(a["en"]["name"]), esc(a["tr"]["name"]))}</a>' for a in apps
    )
    body = f"""
<main>
<div class="hero"><div class="wrap">
  <span class="eyebrow"><i></i>{both("Independent app & game studio", "Bağımsız uygulama ve oyun stüdyosu")}</span>
  <h1>{both('We build what <span class="grad">doesn’t exist yet.</span>', 'Henüz <span class="grad">olmayanı</span> yapıyoruz.')}</h1>
  <p class="lead">{both(
      "OneHelsing makes apps and games for every language and every platform — and brings AI wherever it opens something new. Our limit is imagination.",
      "OneHelsing her dil ve her platform için uygulama ve oyun yapar; yeni bir kapı açtığı her yere yapay zekâyı getirir. Sınırımız hayal gücü.")}</p>
  <div class="ctas">
    <a class="btn primary" href="#apps">{both("See our apps", "Uygulamalarımız")}</a>
    <a class="btn" href="#contact">{both("Build something with us →", "Birlikte bir şey yapalım →")}</a>
  </div>
  <div class="stats">
    <div><b>{len(apps)}</b><span>{both("apps and games", "uygulama ve oyun")}</span></div>
    <div><b>7</b><span>{both("languages and counting", "dil, artmaya devam")}</span></div>
    <div><b>iOS · Android</b><span>{both("every release", "her sürümde")}</span></div>
    <div><b>∞</b><span>{both("ideas in the queue", "sırada bekleyen fikir")}</span></div>
  </div>
</div></div>

<section id="apps"><div class="wrap">
  <div class="kicker">{both("Our apps", "Uygulamalarımız")}</div>
  <h2>{both("Made by OneHelsing", "OneHelsing imzalı")}</h2>
  <p class="sub">{both("Every one of them started with a gap: a feeling, a language, a moment nobody had designed for. And this is only the beginning.",
      "Her biri bir boşlukla başladı: bir his, bir dil, kimsenin düşünmediği bir an. Ve bu daha başlangıç.")}</p>
  <div class="apps">
{cards}
  </div>
</div></section>

<section id="build"><div class="wrap">
  <div class="kicker">{both("What we build", "Neler yapıyoruz")}</div>
  <h2>{both("If it runs on a screen, we can build it.", "Ekranda çalışıyorsa, yapabiliriz.")}</h2>
  <p class="sub">{both("Games, learning, productivity, health, culture, business tools — no category is too small or too strange. We think about what hasn't been thought of.",
      "Oyun, eğitim, verimlilik, sağlık, kültür, iş araçları; hiçbir kategori fazla küçük ya da fazla tuhaf değil. Düşünülmemiş olanı düşünürüz.")}</p>
  <div class="grid3">
{caps}
  </div>
</div></section>

<section id="vision"><div class="wrap">
  <div class="kicker">{both("Vision", "Vizyon")}</div>
  <p class="vision">{both(
      'Hundreds of apps. <span class="grad">Every language.</span> The newest technology, used where it truly matters.',
      'Yüzlerce uygulama. <span class="grad">Her dil.</span> En yeni teknoloji, gerçekten fark yarattığı yerde.')}</p>
  <div class="steps">
{steps}
  </div>
</div></section>

<section id="contact"><div class="wrap">
  <div class="contact">
    <div class="kicker">{both("Work with us", "Birlikte çalışalım")}</div>
    <h2>{both("Have an idea? Let’s make it real.", "Bir fikrin mi var? Gerçek yapalım.")}</h2>
    <p class="sub">{both("Custom apps and games for companies, communities and creators — in any language, on any platform. Tell us what you need.",
        "Şirketler, topluluklar ve üreticiler için özel uygulama ve oyunlar; her dilde, her platformda. Neye ihtiyacın olduğunu anlat.")}</p>
    <div class="ctas" style="justify-content:center">
      <a class="btn primary" href="{mail}">{both("Write to us", "Bize yaz")}</a>
      <a class="btn" href="mailto:{EMAIL}">{EMAIL}</a>
    </div>
  </div>
</div></section>
</main>
"""
    title = "OneHelsing — Apps & games for every language"
    desc = "OneHelsing is an independent studio building apps and games for every language and platform, with AI where it matters. Custom projects welcome."
    privacy_block = f'{both("Privacy:", "Gizlilik:")} {privacy}'
    return head(title, desc, "/") + body + FOOT.replace("{privacy}", privacy_block)


def store_button(url, store_en, store_tr):
    if url:
        return f'<a class="store" href="{esc(url)}"><small>{both("Get it on", "İndir:")}</small><b>{store_en}</b></a>'
    return f'<span class="store off"><small>{both("Coming soon", "Yakında")}</small><b>{both(store_en, store_tr)}</b></span>'


def app_page(a):
    en, tr = a["en"], a["tr"]
    desc = "".join(f"<p>{both(esc(x), esc(y))}</p>" for x, y in zip(en["description"], tr["description"]))
    feats = "".join(f"<li>{both(esc(x), esc(y))}</li>" for x, y in zip(en["features"], tr["features"]))
    d = os.path.join(ROOT, "assets", "apps", a["slug"])
    shots = ""
    for lang in ("en", "tr"):
        imgs = sorted(f for f in os.listdir(d) if f.startswith(lang + "_"))
        shots += f'<div class="shots" lang="{lang}">' + "".join(
            f'<img src="/assets/apps/{a["slug"]}/{f}" alt="" loading="lazy">' for f in imgs
        ) + "</div>"
    body = f"""
<main style="--accent:{a['accent']}">
<div class="apphero"><div class="wrap">
  <a class="back" href="/#apps">← {both("All apps", "Bütün uygulamalar")}</a>
  <div class="apphead" style="margin-top:22px">
    <img src="/assets/apps/{a['slug']}/icon.png" alt="" width="112" height="112">
    <div><h1>{both(esc(en['name']), esc(tr['name']))}</h1><p>{both(esc(en['tagline']), esc(tr['tagline']))}</p></div>
  </div>
  <div class="stores">
    {store_button(a.get('appStore'), 'App Store', 'App Store')}
    {store_button(a.get('googlePlay'), 'Google Play', 'Google Play')}
  </div>
</div></div>
<section style="border-top:0;padding-top:30px"><div class="wrap">
  {shots}
  <div class="cols" style="margin-top:30px">
    <div>{desc}</div>
    <ul class="feat">{feats}</ul>
  </div>
</div></section>
</main>
"""
    title = f"{en['name']} — {en['tagline']}"
    privacy = f'<a href="/{a["slug"]}/privacy/">{both("Privacy policy", "Gizlilik politikası")}</a>'
    image = f"{SITE}/assets/apps/{a['slug']}/en_1.jpg"
    return head(title, en["description"][0], f"/{a['slug']}/", image) + body + FOOT.replace("{privacy}", privacy)


def main():
    apps = json.load(open(os.path.join(ROOT, "data", "apps.json"), encoding="utf-8"))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(index(apps))
    for a in apps:
        os.makedirs(os.path.join(ROOT, a["slug"]), exist_ok=True)
        with open(os.path.join(ROOT, a["slug"], "index.html"), "w", encoding="utf-8") as f:
            f.write(app_page(a))
    print(f"{len(apps)} uygulama, {len(apps) + 1} sayfa yazıldı")


if __name__ == "__main__":
    main()
