# WCAG 2.x kontrasztszámítás a Rendben (B) változat színpárjaira (második kör: kőszürke alap, okker „rád vár”)
import sys
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
def cr(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)
PAROK = [
    ("Tinta szöveg", "#241A23", "Lap", "#FFFFFF", 7),
    ("Tinta szöveg", "#241A23", "Alap (kőszürke)", "#DFE1E3", 7),
    ("Tinta szöveg", "#241A23", "Halvány szilva", "#F3EAF1", 7),
    ("Másodlagos szöveg", "#5E5B63", "Lap", "#FFFFFF", 4.5),
    ("Másodlagos szöveg", "#5E5B63", "Alap (kőszürke)", "#DFE1E3", 4.5),
    ("Másodlagos szöveg", "#5E5B63", "Halvány szilva", "#F3EAF1", 4.5),
    ("Másodlagos szöveg", "#5E5B63", "Ikoncsempe", "#EEEFF1", 4.5),
    ("Szilva szöveg/link", "#6A2D61", "Lap", "#FFFFFF", 4.5),
    ("Szilva szöveg/link", "#6A2D61", "Alap (kőszürke)", "#DFE1E3", 4.5),
    ("Szilva (szójel, gombfelirat, aktív fül)", "#4B1F45", "Lap", "#FFFFFF", 4.5),
    ("Szilva (szójel)", "#4B1F45", "Alap (kőszürke)", "#DFE1E3", 4.5),
    ("Szilva felirat a Kimásolva gombon", "#4B1F45", "Halvány szilva", "#F3EAF1", 4.5),
    ("Fehér felirat", "#FFFFFF", "Szilva gomb", "#4B1F45", 4.5),
    ("Rád vár (okker) szöveg", "#8A5A00", "Lap", "#FFFFFF", 4.5),
    ("Rád vár (okker) szöveg", "#8A5A00", "Alap (kőszürke)", "#DFE1E3", 4.5),
    ("Fehér szám az okker jelvényen", "#FFFFFF", "Okker", "#8A5A00", 4.5),
    ("Okker pötty a szilva hónap-pirulán (fehér gyűrűvel)", "#8A5A00", "Szilva", "#4B1F45", 1),
    ("Hiba / veszélyes", "#B42318", "Lap", "#FFFFFF", 4.5),
    ("Fehér felirat", "#FFFFFF", "Piros gomb", "#B42318", 4.5),
    ("Mezőkeret, sornyíl (nem szöveg)", "#858891", "Lap", "#FFFFFF", 3),
    ("Hónap-pirula kerete (nem szöveg, a felirat azonosít)", "#858891", "Alap (kőszürke)", "#DFE1E3", 2.5),
    ("Hiányzó irat szaggatott kerete (nem szöveg)", "#A3A7AE", "Lap", "#FFFFFF", 2.3),
    ("Mérő alja / későbbi lépés pöttye", "#CBCED3", "Lap", "#FFFFFF", 1),
    ("Lap az alapon (csoportosítás)", "#FFFFFF", "Alap (kőszürke)", "#DFE1E3", 1.25),
    ("Hajszálvonal a lapon", "#E3E4E7", "Lap", "#FFFFFF", 1),
]
if __name__ == "__main__":
    for nev, e, hnev, h, min_ in PAROK:
        r = cr(e, h)
        print(f"{nev:52s} {e} / {hnev:16s} {h}: {r:5.2f}:1  {'OK' if r >= min_ else 'KEVES'} (min {min_})")
