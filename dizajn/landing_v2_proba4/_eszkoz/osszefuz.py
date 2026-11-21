# A kep.cjs szeleteit egy képpé fűzi: python osszefuz.py kimenet.png szelet1.png szelet2.png ...
import sys
from PIL import Image
ki, be = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in be]
w = ims[0].width
out = Image.new('RGB', (w, sum(i.height for i in ims)), (255, 255, 255))
y = 0
for i in ims:
    out.paste(i, (0, y)); y += i.height
out.save(ki, optimize=True)
