# Ellenőrzéshez: a teljes képernyőképet szeletekre vágja (scratchpad mappába).
import sys
from PIL import Image
src, out, magas = sys.argv[1], sys.argv[2], int(sys.argv[3])
skala = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
im = Image.open(src)
w, h = im.size
i = 0
for y in range(0, h, magas):
    d = im.crop((0, y, w, min(h, y + magas)))
    if skala != 1.0:
        d = d.resize((int(d.width * skala), int(d.height * skala)), Image.LANCZOS)
    d.save(f"{out}_{i:02d}.png"); i += 1
print(i, 'szelet')
