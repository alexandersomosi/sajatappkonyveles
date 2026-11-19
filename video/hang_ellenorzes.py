"""A három videó hangjának közös mércéje (bekotes, vallalkozas_bejelentes, meghatalmazas). 2026-11-19, 2. ellenőrző kör.

Miért kell: a bekötés-videó sztereó volt (a mono narráció az ffmpeg alapértelmezett -3 dB-es felkeverésével), a két
útmutató mono. A fájl EGÉSZÉRE mért hangosság (ebur128) mindháromnál -16,2 … -16,3 LUFS volt, ezért minden teszt
átment – de CSATORNÁNKÉNT (amit egy telefon hangszórója tényleg lejátszik) a bekötés-videó 3 dB-lel halkabb volt.

Ezért mindhárom videónál ugyanazt mérjük, ugyanúgy:
  - a hangsáv MONO (ugyanaz a csatornakiosztás mindenhol),
  - az ELSŐ CSATORNA hangossága önmagában (nem a csatornák összege) a cél ± tűrés,
  - a valódi csúcs a KÉSZ fájlban legfeljebb -1,5 dBTP,
  - és a három kész videó csatornánkénti hangossága legfeljebb 1 LU-val tér el egymástól.

  python hang_ellenorzes.py            # a kod/media három videója: mérés + hibák; kilépési kód 0 / 1
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

VIDEO = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
MEDIA = os.path.dirname(VIDEO) + "/kod/media"
NEVEK = ["bekotes", "vallalkozas_bejelentes", "meghatalmazas"]
CEL_LUFS = -16.0
TURES = 0.7                 # egy videó csatornánkénti hangossága a célhoz képest
MAX_CSUCS = -1.5            # dBTP a kész fájlban
MAX_ELTERES = 1.0           # a videók egymáshoz képest (LU, csatornánként)
CSATORNAK = 1


def _ebur(p: str, szuro: str = "") -> tuple:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-vn", "-af", szuro + "ebur128=peak=true:framelog=quiet",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return (float(re.findall(r"I:\s*(-?[\d.]+) LUFS", r.stderr)[-1]), float(re.findall(r"Peak:\s*(-?[\d.]+) dBFS", r.stderr)[-1]))


def meres(p: str) -> dict:
    """-> {'csatornak', 'elrendezes', 'lufs' (a fájl egésze), 'lufs_csatorna' (az első csatorna önmagában), 'csucs_dbtp'}"""
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                                    "stream=channels,channel_layout", "-of", "json", p], capture_output=True, text=True).stdout)
    st = (pr.get("streams") or [{}])[0]
    egesz, csucs = _ebur(p)
    egy, _ = _ebur(p, "pan=mono|c0=c0,")
    return {"csatornak": int(st.get("channels") or 0), "elrendezes": st.get("channel_layout") or "", "lufs": egesz,
            "lufs_csatorna": egy, "csucs_dbtp": csucs}


def hibak(p: str, cel: float = CEL_LUFS, tures: float = TURES, max_csucs: float = MAX_CSUCS, m: dict | None = None) -> list:
    m = m or meres(p)
    nev = os.path.basename(p)
    ki = []
    if m["csatornak"] != CSATORNAK:
        ki.append(f"{nev}: a hangsáv {m['csatornak']} csatornás ({m['elrendezes']}), mono kell (mint a másik két videó)")
    if abs(m["lufs_csatorna"] - cel) > tures:
        ki.append(f"{nev}: csatornánkénti hangosság {m['lufs_csatorna']:.1f} LUFS (cél {cel} ± {tures})")
    if m["csucs_dbtp"] > max_csucs + 0.05:
        ki.append(f"{nev}: valódi csúcs {m['csucs_dbtp']:.1f} dBTP a kész fájlban (legfeljebb {max_csucs})")
    return ki


def egyezes(media: str = MEDIA, nevek: list | None = None, max_elteres: float = MAX_ELTERES) -> tuple:
    """a kész videók csatornánkénti hangossága egymáshoz mérve -> (hibák, {nev: mérés}); a hiányzó fájl kimarad"""
    mert = {}
    for n in nevek or NEVEK:
        p = f"{media}/{n}.mp4"
        if os.path.exists(p):
            mert[n] = meres(p)
    ki = []
    if len(mert) >= 2:
        lo = min(mert, key=lambda n: mert[n]["lufs_csatorna"])
        hi = max(mert, key=lambda n: mert[n]["lufs_csatorna"])
        d = mert[hi]["lufs_csatorna"] - mert[lo]["lufs_csatorna"]
        if d > max_elteres:
            ki.append(f"a videók nem egyforma hangosak: {lo} {mert[lo]['lufs_csatorna']:.1f} LUFS, {hi} "
                      f"{mert[hi]['lufs_csatorna']:.1f} LUFS csatornánként ({d:.1f} LU > {max_elteres})")
        if len({m["csatornak"] for m in mert.values()}) > 1:
            ki.append("a videók csatornakiosztása eltér: " + ", ".join(f"{n} {m['csatornak']}" for n, m in mert.items()))
    return ki, mert


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    h, mert = egyezes()
    for n, m in mert.items():
        print(f"{n}: {m['csatornak']} csatorna ({m['elrendezes']}), {m['lufs_csatorna']:.1f} LUFS csatornánként "
              f"({m['lufs']:.1f} a fájl egészére), csúcs {m['csucs_dbtp']:.1f} dBTP")
        h += hibak(f"{MEDIA}/{n}.mp4", m=m)
    for x in h:
        print("HIBA:", x)
    print("RENDBEN" if not h else f"{len(h)} hiba")
    sys.exit(1 if h else 0)
