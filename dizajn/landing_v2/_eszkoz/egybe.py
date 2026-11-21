# Egyfájlos változat az értékesítő oldalból (minden beágyazva: CSS, betű, képek, mozgas.js), hogy a tulaj a telefonján megnyithassa.
# Futtatás a landing_v2 mappából: python _eszkoz/egybe.py . adozz_weboldal_egyben.html
# 11-20 este: a mozgas.js inline <script>-be kerül (a fájl a DOMContentLoaded-ra vár, így a <head>-ben is jól fut).
# Ez csak a helyi, egyfájlos megtekintéshez kell; élesben a külön mozgas.js megy (CSP default-src 'self').
import base64, re, sys, os
d = sys.argv[1]; ki = sys.argv[2]
mime = {'.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml','.jpg':'image/jpeg'}
def data(rel):
    p = os.path.join(d, rel)
    return f"data:{mime[os.path.splitext(p)[1].lower()]};base64," + base64.b64encode(open(p,'rb').read()).decode()
h = open(os.path.join(d,'index.html'), encoding='utf-8').read()
css = open(os.path.join(d,'stilus.css'), encoding='utf-8').read()
css = re.sub(r'url\("?(fontok/[^")]+|kepek/[^")]+)"?\)', lambda m: f'url("{data(m.group(1))}")', css)
h = re.sub(r'<link[^>]+href="stilus\.css"[^>]*>', lambda m: '<style>\n' + css + '\n</style>', h)
js_ut = os.path.join(d, 'mozgas.js')
if os.path.exists(js_ut):
    js = open(js_ut, encoding='utf-8').read()
    assert '</script' not in js.lower()
    h, db = re.subn(r'<script\s+src="mozgas\.js"[^>]*>\s*</script>', lambda m: '<script>\n' + js + '\n</script>', h)
    print('mozgas.js beágyazva:', db)
# 11-21 (3. kör javító): a hős gépes képeinek srcset/sizes attribútuma kimarad (az egyfájlos változatban csak a nagy kép van beágyazva)
h = re.sub(r'\s(?:srcset|sizes)="[^"]*"', '', h)
h = re.sub(r'<link\s+rel="preload"[^>]*>\s*', '', h)
h = re.sub(r'(src|href)="(kepek/[^"]+)"', lambda m: f'{m.group(1)}="{data(m.group(2))}"', h)
h = re.sub(r'url\((["\']?)(kepek/[^)"\']+)\1\)', lambda m: f'url("{data(m.group(2))}")', h)
open(ki, 'w', encoding='utf-8').write(h)
left = re.findall(r'(?:src|href)="(?!https?:|mailto:|data:|#)[^"]+"', h)
print('kesz', os.path.getsize(ki)//1024, 'KB; maradt helyi hivatkozas:', left)
