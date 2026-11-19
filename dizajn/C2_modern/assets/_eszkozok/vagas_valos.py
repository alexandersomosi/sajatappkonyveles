"""Kézjegy C2, a szemből fotózott (valósághű) tárgyak kivágása (11-17 este).
A fehér stúdióháttér előtt álló tárgyakat nem lehet sima „fehérből átlátszó” módszerrel kivágni, mert a papír
(levél, naptár, kártya) majdnem olyan fehér, mint a háttér. Ezért:
  1. a tárgy maszkja: éles élek + színes (tintakék) pontok + nagyon sötét pontok határolnak, a lap széléről
     elárasztott (elért) rész a háttér és az árnyék, ami nem érhető el, az a tárgy (lyukak kitöltve);
  2. a tárgyon kívül a lágy árnyék megmarad félig átlátszó sötét kékesszürkeként (a színezett alapon is valódi árnyék);
  3. kimenet: átlátszó PNG (@2x, @3x, teljes felbontású forrás) és tiszta #FFFFFF hátterű PNG a fehér lapokra,
     mind a hat AZONOS vásznon és AZONOS léptékben (a mesterlap szerinti egymáshoz viszonyított méret).
Használat: python vagas_valos.py"""
import json, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
NYERS = os.path.join(ASSETS, "_nyers")
LAP = os.path.join(ASSETS, "_lap_illusztraciok.png")
KI = os.path.join(ASSETS, "illusztraciok")
PROBA = os.path.join(NYERS, "vagas_proba")

NEVEK = {"11": "level_boritek", "12": "meghatalmazas_alairva", "13": "videohivas_laptop",
         "21": "dosszie_mappa", "22": "hatarido_naptar", "23": "befizetve_pecset"}
VASZON_PT = (160, 120)       # közös vászon pontban (4:3), a tárgy alul áll, felette levegő
TARGY_MAX_MAGAS = 0.80       # a mesterlap legmagasabb tárgya a vászon magasságának ennyi része
TARGY_MAX_SZEL = 0.92
ARNYEK_SZIN = np.array([0x1A, 0x22, 0x33], np.float32)   # a tintakék családjából, nem fekete

def hatter(rgb):
    s = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    return np.median(s, axis=0)

def maszk(rgb, g_kuszob=3.2, szin_kuszob=16, sotet=105, min_terulet=600):
    bg = hatter(rgb)
    L = rgb.mean(axis=2)
    Lb = cv2.GaussianBlur(L, (0, 0), 0.9)
    gx = cv2.Sobel(Lb, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(Lb, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    G = np.hypot(gx, gy)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    D = bg.mean() - L
    gat = (G > g_kuszob) | (sat > szin_kuszob) | (D > sotet)
    gat = ndi.binary_closing(gat, structure=np.ones((3, 3)), iterations=2)
    gat = ndi.binary_dilation(gat, iterations=1)
    lab, n = ndi.label(~gat)
    szel = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    szel = szel[szel != 0]
    elert = np.isin(lab, szel)
    obj = ndi.binary_fill_holes(~elert)
    # a papír körvonalán lehet néhány képpontos rés (pl. ahol a toll vagy az árnyék hozzáér): nagyobb zárással
    # kitöltjük, de a zárás csak a háttértől eltérő pontokat adhatja hozzá (a valódi háttér-rések kimaradnak)
    zart = ndi.binary_fill_holes(ndi.binary_closing(obj, structure=np.ones((3, 3)), iterations=7))
    obj |= zart & (np.abs(rgb - bg).max(axis=2) >= 6)
    obj = ndi.binary_fill_holes(obj)
    lab2, n2 = ndi.label(obj)
    if n2:
        meret = ndi.sum(obj, lab2, range(1, n2 + 1))
        obj = np.isin(lab2, [i + 1 for i, m in enumerate(meret) if m >= min_terulet])
    # a gát 1-2 képpontot a háttérből is a tárgyhoz vett: a peremen a háttérrel egyező pontok kiesnek
    perem = obj & ~ndi.binary_erosion(obj, iterations=3)
    obj &= ~(perem & (np.abs(rgb - bg).max(axis=2) < 5))
    obj = ndi.binary_opening(obj, iterations=1)
    return obj, bg

def kivag(rgb):
    """RGBA float (0..1 alfa), a tárgy átlátszatlan, a háttér átlátszó, az árnyék félig átlátszó."""
    obj, bg = maszk(rgb)
    obj = ndi.binary_erosion(obj, iterations=1)   # a fehér háttérrel kevert 1 px-es perem ne világítson sötét alapon
    m = cv2.GaussianBlur(obj.astype(np.float32), (0, 0), 0.7)
    m = np.where(ndi.binary_erosion(obj, iterations=2), 1.0, m)
    L = rgb.mean(axis=2)
    a_arny = np.clip((bg.mean() - L - 2.5) / (bg.mean() - ARNYEK_SZIN.mean()), 0, 1)
    a_arny = cv2.GaussianBlur(a_arny.astype(np.float32), (0, 0), 0.6)
    a = m + (1 - m) * a_arny
    with np.errstate(divide="ignore", invalid="ignore"):
        col = (m[..., None] * rgb + ((1 - m) * a_arny)[..., None] * ARNYEK_SZIN) / np.maximum(a[..., None], 1e-6)
    col = np.where(a[..., None] > 1e-4, col, 0)
    return np.dstack([col, a * 255]).clip(0, 255).astype(np.uint8), obj

def tartalom(rgba, kuszob=6):
    a = rgba[..., 3]
    ys, xs = np.nonzero(a > kuszob)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def lap_cellak(rgb, sor=2, oszlop=3):
    H, W = rgb.shape[:2]
    return {f"{r + 1}{c + 1}": rgb[r * H // sor:(r + 1) * H // sor, c * W // oszlop:(c + 1) * W // oszlop]
            for r in range(sor) for c in range(oszlop)}

def ratesz(rgba, szin):
    a = rgba[..., 3:4].astype(np.float32) / 255
    return (rgba[..., :3] * a + np.array(szin, np.float32) * (1 - a)).round().astype(np.uint8)

def main():
    os.makedirs(KI, exist_ok=True); os.makedirs(os.path.join(KI, "_lapbol"), exist_ok=True); os.makedirs(PROBA, exist_ok=True)
    lap = np.asarray(Image.open(LAP).convert("RGB")).astype(np.float32)
    # 1) a mesterlap szétvágása cellánként (ez adja az egymáshoz viszonyított méretet is)
    lapmeret = {}
    for k, cel in lap_cellak(lap).items():
        rgba, obj = kivag(cel)
        ys, xs = np.nonzero(obj)
        lapmeret[k] = (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1)
        x0, y0, x1, y1 = tartalom(rgba)
        Image.fromarray(rgba[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4], "RGBA").save(
            os.path.join(KI, "_lapbol", f"{NEVEK[k]}_lapbol_{x1 - x0}px.png"))
    leg_magas = max(h for w, h in lapmeret.values())
    info = {"vaszon_pt": VASZON_PT, "forras": {}, "lapmeret_px": {k: [int(v) for v in s] for k, s in lapmeret.items()}}
    probak = []
    for k, nev in NEVEK.items():
        src = os.path.join(NYERS, f"valos_szembol_egyedi_{k}_v1.png")
        rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
        rgba, obj = kivag(rgb)
        x0, y0, x1, y1 = tartalom(rgba)
        ys, xs = np.nonzero(obj)
        oh, ow = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        forras = rgba[y0:y1, x0:x1]
        Image.fromarray(forras, "RGBA").save(os.path.join(KI, f"{nev}_forras.png"))
        # közös lépték: a tárgy magassága a mesterlapon mért arány szerint
        cel_h_arany = lapmeret[k][1] / leg_magas * TARGY_MAX_MAGAS
        for sk in (1, 2, 3):
            VW, VH = VASZON_PT[0] * sk, VASZON_PT[1] * sk
            f = cel_h_arany * VH / oh
            f = min(f, TARGY_MAX_SZEL * VW / forras.shape[1], 0.97 * VH / forras.shape[0])
            kep = Image.fromarray(forras, "RGBA")
            kep = kep.resize((max(1, round(kep.width * f)), max(1, round(kep.height * f))), Image.LANCZOS)
            v = Image.new("RGBA", (VW, VH), (0, 0, 0, 0))
            # a tárgy talppontja (a maszk alja) a vászon alsó 8%-ánál, vízszintesen a tárgy közepe középen
            talp = (ys.max() - y0) * f
            kx = ((xs.min() + xs.max()) / 2 - x0) * f
            px, py = round(VW / 2 - kx), round(VH * 0.92 - talp)
            px = min(max(px, 0), VW - kep.width); py = min(max(py, 0), VH - kep.height)
            v.alpha_composite(kep, (px, py))
            jel = "" if sk == 1 else f"@{sk}x"
            v.save(os.path.join(KI, f"{nev}{jel}.png"))
            feher = Image.new("RGBA", (VW, VH), (255, 255, 255, 255)); feher.alpha_composite(v)
            feher.convert("RGB").save(os.path.join(KI, f"{nev}_feher{jel}.png"))
            if sk == 3:
                probak.append(np.asarray(v))
                info["forras"][nev] = {"forras": os.path.relpath(src, ASSETS), "targy_px": [int(ow), int(oh)],
                                       "nagyitas_3x": round(f, 3), "felskalazva_3x": bool(f > 1.0)}
    # 2) próbalap: a hat tárgy fehér lapon, a színezett alapon (#DDE3EC) és tintakéken, @3x vásznon
    sorok = []
    for szin in ((255, 255, 255), (0xDD, 0xE3, 0xEC), (0x17, 0x28, 0x4A)):
        sorok.append(np.concatenate([ratesz(p, szin) for p in probak], axis=1))
    Image.fromarray(np.concatenate(sorok, axis=0)).save(os.path.join(PROBA, "harom_alapon.png"))
    json.dump(info, open(os.path.join(KI, "_info.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(info, ensure_ascii=False))

if __name__ == "__main__":
    main()
