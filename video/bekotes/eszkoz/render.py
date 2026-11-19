# render.py - THE PICTURE STEP of the onboarding video (one command, after hang_lepes.py):
#   python eszkoz/render.py [--gyors] [--nincs-masolas]
# 1. reads ../../kod/shared/brand.json (name, price), szoveg/sorok.json, hang/idozites.json -> remotion/src/adat.json (frames)
# 2. copies the approved C2 assets (3D icons, avatar, object visuals, Geist, rosette) into remotion/public/
# 3. Remotion renders the picture (1080x1920, 30 fps) and the poster still
# 4. ffmpeg: picture + hang/narracio.wav -> bekotes.mp4 (H.264 High + AAC, +faststart, <= 15 MB, CRF raised until it fits)
# 5. bekotes_poszter.jpg (<= 300 KB), bekotes.vtt (UTF-8, hu, <= 2 lines x 42 chars), kockak/ (a frame every 3 s + contact sheet)
# 6. copies bekotes.mp4 / bekotes_poszter.jpg / bekotes.vtt into C:/Users/UpgradePC/konyvelo_app/kod/media/ (SPEC §26.7.1)
import glob, json, os, shutil, subprocess, sys, textwrap, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(ROOT))                 # video/: the modules shared by the three videos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import felirat_tores as FT                                # caption line breaks (never "jelented | be")
import hang_ellenorzes as HE                              # per-channel loudness + true peak of the finished file
APP = "C:/Users/UpgradePC/konyvelo_app"
DIZ = APP + "/dizajn/C2_modern"
BRAND = APP + "/kod/shared/brand.json"
MEDIA = APP + "/kod/media"
REM = os.path.join(ROOT, "remotion")
PUB = os.path.join(REM, "public")
FPS = 30
MAX_MB = 15.0
CEL_MB = 14.0
POSZTER_MAX_KB = 300
CHROME = "D:/Atvitel/Desktop/kukutyini-studio/remotion_proba/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe"

IKONOK = ["fooldal", "dosszie", "uzenetek", "fiok", "fotozas", "irat", "szamlaszam", "igazolas", "szamlak", "bevallas", "szamolo",
          "lakat", "ora", "befizetve", "feltoltes", "hataridok", "kerdezek", "nyugta"]
TARGYAK = {"meghatalmazas_alairva": "meghatalmazas_alairva_forras.png", "dosszie_mappa": "dosszie_mappa_forras.png",
           "tepnaptar_3d": "tepnaptar_3d@3x.png", "level_boritek": "level_boritek_forras.png"}


def masol_eszkozok():
    os.makedirs(PUB + "/ikon", exist_ok=True)
    os.makedirs(PUB + "/targy", exist_ok=True)
    os.makedirs(PUB + "/fontok", exist_ok=True)
    for n in IKONOK:
        shutil.copy2(f"{DIZ}/assets/ikon3d/{n}.png", f"{PUB}/ikon/{n}.png")
    for n, f in TARGYAK.items():
        shutil.copy2(f"{DIZ}/assets/illusztraciok/{f}", f"{PUB}/targy/{n}.png")
    shutil.copy2(f"{DIZ}/assets/avatar/karakter_1_lapos_nagy.png", f"{PUB}/targy/avatar.png")
    shutil.copy2(f"{DIZ}/app_v2/fontok/Geist_wght.ttf", f"{PUB}/fontok/Geist_wght.ttf")
    shutil.copy2(f"{DIZ}/app_v2/guilloche_rozetta.svg", f"{PUB}/rozetta.svg")


def ft(n):
    s = f"{int(n):,}".replace(",", "\u00a0")
    return s


def adat_json():
    brand = json.load(open(BRAND, encoding="utf-8"))
    idz = json.load(open(os.path.join(ROOT, "hang", "idozites.json"), encoding="utf-8"))
    k = lambda s: int(round(s * FPS))
    sorok = [dict(id=s["id"], jelenet=s["jelenet"], tol=k(s["start"]), ig=k(s["end"])) for s in idz["sorok"]]
    # burned-in captions: the browser balances the lines; FT.ragaszt puts a no-break space where a break is forbidden
    # (verb + its prefix, article + noun, number + noun)
    cues = [dict(szoveg=FT.ragaszt(c["szoveg"]), tol=k(c["start"]), ig=k(c["end"])) for s in idz["sorok"] for c in s["cues"]]
    hossz = k(idz["hossz"])
    # scenes: a scene starts 8 frames before its first line (the picture leads the voice), ends where the next starts
    jel = []
    for s in sorok:
        if not jel or jel[-1]["id"] != s["jelenet"]:
            jel.append(dict(id=s["jelenet"], tol=max(0, s["tol"] - 8)))
    jel[0]["tol"] = 0
    for i, j in enumerate(jel):
        j["ig"] = jel[i + 1]["tol"] if i + 1 < len(jel) else hossz
    d = dict(fps=FPS, hossz=hossz, nema=bool(idz.get("becsult")), marka=dict(nev=brand["name"], havidij=ft(brand["priceHufMonthlyGross"])),
             sorok=sorok, cues=cues, jelenetek=jel)
    json.dump(d, open(os.path.join(REM, "src", "adat.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return d, idz


def futtat(cmd, **kw):
    print("$", " ".join(cmd) if isinstance(cmd, list) else cmd, flush=True)
    subprocess.run(cmd, check=True, **kw)


def remotion(args):
    npx = "npx.cmd" if os.name == "nt" else "npx"
    extra = ["--browser-executable", CHROME] if os.path.exists(CHROME) else []
    futtat([npx, "remotion"] + args + extra, cwd=REM)


def vtt(idz, cel):
    def ts(s):
        h, m = int(s // 3600), int(s % 3600 // 60)
        return f"{h:02d}:{m:02d}:{s % 60:06.3f}"
    sorok = ["WEBVTT", "Kind: captions", "Language: hu", ""]
    n = 0
    for s in idz["sorok"]:
        for c in s["cues"]:
            n += 1
            sorok += [str(n), f"{ts(c['start'])} --> {ts(c['end'])}"]
            # lines break where the sentence does (video/felirat_tores.py), not wherever 42 characters run out
            sorok += FT.ket_sor(c["szoveg"].split(), 42) or textwrap.wrap(c["szoveg"], 42, break_long_words=False)[:2]
            sorok.append("")
    open(cel, "w", encoding="utf-8", newline="\n").write("\n".join(sorok))


def kodol(kep, hang, cel):
    for crf in (21, 23, 25, 27, 29):
        futtat(["ffmpeg", "-v", "error", "-y", "-i", kep, "-i", hang, "-map", "0:v:0", "-map", "1:a:0",
                # limited (tv) range BT.709: some Android hardware decoders (expo-video) show full-range H.264 with crushed colours.
                # accurate_rnd keeps the brand blue exact (#1428DB decodes as 20,40,220; without it 16,38,218);
                # setparams writes the primaries/transfer tags too (the -color_* options alone left them "unknown").
                "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=bicubic+accurate_rnd+full_chroma_int,"
                       "format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709",
                "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", str(crf),
                "-tune", "animation", "-r", str(FPS), "-g", str(FPS * 4),
                # MONO, like the two guide videos: the default stereo upmix of a mono source is -3 dB per channel, so this
                # video played 3 dB quieter than the guides while the whole-file LUFS looked the same (2026-11-19)
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", "-shortest", cel])
        mb = os.path.getsize(cel) / 1e6
        print(f"  CRF {crf}: {mb:.2f} MB")
        if mb <= CEL_MB:
            return crf, mb
    raise SystemExit(f"túl nagy: {mb:.2f} MB")


def csucs_igazit(mp4):
    """Measures the FINISHED mp4 (after AAC). While its true peak is above -1.5 dBTP, the mix ceiling is lowered by the
    excess (+0.3 dB), the narration is re-mixed from hang/narracio_nyers.wav and ONLY the audio track is replaced
    (the picture is copied). Writes the measured values into hang/idozites.json. -> the measurement dict"""
    import hang_lepes as HL
    tp = HL.TP_KEVERES
    m = HE.meres(mp4)
    for _ in range(3):
        if m["csucs_dbtp"] <= HL.CEL_TP + 0.05:
            break
        tp -= (m["csucs_dbtp"] - HL.CEL_TP) + 0.3
        print(f"  hang: a kész fájl csúcsa {m['csucs_dbtp']:.1f} dBTP > {HL.CEL_TP}; újrakeverés {tp:.1f} dBTP plafonnal", flush=True)
        HL.hangosit(os.path.join(ROOT, "hang", "narracio_nyers.wav"), HL.KI_NARRACIO, tp)
        futtat(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-i", HL.KI_NARRACIO, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", "-shortest", mp4 + ".hang.mp4"])
        os.replace(mp4 + ".hang.mp4", mp4)
        m = HE.meres(mp4)
    print(f"  hang: {m['csatornak']} csatorna, {m['lufs_csatorna']:.1f} LUFS csatornánként, csúcs {m['csucs_dbtp']:.1f} dBTP a kész "
          f"fájlban (keverési plafon {tp:.1f} dBTP)", flush=True)
    ip = os.path.join(ROOT, "hang", "idozites.json")
    idz = json.load(open(ip, encoding="utf-8"))
    idz["kesz_fajl_hang"] = dict(csatornak=m["csatornak"], lufs_csatornankent=m["lufs_csatorna"], csucs_dbtp=m["csucs_dbtp"],
                                 keveres_plafon_dbtp=round(tp, 2))
    json.dump(idz, open(ip, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return m


def poszter(png, cel):
    im = Image.open(png).convert("RGB")
    for q in (88, 84, 80, 76, 72, 68):
        im.save(cel, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(cel) <= POSZTER_MAX_KB * 1024:
            return q
    raise SystemExit("a poszter túl nagy")


def kockak(mp4, hossz_s):
    d = os.path.join(ROOT, "kockak")
    os.makedirs(d, exist_ok=True)
    regi = glob.glob(d + "/k_*.jpg") + glob.glob(d + "/attekinto_*.jpg")
    if regi:                                          # the previous run's frames go to _regi/ (we never delete)
        rd = os.path.join(d, "_regi", time.strftime("%Y%m%d_%H%M%S"))
        os.makedirs(rd, exist_ok=True)
        for f in regi:
            shutil.move(f, os.path.join(rd, os.path.basename(f)))
    t, i = 1.5, 0
    utak = []
    while t < hossz_s:
        p = f"{d}/k_{i:03d}_{t:05.1f}s.jpg"
        # JPEG is BT.601 full range: convert, or the frames show the brand blue as 19,30,210 instead of 20,40,219
        futtat(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", mp4, "-frames:v", "1", "-vf",
                "scale=in_color_matrix=bt709:out_color_matrix=bt601:in_range=tv:out_range=pc:flags=bicubic+accurate_rnd+full_chroma_int,"
                "format=yuvj420p", "-q:v", "3", p])
        utak.append(p)
        t += 3.0
        i += 1
    # contact sheets: 6 x 2 frames per sheet, 270 px wide each
    lap = 12
    for li in range(0, len(utak), lap):
        cs = utak[li: li + lap]
        tw, th = 270, 480
        im = Image.new("RGB", (tw * 6, th * 2), (255, 255, 255))
        for j, p in enumerate(cs):
            k = Image.open(p).resize((tw, th))
            im.paste(k, ((j % 6) * tw, (j // 6) * th))
        im.save(f"{d}/attekinto_{li // lap + 1}.jpg", quality=85)
    return utak


def regi_kimenet():
    """the previous outputs go to _regi/kimenet_<time>/ before they are overwritten (we never delete)"""
    megvan = [f for f in ("bekotes.mp4", "bekotes_poszter.jpg", "bekotes.vtt") if os.path.exists(os.path.join(ROOT, f))]
    if megvan:
        rd = os.path.join(ROOT, "_regi", "kimenet_" + time.strftime("%Y%m%d_%H%M%S"))
        os.makedirs(rd, exist_ok=True)
        for f in megvan:
            shutil.copy2(os.path.join(ROOT, f), os.path.join(rd, f))


def csak_vtt():
    """python eszkoz/render.py --csak-vtt: only the WebVTT again from hang/idozites.json (after a change of the line-break
    rules in video/felirat_tores.py), copied to kod/media; the picture and the sound are not touched"""
    idz = json.load(open(os.path.join(ROOT, "hang", "idozites.json"), encoding="utf-8"))
    cel = os.path.join(ROOT, "bekotes.vtt")
    if os.path.exists(cel):
        rd = os.path.join(ROOT, "_regi", "kimenet_" + time.strftime("%Y%m%d_%H%M%S"))
        os.makedirs(rd, exist_ok=True)
        shutil.copy2(cel, os.path.join(rd, "bekotes.vtt"))
    vtt(idz, cel)
    if "--nincs-masolas" not in sys.argv:
        shutil.copy2(cel, os.path.join(MEDIA, "bekotes.vtt"))
    print("VTT kész:", cel)


def main():
    if "--csak-vtt" in sys.argv:
        return csak_vtt()
    gyors = "--gyors" in sys.argv
    regi_kimenet()
    masol_eszkozok()
    d, idz = adat_json()
    print(f"adat: {d['hossz']} kocka ({d['hossz'] / FPS:.1f} s), {'NÉMA ELŐZETES (becsült időzítés)' if d['nema'] else 'hanggal'}")
    out = os.path.join(REM, "out")
    os.makedirs(out, exist_ok=True)
    kep = os.path.join(out, "kep.mp4")
    remotion(["render", "src/index.ts", "Bekotes", kep, "--codec", "h264", "--crf", "14", "--concurrency", "4",
              "--log", "error"] + (["--scale", "0.5"] if gyors else []))
    remotion(["still", "src/index.ts", "Poszter", os.path.join(out, "poszter.png"), "--log", "error"])
    mp4 = os.path.join(ROOT, "bekotes.mp4")
    crf, mb = kodol(kep, os.path.join(ROOT, "hang", "narracio.wav"), mp4)
    if not d["nema"]:
        csucs_igazit(mp4)
        mb = os.path.getsize(mp4) / 1e6
    q = poszter(os.path.join(out, "poszter.png"), os.path.join(ROOT, "bekotes_poszter.jpg"))
    vtt(idz, os.path.join(ROOT, "bekotes.vtt"))
    kk = kockak(mp4, d["hossz"] / FPS)
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,profile,width,height,r_frame_rate",
                                      "-of", "json", mp4], capture_output=True, text=True).stdout)
    if "--nincs-masolas" not in sys.argv:
        os.makedirs(MEDIA, exist_ok=True)
        for f in ("bekotes.mp4", "bekotes_poszter.jpg", "bekotes.vtt"):
            shutil.copy2(os.path.join(ROOT, f), os.path.join(MEDIA, f))
    print(json.dumps(dict(mp4=mp4, crf=crf, mb=round(mb, 2), poszter_q=q, kockak=len(kk), nema=d["nema"], ffprobe=info), ensure_ascii=False))


if __name__ == "__main__":
    main()
