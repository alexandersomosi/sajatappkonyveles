"""Narráció soronként (Gemini 3.8 Flash TTS az OpenRouteren át, a közös hang: video/hang.json).

  python hang.py <nev> [--ujra b07,b22] [--proba]

- minden sor külön kérés (egy-két mondat), a hang és az alapstílus a hang.json-ból, a sor hangulata a forgatókönyvből
  (sor.hangulat, különben a jelenet típusa szerint); tartalom szerinti gyorsítótár (hang/cache/), költség a koltseg.jsonl-be.
- --ujra: csak a felsorolt sorok új felvétele (a take száma nő: más utasítás-utótag -> új kérés); a régi take megmarad
  (hang/takek/<id>_t<k>.wav), a hossz.json a választott take-et írja.
- a csendet a sor elején/végén levágja (60 ms ráhagyással), 48 kHz mono 16 bit WAV: hang/<id>.wav, hossz: hang/hossz.json.
  A sor ELEJE a beszéd valódi kezdete (beszed_kezdete): a felvétel eleji kattanást / pattanást (a TTS szinte minden
  take elejére tesz egyet, 0,1–0,4 s-mal a hang elé) eldobja, a zárhang (k, p, t) saját pattanását megtartja.
- --eleje: csak a meglévő take-ek elejének javítása (eleje_javit; az epit.py minden futáskor meghívja, ismételhető).
- 402 (nincs elég kredit) -> hang/ALLAPOT.md, kilépési kód 3; a keret (0,30 USD, a két videó együtt) túllépése -> kód 4.
- --proba: hálózat nélküli próbahang (zúgás a becsült hosszal) a lánc kipróbálásához; ezt a végleges építés felülírja.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402

TAKE_UTOTAG = {
    1: "",
    2: " Say every word completely and clearly, to its very last sound.",
    3: " Speak slightly slower, pronouncing every vowel with its exact Hungarian length.",
    4: " Read it as one calm, natural sentence; every word clearly articulated.",
}
FONTOS = {"figyelem"}


def hangulat(j: dict, s: dict, elso: bool) -> str:
    if s.get("hangulat"):
        return s["hangulat"]
    t = j["tipus"]
    if t == "cim":
        return "udvozlo" if elso else "magyarazo"
    if t in ("lista",):
        return "magyarazo"
    if t == "zaro":
        return "zaro"
    if t == "kartya":
        return "figyelem"
    return "lepes"


def utasitas(h: dict, hang_nev: str, take: int) -> str:
    return h["alap_stilus"] + ", " + h["hangulatok"][hang_nev] + "." + TAKE_UTOTAG.get(take, TAKE_UTOTAG[4]) + " " + h["nativ_vege"]


def pcm_wav(pcm: bytes, cel: str):
    a = np.frombuffer(pcm[: len(pcm) // 2 * 2], np.int16)
    tmp = cel + ".24k.wav"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(a.tobytes())
    K.futtat(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", cel])
    os.remove(tmp)


ELEJE_HANGOS_DB = -42.0     # 5 ms-os keretben ennél hangosabb = „hangos” (a beszéd csúcsa 0…-3 dBFS)
ELEJE_TARTOS = 0.040        # ennyi ideig folyamatosan hangos = ez már beszéd (egy kattanás 5–25 ms)
ELEJE_RES = 0.10            # a beszéd előtt ennél hosszabb csend után álló hang nem a szó része (a k/p/t pattanása
#                             legfeljebb 60–90 ms-mal előzi meg a magánhangzót), hanem felvétel-eleji kattanás
ELEJE_MIN_VAGAS = 0.040     # eleje_javit: ennél kisebb igazításért nem írjuk át a meglévő take-et
# 2. ellenőrző kör (2026-11-19): a beszédhez ELEJE_RES-en belül álló kattanás megmaradt (b11: egy 0,65 ms-os impulzus
# 85 ms-mal a hang előtt). Ha a sor NEM zárhanggal kezdődik (magánhangzó, h, j, m, sz …), akkor a beszéd előtt álló rövid,
# elszigetelt pattanás nem lehet a szó része – a zárhang (b, p, d, t, g, k, c, cs, dz, dzs, gy, ty) pattanása viszont
# igen, azt megtartjuk.
ELEJE_KATT_MAX = 0.015      # ennél rövidebb hangos folt (5 ms-os keretekben) ...
ELEJE_KATT_RES = 0.030      # ... amelyet legalább ennyi csend választ el a tartós beszédtől: kattanás (nem zárhangos sorban)
ELEJE_NEMA = 0.025          # kattanásos sornál a beszéd előtti ráhagyást eddig a pontig (a beszéd előtt ennyivel) elnémítjuk,
ELEJE_FELFUT = 0.010        # ... és innen ennyi idő alatt úszik be
ZARHANG = re.compile(r"^[^a-záéíóöőúüű]*(?:dzs|dz|cs|gy|ty|[bpdtgkc])", re.I)


def zarhanggal_kezdodik(szoveg: str | None) -> bool:
    """a sor első hangja zárhang vagy zár-rés hang? (None = nem tudjuk: úgy kezeljük, mintha az lenne – nem vágunk)"""
    return True if szoveg is None else bool(ZARHANG.match(szoveg))


def eleje_elemzes(a, sr: int, szoveg: str | None = None) -> tuple:
    """-> (a beszéd első mintája vagy None, kattanas: bool).

    2026-11-19 (ellenőrző kör): a régi vágás az első -45 dB-nél hangosabb kerettől indult, így 7 sorban a felvétel
    eleji kattanás (-22…-33 dBFS, 5–40 ms) 0,12–0,4 s-mal a hang előtt megmaradt: fejhallgatón hallatszott, és a
    felirat ennyivel a hang előtt jelent meg. Most: megkeressük az első TARTÓSAN hangos szakaszt (ez a beszéd), és
    visszafelé csak azt vesszük hozzá, ami ELEJE_RES-nél rövidebb csenddel kapcsolódik hozzá (a zárhang pattanása,
    halk h / j / v kezdet). Ami ennél messzebb van előtte, az kattanás: kimarad.
    2. kör: ha a sor nem zárhanggal kezdődik (szoveg megadva), a beszédhez ELEJE_RES-en belül álló rövid
    (<= ELEJE_KATT_MAX), elszigetelt (>= ELEJE_KATT_RES csend utána) hangos folt is kattanás: nem vesszük a beszédhez,
    és kattanas=True jelzi a hívónak, hogy a ráhagyásból is ki kell némítani."""
    ab = int(sr * 0.005)
    n = min(len(a) // ab, int(2.0 / 0.005))
    if n < 12:
        return None, False
    rms = np.sqrt((a[: n * ab].reshape(n, ab) ** 2).mean(axis=1) + 1e-12)
    hangos = 20 * np.log10(rms) > ELEJE_HANGOS_DB
    k = int(round(ELEJE_TARTOS / 0.005))
    kezd = next((i for i in range(n - k) if hangos[i:i + k].all()), None)
    if kezd is None:
        return None, False
    elso, csend, i = kezd, 0, kezd - 1
    res = int(round(ELEJE_RES / 0.005))
    while i >= 0 and csend < res:
        if hangos[i]:
            elso, csend = i, 0
        else:
            csend += 1
        i -= 1
    kattanas = False
    if elso < kezd and not zarhanggal_kezdodik(szoveg):
        # a beszédhez csatolt rész hangos foltjai, a beszédtől visszafelé: (rés a folt után, a folt hossza)
        hely = kezd
        while hely > elso:
            j = hely - 1
            while j >= elso and not hangos[j]:
                j -= 1
            res_utana = hely - 1 - j
            f = j
            while f >= elso and hangos[f]:
                f -= 1
            folt = j - f
            if folt <= 0:
                break
            if res_utana * 0.005 >= ELEJE_KATT_RES - 1e-9 and folt * 0.005 <= ELEJE_KATT_MAX + 1e-9:
                elso, kattanas = hely, True            # elszigetelt pattanás: innen (hely) kezdődik a beszéd
                break
            hely = f + 1
    return elso * ab, kattanas


def beszed_kezdete(a, sr: int, szoveg: str | None = None) -> int | None:
    """A beszéd első mintája (a sor elején álló kattanás, pattanás, halk zaj nélkül) vagy None, ha nincs tartós hang.
    szoveg: a sor szövege – ha nem zárhanggal kezdődik, a beszéd elé tapadt rövid pattanás sem számít a szó részének."""
    return eleje_elemzes(a, sr, szoveg)[0]


def _eleje_nemit(b, sr: int, beszed: int):
    """a `beszed` minta előtti rész elnémítása (a kattanás a ráhagyásban maradna): ELEJE_NEMA-val a beszéd előttig csend,
    onnan ELEJE_FELFUT alatt beúszik"""
    v = max(0, beszed - int(ELEJE_NEMA * sr))
    f = min(int(ELEJE_FELFUT * sr), max(0, beszed - v))
    b[:v] = 0.0
    if f > 0:
        b[v:v + f] *= np.linspace(0, 1, f)
    return b


def _wav_be(p: str):
    with wave.open(p) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
    return a, sr


def _wav_ki(p: str, b, sr: int):
    with wave.open(p, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(b, -1, 1) * 32767).astype(np.int16).tobytes())


def csend_vag(p: str, kuszob_db: float = -45.0, rahagy: float = 0.06, szoveg: str | None = None) -> float:
    a, sr = _wav_be(p)
    ab = int(sr * 0.01)
    n = len(a) // ab
    if n == 0:
        return len(a) / sr
    rms = np.sqrt((a[: n * ab].reshape(n, ab) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    hang_ = np.where(db > kuszob_db)[0]
    if len(hang_) == 0:
        return len(a) / sr
    kezd, katt = eleje_elemzes(a, sr, szoveg)    # a beszéd kezdete (kattanás nélkül); ha nincs tartós hang: a régi szabály
    if kezd is None:
        kezd, katt = hang_[0] * ab, False
    i0 = max(0, kezd - int(rahagy * sr))
    i1 = min(len(a), (hang_[-1] + 1) * ab + int(rahagy * sr))
    b = a[i0:i1].copy()
    f_be, f_ki = int(0.012 * sr), int(0.008 * sr)   # 12 ms be-, 8 ms kiúsztatás a kattanás ellen
    if len(b) > f_be + f_ki:
        b[:f_be] *= np.linspace(0, 1, f_be)
        b[-f_ki:] *= np.linspace(1, 0, f_ki)
    if katt:                                     # a beszédhez közeli kattanás a ráhagyásba esne: kinémítjuk
        _eleje_nemit(b, sr, kezd - i0)
    _wav_ki(p, b, sr)
    return len(b) / sr


def eleje_javit(nev: str) -> list:
    """A MEGLÉVŐ take-ek (hang/takek/*.wav) elejének javítása a beszed_kezdete szabályával, új felvétel nélkül.
    Ismételhető: ami már rendben van (a beszéd a 60 ms-os ráhagyás után indul), ahhoz nem nyúl. Az átírt take eredetije a
    hang/_regi/eleje_elott_<idő>/ mappába kerül (nem törlünk). A választott take-ből frissíti a hang/<id>.wav-ot és a
    hossz.json-t. -> [(fájl, levágott mp)]"""
    hd = f"{K.mappa(nev)}/hang"
    hp = f"{hd}/hossz.json"
    if not os.path.exists(hp):
        return []
    hossz = json.load(open(hp, encoding="utf-8"))
    szovegek = {s["id"]: (s.get("mond_tts") or s["mond"]) for _, s in K.sorok(K.forgatokonyv(nev))}
    rahagy = 0.06
    valt = []
    regi = None
    for fn in sorted(os.listdir(f"{hd}/takek")):
        if not fn.endswith(".wav"):
            continue
        p = f"{hd}/takek/{fn}"
        a, sr = _wav_be(p)
        # a sor szövege dönti el, hogy a beszéd előtti rövid pattanás a szó része-e (zárhang) vagy kattanás
        kezd, katt = eleje_elemzes(a, sr, szovegek.get(fn.rsplit("_t", 1)[0]))
        if kezd is None:
            continue
        i0 = max(0, kezd - int(rahagy * sr))
        if i0 < int(ELEJE_MIN_VAGAS * sr) and not katt:
            continue
        if regi is None:
            regi = f"{hd}/_regi/eleje_elott_{_dt.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(regi, exist_ok=True)
        shutil.copy2(p, f"{regi}/{fn}")
        b = a[i0:].copy()
        f_be = int(0.012 * sr)
        b[:f_be] *= np.linspace(0, 1, f_be)
        if katt:                                  # a kattanás a 60 ms-os ráhagyásba esne: kinémítjuk (ismételve már nem találja)
            _eleje_nemit(b, sr, kezd - i0)
        _wav_ki(p, b, sr)
        valt.append((fn, round(i0 / sr, 3)))
    if not valt:
        return []
    erintett = {fn for fn, _ in valt}
    for sid, v in hossz.items():
        fn = f"{sid}_t{v.get('take')}.wav"
        if fn not in erintett or v.get("proba"):
            continue
        v["eleje_vagva_mp"] = round(v.get("eleje_vagva_mp", 0.0) + dict(valt)[fn], 3)
        if v.get("tempo"):
            continue                              # a gyorsított sort az epit.hosszra_igazit a take-ből újra előállítja
        if os.path.exists(f"{hd}/{sid}.wav"):
            shutil.copy2(f"{hd}/{sid}.wav", f"{regi}/{sid}.wav")
        shutil.copyfile(f"{hd}/takek/{fn}", f"{hd}/{sid}.wav")
        with wave.open(f"{hd}/{sid}.wav") as w:
            v["mp"] = round(w.getnframes() / w.getframerate(), 3)
    json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{nev}] a sorok eleje javítva (kattanás / üres felvezetés levágva): "
          + ", ".join(f"{fn[:-4]} -{mp:.2f} s" for fn, mp in valt) + f"; az eredetik: {regi}", flush=True)
    return valt


def proba_pcm(szoveg: str) -> bytes:
    mp = len(szoveg) / 14.5
    t = np.arange(int(24000 * mp)) / 24000
    jel = 0.08 * np.sin(2 * np.pi * 140 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * t))
    return (np.concatenate([np.zeros(2400), jel, np.zeros(4800)]) * 32767).astype(np.int16).tobytes()


def main(argv):
    nev = argv[0]
    if "--eleje" in argv:
        eleje_javit(nev)
        return 0
    ujra = set()
    if "--ujra" in argv:
        ujra = set(x for x in argv[argv.index("--ujra") + 1].split(",") if x)
    proba = "--proba" in argv
    fk = K.forgatokonyv(nev)
    h = json.load(open(K.HANG_JSON, encoding="utf-8"))
    hd = f"{K.mappa(nev)}/hang"
    os.makedirs(f"{hd}/takek", exist_ok=True)
    hp = f"{hd}/hossz.json"
    hossz = json.load(open(hp, encoding="utf-8")) if os.path.exists(hp) else {}
    ervenyes = {s["id"] for _, s in K.sorok(fk)}
    hossz = {k: v for k, v in hossz.items() if k in ervenyes}
    elso = True
    try:
        for j, s in K.sorok(fk):
            sid = s["id"]
            hn = hangulat(j, s, elso)
            elso = False
            regi = hossz.get(sid)
            szoveg = s.get("mond_tts") or s["mond"]
            if regi and sid not in ujra and regi.get("szoveg") == szoveg and regi.get("hang") == h["hang"] and \
                    bool(regi.get("proba")) == proba and os.path.exists(f"{hd}/{sid}.wav"):
                continue
            take = (regi.get("take", 0) + 1) if (regi and sid in ujra and regi.get("szoveg") == szoveg) else 1
            if proba:
                pcm = proba_pcm(szoveg)
            else:
                pcm = K.tts(nev, szoveg, h["hang"], utasitas(h, hn, take), f"{hd}/cache", f"{sid}_t{take}")
            tw = f"{hd}/takek/{sid}_t{take}.wav"
            pcm_wav(pcm, tw)
            mp = csend_vag(tw, szoveg=szoveg)
            shutil.copyfile(tw, f"{hd}/{sid}.wav")
            hossz[sid] = {"mp": round(mp, 3), "take": take, "hangulat": hn, "szoveg": szoveg, "hang": h["hang"],
                          "fajl": f"hang/{sid}.wav", "proba": proba}
            json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"  {sid} t{take} {mp:.2f} s {'(próba)' if proba else ''}", flush=True)
    except K.Fizetes402 as e:
        with open(f"{hd}/ALLAPOT.md", "w", encoding="utf-8") as f:
            f.write(f"# Hang: áll ({_dt.datetime.now().isoformat(timespec='seconds')})\n\n{e}\n\nFeltölteni nem szabad (a tulaj dönt). "
                    f"Ha van keret: `python {K.ESZKOZ}/epit.py {nev}` (vagy `mind`).\n")
        print("402 – a hangrész áll:", str(e)[:160])
        return 3
    except K.KeretBetelt as e:
        print("KERET:", e)
        return 4
    json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ossz = sum(v["mp"] for v in hossz.values())
    print(f"{nev}: {len(hossz)} sor, beszéd összesen {ossz:.1f} s; költés eddig {K.koltes_osszesen():.4f} USD")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
