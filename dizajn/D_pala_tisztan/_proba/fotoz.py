"""Fejetlen Chrome-mal lefotózza a képernyőket 390x844 CSS px-en, 2x-es felbontásban.
Minden lövés saját --user-data-dir-t kap (így a localStorage üres, a számolás első megnyitása látszik).
Használat: python fotoz.py 03_fooldal [01_belepes ...]  (teljes hosszú képhez: --teljes)"""
import subprocess, sys, os, re, time, uuid
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
MAPPA = "C:/Users/UpgradePC/konyvelo_app/dizajn/D_pala_tisztan"
PROFIL = "D:/Atvitel/Temp/claude/C--Users-UpgradePC/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/chr_d"
def lov(nev, teljes=False):
    url = f"file:///{MAPPA}/{nev}.html" + ("?teljes" if teljes else "")
    mag = 844
    if teljes:
        out = subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={PROFIL}_{uuid.uuid4().hex[:8]}",
            "--window-size=390,844", "--virtual-time-budget=6000", "--dump-dom", url], capture_output=True, text=True, encoding="utf-8", timeout=60).stdout
        m = re.search(r'data-magassag="(\d+)"', out)
        mag = int(m.group(1)) if m else 1600
    cel = f"{MAPPA}/{nev}{'_teljes' if teljes else ''}.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={PROFIL}_{uuid.uuid4().hex[:8]}",
        f"--window-size=390,{mag}", "--force-device-scale-factor=2", "--hide-scrollbars", "--virtual-time-budget=6000",
        f"--screenshot={cel}", url], capture_output=True, timeout=60)
    print(cel, mag)
teljes = "--teljes" in sys.argv
for n in [a for a in sys.argv[1:] if not a.startswith("--")]:
    lov(n, teljes)
