# A tulaj_kep(_b).cjs szeleteiből EGY áttekintő JPG: a teljes oldal N oszlopra vágva, köztük szürke rés, fölöttük „1. rész →” felirat.
# A vágás egy legalább 40 px-es egyszínű sáv közepére esik (szakaszok közötti üres rész), ha a cél körül +-600 px-en belül van ilyen.
# Futtatás: python _eszkoz/egy_kepen.py <kimenet.jpg> <oszlopok> <kicsinyítés> <szelet1.png> <szelet2.png> ...
#   gép:     python _eszkoz/egy_kepen.py _proba_kepek/proba4b_egy_kepen_gep.jpg 2 0.5 _proba_kepek/gep_0*.png       (1440 széles, 1x)
#   telefon: python _eszkoz/egy_kepen.py _proba_kepek/proba4b_egy_kepen_telefon.jpg 4 1 _proba_kepek/telefon_0*.png  (780 széles, 2x)
import sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

ki, n, k = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
ims = [Image.open(f).convert('RGB') for f in sys.argv[4:]]
w = ims[0].width
lap = Image.new('RGB', (w, sum(i.height for i in ims)), 'white')
y = 0
for i in ims:
    lap.paste(i, (0, y)); y += i.height
if k != 1:
    lap = lap.resize((round(lap.width * k), round(lap.height * k)), Image.LANCZOS)
W, H = lap.size

def egyszinu(y):
    sor = lap.crop((0, y, W, y + 1))
    return max(b - a for a, b in ImageStat.Stat(sor).extrema) <= 3

vagasok = [0]
SAV, ABL = 40, 600   # legalább 40 px-es egyszínű sáv (szakaszok közti rés) közepén vág, a cél +-600 px-én belül
for j in range(1, n):
    cel = round(H * j / n)
    sorok = [egyszinu(yy) for yy in range(cel - ABL, cel + ABL)]
    jo, fut = None, 0
    for i, e in enumerate(sorok + [False]):
        if e: fut += 1; continue
        if fut >= SAV:
            kozep = cel - ABL + i - fut // 2 - 1
            if jo is None or abs(kozep - cel) < abs(jo - cel): jo = kozep
        fut = 0
    vagasok.append(jo or cel)
vagasok.append(H)

RES, FEJ = 40, 64
osz_h = max(b - a for a, b in zip(vagasok, vagasok[1:]))
out = Image.new('RGB', (n * W + (n - 1) * RES, FEJ + osz_h), (200, 203, 210))
d = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 30)
except OSError:
    font = ImageFont.load_default()
for j in range(n):
    x = j * (W + RES)
    out.paste(lap.crop((0, vagasok[j], W, vagasok[j + 1])), (x, FEJ))
    d.text((x + 16, 14), f'{j + 1}. rész' + (' →' if j < n - 1 else ''), fill=(16, 21, 43), font=font)
assert max(out.size) <= 8000, out.size
out.save(ki, quality=88, optimize=True, progressive=True)
print(ki, out.size, 'vágások:', vagasok[1:-1])
