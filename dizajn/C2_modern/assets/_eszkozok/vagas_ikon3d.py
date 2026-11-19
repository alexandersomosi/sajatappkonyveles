"""Kézjegy C2: a két jóváhagyott, színes 3D ikonlap (ikonlap_a_v2.webp, ikonlap_b_v1.webp) szétvágása 16 külön ikonra.
(11-17 éjjel, a tulaj döntése: vonalas/vektor ikon SEHOL, helyette ezek.)

Lépések:
  1. tárgymaszk: éles élek + színes pontok határolnak, a lap széléről elárasztott rész a háttér (és az árnyék);
     a B lap lebegő árnyékai a tárgy alatt vannak, ezért ott ikononként megadott „talpvonal” alatt a semleges
     (szürke) pont már árnyék, a nyugtánál egy kis sokszög is leválasztja a tépett perem alatti árnyékot;
  2. alfa: a tárgy belseje átlátszatlan; a tárgy peremén alfa = max(lágy maszk, fehértől mért távolság), a szín
     a fehértől leválasztva (nincs fehér szegély a #DDE3EC alapon); a tárgyon kívül az árnyék alfája a fehértől mért
     távolságból jön, színe a tintakék családból (#1A2233), mint az illusztrációknál;
  3. minden árnyékfoltot a fölötte álló tárgy kap (x-átfedés), és az ikon árnyéka a saját tárgyától/foltjától
     10 px alatt lágyan elfogy, így a szomszéd árnyéka és a halvány padlófény nem lóg át, kemény határ nincs;
  4. vágás: a tárgy hosszabbik oldala a négyzet FILL része, a négyzet közepe a tárgy közepe (az árnyék felé kicsit
     lejjebb tolva); ami az árnyékból a négyzet szélére ér, az lágyan elhalványul (nincs levágott árnyék-él);
  5. kimenet: assets/ikon3d/<nev>.png (mester, forrásfelbontás) és <nev>_<pt>@2x/@3x.png 24/28/36/44/56/72 pt-ra,
     plusz _elonezet.png (28 és 56 pt, fehér lapon és a #DDE3EC alapon) és _info.json.
Használat: python vagas_ikon3d.py"""
import json, os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
NYERS = os.path.join(ASSETS, "_nyers")
KI = os.path.join(ASSETS, "ikon3d")
FONT = os.path.join(os.path.dirname(ASSETS), "app_v2", "fontok", "Geist_wght.ttf")

PT_MERETEK = (24, 28, 36, 44, 56, 72)
SZORZOK = (2, 3)
FILL = 0.86                 # a tárgy hosszabbik oldala a négyzet ennyi része
ARNYEK_TOLAS = 0.35         # az árnyék alsó kiterjedésének ennyi részével kerül lejjebb a négyzet közepe
PEREM_MIN = 0.03            # a tárgy+árnyék és a négyzet széle között legalább ennyi levegő
HALVANYITAS = 0.10          # az árnyék a négyzet szélétől ekkora sávban (a négyzet oldalának része) halványul el
ARNYEK_SZIN = np.array([0x1A, 0x22, 0x33], np.float32)
ARNYEK_KUSZOB = 2.5         # ennyi fehértől való eltérés még zaj (webp), nem árnyék
ARNYEK_MAG = 0.08           # e fölött árnyékfolt (a padlófény halványabb), a folt a fölötte álló tárgyé
ARNYEK_KIFUTAS = 10.0       # a folttól/tárgytól ennyi px alatt fogy el az árnyék

LAPOK = {
    "a": {"fajl": "ikonlap_a_v2.webp", "oszlop": [0, 330, 625, 890, 1216], "sor": [0, 450, 896]},
    "b": {"fajl": "ikonlap_b_v1.webp", "oszlop": [0, 400, 640, 895, 1216], "sor": [0, 440, 896]},
}
# (lap, sor, oszlop, név, maszk-módszer, talpvonal y vagy None, árnyék-sokszög vagy None)
#  módszer: "eredeti" = élek 3,2 küszöbbel + zárás (papír is), "szigoru" = élek 7 felett + szín (a lágy árnyék nem gát)
IKONOK = [
    ("a", 0, 0, "feltoltes", "eredeti", None, None),
    ("a", 0, 1, "kerdezek", "eredeti", None, None),
    ("a", 0, 2, "igazolas", "eredeti", None, None),
    ("a", 0, 3, "hataridok", "eredeti", None, None),
    ("a", 1, 0, "fooldal", "eredeti", None, None),
    ("a", 1, 1, "dosszie", "eredeti", None, None),
    ("a", 1, 2, "uzenetek", "eredeti", None, None),
    ("a", 1, 3, "fiok", "eredeti", None, None),
    ("b", 0, 0, "fotozas", "szigoru", 362, None),
    ("b", 0, 1, "masolas", "eredeti", 384, None),
    ("b", 0, 2, "szamlaszam", "szigoru", 362, None),
    ("b", 0, 3, "befizetve", "szigoru", 378, None),
    ("b", 1, 0, "szamolo", "szigoru", 681, None),
    ("b", 1, 1, "ertesites", "szigoru", 663, None),
    ("b", 1, 2, "irat", "eredeti", 671, None),
    ("b", 1, 3, "nyugta", "szigoru", 696,
     [(900, 689.5), (985, 688), (995, 687.5), (1010, 688), (1025, 690), (1040, 691), (1046, 692.5), (1049, 688),
      (1052, 672), (1216, 672), (1216, 730), (900, 730)]),
]
MAGYARUL = {"feltoltes": "Feltöltés", "kerdezek": "Kérdezek", "igazolas": "Igazolás", "hataridok": "Határidők",
            "fooldal": "Főoldal", "dosszie": "Dosszié", "uzenetek": "Üzenetek", "fiok": "Fiók",
            "fotozas": "Fotózás", "masolas": "Másolás", "szamlaszam": "Számlaszám", "befizetve": "Befizetve",
            "szamolo": "Hogyan jött ki?", "ertesites": "Értesítés", "irat": "Irat / PDF", "nyugta": "Nyugta"}


def gradiens(rgb):
    Lb = cv2.GaussianBlur(rgb.mean(axis=2), (0, 0), 0.9)
    gx = cv2.Sobel(Lb, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(Lb, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    return np.hypot(gx, gy)


def elarasztott_maszk(gat):
    lab, _ = ndi.label(~gat)
    szel = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    szel = szel[szel != 0]
    return ndi.binary_fill_holes(~np.isin(lab, szel))


def maszk_eredeti(rgb):
    """A vagas_valos.py módszere: a fehér papír halvány pereme is gát, a kis rések zárással teltek."""
    G = gradiens(rgb)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    D = 255.0 - rgb.mean(axis=2)
    gat = (G > 3.2) | (sat > 16) | (D > 105)
    gat = ndi.binary_closing(gat, structure=np.ones((3, 3)), iterations=2)
    gat = ndi.binary_dilation(gat, iterations=1)
    obj = elarasztott_maszk(gat)
    elter = np.abs(rgb - 255.0).max(axis=2)
    zart = ndi.binary_fill_holes(ndi.binary_closing(obj, structure=np.ones((3, 3)), iterations=7))
    obj |= zart & (elter >= 6)
    obj = ndi.binary_fill_holes(obj)
    perem = obj & ~ndi.binary_erosion(obj, iterations=3)
    obj &= ~(perem & (elter < 5))
    return ndi.binary_opening(obj, iterations=1)


def maszk_szigoru(rgb):
    """Csak a határozott él és a szín gát: a lágy, szürke árnyék elárasztható, így nem tapad a tárgyhoz."""
    G = gradiens(rgb)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    gat = (G > 7) | (sat > 16)
    gat = ndi.binary_closing(gat, structure=np.ones((3, 3)), iterations=1)
    return elarasztott_maszk(gat)


def sokszog_maszk(shape, pontok):
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pontok], fill=255)
    return np.asarray(m) > 0


def lap_targyai(lapkulcs, rgb):
    lap = LAPOK[lapkulcs]
    H, W = rgb.shape[:2]
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    yy = np.arange(H)[:, None]
    maszkok = {"eredeti": maszk_eredeti(rgb), "szigoru": maszk_szigoru(rgb)}
    targyak = {}
    for lk, r, c, nev, mod, talp, poli in IKONOK:
        if lk != lapkulcs:
            continue
        x0, x1 = lap["oszlop"][c], lap["oszlop"][c + 1]
        y0, y1 = lap["sor"][r], lap["sor"][r + 1]
        m = np.zeros((H, W), bool)
        m[y0:y1, x0:x1] = maszkok[mod][y0:y1, x0:x1]
        semleges = sat < 10
        if talp is not None:
            m &= ~((yy >= talp) & semleges)
        if poli is not None:
            m &= ~(sokszog_maszk((H, W), poli) & semleges)
        if talp is not None:
            # a talp fölötti 30 px-ben a perem világos, semleges pontjai a lágy padlófény/árnyék, nem a papír
            # (a papír 225-230 körüli, a padlófény 236 fölötti)
            perem = m & ~ndi.binary_erosion(m, iterations=4)
            m &= ~(perem & semleges & (yy >= talp - 30) & (rgb.mean(axis=2) > 235))
        m = ndi.binary_opening(m, iterations=1)
        lab, n = ndi.label(m)
        meret = ndi.sum(m, lab, range(1, n + 1))
        m = ndi.binary_fill_holes(lab == (int(np.argmax(meret)) + 1))
        # az élgát 1-2 képpontot a fehér háttérből is a tárgyhoz vett: ezek kiesnek (különben fehér perem)
        perem = m & ~ndi.binary_erosion(m, iterations=3)
        m &= ~(perem & (np.abs(rgb - 255.0).max(axis=2) < 8))
        targyak[nev] = m
    return targyak


def arnyek_alfa(d):
    """A tárgyon kívüli árnyék alfája a fehértől mért távolságból (a tintakék árnyékszínnel visszaadja a pontot)."""
    return np.clip((d - ARNYEK_KUSZOB) / (255.0 - ARNYEK_SZIN.mean() - ARNYEK_KUSZOB), 0, 1)


def rgba_lap(rgb, targyak, gyuru_be=3, gyuru_ki=3):
    """A lap minden pontjára: melyik ikoné, tárgy-fedettség (a_obj), a tárgy leválasztott színe és az árnyék alfája.
    A perem két rétegű matt: a pont = alfa * tárgyszín + (1 - alfa) * helyi háttér, ahol a tárgyszín a legközelebbi
    belső pont, a helyi háttér a legközelebbi külső pont színe (fehér vagy árnyék). Így nincs fehér perem, és ami a
    peremből háttér, az árnyékként folytatódik."""
    nevek = list(targyak)
    H, W = rgb.shape[:2]
    cimke = np.zeros((H, W), np.int32)
    for i, nev in enumerate(nevek, start=1):
        cimke[targyak[nev]] = i
    obj = cimke > 0
    d = 255.0 - rgb.min(axis=2)
    db = cv2.GaussianBlur(d.astype(np.float32), (0, 0), 0.8)
    a_arny = arnyek_alfa(db)

    # --- az árnyék gazdája: az árnyékfoltot az a tárgy kapja, amelyik fölötte van (x-átfedés)
    mag_arny = (a_arny > ARNYEK_MAG) & ~ndi.binary_dilation(obj, iterations=gyuru_ki)
    lab, n = ndi.label(mag_arny)
    mag_cimke = cimke.copy()
    dobozok = {}
    for i, nev in enumerate(nevek, start=1):
        ys, xs = np.nonzero(targyak[nev])
        dobozok[i] = (xs.min(), xs.max(), ys.min(), ys.max())
    for j, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        folt = lab[sl] == j
        if folt.sum() < 30:
            continue
        fx0, fx1, fy0 = sl[1].start, sl[1].stop - 1, sl[0].start
        legjobb, lj = 0, None
        for i, (x0, x1, y0, y1) in dobozok.items():
            if y0 > fy0 or fy0 - y1 > 60:          # a tárgy a folt fölött, legfeljebb 60 px-re
                continue
            atfed = min(x1, fx1) - max(x0, fx0)
            if atfed > legjobb:
                legjobb, lj = atfed, i
        if lj is not None:
            mag_cimke[sl][folt] = lj
    _, (oy, ox) = ndi.distance_transform_edt(cimke == 0, return_indices=True)
    targy_gazda = cimke[oy, ox]

    # --- peremmatt
    rgbs = cv2.GaussianBlur(rgb, (0, 0), 0.6)
    belso = ndi.binary_erosion(obj, iterations=gyuru_be)
    kulso = ~ndi.binary_dilation(obj, iterations=gyuru_ki)
    gyuru = ~belso & ~kulso
    _, (fy, fx) = ndi.distance_transform_edt(~belso, return_indices=True)
    _, (by, bx) = ndi.distance_transform_edt(~kulso, return_indices=True)
    F = rgbs[fy, fx]
    B = rgbs[by, bx]
    FB = F - B
    nrm = (FB ** 2).sum(axis=2)
    with np.errstate(divide="ignore", invalid="ignore"):
        a_vet = ((rgb - B) * FB).sum(axis=2) / np.maximum(nrm, 1e-6)
    a_vet = np.clip(a_vet, 0, 1)
    # ahol a tárgy és a háttér szinte azonos (fehér papír a fehéren), ott a lágyított maszk dönt
    m = cv2.GaussianBlur(ndi.binary_erosion(obj, iterations=1).astype(np.float32), (0, 0), 0.7)
    biztos = smoothstep((np.sqrt(nrm) - 14.0) / 16.0)
    a_g = biztos * a_vet + (1 - biztos) * m
    a_obj = np.where(belso, 1.0, np.where(gyuru, a_g, 0.0)).astype(np.float32)
    with np.errstate(divide="ignore", invalid="ignore"):
        Fd = (rgb - (1 - a_obj[..., None]) * B) / np.maximum(a_obj[..., None], 1e-6)
    Fd = np.clip(Fd, 0, 255)
    s = smoothstep((a_obj - 0.15) / 0.35)[..., None]
    szin = np.where(belso[..., None], rgb, s * Fd + (1 - s) * F)
    # a perem háttér-része: ugyanaz az árnyék, mint a helyi háttérben
    a_hatter = arnyek_alfa(255.0 - B.min(axis=2))
    a_arny = np.where(belso, 0.0, np.where(gyuru, a_hatter, a_arny)).astype(np.float32)
    return nevek, targy_gazda, mag_cimke, a_obj, szin.astype(np.float32), a_arny


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def premult_resize(rgba_img, px):
    return rgba_img.convert("RGBa").resize((px, px), Image.LANCZOS).convert("RGBA")


def main():
    os.makedirs(KI, exist_ok=True)
    info = {"forras": {k: v["fajl"] for k, v in LAPOK.items()}, "fill": FILL, "arnyek_szin": "#1A2233",
            "meretek_pt": list(PT_MERETEK), "ikonok": {}}
    mesterek = {}
    for lk, lap in LAPOK.items():
        rgb = np.asarray(Image.open(os.path.join(NYERS, lap["fajl"])).convert("RGB")).astype(np.float32)
        targyak = lap_targyai(lk, rgb)
        nevek, targy_gazda, mag_cimke, a_obj, szin_obj, a_arny = rgba_lap(rgb, targyak)
        H, W = rgb.shape[:2]
        for i, nev in enumerate(nevek, start=1):
            # az ikon árnyéka: a saját tárgya és a hozzá rendelt árnyékfolt, ettől ARNYEK_KIFUTAS px alatt lágyan elfogy
            # (nincs kemény Voronoi-határ a halvány padlófényben, és a szomszéd árnyéka sem lóg át)
            sajat_tav = ndi.distance_transform_edt(mag_cimke != i)
            sulyozott_arny = a_arny * smoothstep(1 - sajat_tav / ARNYEK_KIFUTAS)
            sajat = targy_gazda == i
            ys, xs = np.nonzero(targyak[nev])
            ox0, ox1, oy0, oy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            M = max(ox1 - ox0, oy1 - oy0)
            S = M / FILL
            cx = (ox0 + ox1) / 2
            # az árnyék magja a négyzet szélességén belül: meddig ér lefelé
            sav = (np.abs(np.arange(W)[None, :] - cx) < S / 2) & (sulyozott_arny > 0.05)
            ay = np.nonzero(sav.any(axis=1))[0]
            also = max(oy1, ay.max() + 1) if len(ay) else oy1
            S = max(S, (also - oy0) / (1 - 2 * PEREM_MIN))
            cy = (oy0 + oy1) / 2 + ARNYEK_TOLAS * (also - oy1)
            # ne lógjon ki se a tárgy teteje, se az árnyék alja
            cy = max(cy, also - S * (0.5 - PEREM_MIN))
            cy = min(cy, oy0 + S * (0.5 - PEREM_MIN))
            n = int(np.ceil(S))
            bx, by = int(round(cx - n / 2)), int(round(cy - n / 2))
            # kivágás (a lapon kívül eső rész átlátszó)
            a_o = np.zeros((n, n), np.float32); a_s = np.zeros((n, n), np.float32)
            col = np.zeros((n, n, 3), np.float32)
            sx0, sy0 = max(bx, 0), max(by, 0)
            sx1, sy1 = min(bx + n, W), min(by + n, H)
            ds = (slice(sy0 - by, sy1 - by), slice(sx0 - bx, sx1 - bx))
            ss = (slice(sy0, sy1), slice(sx0, sx1))
            a_o[ds] = np.where(sajat[ss], a_obj[ss], 0)
            a_s[ds] = sulyozott_arny[ss]
            col[ds] = szin_obj[ss]
            # az árnyék a négyzet szélén lágyan elfogy
            k = np.arange(n, dtype=np.float32) + 0.5
            tav = np.minimum.outer(np.minimum(k, n - k), np.minimum(k, n - k))
            a_s *= smoothstep(tav / (HALVANYITAS * n))
            a = a_o + (1 - a_o) * a_s
            with np.errstate(divide="ignore", invalid="ignore"):
                c = (a_o[..., None] * col + ((1 - a_o) * a_s)[..., None] * ARNYEK_SZIN) / np.maximum(a[..., None], 1e-6)
            c = np.where(a[..., None] > 1e-4, c, 0)
            rgba = np.dstack([c, a * 255]).round().clip(0, 255).astype(np.uint8)
            kep = Image.fromarray(rgba, "RGBA")
            kep.save(os.path.join(KI, f"{nev}.png"))
            mesterek[nev] = kep
            for pt in PT_MERETEK:
                for sz in SZORZOK:
                    premult_resize(kep, pt * sz).save(os.path.join(KI, f"{nev}_{pt}@{sz}x.png"))
            info["ikonok"][nev] = {
                "felirat": MAGYARUL[nev], "lap": lk, "targy_doboz_px": [int(ox0), int(oy0), int(ox1), int(oy1)],
                "negyzet_px": [bx, by, n], "arnyek": bool(also > oy1 + 2),
                "felskalazva_72pt@3x": bool(72 * 3 > n)}
    json.dump(info, open(os.path.join(KI, "_info.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    elonezet()
    print(json.dumps({k: v["negyzet_px"] for k, v in info["ikonok"].items()}))


def elonezet():
    """Mind a 16 ikon 28 és 56 pt-on (@2x, a kész fájlokból), fehér lapon és a #DDE3EC alapon."""
    nevek = [i[3] for i in IKONOK]
    try:
        f = ImageFont.truetype(FONT, 20); f.set_variation_by_name("Medium")
        fk = ImageFont.truetype(FONT, 26); fk.set_variation_by_name("SemiBold")
    except Exception:
        f = ImageFont.truetype("segoeui.ttf", 22); fk = ImageFont.truetype("segoeuib.ttf", 26)
    OSZ, MARGO = 8, 40
    szakaszok = []
    for pt in (28, 56):
        for alap, alapnev in (((255, 255, 255), "fehér lap #FFFFFF"), ((0xDD, 0xE3, 0xEC), "alap #DDE3EC")):
            px = pt * 2
            cella = max(px + 56, 170)
            sorm = px + 64
            Wd = MARGO * 2 + OSZ * cella
            Hd = 64 + 2 * sorm + 16
            img = Image.new("RGB", (Wd, Hd), alap)
            d = ImageDraw.Draw(img)
            d.text((MARGO, 18), f"{pt} pt (@2x, {px} px) · {alapnev}", font=fk, fill=(0x15, 0x1C, 0x2A))
            for j, nev in enumerate(nevek):
                r, c = divmod(j, OSZ)
                ik = Image.open(os.path.join(KI, f"{nev}_{pt}@2x.png"))
                x = MARGO + c * cella + (cella - px) // 2
                y = 64 + r * sorm
                img.paste(ik, (x, y), ik)
                t = MAGYARUL[nev]
                tw = d.textlength(t, font=f)
                d.text((MARGO + c * cella + (cella - tw) / 2, y + px + 10), t, font=f, fill=(0x53, 0x5D, 0x72))
            szakaszok.append(img)
    Wd = max(s.width for s in szakaszok)
    out = Image.new("RGB", (Wd, sum(s.height for s in szakaszok)), (255, 255, 255))
    y = 0
    for s in szakaszok:
        out.paste(s, (0, y)); y += s.height
    out.save(os.path.join(KI, "_elonezet.png"))


if __name__ == "__main__":
    main()
