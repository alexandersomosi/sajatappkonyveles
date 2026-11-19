# -*- coding: utf-8 -*-
"""Kézjegy C2, 4. kör: a „kézvonás” – egyetlen tollvonás, változó vastagsággal (a toll nyomása), elvékonyodó végekkel.
Két helyen él: az app-ikonon a K alatt, és a belépés szóvédjegye („Kézjegy”) alatt. Kitöltött körvonalat ad
(nem stroke-ot), ezért a vastagodás kirajzolódik. A kimenet a kozos.js-be kerül (#kezvonas-ikon, #kezvonas-szojegy).
Futtatás: python kezvonas.py → kiírja a két path-ot; python kezvonas.py --beir → a kozos.js-be írja."""
import math

def bezier(p, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = p
    u = 1 - t
    x = u**3*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3
    y = u**3*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3
    dx = 3*u*u*(x1-x0) + 6*u*t*(x2-x1) + 3*t*t*(x3-x2)
    dy = 3*u*u*(y1-y0) + 6*u*t*(y2-y1) + 3*t*t*(y3-y2)
    return x, y, dx, dy

def vonas(szakaszok, vmax, vmin=0.35, csucs=0.32, n=90):
    """szakaszok: egymáshoz illesztett köbös Bézier-szakaszok; a vastagság a teljes hosszon egy ív: gyors felfutás,
    lassú elvékonyodás (jobbkezes toll)."""
    pts = []
    m = len(szakaszok)
    for i, p in enumerate(szakaszok):
        for s in range(n + (1 if i == m - 1 else 0)):
            t = s / n
            x, y, dx, dy = bezier(p, t)
            T = (i + t) / m
            if T < csucs:
                w = vmin + (vmax - vmin) * math.sin(T / csucs * math.pi / 2) ** 0.8
            else:
                w = vmin + (vmax - vmin) * math.cos((T - csucs) / (1 - csucs) * math.pi / 2) ** 1.25
            l = math.hypot(dx, dy) or 1
            nx, ny = -dy / l, dx / l
            pts.append((x, y, nx, ny, w / 2))
    bal = [(x + nx*h, y + ny*h) for x, y, nx, ny, h in pts]
    jobb = [(x - nx*h, y - ny*h) for x, y, nx, ny, h in pts][::-1]
    o = bal + jobb
    return 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in o) + 'Z'

# az ikonon: 120 × 120-as rács, a K alatt egy lendületes, jobbra emelkedő vonás
IKON = vonas([((24, 95), (44, 101), (66, 93), (82, 89)), ((82, 89), (92, 87), (99, 86), (104, 81))], vmax=5.6, vmin=0.6)
# a szóvédjegy alatt: 220 × 26-os rács, hosszabb, enyhén hullámzó aláhúzás felfelé csapó véggel
SZOJEGY = vonas([((3, 16), (40, 22), (90, 19), (130, 14)), ((130, 14), (165, 10), (196, 12), (216, 4))], vmax=3.6, vmin=0.5, csucs=0.28)
if __name__ == '__main__':
    import os, re, sys
    if '--beir' in sys.argv:   # a kozos.js KEZVONAS-ELEJE … KEZVONAS-VEGE közé írja
        k = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kozos.js')
        s = open(k, encoding='utf-8').read()
        uj = f'  var KV = {{ ikon: "{IKON}", szojegy: "{SZOJEGY}" }};' + chr(10)
        s = re.sub(r'(// KEZVONAS-ELEJE[^\n]*\n).*?(  // KEZVONAS-VEGE)', lambda m: m.group(1) + uj + m.group(2), s, flags=re.S)
        open(k, 'w', encoding='utf-8').write(s); print('beírva:', k)
    else:
        print('IKON', IKON)
        print('SZOJEGY', SZOJEGY)
