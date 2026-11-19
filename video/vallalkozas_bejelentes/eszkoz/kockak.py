"""Ellenőrző kockák: python kockak.py <nev> [--elonezet] [--lepes 3] [--idok 1.5,7,12]
Kockák 3 másodpercenként (vagy a megadott időkben) közvetlenül a renderből -> video/<nev>/kockak/lap_NN.jpg (4x2-es lapok)."""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402
import render as R  # noqa: E402


def main():
    nev = sys.argv[1]
    elonezet = "--elonezet" in sys.argv
    lepes = 3.0
    idok = None
    if "--lepes" in sys.argv:
        lepes = float(sys.argv[sys.argv.index("--lepes") + 1])
    if "--idok" in sys.argv:
        idok = [float(x) for x in sys.argv[sys.argv.index("--idok") + 1].split(",")]
    fk = K.forgatokonyv(nev)
    iv = R.idovonal(nev, fk, R.hosszak(nev, fk, elonezet))
    if idok is None:
        idok = [round(i * lepes + 0.5, 2) for i in range(int(iv["hossz"] // lepes) + 1)]
    kockak, _ = R.epit(nev, elonezet=elonezet, csak_kockak=idok)
    ki = f"{K.mappa(nev)}/kockak"
    os.makedirs(ki, exist_ok=True)
    tw, th = 360, 640
    per = 8
    for li in range(0, len(kockak), per):
        lap = Image.new("RGB", (tw * 4 + 50, (th + 40) * 2 + 10), (40, 40, 40))
        d = ImageDraw.Draw(lap)
        for k, (img, t) in enumerate(zip(kockak[li:li + per], idok[li:li + per])):
            x, y = 10 + (k % 4) * (tw + 10), 10 + (k // 4) * (th + 40)
            lap.paste(img.resize((tw, th), Image.LANCZOS), (x, y))
            d.text((x + 4, y + th + 6), f"{t:.1f} s", fill=(255, 255, 255), font=K.betu(26, 600))
        lap.save(f"{ki}/lap_{li // per:02d}.jpg", quality=88)
    print(f"{len(kockak)} kocka -> {ki}/lap_*.jpg")


if __name__ == "__main__":
    main()
