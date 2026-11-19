"""EGY PARANCS a két útmutató-videóhoz (SPEC §26.7):

  python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind          # hanggal (végleges)
  python .../epit.py vallalkozas_bejelentes | meghatalmazas                                       # csak az egyik
  python .../epit.py mind --nema                                                                  # átmeneti: hang nélkül

Végleges lánc videónként: hang.py (Gemini TTS, a közös hang: video/hang.json; a sorok eleji kattanás levágva) -> vak.py (3 vak átirat/sor) ->
legfeljebb 2 újravételi kör CSAK a hibás sorokra (a jobb take marad) -> ha kell, enyhe gyorsítás (<= 1,08x) a SPEC-hosszba ->
render.py (kép BT.709 + felirat + hangkeverés -16 LUFS, a kész fájl csúcsa <= -1,5 dBTP) -> kod/media/ másolat (a régi a
video/<nev>/_regi/-be) -> ellenoriz.py.
402 (nincs kredit) -> megáll, kilépési kód 3; a keret (0,30 USD a kettőre) betelte -> 4. Semmit nem tölt fel.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import shutil
import subprocess
import sys
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402
import ellenoriz as E  # noqa: E402
import hang as HG  # noqa: E402
import render as R  # noqa: E402
import vak as V  # noqa: E402

MAX_KOR = 2
MAX_GYORSITAS = 1.08


def wav_mp(p):
    with wave.open(p) as w:
        return w.getnframes() / w.getframerate()


def ujravetel(nev: str) -> list:
    """a hibás sorok újravétele; minden sorra a legkevesebb hibás szót adó take marad"""
    hd = f"{K.mappa(nev)}/hang"
    vak = json.load(open(f"{hd}/VAK.json", encoding="utf-8"))
    legjobb = {k: (len(v["hibas_szavak"]), v["take"]) for k, v in vak.items()}
    for kor in range(1, MAX_KOR + 1):
        rossz = [k for k, (n, _) in legjobb.items() if n > 0]
        if not rossz:
            break
        print(f"[{nev}] újravétel {kor}. kör: {','.join(rossz)}")
        rc = HG.main([nev, "--ujra", ",".join(rossz)])
        if rc:
            return rc
        rc = V.main([nev, "--csak", ",".join(rossz)])
        if rc:
            return rc
        vak = json.load(open(f"{hd}/VAK.json", encoding="utf-8"))
        for k in rossz:
            n_uj, t_uj = len(vak[k]["hibas_szavak"]), vak[k]["take"]
            if n_uj < legjobb[k][0]:
                legjobb[k] = (n_uj, t_uj)
    # a legjobb take-ek visszaállítása
    hp = f"{hd}/hossz.json"
    hossz = json.load(open(hp, encoding="utf-8"))
    for k, (n, take) in legjobb.items():
        if hossz[k]["take"] != take:
            shutil.copyfile(f"{hd}/takek/{k}_t{take}.wav", f"{hd}/{k}.wav")
            hossz[k]["take"] = take
            hossz[k]["mp"] = round(wav_mp(f"{hd}/{k}.wav"), 3)
        hossz[k]["vak_hibas_szavak"] = n
    json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    marad = {k: n for k, (n, _) in legjobb.items() if n}
    if marad:
        print(f"[{nev}] FIGYELEM: {len(marad)} sorban marad vak-eltérés (meg kell hallgatni): {marad}")
    return 0


def hosszra_igazit(nev: str):
    """mindig az eredeti take-ekből indul (újrafuttatáskor sem gyorsít kétszer)"""
    fk = K.forgatokonyv(nev)
    hd0 = f"{K.mappa(nev)}/hang"
    hossz0 = json.load(open(f"{hd0}/hossz.json", encoding="utf-8"))
    for k, v in hossz0.items():
        if v.get("tempo"):
            shutil.copyfile(f"{hd0}/takek/{k}_t{v['take']}.wav", f"{hd0}/{k}.wav")
            v["mp"] = round(wav_mp(f"{hd0}/{k}.wav"), 3)
            v.pop("tempo")
    json.dump(hossz0, open(f"{hd0}/hossz.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    iv = R.idovonal(nev, fk, R.hosszak(nev, fk, False))
    lo, hi = E.HOSSZ[nev]
    if iv["hossz"] <= hi:
        return
    beszed = sum(s["mp"] for s in iv["sorok"])
    kell = iv["hossz"] - hi + 0.5
    f = beszed / max(1.0, beszed - kell)
    if f > MAX_GYORSITAS:
        print(f"[{nev}] FIGYELEM: {iv['hossz']:.1f} s > {hi} s, a szükséges gyorsítás {f:.3f}x túl sok: rövidíts a szövegen. "
              f"Most {MAX_GYORSITAS}x.")
        f = MAX_GYORSITAS
    hd = f"{K.mappa(nev)}/hang"
    hp = f"{hd}/hossz.json"
    hossz = json.load(open(hp, encoding="utf-8"))
    for k, v in hossz.items():
        src = f"{hd}/takek/{k}_t{v['take']}.wav"
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", f"atempo={f:.4f}", "-ar", "48000", "-ac", "1",
                        "-c:a", "pcm_s16le", f"{hd}/{k}.wav"])
        v["mp"] = round(wav_mp(f"{hd}/{k}.wav"), 3)
        v["tempo"] = round(f, 4)
    json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{nev}] gyorsítás {f:.3f}x a {hi} s-os sávhoz")


def mediaba(nev: str):
    os.makedirs(K.MEDIA, exist_ok=True)
    ts = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    for f in (f"{nev}.mp4", f"{nev}.vtt", f"{nev}_poszter.jpg"):
        cel = f"{K.MEDIA}/{f}"
        if os.path.exists(cel):
            regi = f"{K.mappa(nev)}/_regi/media_{ts}"
            os.makedirs(regi, exist_ok=True)
            shutil.move(cel, f"{regi}/{f}")
        shutil.copyfile(f"{K.mappa(nev)}/{f}", cel)
    print(f"[{nev}] -> {K.MEDIA}/ ({nev}.mp4, .vtt, _poszter.jpg)")


def egy(nev: str, nema: bool) -> int:
    if not nema:
        # HG.eleje_javit: a meglévő take-ek eleji kattanásának levágása (ismételhető; új take-nél a hang.py már így vág)
        for lepes in (lambda: HG.main([nev]), lambda: (HG.eleje_javit(nev), 0)[1], lambda: V.main([nev]), lambda: ujravetel(nev)):
            rc = lepes()
            if rc:
                print(f"[{nev}] megállt (kód {rc}); a meglévő kimenet változatlan.")
                return rc
        hosszra_igazit(nev)
    d = K.mappa(nev)
    for f in (f"{nev}.mp4", f"{nev}.vtt", f"{nev}_poszter.jpg"):     # régi kimenet a _regi-be (nem törlünk)
        if os.path.exists(f"{d}/{f}"):
            regi = f"{d}/_regi/kimenet_{_dt.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(regi, exist_ok=True)
            shutil.copyfile(f"{d}/{f}", f"{regi}/{f}")
    R.epit(nev, mod="nema" if nema else "vegleges")
    mediaba(nev)
    hibak = E.ellenoriz(nev, kockak=True)
    for h in hibak:
        print(f"[{nev}] HIBA: {h}")
    return 1 if hibak else 0


def main(argv):
    nevek = K.NEVEK if argv[0] == "mind" else [argv[0]]
    nema = "--nema" in argv
    rc = 0
    for n in nevek:
        r = egy(n, nema)
        if r in (3, 4):
            return r
        rc = rc or r
    print(f"költés összesen: {K.koltes_osszesen():.4f} USD (keret {K.KERET_USD})")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
