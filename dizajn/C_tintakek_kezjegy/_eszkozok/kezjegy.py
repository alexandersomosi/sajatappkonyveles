# -*- coding: utf-8 -*-
"""Kézjegy-változat: a kézírásos aláírás és a KB monogram SVG-útvonalai.

HELYŐRZŐ. Élesben a könyvelő a saját aláírását és monogramját egyszer adja le
érintőképernyőn (a hozzájárulásával), és az app azt a tollvonást tárolja.
Ez a szkript csak azt mutatja meg, hogyan néz ki egy érintőképernyős tollvonás:
a vonal ott vékonyabb, ahol a toll gyorsabban mozog (mint a signature_pad-szerű
gyűjtőknél). Kitalált aláírást élesben használni nem szabad.

Kimenet: a két útvonal egy JS-fájlba (../kezjegy_utak.js), amit az ikonok.js tölt be.
"""
import math, os, sys

def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])

def sample(stroke, steps=22):
    """stroke: [p0, (c1, c2, p), (c1, c2, p), ...] -> pontok, egyenlő 'idő' lépésekkel"""
    pts = [stroke[0]]
    cur = stroke[0]
    for seg in stroke[1:]:
        c1, c2, p = seg
        for i in range(1, steps + 1):
            pts.append(cubic(cur, c1, c2, p, i / steps))
        cur = p
    return pts

def outline(pts, wmin, wmax, k):
    # sebesség -> szélesség, simítva
    n = len(pts)
    v = [0.0] * n
    for i in range(1, n):
        v[i] = math.dist(pts[i], pts[i-1])
    v[0] = v[1] if n > 1 else 0
    w = []
    last = None
    for i in range(n):
        target = max(wmin, wmax / (1 + k * v[i]))
        last = target if last is None else last * 0.72 + target * 0.28
        w.append(last)
    # végek elvékonyítása (a toll felemelése / letétele)
    for i in range(min(5, n)):
        f = 0.45 + 0.11 * i
        w[i] *= min(1, f)
        w[n-1-i] *= min(1, 0.35 + 0.13 * i)
    L, R = [], []
    for i in range(n):
        a = pts[max(0, i-1)]
        b = pts[min(n-1, i+1)]
        dx, dy = b[0]-a[0], b[1]-a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy/d, dx/d
        h = w[i] / 2
        L.append((pts[i][0] + nx*h, pts[i][1] + ny*h))
        R.append((pts[i][0] - nx*h, pts[i][1] - ny*h))
    ring = L + R[::-1]
    return 'M' + ' L'.join('%.2f %.2f' % p for p in ring) + 'Z'

def shear(stroke, s, ybase):
    """döntés jobbra: minél feljebb, annál jobbra (kézírás-dőlés)"""
    f = lambda p: (p[0] + (ybase - p[1]) * s, p[1])
    out = [f(stroke[0])]
    for c1, c2, p in stroke[1:]:
        out.append((f(c1), f(c2), f(p)))
    return out

def path(strokes, wmin, wmax, k, steps=22, dolés=0.0, ybase=0):
    return ' '.join(outline(sample(shear(s, dolés, ybase), steps), wmin, wmax, k) for s in strokes)

# --- Aláírás: „Kovács B.” gyors, döntött tollvonással (viewBox 0 0 210 78) ---
ALAIRAS = [
    # K szára
    [(31, 9), ((30.5, 22), (28.5, 44), (25, 63))],
    # K karja és lába, majd tovább „ovács” hullámként
    [(55, 13), ((46, 22), (36, 32), (29, 38)),
               ((35, 41), (42, 50), (47, 58)),
               ((50, 62), (54, 50), (58, 47)),     # o
               ((63, 43), (65, 54), (59, 55)),
               ((55, 56), (60, 45), (66, 45)),
               ((69, 46), (68, 56), (72, 56)),     # v
               ((75, 56), (78, 44), (82, 43)),
               ((88, 42), (88, 56), (82, 55)),     # á
               ((78, 54), (82, 45), (88, 47)),
               ((90, 48), (88, 56), (93, 56)),
               ((97, 56), (99, 46), (104, 46)),    # c
               ((100, 46), (98, 56), (105, 56)),
               ((110, 56), (112, 48), (116, 48)),  # s
               ((121, 49), (114, 58), (110, 60)),
               ((106, 62), (113, 59), (119, 58))],
    # ékezet az á fölött
    [(83, 34), ((85, 32), (87, 30), (90, 27))],
    # B szára
    [(136, 12), ((135, 26), (133, 45), (131, 62))],
    # B két hasa egy vonással
    [(134, 14), ((151, 6), (160, 19), (145, 29)),
                ((142, 31), (139, 32), (136, 32)),
                ((156, 30), (164, 45), (152, 56)),
                ((146, 61), (138, 62), (130, 60))],
    # pont
    [(168, 58), ((168.6, 58.4), (169.2, 58.9), (169.6, 59.4))],
    # aláhúzás, lendülettel
    [(16, 71), ((60, 64), (128, 66), (196, 57))],
]

# --- Monogram: KB, szignáláshoz (viewBox 0 0 46 30) ---
MONOGRAM = [
    # K szára, lendülettel lefelé
    [(7.5, 3.5), ((7.3, 10), (6.6, 17), (5.4, 24.5))],
    # K karja és lába egy vonással, a láb kis kunkorral fut ki
    [(16.5, 4.2), ((13.5, 7.5), (9.8, 11.2), (7.0, 13.8)),
                  ((10.5, 15.2), (13.2, 19.5), (15.6, 23.2)),
                  ((16.6, 24.6), (18.2, 24.4), (19.4, 22.8))],
    # B szára
    [(23.8, 4.6), ((23.6, 10.5), (23.0, 17.5), (22.2, 24.6))],
    # B: kisebb felső has, nagyobb alsó, nem zárul pontosan
    [(23.4, 5.2), ((29.5, 2.6), (33.2, 6.8), (28.2, 11.4)),
                  ((27.2, 12.2), (25.8, 12.6), (24.6, 12.5)),
                  ((32.5, 11.6), (37.2, 17.2), (32.4, 22.0)),
                  ((29.6, 24.6), (25.4, 25.2), (21.0, 24.4))],
    # kis lendítés alá
    [(4.0, 28.2), ((14, 27.2), (27, 27.0), (40.5, 25.2))],
]

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kezjegy_utak.js')
    a = path(ALAIRAS, 0.9, 3.4, 0.55, steps=20, dolés=0.16, ybase=62)
    m = path(MONOGRAM, 0.85, 2.3, 0.8, steps=16, dolés=0.18, ybase=25)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('// Generálta: _eszkozok/kezjegy.py. HELYŐRZŐ aláírás és monogram;\n'
                '// élesben a könyvelő egyszer, érintőképernyőn adja le a sajátját.\n')
        f.write('window.KEZJEGY = {\n  alairas: "%s",\n  monogram: "%s"\n};\n' % (a, m))
    print('ok', len(a), len(m))
