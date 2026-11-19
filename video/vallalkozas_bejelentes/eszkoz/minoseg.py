"""Kockánkénti SSIM a kész mp4 és a köztes (crf 14) fájl között: hol esik szét a kép a kódolásban?
python minoseg.py <nev> [mp4]"""
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
V = "C:/Users/UpgradePC/konyvelo_app/video"
nev = sys.argv[1]
mp4 = sys.argv[2] if len(sys.argv) > 2 else f"{V}/{nev}/{nev}.mp4"
koztes = f"{V}/{nev}/_elonezet/{nev}_koztes.mp4"
log = f"{V}/{nev}/_elonezet/ssim_{os.path.basename(mp4)}.log".replace("\\", "/")
# a szűrőben a kettőspontot védeni kell (C:)
logf = log.replace(":", "\\:")
r = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-i", koztes, "-lavfi", f"[0:v][1:v]ssim=stats_file='{logf}'", "-f", "null", "-"],
                   capture_output=True, text=True)
if r.returncode:
    print(r.stderr[-600:])
    sys.exit(1)
v = []
for sor in open(log, encoding="utf-8"):
    m = re.search(r"n:(\d+) .*All:([\d.]+)", sor)
    if m:
        v.append((int(m.group(1)), float(m.group(2))))
ssim = [x[1] for x in v]
n = len(ssim)
print(f"{os.path.basename(mp4)}: {n} kocka, SSIM átlag {sum(ssim) / n:.4f}, min {min(ssim):.4f}")
for kuszob in (0.90, 0.93, 0.95, 0.97):
    print(f"  SSIM < {kuszob}: {sum(1 for x in ssim if x < kuszob)} kocka ({sum(1 for x in ssim if x < kuszob) / 30:.1f} s)")
# összefüggő rossz szakaszok (SSIM < 0.93)
szak, i = [], 0
while i < n:
    if ssim[i] < 0.93:
        j = i
        while j < n and ssim[j] < 0.93:
            j += 1
        szak.append((i / 30, j / 30, min(ssim[i:j])))
        i = j
    else:
        i += 1
print(f"  rossz szakaszok (SSIM < 0.93): {len(szak)}")
for a, b, m in sorted(szak, key=lambda x: x[2])[:25]:
    print(f"    {a:7.2f}-{b:7.2f} s ({b - a:.2f} s) min {m:.3f}")
