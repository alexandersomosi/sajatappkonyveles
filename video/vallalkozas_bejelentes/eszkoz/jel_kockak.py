"""Jelölésenként egy kocka a KÉSZ mp4-ből (a jelölés megjelenése után 0,5 s-mal): ráközelít-e a kamera a jelölt
területre, amikor a narráció arról beszél?  python jel_kockak.py <nev>
-> video/<nev>/kockak/jel_lap_NN.jpg (4x2-es lapok, felirattal: sor, szó, idő) + szöveges lista."""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

ESZ = "C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz"
sys.path.insert(0, ESZ)
import kozos as K  # noqa: E402
import render as R  # noqa: E402

nev = sys.argv[1]
R.RITMUS_BE = True          # a végleges (narrált) videó időzítése
fk = K.forgatokonyv(nev)
iv = R.idovonal(nev, fk, R.hosszak(nev, fk, False))
kep_jelenetek = [js["i"] for js in iv["jelenetek"] if js["j"]["tipus"] == "kep"]
jelenetek = [R.Jelenet(nev, fk, js, iv, kep_jelenetek) for js in iv["jelenetek"]]
mp4 = f"{K.mappa(nev)}/{nev}.mp4"
tetelek = []
for jl in jelenetek:
    if jl.tipus == "kep":
        for sv in jl.savok:
            for (t, n) in sv.jelek:
                # melyik sor melyik szava?
                szo, sid, sor_start, sor_end, anker = "?", "?", 0, 0, 0
                for s in jl.sorok:
                    for jj in s["sor"].get("jel", []):
                        kep = jj.get("kep") or s["sor"].get("kep")
                        if jj.get("n") == n and kep == sv.kep:
                            szo, sid, sor_start, sor_end = jj["szo"], s["id"], s["start"], s["end"]
                            anker = R.anker_ido(s["sor"], s["start"], s["mp"], jj["szo"], jj.get("kesleltet", 0.0), nev)
                cimke = sv.r["jelek"][n]["cimke"]
                tetelek.append({"t": t, "sid": sid, "szo": szo, "kep": sv.kep, "n": n, "cimke": cimke, "sor": (sor_start, sor_end),
                                "anker": anker})
    else:
        for s in jl.sorok:
            for jj in s["sor"].get("jel", []):
                t = R.anker_ido(s["sor"], s["start"], s["mp"], jj["szo"], jj.get("kesleltet", 0.0), nev)
                tetelek.append({"t": t, "sid": s["id"], "szo": jj["szo"], "kep": jl.tipus, "n": jj.get("elem", jj.get("app")),
                                "cimke": "", "sor": (s["start"], s["end"]), "anker": t})
tetelek.sort(key=lambda x: x["t"])
ki = f"{K.mappa(nev)}/kockak"
os.makedirs(ki, exist_ok=True)
tmp = f"{K.mappa(nev)}/_elonezet/jel_kocka_tmp.jpg"
kepek = []
for x in tetelek:
    tk = min(iv["hossz"] - 0.05, x["t"] + 0.5)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{tk:.3f}", "-i", mp4, "-frames:v", "1", "-vf", R.JPEG_SZIN, "-q:v", "2", tmp],
                   check=True)
    kepek.append(Image.open(tmp).convert("RGB").copy())
    print(f"{x['sid']} {x['kep'][:34]:34s} n={x['n']} szó='{x['szo']}' jel: {x['t']:.2f}s (horgony {x['anker']:.2f}s, a sor {x['sor'][0]:.2f}-{x['sor'][1]:.2f}s) "
          f"kocka: {tk:.2f}s  [{x['cimke']}]")
tw, th = 432, 768
per = 8
f = K.betu(24, 600)
for li in range(0, len(kepek), per):
    lap = Image.new("RGB", (tw * 4 + 50, (th + 44) * 2 + 10), (40, 40, 40))
    d = ImageDraw.Draw(lap)
    for k, (img, x) in enumerate(zip(kepek[li:li + per], tetelek[li:li + per])):
        px, py = 10 + (k % 4) * (tw + 10), 10 + (k // 4) * (th + 44)
        lap.paste(img.resize((tw, th), Image.LANCZOS), (px, py))
        d.text((px + 4, py + th + 6), f"{x['sid']} „{x['szo']}” #{x['n']}  {x['t'] + 0.5:.1f}s", fill=(255, 255, 255), font=f)
    lap.save(f"{ki}/jel_lap_{li // per + 1:02d}.jpg", quality=88)
print(f"{len(kepek)} kocka -> {ki}/jel_lap_*.jpg")
