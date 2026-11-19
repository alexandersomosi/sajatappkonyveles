# -*- coding: utf-8 -*-
"""Kézzel rajzolt „fotó” egy nyugtatömb-lapról (05_tetel). Nem kép-generátor:
SVG-alakzatok és a kezjegy.py tollvonás-függvénye. Kimenet: ../nyugta_foto.svg
A kézírás sötét golyóstoll-színű (#2E3442), NEM tollkék: a tollkék a könyvelő
aláírásáé és monogramjáé."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kezjegy import outline, sample

L = lambda a, b: (a, (a[0] + (b[0]-a[0])/3, a[1] + (b[1]-a[1])/3), (a[0] + 2*(b[0]-a[0])/3, a[1] + 2*(b[1]-a[1])/3), b)

def line(a, b):
    _, c1, c2, p = L(a, b)
    return [a, (c1, c2, p)]

# számjegyek 6×10-es dobozban, alapvonal y=10
JEGY = {
 '0': [[(3.2, 0.2), ((0.2, 0.2), (0, 10), (2.8, 10)), ((5.8, 10), (6, 0.2), (3.0, 0.6))]],
 '1': [[(1.2, 2.4), ((2.2, 1.6), (3.2, 0.8), (4.0, 0.0)), ((3.9, 3.4), (3.8, 6.8), (3.6, 10))]],
 '2': [[(0.4, 2.6), ((1.0, -0.6), (6.2, -0.6), (5.2, 3.0)), ((4.5, 5.2), (1.6, 7.8), (0.0, 10)),
        ((2.0, 9.9), (4.0, 9.8), (6.2, 9.6))]],
 '3': [[(0.6, 1.4), ((3.0, -0.8), (6.8, 1.0), (2.6, 4.6)), ((7.4, 4.6), (6.4, 11.4), (0.2, 9.0))]],
 '6': [[(5.0, 0.4), ((1.0, 1.2), (-0.6, 8.0), (2.2, 9.9)), ((5.2, 11.2), (6.6, 5.8), (3.0, 5.4)),
        ((1.6, 5.2), (0.6, 6.4), (0.6, 7.2))]],
 '8': [[(3.0, 4.8), ((-0.6, 3.4), (1.0, -0.4), (3.0, 0.1)), ((5.2, 0.4), (6.4, 3.4), (3.0, 4.8)),
        ((-0.4, 6.2), (0.4, 10.4), (3.0, 10.0)), ((5.8, 9.8), (6.6, 6.2), (3.0, 4.8))]],
 '.': [[(1.0, 9.4), ((1.3, 9.6), (1.5, 9.8), (1.6, 10.0))]],
 ',': [[(1.4, 9.0), ((1.4, 10.0), (1.0, 11.0), (0.2, 12.0))]],
 '-': [[(0.4, 5.4), ((2.0, 5.3), (3.6, 5.2), (5.2, 5.0))]],
}
TAV = {'.': 3.2, ',': 3.0, '-': 6.6, ' ': 4.0}

def irott_szam(szoveg, x, y, meret, dolés=0.2):
    """kézzel írt számjegyek: (x, y) az alapvonal bal vége, meret a számjegy magassága"""
    k = meret / 10.0
    out = []
    for ch in szoveg:
        if ch in JEGY:
            for st in JEGY[ch]:
                pts = [st[0]] + [tuple(c) for c in st[1:]]
                def tr(p):
                    return (x + (p[0] + (10 - p[1]) * dolés) * k, y - (10 - p[1]) * k)
                s2 = [tr(pts[0])] + [(tr(c1), tr(c2), tr(p)) for (c1, c2, p) in pts[1:]]
                out.append(outline(sample(s2, 14), 0.55, 1.5, 0.9))
        x += TAV.get(ch, 7.6) * k
    return ' '.join(out)

def firka(x, y, hossz, magas, hullam=7, seed=0):
    """olvashatatlan, folyó kézírás-szó (betűk helyett): változó magasságú
    ívek, néha felső hurok (l, k, t), néha alsó szár (g, j)"""
    import random
    r = random.Random(seed)
    seg = []
    cx = x
    while cx < x + hossz:
        w = hullam * r.uniform(0.7, 1.25)
        u = r.random()
        if u < 0.13:            # felső hurok
            h = magas * r.uniform(1.8, 2.2)
            seg.append(((cx + w*0.6, y - h*0.7), (cx + w*0.9, y - h*1.05), (cx + w*0.45, y - h)))
            seg.append(((cx + w*0.1, y - h*0.9), (cx + w*0.35, y - 1), (cx + w*0.95, y - 0.3)))
        elif u < 0.21:          # alsó szár
            h = magas * r.uniform(0.7, 0.9)
            seg.append(((cx + w*0.2, y - h), (cx + w*0.8, y - h), (cx + w*0.7, y - h*0.2)))
            seg.append(((cx + w*0.6, y + magas*1.1), (cx + w*0.2, y + magas*1.0), (cx + w*1.0, y - 0.5)))
        else:                   # kis ív
            h = magas * r.uniform(0.55, 1.0)
            seg.append(((cx + w*0.2, y - h), (cx + w*0.65, y - h*1.05), (cx + w, y - r.uniform(0, 1.2))))
        cx += w
    return outline(sample([(x, y - 0.5)] + seg, 9), 0.5, 1.35, 0.9)

def main():
    W, H = 358, 214
    ink = '#2E3442'
    p = []
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W*2}" height="{H*2}">')
    p.append('<defs>'
             '<linearGradient id="asztal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#454C59"/><stop offset="1" stop-color="#2A3039"/></linearGradient>'
             '<linearGradient id="papir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F7F5"/><stop offset=".7" stop-color="#ECEEEB"/><stop offset="1" stop-color="#E1E4E1"/></linearGradient>'
             '<radialGradient id="feny" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>'
             '</defs>')
    p.append(f'<rect width="{W}" height="{H}" fill="url(#asztal)"/>')
    # a lap enyhén szabálytalan széllel (kiegyenesítés után is látszik a fotón)
    p.append('<path d="M70 10 L289 8 L292 205 L67 207 Z" fill="#1E232B" opacity=".35" transform="translate(3 4)"/>')
    p.append('<path d="M70 10 L289 8 L292 205 L67 207 Z" fill="url(#papir)"/>')
    p.append('<path d="M70 10 L289 8 L292 205 L67 207 Z" fill="url(#feny)"/>')
    # tömb-perforáció a lap tetején
    p.append('<g fill="#C9CDD2">' + ''.join(f'<circle cx="{76+i*6.4:.1f}" cy="15.5" r=".9"/>' for i in range(34)) + '</g>')
    # nyomtatott űrlap (szürkéskék nyomdafesték)
    f = 'font-family="Arial, Helvetica, sans-serif" fill="#5A6676"'
    p.append(f'<text x="80" y="36" {f} font-size="12.5" font-weight="700" letter-spacing="1.2">NYUGTA</text>')
    p.append(f'<text x="186" y="35" {f} font-size="7">Sorszám:</text>')
    p.append('<text x="216" y="35.5" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" fill="#B5483A" letter-spacing=".6">TA 4471203</text>')
    rows = [('A kibocsátó neve, címe, adószáma:', 52), ('Megnevezés', 104), ('Összeg (Ft)', 134), ('Kelt:', 172)]
    for t, y in rows:
        p.append(f'<text x="80" y="{y}" {f} font-size="6.4">{t}</text>')
    for y in (122, 152, 188):
        p.append(f'<path d="M80 {y} L280 {y-0.6}" stroke="#AAB2BC" stroke-width=".6"/>')
    p.append('<path d="M80 110 L280 109.5 M80 140 L280 139.4" stroke="#AAB2BC" stroke-width=".4" stroke-dasharray="1.5 1.5"/>')
    # e.v. bélyegző lila tintával, kicsit ferdén
    p.append('<g transform="rotate(-3 150 74)" fill="none" stroke="#5B4A8C" stroke-opacity=".78">'
             '<rect x="82" y="58" width="132" height="34" rx="2" stroke-width="1.1"/></g>')
    p.append('<g transform="rotate(-3 150 74)" font-family="Arial, Helvetica, sans-serif" fill="#5B4A8C" fill-opacity=".8" font-size="6.6">'
             '<text x="88" y="69" font-weight="700">Szabó Katalin e.v.</text>'
             '<text x="88" y="78">1137 Budapest, Lugas u. 4.</text>'
             '<text x="88" y="87">Adószám: 69123456-1-41</text></g>')
    # kézírás
    p.append(f'<g fill="{ink}">')
    p.append(f'<path d="{irott_szam("3", 84, 120, 11)}"/>')
    p.append(f'<path d="{firka(97, 120, 14, 5.5, 6.0, 5)}"/>')
    p.append(f'<path d="{firka(120, 120, 44, 5.5, 6.4, 2)}"/>')
    p.append(f'<path d="{irott_szam("18 000,-", 196, 150, 14)}"/>')
    p.append(f'<path d="{irott_szam("2026. 10. 03.", 102, 186, 10)}"/>')
    p.append(f'<path d="{firka(218, 186, 46, 6.5, 7.6, 21)}"/>')
    p.append('</g>')
    p.append('</svg>')
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'nyugta_foto.svg')
    open(out, 'w', encoding='utf-8').write('\n'.join(p))
    print('ok', out)

if __name__ == '__main__':
    main()
