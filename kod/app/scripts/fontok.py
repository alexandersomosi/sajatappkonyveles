"""Geist statikus súlyok a jóváhagyott dizájn változtatható betűjéből (dizajn/C2_modern/app_v2/fontok/Geist_wght.ttf, OFL).

A dizájn 400/500/550/600/650/700/750/800/900-as súlyokat használ; az @expo-google-fonts/geist csak a kerek
százasokat adja, ezért a pontos súlyokat itt példányosítjuk. Minden példány saját családnevet és PostScript-nevet
kap (Geist-W650 …), így iOS-en sem ütköznek. Futtatás: python scripts/fontok.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

APP = Path(__file__).resolve().parent.parent
SRC = APP.parent.parent / "dizajn" / "C2_modern" / "app_v2" / "fontok" / "Geist_wght.ttf"
OUT = APP / "assets" / "fonts"
WEIGHTS = [400, 500, 550, 600, 650, 700, 750, 800, 900]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for w in WEIGHTS:
        font = TTFont(str(SRC))
        inst = instancer.instantiateVariableFont(font, {"wght": w})
        name = inst["name"]
        fam = f"Geist W{w}"
        ps = f"Geist-W{w}"
        for rec in list(name.names):
            if rec.nameID in (1, 16):
                rec.string = fam
            elif rec.nameID in (2, 17):
                rec.string = "Regular"
            elif rec.nameID == 4:
                rec.string = fam
            elif rec.nameID == 6:
                rec.string = ps
            elif rec.nameID == 3:
                rec.string = f"1.800;{ps}"
        inst["OS/2"].usWeightClass = 400  # egy családon belül egyetlen stílus: a súlyt a családnév hordozza
        inst.save(str(OUT / f"Geist-W{w}.ttf"))
        print("kész:", OUT / f"Geist-W{w}.ttf")
    (OUT / "OFL.txt").write_text(
        "Geist – Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font).\n"
        "SIL Open Font License, Version 1.1 – https://openfontlicense.org\n"
        "A fájlok a változtatható Geist_wght.ttf statikus példányai (scripts/fontok.py).\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
