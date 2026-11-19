# -*- coding: utf-8 -*-
"""Kézjegy C2, 4. kör: procedurális guilloche-rozetta (értékpapír-nyomat) a fejlécsáv nagy száma mögé.
Kimenet: ../guilloche_rozetta.svg (440 × 440 CSS px, középpont 220/220).
- 0,5 px-es fehér vonalak, vonalanként 7% átlátszatlanság (a feladat: 6–8%);
- a rozetta a szélei felé kifakul (sugárirányú maszk), így csak a szám mögött látszik, csempézés és moiré nincs;
- a sávok fázisban eltolt szinuszgyűrűk (a klasszikus guilloche-rács), középen egy epitrochoid-rózsa.
Futtatás: python guilloche.py"""
import math, os

D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
W = 440; C = W / 2
OP = 0.065; SW = 0.5

def pont(x, y):
    return (round(x * 10), round(y * 10))   # tizedpixel-rács

def ut(p):
    """relatív 'l' parancsok tizedpixelben → kicsi fájl"""
    x0, y0 = p[0]; o = [f'M{x0/10:.1f} {y0/10:.1f}']; px, py = x0, y0
    for x, y in p[1:]:
        dx, dy = x - px, y - py
        if dx or dy:
            o.append(f'l{dx/10:g} {dy/10:g}'); px, py = x, y
    return ''.join(o) + 'z'

def gyuru(r0, a, k, n, lepes=None, b=0.0, j=0):
    """n darab, egymáshoz képest eltolt fázisú hullámgyűrű: r = r0 + a·sin(kθ + φ) (+ b·sin(jθ − φ))"""
    lepes = lepes or max(360, k * 16)
    utak = []
    for i in range(n):
        f = 2 * math.pi * i / n
        p = []
        for s in range(lepes + 1):
            t = 2 * math.pi * s / lepes
            r = r0 + a * math.sin(k * t + f) + (b * math.sin(j * t - f) if b else 0)
            p.append(pont(C + r * math.cos(t), C + r * math.sin(t)))
        utak.append(ut(p))
    return utak

def epitrochoid(R, r, d, lepes=3600):
    g = math.gcd(R, r); per = 2 * math.pi * r / g
    p = []
    for s in range(lepes + 1):
        t = per * s / lepes
        x = (R + r) * math.cos(t) - d * math.cos((R + r) / r * t)
        y = (R + r) * math.sin(t) - d * math.sin((R + r) / r * t)
        p.append(pont(C + x * 0.5, C + y * 0.5))
    return [ut(p)]

utak = []
utak += epitrochoid(48, 8, 30)                # belső rózsa (~ 43 px sugár)
utak += gyuru(70, 6, 16, 8)                   # első rács
utak += gyuru(104, 9, 22, 10, b=5, j=4)       # második rács, lassú hullámmal
utak += gyuru(142, 7, 28, 10, b=4, j=7)       # harmadik rács (a kifakulás már itt elkezdődik)     # külső szegély

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">',
       '<!-- Generálta: _eszkozok/guilloche.py (Kézjegy C2, 4. kör). Procedurális guilloche-rozetta, 0,5 px, 7%. -->',
       '<defs><radialGradient id="fakulas" cx="50%" cy="50%" r="50%">'
       '<stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#fff"/><stop offset=".82" stop-color="#fff" stop-opacity="0"/></radialGradient>'
       f'<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{W}"><rect width="{W}" height="{W}" fill="url(#fakulas)"/></mask></defs>',
       f'<g mask="url(#m)" fill="none" stroke="#fff" stroke-opacity="{OP}" stroke-width="{SW}" stroke-linejoin="round">']
for u in utak:
    svg.append(f'<path d="{u}"/>')
svg.append('</g></svg>')
ki = os.path.join(D, 'guilloche_rozetta.svg')
open(ki, 'w', encoding='utf-8').write('\n'.join(svg))
print(ki, os.path.getsize(ki), 'bájt,', len(utak), 'vonal')
