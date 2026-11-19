# teszt.py - checks of the onboarding video package (no API call, no cost).
#   python eszkoz/teszt.py          -> exit 0 when everything passes
# 1. script rules (no product/accountant name, no AI, never the back of the address card, caption length, scenes exist)
# 2. voice-step helpers on synthetic audio (silence trim, internal pauses, caption split, blind-check word matching)
# 3. the outputs when present: mp4 (H.264 High + AAC, 1080x1920, 30 fps, 70-110 s, <= 15 MB, moov before mdat),
#    poster (1080x1920 JPEG <= 300 KB), VTT (header, <= 2 lines x 42 chars per cue), kod/media copies identical, hang.json keys
import hashlib, json, os, re, subprocess, sys
import numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hang_lepes as HL
sys.path.insert(0, os.path.dirname(HL.ROOT))              # video/: checks shared by the three videos
import felirat_tores as FT
import hang_ellenorzes as HE

ROOT = HL.ROOT
APP = "C:/Users/UpgradePC/konyvelo_app"
HIBAK, OK = [], [0]


def ell(felt, uzenet):
    if felt:
        OK[0] += 1
    else:
        HIBAK.append(uzenet)


def szkript():
    d = json.load(open(HL.SOROK, encoding="utf-8"))
    brand = json.load(open(APP + "/kod/shared/brand.json", encoding="utf-8"))
    tilos = [brand["name"], "Kovács", "Bence", "mesterséges", "intelligencia", "chatbot", "hátoldal", "időpont", "foglal"]
    jsx = open(os.path.join(ROOT, "remotion", "src", "Bekotes.tsx"), encoding="utf-8").read()
    jelenetek = set(re.findall(r"^\s{2}(\w+): \w+,$", jsx, re.M))
    for s in d["sorok"]:
        szoveg = s["szoveg"] + " " + s.get("tts", "")
        for t in tilos:
            ell(t.lower() not in szoveg.lower(), f"{s['id']}: tiltott szó a szövegben: {t}")
        ell(not re.search(r"\bAI\b|\bMI\b", szoveg), f"{s['id']}: AI/MI említés")
        # tulaj 11-19: „anyukád”, nem „anyád”; a kiállított számlák nem „a NAV-tól jönnek” (SPEC §27.0.2 / §27.5.2)
        ell(not re.search(r"\banyád\b|\banyja\b|édesanyád", szoveg, re.I), f"{s['id']}: „anyukád” kell")
        for minta in (r"száml\w*\s+(?:[\w-]+\s+){0,3}NAV-tól", r"NAV-tól\s+(?:jön|jött|jönnek|jöttek|kaptuk|érkez\w*|megérkez\w*)", r"NAV-ból jövő számlá"):
            ell(not re.search(minta, szoveg, re.I), f"{s['id']}: tiltott számla-szöveg ({minta})")
        for c in HL.cue_reszek(s):
            ell(len(c) <= 62, f"{s['id']}: túl hosszú feliratrész ({len(c)}): {c}")
        ell(s["jelenet"] in jelenetek, f"{s['id']}: nincs ilyen jelenet a Bekotes.tsx-ben: {s['jelenet']}")
        ell(not re.search(r"\d", s.get("tts") or s["szoveg"].replace("|", "")) or bool(s.get("tts")),
            f"{s['id']}: számjegy a kimondott szövegben (írd betűvel a 'tts' mezőbe)")
    egesz = " ".join(s["szoveg"] for s in d["sorok"]).lower()
    ell("lakcímes oldal" in egesz, "a lakcímkártyánál a LAKCÍMES oldalt kell mondani")
    ell(d["sorok"][0]["szoveg"].startswith("Köszönjük, hogy telepítetted az alkalmazásunkat"), "a tulaj nyitómondata hiányzik")
    ell("24–48" in egesz, "a 24–48 órás visszahívás-ígéret hiányzik")


def segedek():
    sr = HL.SR
    t = np.arange(int(0.5 * sr)) / sr
    hang = 0.3 * np.sin(2 * np.pi * 220 * t).astype(np.float32)
    csend = np.zeros(int(0.3 * sr), dtype=np.float32)
    x = np.concatenate([csend, hang, np.zeros(int(0.25 * sr), dtype=np.float32), hang, csend])
    y = HL.vag(x)
    ell(abs(len(y) / sr - (0.5 + 0.25 + 0.5 + 0.12)) < 0.08, f"vag(): rossz hossz {len(y) / sr:.3f}")
    cs = HL.belso_csendek(y)
    ell(len(cs) == 1 and abs((cs[0][0] + cs[0][1]) / 2 - (0.06 + 0.5 + 0.125)) < 0.06, f"belso_csendek(): {cs}")
    katt = np.concatenate([hang[: int(0.02 * sr)], csend, hang, csend])       # a one-frame click, silence, then the voice
    ell(abs(len(HL.vag(katt)) / sr - (0.5 + 0.12)) < 0.08, f"vag(): a kezdő kattanást benne hagyta {len(HL.vag(katt)) / sr:.3f}")
    zar = np.concatenate([csend, hang[: int(0.02 * sr)], csend[: int(0.08 * sr)], hang, csend])   # a plosive burst 80 ms before its vowel
    ell(abs(len(HL.vag(zar)) / sr - (0.02 + 0.08 + 0.5 + 0.12)) < 0.08, f"vag(): levágta a zárhang kezdetét {len(HL.vag(zar)) / sr:.3f}")
    idok = HL.cue_idok(["aaaa", "bbbbbbbb"], 3.0, [(1.4, 1.6)])
    ell(abs(idok[0][1] - 1.5) < 1e-6 and idok[1] == (1.5, 3.0), f"cue_idok(): nem a szünetre vágott {idok}")
    idok = HL.cue_idok(["aaaa", "bbbbbbbb"], 3.0, [])
    ell(abs(idok[0][1] - 1.0) < 1e-6, f"cue_idok(): nem karakterarányos {idok}")
    h = HL.hianyzo_szavak("A számláid megérkeznek a NAV-tól.", ["A számláid megérkeznek a návtól.", "a számláid megérkeznek a NAV-tól"])
    ell(h == [], f"hianyzo_szavak(): NAV-alias hibás: {h}")
    h = HL.hianyzo_szavak("huszonnégy órán belül", ["24 órán belül", "24 órán belül"])
    ell(h == [], f"hianyzo_szavak(): számjegy nem fogadva: {h}")
    h = HL.hianyzo_szavak("a lakcímes oldalát", ["a lakcímes oldalát", "a lakatos oldalát"])
    ell(h == [], f"hianyzo_szavak(): 1/2 hiány még nem hiba: {h}")
    h = HL.hianyzo_szavak("a lakcímes oldalát", ["a lakatos oldalát", "a lakótelepes oldalát"])
    ell(h == ["lakcímes"], f"hianyzo_szavak(): 2/2 hiány hiba kell legyen: {h}")


def mp4_atomok(p):
    sorrend = []
    with open(p, "rb") as f:
        while True:
            fej = f.read(8)
            if len(fej) < 8:
                break
            meret, nev = int.from_bytes(fej[:4], "big"), fej[4:8].decode("latin-1")
            if meret == 1:
                meret = int.from_bytes(f.read(8), "big")
                f.seek(meret - 16, 1)
            else:
                f.seek(meret - 8, 1)
            sorrend.append(nev)
            if meret == 0:
                break
    return sorrend


def kimenetek():
    mp4 = os.path.join(ROOT, "bekotes.mp4")
    if not os.path.exists(mp4):
        print("(nincs még bekotes.mp4 – a kimeneti ellenőrzés kimarad)")
        return
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                      "format=duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,sample_rate",
                                      "-of", "json", mp4], capture_output=True, text=True).stdout)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    ell(v["codec_name"] == "h264" and v["profile"] == "High", f"videó: {v['codec_name']} {v.get('profile')}")
    ell((v["width"], v["height"]) == (1080, 1920), f"méret: {v['width']}x{v['height']}")
    ell(v["r_frame_rate"] == "30/1", f"fps: {v['r_frame_rate']}")
    ell(len(a) == 1 and a[0]["codec_name"] == "aac", "nincs AAC hangsáv")
    hossz = float(info["format"]["duration"])
    ell(70 <= hossz <= 110.5, f"hossz: {hossz:.1f} s (70–110)")
    ell(int(info["format"]["size"]) <= 15_000_000, f"méret: {int(info['format']['size']) / 1e6:.2f} MB (> 15)")
    at = mp4_atomok(mp4)
    ell("moov" in at and "mdat" in at and at.index("moov") < at.index("mdat"), f"faststart: atomok {at}")
    from PIL import Image
    pj = os.path.join(ROOT, "bekotes_poszter.jpg")
    im = Image.open(pj)
    ell(im.format == "JPEG" and im.size == (1080, 1920), f"poszter: {im.format} {im.size}")
    ell(os.path.getsize(pj) <= 300 * 1024, f"poszter: {os.path.getsize(pj) / 1024:.0f} KB")
    vtt = open(os.path.join(ROOT, "bekotes.vtt"), encoding="utf-8").read()
    ell(vtt.startswith("WEBVTT"), "VTT fejléc")
    blokkok = [b for b in vtt.strip().split("\n\n")[1:] if "-->" in b]
    ell(len(blokkok) > 20, f"VTT: kevés felirat ({len(blokkok)})")
    for b in blokkok:
        sorok = b.split("\n")[2:]
        ell(1 <= len(sorok) <= 2 and all(len(s) <= 42 for s in sorok), f"VTT felirat: {sorok}")
    for f in ("bekotes.mp4", "bekotes_poszter.jpg", "bekotes.vtt"):
        cel = os.path.join(APP, "kod", "media", f)
        ell(os.path.exists(cel), f"nincs a kod/media-ban: {f}")
        if os.path.exists(cel):
            h1 = hashlib.sha256(open(os.path.join(ROOT, f), "rb").read()).hexdigest()
            h2 = hashlib.sha256(open(cel, "rb").read()).hexdigest()
            ell(h1 == h2, f"a kod/media/{f} eltér a videó-mappabelitől")
    hj = json.load(open(HL.HANG_JSON, encoding="utf-8"))
    for k in ("hang", "alap_stilus", "nativ_vege", "hangulatok", "keres_forma", "modell", "url"):
        ell(k in hj, f"hang.json: hiányzik {k}")
    ell(hj["modell"] == "google/gemini-3.8-flash-tts", "hang.json: rossz modell")
    # captions = the per-line timing of the voice step (hang/idozites.json), in order, without overlap, inside the video
    idz = json.load(open(HL.KI_IDOZITES, encoding="utf-8"))
    mp = lambda t: int(t[:2]) * 3600 + int(t[3:5]) * 60 + float(t[6:])
    vtt_idok = [tuple(mp(x) for x in re.findall(r"\d\d:\d\d:\d\d\.\d{3}", b.split("\n")[1])) for b in blokkok]
    cues = [c for s in idz["sorok"] for c in s["cues"]]
    ell(len(vtt_idok) == len(cues), f"VTT: {len(vtt_idok)} felirat, az időzítésben {len(cues)}")
    for (a, b), c in zip(vtt_idok, cues):
        ell(abs(a - c["start"]) < 0.002 and abs(b - c["end"]) < 0.002, f"VTT idő eltér az időzítéstől: {c['szoveg']}")
    ell(all(x[1] <= y[0] + 0.001 for x, y in zip(vtt_idok, vtt_idok[1:])), "VTT: átfedő feliratok")
    ell(vtt_idok[-1][1] <= hossz + 0.05 and abs(idz["hossz"] - hossz) < 0.2, f"VTT/időzítés hossza ({idz['hossz']}) és a videó ({hossz:.2f})")
    # the brand band is the vivid blue #1428DB (dizajn/PALETTA.md), decoded with the BT.709 matrix the file is tagged with
    kocka = subprocess.run(["ffmpeg", "-v", "error", "-ss", "1.5", "-i", mp4, "-frames:v", "1", "-vf",
                            "scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=bicubic+accurate_rnd+full_chroma_int,"
                            "format=rgb24,crop=8:8:30:30", "-f", "rawvideo", "-"], capture_output=True).stdout
    rgb = tuple(kocka[:3])
    ell(len(kocka) == 192 and all(abs(x - y) <= 6 for x, y in zip(rgb, (0x14, 0x28, 0xDB))), f"a fejlécsáv nem #1428DB: {rgb}")
    if not idz.get("becsult"):
        # loudness PER CHANNEL (what a phone speaker plays), mono like the two guide videos, true peak in the finished file,
        # and the three finished videos within 1 LU of each other (video/hang_ellenorzes.py). 2026-11-19: the whole-file
        # LUFS of the old stereo file read -16.2 while each channel was at -19.2, 3 dB below the guides.
        m = HE.meres(mp4)
        for h in HE.hibak(mp4, tures=0.5, m=m):
            ell(False, "hang: " + h)
        ell(True, "hang")
        elt, mert = HE.egyezes()
        for h in elt:
            ell(False, "hang: " + h)
        print(f"hang: {m['csatornak']} csatorna, {m['lufs_csatorna']:.1f} LUFS csatornánként, csúcs {m['csucs_dbtp']:.1f} dBTP; "
              + ", ".join(f"{n} {x['lufs_csatorna']:.1f}" for n, x in mert.items()))
    # caption lines never separate a verb from its prefix / an article from its noun (video/felirat_tores.py)
    for b in blokkok:
        sorok = b.split("\n")[2:]
        if len(sorok) == 2:
            szavak = (sorok[0] + " " + sorok[1]).split()
            ell(FT.tores_ar(szavak, len(sorok[0].split())) < FT.TILOS, f"VTT: tiltott sortörés: {sorok}")


if __name__ == "__main__":
    szkript()
    segedek()
    kimenetek()
    print(f"OK: {OK[0]} ellenőrzés")
    for h in HIBAK:
        print("HIBA:", h)
    sys.exit(1 if HIBAK else 0)
