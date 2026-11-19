"""Közös rész a két útmutató-videóhoz (vallalkozas_bejelentes, meghatalmazas) – SPEC §26.7.

Útvonalak, C2 színek és betűk, a forgatókönyv betöltése, költségnapló (video/<nev>/koltseg.jsonl) és a két
OpenRouter-hívás (Gemini TTS, szöveges/hangos chat). A kulcs (OPENROUTER_API_KEY) csak a folyamaton belül, a
HKCU\\Environment-ből; soha nem írjuk ki és nem mentjük.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

APP = "C:/Users/UpgradePC/konyvelo_app"
VIDEO = APP + "/video"
ESZKOZ = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
KEPEK = APP + "/utmutato_kepek"
DIZAJN = APP + "/dizajn/C2_modern"
IKON3D = DIZAJN + "/assets/ikon3d"
ILLUSZTR = DIZAJN + "/assets/illusztraciok"
BETU_GEIST = DIZAJN + "/app_v2/fontok/Geist_wght.ttf"
MEDIA = APP + "/kod/media"
HANG_JSON = VIDEO + "/hang.json"
NEVEK = ["vallalkozas_bejelentes", "meghatalmazas"]

# C2 tokenek (dizajn/C2_modern/app_v2/tokens.css) + a kék paletta (tulaj 11-18 17:50: dizajn/C3_zold/kek.css, dizajn/PALETTA.md;
# a régi tintakék értékek: ../_regi/eszkoz_elotte_kek_1817/kozos.py)
TINTAKEK = (20, 40, 219)         # #1428DB
TINTAKEK_SZOVEG = (18, 38, 184)  # #1226B8
TINTA = (16, 21, 43)              # #10152B
ALAP = (228, 232, 243)           # #E4E8F3
LAP = (255, 255, 255)
HALVANY = (80, 88, 115)          # #505873
HALVANY_ALAPON = (74, 82, 112)   # #4A5270
FEJLEC_HALVANY = (201, 210, 255)  # #C9D2FF
KERET = (201, 208, 228)          # #C9D0E4
HAJSZAL = (226, 230, 241)        # #E2E6F1
ARNYEK = (16, 21, 60)            # az árnyék színe (tokens: rgba(16,21,60,…)); nem a márkakék, hogy ne legyen kék derengés
KOR_SAVON = (38, 56, 222)        # a címkép halvány körei a kék sávon (a régi (40, 58, 96) párja)
HALADAS_HATRA = (86, 100, 229)   # #5664E5: a fejléc haladásjelzőjének még hátralévő szakaszai (fehér 28%-a a #1428DB sávon;
#   a régi tintakék sávhoz tartozó (60, 76, 108) szürkéskék helyett – 2026-11-19)
BOROSTYAN = (224, 150, 20)       # a jelölők borostyánja (utmutato_kepek/annotate.py)
BOROSTYAN_SOTET = (132, 83, 0)   # --borostyan
BOROSTYAN_ALAP = (247, 232, 198)
SZURKE_KORONG = (106, 117, 138)

W, H, FPS = 1080, 1920, 30
KERET_USD = float(os.environ.get("UTMUTATO_HANG_KERET", "0.30"))   # a két videó együttes kerete (TTS + átírás + lektorok);
#   emelni csak az UTMUTATO_HANG_KERET környezeti változóval, és a három videó együtt sem lépheti át a 0,60 USD-t (hang.json)

OR_TTS_URL = "https://openrouter.ai/api/v1/audio/speech"
OR_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
TTS_MODELL = "google/gemini-3.8-flash-tts"
TTS_USD_PER_S = 32 * 9.0 / 1e6   # ~32 hang-token/s, 9 USD / 1M kimeneti token (becslés, mint a kukutyini tts-ben)
NATIVE_HU = ("Native Hungarian speaker born and raised in Budapest: strictly Hungarian phonetics and intonation, stress always on the "
             "first syllable, long and short vowels kept distinct, no foreign accent at all.")


class KeretBetelt(RuntimeError):
    pass


class Fizetes402(RuntimeError):
    pass


class Blokkolt(RuntimeError):
    """a szolgáltató (Gemini) biztonsági szűrője elutasította a kérést, vagy üres választ adott – többszöri próbára is"""


def mappa(nev: str) -> str:
    return f"{VIDEO}/{nev}"


# Windows-kilépési kódok, amelyek átmeneti memóriahiányt jelentenek (más, párhuzamos munka foglalja a gépet):
# 0xC000012D = STATUS_COMMITMENT_LIMIT, 0xC0000017 = STATUS_NO_MEMORY, 0xC000009A = STATUS_INSUFFICIENT_RESOURCES
_ATMENETI_KODOK = {0xC000012D, 0xC0000017, 0xC000009A}


def futtat(cmd: list, probak: int = 6, **kw):
    """subprocess.run(cmd, check=True, ...) – de ha a folyamat átmeneti memóriahiány miatt el sem tud indulni vagy
    elhal (pl. az ffmpeg 0xC000012D-vel), vár és újrapróbálja (2026-11-19: így állt meg egyszer a vak ellenőrzés)."""
    import subprocess
    for i in range(probak):
        try:
            r = subprocess.run(cmd, **kw)
        except OSError as e:                      # pl. WinError 1455: a lapozófájl túl kicsi
            if i == probak - 1 or getattr(e, "winerror", None) not in (8, 14, 1450, 1455):
                raise
            print(f"  [futtat] átmeneti memóriahiány ({e}); {15 * (i + 1)} s múlva újra", flush=True)
            time.sleep(15 * (i + 1))
            continue
        kod = r.returncode & 0xFFFFFFFF
        if kod == 0:
            return r
        if kod in _ATMENETI_KODOK and i < probak - 1:
            print(f"  [futtat] {os.path.basename(str(cmd[0]))} átmeneti memóriahiány (0x{kod:08X}); {15 * (i + 1)} s múlva újra", flush=True)
            time.sleep(15 * (i + 1))
            continue
        raise subprocess.CalledProcessError(r.returncode, cmd, getattr(r, "stdout", None), getattr(r, "stderr", None))
    raise RuntimeError("futtat: nem sikerült")


def forgatokonyv(nev: str) -> dict:
    with open(f"{mappa(nev)}/forgatokonyv.json", encoding="utf-8") as f:
        return json.load(f)


def sorok(fk: dict):
    for j in fk["jelenetek"]:
        for s in j["sorok"]:
            yield j, s


def index_json(utmutato: str) -> dict:
    with open(f"{KEPEK}/{utmutato}/index.json", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------------------------- betűk
_BETUK: dict = {}


def betu(meret: int, suly: int = 500):
    from PIL import ImageFont
    k = (meret, suly)
    if k not in _BETUK:
        f = ImageFont.truetype(BETU_GEIST, meret)
        try:
            f.set_variation_by_axes([suly])
        except Exception:  # noqa: BLE001
            pass
        _BETUK[k] = f
    return _BETUK[k]


# ---------------------------------------------------------------------------------------------- költségnapló
def naplo_ut(nev: str) -> str:
    return f"{mappa(nev)}/koltseg.jsonl"


def koltes_osszesen() -> float:
    ossz = 0.0
    for n in NEVEK:
        p = naplo_ut(n)
        if os.path.exists(p):
            for sor in open(p, encoding="utf-8"):
                if sor.strip():
                    ossz += float(json.loads(sor).get("usd") or 0)
    return ossz


def naploz(nev: str, **mezok):
    mezok = {"ido": _dt.datetime.now().isoformat(timespec="seconds"), **mezok}
    with open(naplo_ut(nev), "a", encoding="utf-8") as f:
        f.write(json.dumps(mezok, ensure_ascii=False) + "\n")


def keret_ellenoriz(becsult: float):
    k = koltes_osszesen()
    if k + becsult > KERET_USD:
        raise KeretBetelt(f"a keret ({KERET_USD} USD) betelne: eddig {k:.4f} USD, ez a hívás ~{becsult:.4f} USD")


def or_kulcs() -> str:
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
        return winreg.QueryValueEx(k, "OPENROUTER_API_KEY")[0].strip()


def _hiba_szoveg(e, kulcs):
    try:
        msg = e.read().decode("utf-8", "replace") if isinstance(e, urllib.error.HTTPError) else str(e)
    except Exception:  # noqa: BLE001
        msg = str(e)
    return msg.replace(kulcs, "***")[:300]


def generacio_koltseg(gen_id: str, kulcs: str, probak: int = 4) -> float | None:
    """OpenRouter /generation -> total_cost (USD), ha elérhető (néhány mp késéssel jelenik meg)."""
    if not gen_id:
        return None
    for i in range(probak):
        try:
            req = urllib.request.Request(f"https://openrouter.ai/api/v1/generation?id={gen_id}",
                                         headers={"Authorization": "Bearer " + kulcs})
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode("utf-8")).get("data") or {}
            c = d.get("total_cost")
            if c is not None:
                return float(c)
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2 + 2 * i)
    return None


# ---------------------------------------------------------------------------------------------- TTS
def tts(nev: str, szoveg: str, hang: str, stilus: str, cache_dir: str, tag: str) -> bytes:
    """Gemini TTS az OpenRouteren át -> nyers 24 kHz s16le mono PCM. Tartalom szerinti gyorsítótár: ugyanaz a kérés
    soha nem megy ki kétszer. 402 -> Fizetes402 (a hívó leállítja a hangrészt)."""
    body = {"model": TTS_MODELL, "response_format": "pcm", "voice": hang, "input": szoveg, "instructions": stilus}
    h = hashlib.sha1(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    os.makedirs(cache_dir, exist_ok=True)
    raw = os.path.join(cache_dir, h + ".pcm")
    if os.path.exists(raw):
        return open(raw, "rb").read()
    becsult = max(2.0, len(szoveg) / 12.0) * TTS_USD_PER_S * 1.3
    keret_ellenoriz(becsult)
    kulcs = or_kulcs()
    utolso = ""
    for i in range(5):
        req = urllib.request.Request(OR_TTS_URL, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + kulcs, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                pcm, ct = r.read(), r.headers.get("Content-Type", "")
                gen_id = r.headers.get("X-Generation-Id") or r.headers.get("x-generation-id") or ""
            if "rate=24000" not in ct and "pcm" not in ct.lower() and "octet" not in ct.lower():
                raise ValueError(f"váratlan formátum: {ct}")
            if len(pcm) < 12000:
                raise ValueError("túl rövid hang")
            mp = len(pcm) / 48000.0
            valos = generacio_koltseg(gen_id, kulcs, probak=2)   # a TTS-nél a /generation ritkán ad árat: ne várjunk 20 s-ot soronként
            usd = valos if valos is not None else mp * TTS_USD_PER_S
            naploz(nev, tipus="tts", tag=tag, modell=TTS_MODELL, hang=hang, karakter=len(szoveg), mp=round(mp, 2),
                   usd=round(usd, 6), usd_forras="openrouter_generation" if valos is not None else "becsult_0.000288_usd_per_s",
                   probalkozas=i + 1, cache=h)
            open(raw + ".tmp", "wb").write(pcm)
            os.replace(raw + ".tmp", raw)
            return pcm
        except urllib.error.HTTPError as e:
            utolso = _hiba_szoveg(e, kulcs)
            if e.code == 402:
                raise Fizetes402("OpenRouter 402 (nincs elég kredit): " + utolso)
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(20 if e.code == 429 else 5 * (i + 1))
                continue
            raise RuntimeError(f"TTS HTTP {e.code}: {utolso}")
        except (urllib.error.URLError, ValueError, TimeoutError, OSError) as e:
            utolso = _hiba_szoveg(e, kulcs)
            time.sleep(5 * (i + 1))
    raise RuntimeError("TTS hiba: " + utolso)


# ---------------------------------------------------------------------------------------------- chat (lektor, átírás)
def chat(nev: str, modell: str, uzenetek: list, tag: str, max_tokens: int = 3000, temperature: float | None = None,
         becsult: float = 0.01, reasoning: dict | None = None, teljes_kell: bool = False) -> str:
    """teljes_kell=True: ha a válasz nem rendes befejezéssel ér véget (a szolgáltató szűrője félbevágta: finish_reason
    nem 'stop'), az nem eredmény – újrapróbáljuk, végül Blokkolt."""
    body = {"model": modell, "messages": uzenetek, "max_tokens": max_tokens, "usage": {"include": True}}
    if temperature is not None:
        body["temperature"] = temperature
    if reasoning is not None:
        body["reasoning"] = reasoning
    kulcs = or_kulcs()
    utolso = ""
    blokk = False
    for i in range(4):
        keret_ellenoriz(becsult)
        req = urllib.request.Request(OR_CHAT_URL, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + kulcs, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                d = json.loads(r.read().decode("utf-8"))
            u = d.get("usage") or {}
            usd = float(u.get("cost") or 0)
            ch = (d.get("choices") or [{}])[0]
            szoveg = str((ch.get("message") or {}).get("content") or "")
            ures = not szoveg.strip()
            veg = str(ch.get("finish_reason") or "")
            if teljes_kell and not ures and veg not in ("stop", ""):
                ures = True                       # félbevágott válasz
            naploz(nev, tipus="chat" if not ures else "chat_ures", tag=tag, modell=modell, be_tok=u.get("prompt_tokens"),
                   ki_tok=u.get("completion_tokens"), usd=round(usd, 6), probalkozas=i + 1, **({"finish": veg} if ures else {}))
            if ures:
                # 200-as válasz tartalom nélkül (a szolgáltató szűrője vagy hibája a válasz törzsében): nem eredmény, újra
                blokk = True
                utolso = ("üres válasz: " + json.dumps(d.get("error") or ch.get("error") or ch.get("finish_reason") or "",
                                                       ensure_ascii=False))[:300]
                time.sleep(2 * (i + 1))
                continue
            return szoveg
        except urllib.error.HTTPError as e:
            utolso = _hiba_szoveg(e, kulcs)
            if e.code == 402:
                raise Fizetes402("OpenRouter 402: " + utolso)
            if e.code == 403 and ("SAFETY" in utolso or "blocked" in utolso.lower()):
                # a Gemini biztonsági szűrője néha ártatlan kérést is elutasít: ez véletlenszerű, újrapróbáljuk
                blokk = True
                naploz(nev, tipus="chat_blokk", tag=tag, modell=modell, usd=0.0, probalkozas=i + 1)
                time.sleep(2 * (i + 1))
                continue
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(15 if e.code == 429 else 5 * (i + 1))
                continue
            raise RuntimeError(f"chat HTTP {e.code}: {utolso}")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            utolso = _hiba_szoveg(e, kulcs)
            time.sleep(5 * (i + 1))
    if blokk:
        raise Blokkolt("chat: a szolgáltató nem adott választ: " + utolso)
    raise RuntimeError("chat hiba: " + utolso)
