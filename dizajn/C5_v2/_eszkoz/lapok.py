# Áttekintő lapok a v2 képernyőkről: python _eszkoz/lapok.py  (a C5_v2 mappából)
# Minden NN_*.png kicsinyítve (300 px széles), lapanként 8 (4x2), felirattal. Kimenet: _eszkoz/lap_01.png ...
import glob, os, re
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
fajlok = sorted(f for f in glob.glob('*.png') if re.match(r'^\d\d', f))
W, OSZ, SOR, FEL = 300, 4, 2, 34
try: font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
except Exception: font = ImageFont.load_default()
for r in glob.glob('_eszkoz/lap_*.png'): os.replace(r, r.replace('lap_', '_regi_lap_'))
n = 0
for i in range(0, len(fajlok), OSZ * SOR):
    csop = fajlok[i:i + OSZ * SOR]
    kepek = []
    for f in csop:
        im = Image.open(f).convert('RGB'); h = round(im.height * W / im.width)
        kepek.append((f, im.resize((W, h), Image.LANCZOS)))
    sorok = [kepek[j:j + OSZ] for j in range(0, len(kepek), OSZ)]
    mag = [FEL + max(k[1].height for k in s) for s in sorok]
    lap = Image.new('RGB', (OSZ * (W + 16) + 16, sum(mag) + 16 * (len(sorok) + 1)), '#D9DDE7')
    d = ImageDraw.Draw(lap); y = 16
    for s, m in zip(sorok, mag):
        x = 16
        for f, im in s:
            d.text((x, y + 4), f[:-4], fill='#10152B', font=font); lap.paste(im, (x, y + FEL)); x += W + 16
        y += m + 16
    n += 1; lap.save(f'_eszkoz/lap_{n:02d}.png'); print(f'_eszkoz/lap_{n:02d}.png', ', '.join(f for f, _ in kepek))
