"""Az ikonlap (_lap_ikonok.png, 2x2) szétvágása: lekerekített csempe átlátszó háttérrel + teljes kitöltésű négyzet
(az iOS/Android maszkolja), @2x/@3x 60 pt-ra, és egy próbalap 60/40/29 pt-on a tintakék és a világos alapon."""
import os, json
import numpy as np
from PIL import Image, ImageDraw
from lapvago import betolt, elemek, atlatszo, vag, feheritett

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
LAP = os.path.join(ASSETS, "_lap_ikonok.png")
KI = os.path.join(ASSETS, "app_ikon")
# 11-17 este: a szemből fotózott, valódi anyagú ikonlap (valos_lap_ikonok_szembol_v3) sorrendje
NEVEK = ["ikon_monogram", "ikon_alairas", "ikon_pecset", "ikon_boritek"]
PT = 60

def main():
    os.makedirs(KI, exist_ok=True)
    rgb = betolt(LAP)
    img = Image.open(LAP).convert("RGB")
    dob = elemek(rgb, kuszob=60, osszevon=4, db=4)  # a valódi csempék lágy árnyéka ne olvassza össze a sorokat
    info = {}
    kis = []
    for nev, box in zip(NEVEK, dob):
        x0, y0, x1, y1 = box
        cs = atlatszo(np.asarray(vag(img, box, 6)).astype(np.float32), belso_feher=False)
        # a csempe színe: a sötét pontok mediánja
        t = rgb[y0:y1, x0:x1].reshape(-1, 3)
        sotet = t[feheritett(t[None])[0] > 150]
        szin = tuple(int(v) for v in np.median(sotet, axis=0))
        # teljes kitöltés: a csempe a saját színére komponálva, a csempe dobozára vágva
        a = cs.crop((6, 6, 6 + x1 - x0, 6 + y1 - y0))
        teli = Image.new("RGBA", a.size, szin + (255,))
        teli.alpha_composite(a)
        teli = teli.convert("RGB")
        n = max(teli.size)
        tn = Image.new("RGB", (n, n), szin); tn.paste(teli, ((n - teli.width) // 2, (n - teli.height) // 2))
        for k in (2, 3):
            px = PT * k
            cs.resize((round(cs.width * px / n), round(cs.height * px / n)), Image.LANCZOS).save(
                os.path.join(KI, f"{nev}_csempe@{k}x.png"))
            tn.resize((px, px), Image.LANCZOS).save(os.path.join(KI, f"{nev}_teli@{k}x.png"))
        tn.save(os.path.join(KI, f"{nev}_teli_forras_{n}px.png"))
        info[nev] = {"doboz": [int(v) for v in box], "szin": "#%02X%02X%02X" % szin, "forras_px": n}
        kis.append(tn)
    # próbalap: 60, 40, 29 pt @1x (valódi képpont), a világos alapon és a fehér lapon
    W, H = 4 * 110 + 40, 3 * 90 + 40
    p = Image.new("RGB", (W, H), (0xDD, 0xE3, 0xEC))
    d = ImageDraw.Draw(p)
    for i, tn in enumerate(kis):
        for j, s in enumerate((60, 40, 29)):
            m = tn.resize((s, s), Image.LANCZOS)
            mask = Image.new("L", (s, s), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.225), fill=255)
            p.paste(m, (20 + i * 110 + (60 - s) // 2, 20 + j * 90 + (60 - s) // 2), mask)
    p.save(os.path.join(HERE, "..", "_nyers", "ikon_proba_60pt.png"))
    p.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(HERE, "..", "_nyers", "ikon_proba_60pt_nagyitva.png"))
    json.dump(info, open(os.path.join(KI, "_info.json"), "w"), indent=1)
    print(json.dumps(info))

if __name__ == "__main__":
    main()
