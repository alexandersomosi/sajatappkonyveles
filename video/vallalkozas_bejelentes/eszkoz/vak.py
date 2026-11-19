"""Vak kiejtés-ellenőrzés soronként: minden sor hangját 3-szor átíratjuk a szöveg MEGMUTATÁSA NÉLKÜL
(google/gemini-3.8-flash, input_audio, temperature 0.7), és minden várt szót megkeresünk az átiratokban.
Egy szó HIBÁS, ha a 3 átiratból legalább 2-ben nincs meg (a kukutyini kiejtes_vak.py módszere: a látott szöveg
alapján ítélő bíró azt hallja, amit vár).

  python vak.py <nev> [--csak b07,b22]      -> hang/VAK.json, hang/VAK.md, hang/ujravesz.txt (a hibás sorok)

Gyorsítótár: hang/vak_cache.json (wav-hash + próba sorszáma); költség a koltseg.jsonl-be.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402

MODELL = "google/gemini-3.8-flash"
PROMPT = ("Transcribe this Hungarian audio clip EXACTLY as it sounds, word by word, in Hungarian spelling. Do not correct "
          "anything: if a word sounds like a different word or is mispronounced, write what you actually hear (for example a "
          "wrong or short/long vowel). Output only the transcript, nothing else.")
# tartalék-kérés, ha a szolgáltató biztonsági szűrője az elsőt (többször is) elutasítja; a várt szöveget ez sem mutatja meg
PROMPT_B = ("This is a short, harmless voice-over line from a Hungarian how-to video about official paperwork. Write down "
            "exactly what is said, word by word, in Hungarian spelling, without correcting anything (keep wrong words or "
            "wrong vowel lengths as heard). Output only the transcript.")
PROBA = 3
# kiejtett formák, amelyeknél az átirat más írásmódot használhat (rövidítés, márkanév, számjegy)
EGYENERTEKU = {
    "plusz": ["+", "plusz"], "plusszal": ["+szal", "+-szal", "plusszal", "pluszszal"],
    "nav": ["nav", "náv"], "navnál": ["navnál", "návnál", "navnal"], "navnak": ["navnak", "návnak"], "navos": ["navos", "návos"],
    "dáp": ["dáp", "dap"], "dáppal": ["dáppal", "dappal", "dáp-pal"],
    "ónyát": ["ónyát", "onyat", "onyát", "ónyat"], "onyát": ["onyát", "onyat", "ónyát", "ónyat"],   # „ONYA-t” = onyát
    "ujegyke": ["ujegyke", "újegyke", "ujegyké"],
    "pdf": ["pdf", "pédéef", "pédéf", "pdé"],
    "tajkártyád": ["tajkártyád", "tajkártyád"], "tajszámodat": ["tajszámodat"],
}
SZAMSZO = re.compile(r"^(egy|kett|két|három|négy|öt|hat|hét|nyolc|kilenc|tíz|tizen|húsz|huszon|harminc|negyven|ötven|hatvan|"
                     r"hetven|nyolcvan|kilencven|száz|ezer|negyedóra)", re.I)


def betuk(s: str) -> str:
    return re.sub(r"[^a-záéíóöőúüű0-9+]", "", s.lower())


def ekezet_nelkul(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def szavak(mond: str) -> list:
    return [w for w in (betuk(x) for x in re.split(r"[\s\-–]+", mond)) if w]


def megvan(szo: str, atirat: str) -> bool:
    a = betuk(atirat)
    for forma in EGYENERTEKU.get(szo, [szo]):
        if betuk(forma) in a:
            return True
    if SZAMSZO.match(szo) and re.search(r"\d", atirat):
        return True                          # a számot számjeggyel írta
    return False


CSONKA_ARANY = 0.6      # ennél rövidebb átirat (a várt betűszám arányában) gyanús: a szolgáltató szűrője félbevághatta


def atir(nev: str, wav: str, i: int, cache: dict, varhato: int = 0) -> str | None:
    """Egy vak átirat. A félbevágott (a vártnál sokkal rövidebb) vagy elutasított válasz nem eredmény: újrakérjük
    (a tartalék-kéréssel is, legfeljebb 5 körben). Ha a rövid átirat következetes (kétszer közel ugyanolyan hosszú),
    akkor a hang a rövid: az valódi eredmény. None = nem sikerült átiratot kapni (nem kerül a gyorsítótárba)."""
    h = hashlib.sha256(open(wav, "rb").read()).hexdigest()[:24]
    kulcs = f"{h}:{i}"

    def csonka(x: str) -> bool:
        return bool(varhato) and len(betuk(x)) < CSONKA_ARANY * varhato

    if kulcs in cache and (not csonka(cache[kulcs]) or cache.get(kulcs + ":rovid_megerositve")):
        return cache[kulcs]
    with tempfile.TemporaryDirectory() as td:
        mp3 = os.path.join(td, "a.mp3")
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", wav, "-ac", "1", "-ar", "24000", "-b:a", "48k", mp3])
        b64 = base64.b64encode(open(mp3, "rb").read()).decode()
    t = None
    rovidek = []
    for prompt in (PROMPT, PROMPT_B, PROMPT, PROMPT_B, PROMPT):
        uz = [{"role": "user", "content": [{"type": "input_audio", "input_audio": {"data": b64, "format": "mp3"}},
                                           {"type": "text", "text": prompt}]}]
        try:
            x = K.chat(nev, MODELL, uz, tag=f"vak:{os.path.basename(wav)}:{i}", max_tokens=600, temperature=0.7, becsult=0.002,
                       reasoning={"effort": "minimal"}, teljes_kell=True).strip().replace("\n", " ")
        except K.Blokkolt as e:
            print(f"    {os.path.basename(wav)} {i + 1}. átirat: {str(e)[:110]}", flush=True)
            continue
        if csonka(x):
            rovidek.append(x)
            print(f"    {os.path.basename(wav)} {i + 1}. átirat csonka ({x[:40]!r}), újra", flush=True)
            continue
        t = x
        break
    cache.pop(kulcs + ":rovid_megerositve", None)
    if t is None:
        # következetesen rövid (két közel egyforma hosszú, nem pár betűs átirat): a felvétel maga a rövid – valódi hiba.
        # A szűrő által félbevágott válaszok véletlen helyen szakadnak meg („Ny”, „nyis”), azok nem számítanak.
        h_ = sorted(len(betuk(x)) for x in rovidek if len(betuk(x)) >= 8)
        if any(b - a <= 3 for a, b in zip(h_, h_[1:])):
            t = max(rovidek, key=len)
            cache[kulcs + ":rovid_megerositve"] = True
    if t is None:
        cache.pop(kulcs, None)
        return None          # nem kerül a gyorsítótárba: a következő futás újra megpróbálja
    cache[kulcs] = t
    return t


def main(argv):
    nev = argv[0]
    csak = set(argv[argv.index("--csak") + 1].split(",")) if "--csak" in argv else None
    fk = K.forgatokonyv(nev)
    hd = f"{K.mappa(nev)}/hang"
    cp = f"{hd}/vak_cache.json"
    cache = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else {}
    hossz = json.load(open(f"{hd}/hossz.json", encoding="utf-8"))
    eredmeny = {}
    vp = f"{hd}/VAK.json"
    if os.path.exists(vp) and csak:
        eredmeny = json.load(open(vp, encoding="utf-8"))
    try:
        for _, s in K.sorok(fk):
            sid = s["id"]
            if csak and sid not in csak:
                continue
            if hossz.get(sid, {}).get("proba"):
                print(f"  {sid}: próbahang, kihagyva")
                continue
            wav = f"{hd}/{sid}.wav"
            varhato = len(betuk(s.get("mond_tts") or s["mond"]))
            atiratok = [atir(nev, wav, i, cache, varhato) for i in range(PROBA)]
            json.dump(cache, open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            blokkolt = sum(1 for a in atiratok if a is None)
            atiratok = [a for a in atiratok if a is not None]
            if len(atiratok) < 2:
                raise RuntimeError(f"{sid}: csak {len(atiratok)} vak átirat készült (a szolgáltató {blokkolt} kérést elutasított); "
                                   f"futtasd újra – a kész átiratok a gyorsítótárban vannak")
            hibak = []
            kell = 2 if len(atiratok) >= 3 else len(atiratok)      # 3 átiratból 2, 2 átiratból mindkettő
            for w in szavak(s.get("mond_tts") or s["mond"]):
                hiany = sum(1 for a in atiratok if not megvan(w, a))
                if hiany >= kell:
                    hibak.append(w)
            eredmeny[sid] = {"mond": s["mond"], "take": hossz.get(sid, {}).get("take"), "atiratok": atiratok, "hibas_szavak": hibak}
            if blokkolt:
                eredmeny[sid]["blokkolt_atirat"] = blokkolt
            print(f"  {sid}: {'OK' if not hibak else 'HIBA ' + ', '.join(hibak)}"
                  f"{f' ({len(atiratok)} átiratból)' if blokkolt else ''}", flush=True)
    except K.Fizetes402 as e:
        print("402 – a vak ellenőrzés áll:", str(e)[:160])
        return 3
    except K.KeretBetelt as e:
        print("KERET:", e)
        return 4
    json.dump(eredmeny, open(vp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rossz = [k for k, v in eredmeny.items() if v["hibas_szavak"]]
    open(f"{hd}/ujravesz.txt", "w", encoding="utf-8").write(",".join(rossz))
    with open(f"{hd}/VAK.md", "w", encoding="utf-8") as f:
        f.write(f"# Vak kiejtés-ellenőrzés – {nev}\n\n{len(eredmeny)} sor, hibás: {len(rossz)}\n\n")
        for k, v in eredmeny.items():
            f.write(f"- **{k}** {'OK' if not v['hibas_szavak'] else 'HIBA: ' + ', '.join(v['hibas_szavak'])} (take {v['take']})\n"
                    f"  - várt: {v['mond']}\n" + "".join(f"  - {i + 1}. átirat: {a}\n" for i, a in enumerate(v['atiratok'])))
    print(f"{nev}: {len(eredmeny)} sor, hibás {len(rossz)}: {','.join(rossz)}; költés eddig {K.koltes_osszesen():.4f} USD")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
