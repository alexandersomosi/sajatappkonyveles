# Képernyőképek fej nélküli Chrome-mal: 390x844 CSS px, @2x.
# Minden lövés saját --user-data-dir-t kap. Használat:
#   python kep.py 01_belepes 03_fooldal ...        (csak a 844 px-es nézet)
#   python kep.py --teljes 03_fooldal              (a teljes görgetett hossz is: <nev>_teljes.png)
#   python kep.py --homaly 01_belepes ...          (hunyorítás-próba: <nev>_homaly.png, GaussianBlur 6)
import os, re, subprocess, sys, tempfile, uuid
from PIL import Image, ImageFilter

MAPPA = "C:/Users/UpgradePC/konyvelo_app/dizajn/B_szilva_rendben"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
TMP = "D:/Atvitel/Temp/claude/C--Users-UpgradePC/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/chrome_profilok"
os.makedirs(TMP, exist_ok=True)

def profil():
    p = TMP + "/p_" + uuid.uuid4().hex[:10]
    os.makedirs(p, exist_ok=True)
    return p

def alap_flagek(w, h):
    return [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
            "--no-default-browser-check", "--allow-file-access-from-files",
            "--force-device-scale-factor=2", f"--window-size={w},{h}",
            "--virtual-time-budget=5000", f"--user-data-dir={profil()}"]

def url(nev):
    return "file:///" + MAPPA + "/" + nev + ".html"

def magassag(nev):
    out = subprocess.run(alap_flagek(390, 844) + ["--dump-dom", url(nev)], capture_output=True, text=True, encoding="utf-8", timeout=90).stdout
    m = re.search(r'data-h="(\d+)"', out)
    f = re.search(r'data-betu="([^"]*)"', out)
    return (int(m.group(1)) if m else 844), (f.group(1) if f else "?")

def loves(nev, h, cel):
    subprocess.run(alap_flagek(390, h) + [f"--screenshot={cel}", url(nev)], capture_output=True, timeout=90)
    return Image.open(cel).size

if __name__ == "__main__":
    args = sys.argv[1:]
    teljes = "--teljes" in args
    homaly = "--homaly" in args
    nevek = [a for a in args if not a.startswith("--")]
    for nev in nevek:
        cel = f"{MAPPA}/{nev}.png"
        meret = loves(nev, 844, cel)
        h, betu = magassag(nev)
        print(nev, meret, "teljes magasság:", h, "betű:", betu)
        if teljes and h > 844:
            c2 = f"{MAPPA}/{nev}_teljes.png"
            print("  teljes:", loves(nev, h, c2))
        if homaly:
            Image.open(cel).convert("RGB").filter(ImageFilter.GaussianBlur(6)).save(f"{MAPPA}/_hunyoritas/{nev}_homaly.png")
