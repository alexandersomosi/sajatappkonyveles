"""Kézjegy C2: az egyéb lap (_lap_egyeb.png: guilloche-minta + papírszál) feldolgozása varratmentes csempékké.
- guilloche: a minta periódusát autokorrelációval mérjük, és pontosan egész számú periódust vágunk ki, így a csempe
  varrat nélkül ismétlődik; kimenet fehér vonalak átlátszó alapon (a fejlécsáv tintakékjére tehető, bármilyen
  színre), egy halk (alapértelmezett) és egy teljes erejű változat;
- papírszál: a fényesség-átmenetet levesszük (felüláteresztő szűrés), a pöttyöket kijavítjuk, a csempét a félig
  eltolt másolatával keverve varratmentessé tesszük; kimenet: tintakék szálak nagyon halk alfával, a fehér levélre.
Próbalapok a _nyers/vagas_proba/-ba (3x3 ismétlés a varrat ellenőrzésére)."""
import json, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
LAP = os.path.join(ASSETS, "_lap_egyeb.png")
KI = os.path.join(ASSETS, "textura")
PROBA = os.path.join(ASSETS, "_nyers", "vagas_proba")
TINTAKEK = (0x17, 0x28, 0x4A)

def mintak(rgb):
    """A két négyzetes minta befoglalója (bal: sötét guilloche, jobb: papír)."""
    d = 255 - rgb.min(axis=2)
    H, W = d.shape
    bal = d[:, : W // 2] > 100
    ys, xs = np.nonzero(bal)
    g = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    jobb = d[:, W // 2:]
    # a papír alig sötétebb a háttérnél: soronként/oszloponként átlagolt eltérés
    oszl = jobb.mean(axis=0); sor = jobb.mean(axis=1)
    xs = np.nonzero(oszl > oszl.max() * 0.5)[0]; ys = np.nonzero(sor > sor.max() * 0.5)[0]
    p = (W // 2 + xs.min(), ys.min(), W // 2 + xs.max() + 1, ys.max() + 1)
    return g, p

def varratmentes(T):
    """Varratmentes csempe: a csempe és félig eltolt másolata keverve (közép: eredeti, szélek: eltolt)."""
    h, w = T.shape[:2]
    y = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h / 2)
    x = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w / 2)
    wgt = np.clip(np.minimum.outer(y, x) * 2.2, 0, 1)
    wgt = wgt * wgt * (3 - 2 * wgt)
    R = np.roll(np.roll(T, h // 2, axis=0), w // 2, axis=1)
    if T.ndim == 3:
        wgt = wgt[..., None]
    return T * wgt + R * (1 - wgt)

def ismetel(img, nx=3, ny=3):
    a = np.asarray(img)
    return np.tile(a, (ny, nx, 1) if a.ndim == 3 else (ny, nx))

def main():
    os.makedirs(KI, exist_ok=True); os.makedirs(PROBA, exist_ok=True)
    rgb = np.asarray(Image.open(LAP).convert("RGB")).astype(np.float32)
    g, p = mintak(rgb)
    info = {"guilloche_doboz": [int(v) for v in g], "papir_doboz": [int(v) for v in p]}

    # --- guilloche ---
    x0, y0, x1, y1 = g
    G = rgb[y0 + 8:y1 - 8, x0 + 8:x1 - 8]
    L = G.mean(axis=2)
    # vízszintes periódus: több sor átlagos autokorrelációja
    acx = np.mean([np.correlate(r - r.mean(), r - r.mean(), "full")[len(r) - 1:] for r in L[::7]], axis=0); acx /= acx[0]
    acy = np.mean([np.correlate(c - c.mean(), c - c.mean(), "full")[len(c) - 1:] for c in L.T[::7]], axis=0); acy /= acy[0]
    def csucs(ac, mn):
        for i in range(mn, len(ac) - 1):
            if ac[i] > ac[i - 1] and ac[i] >= ac[i + 1] and ac[i] > 0.25:
                return i
        return None
    px, py = csucs(acx, 5), csucs(acy, 5)
    info["guilloche_periodus_px"] = [px, py]
    # A periódus nem pontosan egész képpont, ezért a csempe szélességét a NAGY késleltetésű autokorreláció maximuma
    # adja (sok periódus együtt, így a hiba < 1 px); a félig eltolt keverés itt szellemképet adna (1. próba), helyette
    # a kezdő B oszlopot/sort a vágáson túli folytatással keverjük át (a túlnyúló rész természetesen folytatja a mintát).
    B = 14
    def legjobb(ac, n):
        lo = int(n * 0.72)
        return lo + int(np.argmax(ac[lo:n - B - 1]))
    Wt, Ht = legjobb(acx, L.shape[1]), legjobb(acy, L.shape[0])
    info["guilloche_csempe_px"] = [int(Wt), int(Ht)]
    info["guilloche_szel_hiba"] = [round(float(np.abs(L[:, :B] - L[:, Wt:Wt + B]).mean()), 2),
                                   round(float(np.abs(L[:B, :] - L[Ht:Ht + B, :]).mean()), 2)]
    hatter_l, vonal_l = np.percentile(L, 20), np.percentile(L, 99)
    A = np.clip((L - hatter_l) / max(vonal_l - hatter_l, 1), 0, 1)
    w = ((np.arange(B) + 0.5) / B)
    A = A[:Ht + B, :Wt + B].copy()
    A[:, :B] = A[:, :B] * w + A[:, Wt:Wt + B] * (1 - w)
    A = A[:, :Wt]
    A[:B, :] = A[:B, :] * w[:, None] + A[Ht:Ht + B, :] * (1 - w[:, None])
    a = A[:Ht, :]
    for nev, ero in (("guilloche_halk", 0.10), ("guilloche_eros", 1.0)):
        out = np.dstack([np.full(a.shape, 255), np.full(a.shape, 255), np.full(a.shape, 255), a * ero * 255])
        Image.fromarray(out.round().astype(np.uint8), "RGBA").save(os.path.join(KI, f"{nev}_csempe.png"))
    # próba: tintakék sávon 3x3
    tile = Image.open(os.path.join(KI, "guilloche_halk_csempe.png"))
    rep = Image.fromarray(ismetel(tile, 3, 2), "RGBA")
    sav = Image.new("RGBA", rep.size, TINTAKEK + (255,)); sav.alpha_composite(rep)
    sav.convert("RGB").save(os.path.join(PROBA, "guilloche_savon_3x2.png"))
    rep2 = Image.fromarray(ismetel(Image.open(os.path.join(KI, "guilloche_eros_csempe.png")), 3, 2), "RGBA")
    sav2 = Image.new("RGBA", rep2.size, TINTAKEK + (255,)); sav2.alpha_composite(rep2)
    sav2.convert("RGB").save(os.path.join(PROBA, "guilloche_eros_3x2.png"))

    # --- papírszál ---
    x0, y0, x1, y1 = p
    P = rgb[y0 + 10:y1 - 10, x0 + 10:x1 - 10].mean(axis=2)
    s = min(P.shape) // 2 * 2
    P = P[:s, :s]
    # pöttyök (a modell egy-egy sötét pontja) kijavítása
    med = ndi.median_filter(P, size=9)
    hibas = np.abs(P - med) > 12
    hibas = ndi.binary_dilation(hibas, iterations=3)
    P8 = np.clip(P, 0, 255).astype(np.uint8)
    P = cv2.inpaint(P8, hibas.astype(np.uint8), 5, cv2.INPAINT_TELEA).astype(np.float32)
    hp = P - cv2.GaussianBlur(P, (0, 0), 18)
    sd0 = float(hp.std())
    hp = varratmentes(hp)
    # a keverés a két független zaj átlagolásánál halkít (foltos sűrűség): a helyi szórást kiegyenlítjük, körbefutó szűrővel
    helyi = np.sqrt(ndi.gaussian_filter(hp * hp, 22, mode="wrap")) + 1e-3
    hp = hp / helyi * sd0
    sd = float(hp.std())
    info["papir_csempe_px"] = [int(s), int(s)]; info["papir_szoras"] = round(sd, 2); info["papir_pottyok_px"] = int(hibas.sum())
    a = np.clip(-hp / (3 * sd), 0, 1)          # csak a sötét szálak
    for nev, ero in (("papirszal_halk", 0.10), ("papirszal_eros", 0.35)):
        out = np.dstack([np.full(a.shape, TINTAKEK[0]), np.full(a.shape, TINTAKEK[1]), np.full(a.shape, TINTAKEK[2]),
                         a * ero * 255])
        Image.fromarray(out.round().astype(np.uint8), "RGBA").save(os.path.join(KI, f"{nev}_csempe.png"))
    for nev in ("papirszal_halk", "papirszal_eros"):
        tile = Image.open(os.path.join(KI, f"{nev}_csempe.png"))
        rep = Image.fromarray(ismetel(tile, 2, 2), "RGBA")
        lapp = Image.new("RGBA", rep.size, (255, 255, 255, 255)); lapp.alpha_composite(rep)
        lapp.convert("RGB").save(os.path.join(PROBA, f"{nev}_feheren_2x2.png"))
    json.dump(info, open(os.path.join(KI, "_info.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(info, ensure_ascii=False))

if __name__ == "__main__":
    main()
