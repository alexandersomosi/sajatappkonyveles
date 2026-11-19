"""Ellenőrzések (a videók „tesztjei”): python ellenoriz.py <nev|mind> [--kockak]

- mp4: H.264 High, 1080x1920, 30 fps, yuv420p, AAC 48 kHz, +faststart (a moov az mdat előtt), <= 15 MB, hossz a SPEC-sávban
- szín: BT.709 címkék (mátrix, alapszínek, átvitel, korlátozott tartomány), és a címkép alapja a márkakék #1428DB (± 3)
- hang (narrált változat): MONO, CSATORNÁNKÉNT -16 ± 0,7 LUFS, a valódi csúcs a KÉSZ fájlban <= -1,5 dBTP, és a három
  kész videó (a bekötés-videóval együtt) csatornánkénti hangossága legfeljebb 1 LU-val tér el (video/hang_ellenorzes.py)
- VTT: WEBVTT fejléc, UTF-8, növekvő idők, cue-nként <= 2 sor x 42 karakter, és a sortörés nem választ el igét az
  igekötőjétől / névelőt a szavától (video/felirat_tores.py)
- poszter: 1080x1920 JPEG, <= 300 KB
- szöveg: nincs termék- vagy könyvelőnév, MI/AI, lakcímkártya-hátoldal, időpontfoglalás
- a kod/media/ másolatok egyeznek a kimenettel
- --kockak: 3 másodpercenként kocka a KÉSZ mp4-ből -> kockak/vegso_lap_NN.jpg (ezeket meg kell nézni)
Kilépési kód: 0 = minden rendben, 1 = hiba.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402

sys.path.insert(0, K.VIDEO)
import felirat_tores as FT  # noqa: E402  (video/felirat_tores.py – a három videó közös felirat-tördelője)
import hang_ellenorzes as HE  # noqa: E402  (video/hang_ellenorzes.py – a három videó közös hangmércéje)

HOSSZ = {"vallalkozas_bejelentes": (90, 150), "meghatalmazas": (60, 100)}
TILTOTT = [r"\bAI\b", r"\bMI\b", r"mesterséges intelligencia", r"Kovács", r"\bBence\b", r"Kézjegy", r"hátoldal", r"időpont",
           r"Somosi",
           # tulaj 11-19 (SPEC §27.0.2, §27.5.2): „anyukád”, nem „anyád”; a kiállított számlák nem „a NAV-tól jönnek”
           r"\b[Aa]nyád\b", r"\b[Aa]nyja\b", r"[Éé]desanyád", r"száml\w*\s+(?:[\w-]+\s+){0,3}NAV-tól",
           r"NAV-tól\s+(?:jön|jött|jönnek|jöttek|kaptuk|érkez\w*|megérkez\w*)", r"NAV-ból jövő számlá"]


def ffprobe(p):
    r = K.futtat(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", p], capture_output=True, text=True,
                 encoding="utf-8")
    return json.loads(r.stdout)


def faststart(p) -> bool:
    with open(p, "rb") as f:
        b = f.read(1 << 20)
    i_moov, i_mdat = b.find(b"moov"), b.find(b"mdat")
    return i_moov != -1 and (i_mdat == -1 or i_moov < i_mdat)


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def ellenoriz(nev: str, kockak: bool = False) -> list:
    hibak, megj = [], []
    d = K.mappa(nev)
    mp4, vtt, pos = f"{d}/{nev}.mp4", f"{d}/{nev}.vtt", f"{d}/{nev}_poszter.jpg"
    for p in (mp4, vtt, pos):
        if not os.path.exists(p):
            hibak.append(f"hiányzik: {p}")
    if hibak:
        return hibak
    pr = ffprobe(mp4)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    if v["codec_name"] != "h264" or v.get("profile") != "High":
        hibak.append(f"videó kodek/profil: {v['codec_name']} {v.get('profile')}")
    if (v["width"], v["height"]) != (1080, 1920):
        hibak.append(f"méret: {v['width']}x{v['height']}")
    if v.get("r_frame_rate") not in ("30/1",):
        hibak.append(f"fps: {v.get('r_frame_rate')}")
    if v.get("pix_fmt") != "yuv420p":
        hibak.append(f"pix_fmt: {v.get('pix_fmt')}")
    if not a or a["codec_name"] != "aac" or a.get("sample_rate") != "48000":
        hibak.append(f"hang: {a and a['codec_name']} {a and a.get('sample_rate')}")
    if not faststart(mp4):
        hibak.append("nincs +faststart (a moov nem az elején van)")
    meret = os.path.getsize(mp4)
    if meret > 15 * 1024 * 1024:
        hibak.append(f"túl nagy: {meret / 1e6:.1f} MB")
    # szín (2026-11-19): BT.709 címkékkel, hogy a böngésző a márkakéket fesse (címke nélkül #0F31E4 lett)
    szin = (v.get("color_space"), v.get("color_primaries"), v.get("color_transfer"), v.get("color_range"))
    if szin != ("bt709", "bt709", "bt709", "tv"):
        hibak.append(f"színcímkék: {szin} (kell: bt709, bt709, bt709, tv)")
    import tempfile
    from PIL import Image as _Image
    with tempfile.TemporaryDirectory() as td:
        png = os.path.join(td, "k.png")
        K.futtat(["ffmpeg", "-y", "-v", "error", "-ss", "1.0", "-i", mp4, "-frames:v", "1", "-vf",
                  "scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=bicubic+accurate_rnd+full_chroma_int,format=rgb24", png])
        px = _Image.open(png).convert("RGB").getpixel((30, 30))          # a címkép alapja: a márkakék
    if max(abs(a - b) for a, b in zip(px, K.TINTAKEK)) > 3:
        hibak.append(f"a címkép kékje {px}, a márkakék {K.TINTAKEK}")
    megj.append(f"szín: {'/'.join(str(x) for x in szin)}, a címkép kékje #{px[0]:02X}{px[1]:02X}{px[2]:02X}")
    hossz = float(pr["format"]["duration"])
    lo, hi = HOSSZ[nev]
    if not (lo <= hossz <= hi):
        hibak.append(f"hossz {hossz:.1f} s, a SPEC sávja {lo}-{hi} s")
    allapot = {}
    ap = f"{d}/_elonezet/idovonal.json"
    if os.path.exists(ap):
        allapot = json.load(open(ap, encoding="utf-8"))
    megj.append(f"{nev}.mp4: {hossz:.1f} s, {meret / 1e6:.2f} MB, mód: {allapot.get('mod', '?')}")
    if allapot.get("mod") == "vegleges":
        import render as _R
        lufs, csucs = _R.hang_meres(mp4)
        if abs(lufs - _R.CEL_LUFS) > 0.7:
            hibak.append(f"hangosság {lufs:.1f} LUFS (cél {_R.CEL_LUFS} ± 0,7)")
        if csucs > _R.CEL_TP + 0.05:
            hibak.append(f"valódi csúcs {csucs:.1f} dBTP a kész fájlban (legfeljebb {_R.CEL_TP})")
        megj.append(f"hang: {lufs:.1f} LUFS, csúcs {csucs:.1f} dBTP")
        # 2026-11-19, 2. ellenőrző kör: a fájl egészére mért LUFS nem elég (a sztereó bekötés-videó csatornánként 3 dB-lel
        # halkabb volt, miközben az összeg egyezett): mono hangsáv, csatornánkénti hangosság, és a három videó egymáshoz mérve
        hm = HE.meres(mp4)
        hibak += HE.hibak(mp4, m=hm)
        elt, mert = HE.egyezes()
        hibak += elt
        megj.append("csatornánként: " + ", ".join(f"{n} {x['lufs_csatorna']:.1f} LUFS ({x['csatornak']} cs.)" for n, x in mert.items()))
    # VTT
    t = open(vtt, encoding="utf-8").read()
    if not t.startswith("WEBVTT"):
        hibak.append("VTT: nincs WEBVTT fejléc")
    elozo = -1.0
    db = 0
    for blokk in t.strip().split("\n\n")[1:]:
        sorok = blokk.split("\n")
        m = re.match(r"(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})", sorok[1] if len(sorok) > 1 else "")
        if not m:
            hibak.append(f"VTT: hibás idősor: {blokk[:60]!r}")
            continue
        g = [int(x) for x in m.groups()]
        t0 = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        t1 = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        if t0 < elozo - 1e-6 or t1 <= t0:
            hibak.append(f"VTT: idősorrend: {sorok[1]}")
        elozo = t1
        szoveg = sorok[2:]
        if len(szoveg) > 2 or any(len(s) > 42 for s in szoveg):
            hibak.append(f"VTT: túl hosszú cue: {szoveg}")
        if len(szoveg) == 2:
            szavak_ = (szoveg[0] + " " + szoveg[1]).split()
            if FT.tores_ar(szavak_, len(szoveg[0].split())) >= FT.TILOS:
                hibak.append(f"VTT: tiltott sortörés (igekötő / névelő / szám elválik a szavától): {szoveg}")
        db += 1
    if elozo > hossz + 0.05:
        hibak.append(f"VTT: az utolsó cue ({elozo:.2f} s) a videó vége után ér véget")
    megj.append(f"{nev}.vtt: {db} cue")
    # poszter
    from PIL import Image
    im = Image.open(pos)
    if im.size != (1080, 1920) or im.format != "JPEG":
        hibak.append(f"poszter: {im.format} {im.size}")
    if os.path.getsize(pos) > 300 * 1024:
        hibak.append(f"poszter túl nagy: {os.path.getsize(pos) / 1024:.0f} KB")
    megj.append(f"{nev}_poszter.jpg: {os.path.getsize(pos) / 1024:.0f} KB")
    # szövegszabályok
    fk = K.forgatokonyv(nev)
    brand = json.load(open(K.APP + "/kod/shared/brand.json", encoding="utf-8"))
    tiltott = TILTOTT + [re.escape(str(v)) for k, v in brand.items() if isinstance(v, str) and k.lower() in ("name", "nev", "productname", "termeknev") and v]
    for _, s in K.sorok(fk):
        for mezo in ("mond", "felirat"):
            for minta in tiltott:
                if re.search(minta, s[mezo]):
                    hibak.append(f"tiltott szó ({minta}) a(z) {s['id']} {mezo} mezőjében")
    # média-másolatok
    for f in (f"{nev}.mp4", f"{nev}.vtt", f"{nev}_poszter.jpg"):
        mp = f"{K.MEDIA}/{f}"
        if not os.path.exists(mp):
            hibak.append(f"nincs a kod/media-ban: {f}")
        elif sha(mp) != sha(f"{d}/{f}"):
            hibak.append(f"a kod/media/{f} eltér a kimenettől")
    if kockak:
        ki = f"{d}/kockak"
        os.makedirs(ki, exist_ok=True)
        # a korábbi lapok a kockak/_regi/-be (nem törlünk): egy rövidebb videó után ne maradjon ott egy régi, oda nem illő lap
        import datetime as _dt
        import glob
        import shutil
        regiek = sorted(glob.glob(f"{ki}/vegso_lap_*.jpg"))
        if regiek:
            rd = f"{ki}/_regi/vegso_{_dt.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(rd, exist_ok=True)
            for f in regiek:
                shutil.move(f, f"{rd}/{os.path.basename(f)}")
        # a kész fájl BT.709; a JPEG BT.601 teljes tartomány: átszámolva, hogy a lapokon a kék a videó kékje legyen
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", mp4, "-vf",
                  "fps=1/3,scale=360:640:in_color_matrix=bt709:out_color_matrix=bt601:in_range=tv:out_range=pc:"
                  "flags=bicubic+accurate_rnd+full_chroma_int,format=yuvj420p,tile=4x2:padding=8:margin=8:color=0x282828",
                  "-q:v", "3", f"{ki}/vegso_lap_%02d.jpg"])
        megj.append(f"kockák: {ki}/vegso_lap_*.jpg")
    for m in megj:
        print("  " + m)
    return hibak


def main(argv):
    nevek = K.NEVEK if argv[0] == "mind" else [argv[0]]
    osszes = []
    for n in nevek:
        print(n)
        h = ellenoriz(n, "--kockak" in argv)
        for x in h:
            print("  HIBA: " + x)
        osszes += h
    print("RENDBEN" if not osszes else f"{len(osszes)} hiba")
    return 0 if not osszes else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
