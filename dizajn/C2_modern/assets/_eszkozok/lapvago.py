"""Kézjegy C2: a Gemini-lapok szétvágása PIL/numpy/scipy-vel (3. lépés).
Közös függvények: tinta-maszk, elemek megkeresése, fehér háttér átlátszóvá tétele úgy, hogy a tárgyak
belső fehérje (levélpapír, képernyő) fehér maradjon, csak a tárgyon KÍVÜLI fehér tűnik el."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def betolt(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)

def feheritett(rgb):
    """Mennyire tér el a fehértől (0..255): 255 - a legkisebb csatorna."""
    return 255.0 - rgb.min(axis=2)

def elemek(rgb, kuszob=22, osszevon=18, min_terulet=4000, db=None):
    """A lap elemeinek befoglaló téglalapjai (x0,y0,x1,y1), sorrendben: soronként balról jobbra."""
    ink = feheritett(rgb) > kuszob
    nagy = ndi.binary_dilation(ink, iterations=osszevon)
    lab, n = ndi.label(nagy)
    dobozok = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        resz = (lab[sl] == i) & ink[sl]
        if resz.sum() < min_terulet:
            continue
        ys, xs = np.nonzero(resz)
        dobozok.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1,
                        sl[0].start + ys.max() + 1, int(resz.sum())))
    dobozok.sort(key=lambda d: -d[4])
    if db:
        dobozok = dobozok[:db]
    # sorokba rendezés: a középpont y szerint csoportosítva
    dobozok.sort(key=lambda d: (d[1] + d[3]) / 2)
    sorok, akt = [], []
    for d in dobozok:
        cy = (d[1] + d[3]) / 2
        if akt and cy - (akt[-1][1] + akt[-1][3]) / 2 > (d[3] - d[1]) * 0.5:
            sorok.append(akt); akt = []
        akt.append(d)
    if akt:
        sorok.append(akt)
    return [tuple(d[:4]) for s in sorok for d in sorted(s, key=lambda d: d[0])]

def atlatszo(rgb, hatter_kuszob=12, tinta_kuszob=22, perem=3, zar=2, belso_feher=True):
    """RGBA: a kívülről elérhető fehér háttér átlátszó, a perem színe fehérről leválasztva (color-to-alpha),
    a tárgy belseje (zárt fehér területek is) átlátszatlan marad."""
    d = feheritett(rgb)
    ink = d > tinta_kuszob
    inkz = ndi.binary_dilation(ink, iterations=zar)
    lab, n = ndi.label(~inkz)
    szel = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    szel = szel[szel != 0]
    B = np.isin(lab, szel)
    gyuru = ndi.binary_dilation(B, iterations=perem + zar) & ~B
    # color-to-alpha fehér ellen
    a_c2a = np.clip(d / 255.0, 0, 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        un = (rgb - 255.0 * (1 - a_c2a[..., None])) / np.maximum(a_c2a[..., None], 1e-6)
    un = np.clip(un, 0, 255)
    alpha = np.ones(d.shape, np.float32)
    col = rgb.copy()
    m = gyuru | B
    alpha[m] = a_c2a[m]
    col[m] = un[m]
    alpha[B & (d < hatter_kuszob)] = 0
    if belso_feher:
        # a tárgy belsejében a szinte fehér pontok tiszta fehérek legyenek (a lap halvány szürkéje ne látsszon)
        bel = ~m & (d < 8)
        col[bel] = 255
    out = np.dstack([col, alpha * 255]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def vag(img, box, pad):
    x0, y0, x1, y1 = box
    W, H = img.size
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)))

def vaszonra(rgba, W, H):
    """Középre tesz egy RGBA-t egy WxH-s átlátszó vászonra."""
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(rgba, ((W - rgba.width) // 2, (H - rgba.height) // 2))
    return c

def tartalom_doboz(rgba, kuszob=8):
    a = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(a > kuszob)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
