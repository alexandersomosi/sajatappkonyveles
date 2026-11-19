"""Feliratok tördelése – közös a három videónak (bekotes, vallalkozas_bejelentes, meghatalmazas). 2026-11-19, 2. ellenőrző kör.

A sor ott törik, ahol a mondat is tagolódik: írásjelnél, tagmondat vagy szószerkezet határán – nem ott, ahol a két sor
hossza a legkiegyensúlyozottabb. Soha nem válik el
  - az ige az utána álló igekötőtől / simulószótól („jelented | be”, „töltsd | le”, „nyilvántartást | is”),
  - a névelő, a kötőszó, a tagadószó és a „csak” az utána álló szótól („az | útmutatóban”, „ne | jelöld”),
  - a szám a főnevétől („a 2. | pontot”, „5 | munkanapon”),
és nem marad egy tagmondat utolsó szava egyedül a következő sor elején („akkor | kell,”, „pontot | jelöld:”).

  cue_darabok(felirat, max_c=42)  -> [[sor, sor], [sor], ...]   (cue-k, mindegyik legfeljebb 2 sor x max_c karakter)
  ket_sor(szavak, max_c=42)       -> [sor] | [sor, sor] | None   (egy cue sorai; None, ha nem fér el)
  ragaszt(szoveg)                 -> a tiltott töréshelyeken nem törhető szóköz (böngészős tördeléshez: Remotion)

Kézi felülírás a hívónál (forgatokonyv.json: "felirat_sorok"), ha a szószerkezet határát a szabályok nem látják.
Tesztek: python felirat_tores.py
"""
from __future__ import annotations

import functools
import re

MONDATVEG = (".", "!", "?")
TAGVEG = (",", ":", ";", "–")
NYITO, ZARO = "„", "”"
# előre tapadó szavak: UTÁNUK nem törünk
ELORE = {"a", "az", "egy", "és", "s", "vagy", "hogy", "ha", "de", "ne", "nem", "csak", "majd", "mint", "kb", "pl"}
# hátra tapadó szavak (igekötő az ige után, simulószó): ELŐTTÜK nem törünk
HATRA = {"is", "be", "le", "ki", "fel", "föl", "el", "meg", "át", "rá", "össze", "vissza", "szét", "ide", "oda", "sem", "se"}
NEVELO = {"a", "az", "egy"}
KOTOSZO = {"és", "vagy", "de", "hogy", "majd", "mint", "illetve", "valamint", "ha"}
TILOS = 1000.0
AR_MONDAT, AR_TAG, AR_NEVELO_ELOTT, AR_KOTOSZO_ELOTT, AR_SIMA = 0.0, 2.0, 4.0, 5.0, 9.0
AR_IDEZETBEN = 20.0          # idézőjelen belül („Bejelentés | megtétele”)
AR_ARVA_TAGVEG = 10.0        # a tagmondat utolsó szava kerülne egyedül a sor elejére („akkor | kell,”)
AR_ARVA_TAGKEZDET = 6.0      # a tagmondat első szava maradna egyedül a sor végén („igen: így | a bevételed”)
AR_UJ_CUE = 4.0              # minden további cue ára (kevesebb, hosszabb ideig olvasható felirat a jobb)
CUE_HATAR_SZORZO = 2.5       # a cue-határ erősebb vágás, mint a sortörés: még inkább mondat- / tagmondathatárra kerüljön
AR_EGYSZAVAS_CUE = 40.0
AR_EGYSZAVAS_SOR = 5.0       # egyetlen szóból álló sor („Köszönjük, | hogy telepítetted az alkalmazásunkat!”)
EGYENSULY_SOR = 0.06         # a két sor hosszkülönbsége (karakterenként) – csak döntetlennél számít
EGYENSULY_CUE = 0.05


def _mag(szo: str) -> str:
    return re.sub(r"[^0-9a-záéíóöőúüű+]", "", szo.lower())


def _vege(szo: str) -> str:
    """a szó záró írásjele (a záró idézőjel mögül is): '.', ',', ':' … vagy ''"""
    s = szo.rstrip(ZARO + '"”)')
    return s[-1] if s and s[-1] in MONDATVEG + TAGVEG else ""


def _szam(szo: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:[–-]\d+)?\.?", szo))


def tores_ar(szavak: list, i: int) -> float:
    """a szavak[i-1] és szavak[i] közötti törés ára (0 = mondathatár … TILOS)"""
    elozo, kov = szavak[i - 1], szavak[i]
    ev, kv = _vege(elozo), _vege(kov)
    if _szam(elozo) or (_mag(elozo) in ("kb", "pl") and elozo.endswith(".")):
        return TILOS                                   # szám / rövidítés + a szava
    if not ev and _mag(elozo) in ELORE:
        return TILOS
    if not ev and _mag(kov) in HATRA:
        return TILOS
    if _mag(kov) == "ne" and kv:                       # mondatvégi „ne.”: hátra tapad („A többit ne.”)
        return TILOS
    nyitva = sum(w.count(NYITO) for w in szavak[:i]) - sum(w.count(ZARO) for w in szavak[:i])
    if ev in MONDATVEG:
        ar = AR_MONDAT
    elif ev:
        ar = AR_TAG
    elif _mag(kov) in NEVELO:
        ar = AR_NEVELO_ELOTT
    elif _mag(kov) in KOTOSZO:
        ar = AR_KOTOSZO_ELOTT
    else:
        ar = AR_SIMA
    if nyitva > 0:
        ar += AR_IDEZETBEN
    if not ev:
        if kv:                                         # a következő szó zárja a tagmondatot: egyedül maradna a sor elején
            ar += AR_ARVA_TAGVEG
        if i >= 2 and _vege(szavak[i - 2]):            # az előző szó nyitja a tagmondatot: egyedül maradna a sor végén
            ar += AR_ARVA_TAGKEZDET
    return ar


def _sorokra(szavak: tuple, max_c: int, fer=None):
    """-> (ár, [sorok]) a legjobb 1 vagy 2 soros tördelés, vagy None, ha nem fér el. fer(sor) -> bool: saját mérce
    (pl. képpontszélesség); alapból a karakterszám."""
    fer = fer or (lambda s: len(s) <= max_c)
    egesz = " ".join(szavak)
    if fer(egesz):
        return 0.0, [egesz]
    legjobb = None
    for i in range(1, len(szavak)):
        a, b = " ".join(szavak[:i]), " ".join(szavak[i:])
        if not (fer(a) and fer(b)):
            continue
        ar = tores_ar(list(szavak), i) + EGYENSULY_SOR * abs(len(a) - len(b))
        if i == 1 or i == len(szavak) - 1:
            ar += AR_EGYSZAVAS_SOR
        if legjobb is None or ar < legjobb[0]:
            legjobb = (ar, [a, b])
    return legjobb


def ket_sor(szavak: list, max_c: int = 42, fer=None):
    """szavak -> 1 vagy 2 sor (<= max_c), a mondat tagolása szerint törve; None, ha nem fér el"""
    r = _sorokra(tuple(szavak), max_c, fer)
    return r[1] if r else None


def cue_darabok(felirat: str, max_c: int = 42, fer=None) -> list:
    """felirat -> cue-k (mindegyik legfeljebb 2 sor x max_c karakter); a cue-határ és a sortörés is a mondat tagolását
    követi, tiltott helyen (lásd fent) csak akkor törik, ha másképp nem fér el"""
    szavak = tuple(felirat.split())
    n = len(szavak)
    if n == 0:
        return [[felirat]]
    legjobb = None
    for k in range(1, n + 1):
        atlag = len(felirat) / k

        @functools.lru_cache(None)
        def dp(i, maradt):
            if i == n:
                return (0.0, ()) if maradt == 0 else (1e12, ())
            if maradt == 0:
                return (1e12, ())
            best = (1e12, ())
            for j in range(i + 1, n + 1):
                darab = szavak[i:j]
                r = _sorokra(darab, max_c, fer)
                if r is None:
                    if len(darab) > 1:
                        break
                    continue
                ar = r[0] + EGYENSULY_CUE * abs(len(" ".join(darab)) - atlag)
                if j < n:
                    ar += CUE_HATAR_SZORZO * tores_ar(list(szavak), j)
                if len(darab) == 1 and n > 1:
                    ar += AR_EGYSZAVAS_CUE
                t = dp(j, maradt - 1)
                if t[0] + ar < best[0]:
                    best = (t[0] + ar, ((i, j),) + t[1])
            return best
        r = dp(0, k)
        if r[0] < 1e11:
            ossz = r[0] + AR_UJ_CUE * (k - 1)
            if legjobb is None or ossz < legjobb[0] - 1e-9:
                legjobb = (ossz, r[1], k)
            if legjobb[2] + 2 <= k:                    # két cue-val többet már nem próbálunk
                break
    if legjobb is None:
        return [[felirat]]
    return [_sorokra(szavak[a:b], max_c, fer)[1] for a, b in legjobb[1]]


def ragaszt(szoveg: str) -> str:
    """a tiltott töréshelyeken nem törhető szóköz – böngészős tördeléshez (a Remotion beégetett felirata)"""
    szavak = szoveg.split()
    ki = szavak[:1]
    for i in range(1, len(szavak)):
        ki.append((" " if tores_ar(szavak, i) >= TILOS else " ") + szavak[i])
    return "".join(ki)


def kezi(felirat: str, sorok: list, max_c: int = 42) -> list:
    """kézi tördelés ellenőrzése: [[sor, sor], [sor]] – a szövege a felirattal egyezik, cue-nként <= 2 sor x max_c"""
    assert " ".join(" ".join(c) for c in sorok).split() == felirat.split(), f"a kézi tördelés szövege eltér: {felirat!r}"
    assert all(1 <= len(c) <= 2 and all(len(x) <= max_c for x in c) for c in sorok), f"túl hosszú kézi sor: {sorok}"
    return [list(c) for c in sorok]


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    PROBAK = {
        "Megmutatjuk, hogyan jelented be a vállalkozásodat. Ingyenes.":
            [["Megmutatjuk, hogyan jelented be", "a vállalkozásodat. Ingyenes."]],
        "Telephely csak akkor kell, ha lesz üzleted, irodád vagy műhelyed egy másik címen.":
            [["Telephely csak akkor kell,", "ha lesz üzleted,"], ["irodád vagy műhelyed egy másik címen."]],
        "Keresd ki a fő tevékenységedet. Az útmutatóban megírjuk, melyik sort válaszd.":
            [["Keresd ki a fő tevékenységedet."], ["Az útmutatóban megírjuk,", "melyik sort válaszd."]],
        "A „Megtekintés” lapon töltsd le az értesítést PDF-ben.":
            [["A „Megtekintés” lapon töltsd le", "az értesítést PDF-ben."]],
        "A pénzforgalmi elszámolást ne jelöld, a többit hagyd üresen.":
            [["A pénzforgalmi elszámolást ne jelöld,", "a többit hagyd üresen."]],
        "Az áfamentességnél csak a 2. pontot jelöld: az alanyi adómentességet.":
            [["Az áfamentességnél", "csak a 2. pontot jelöld:"], ["az alanyi adómentességet."]],
        "A vegyes ügyeknél jelöld az egyéni vállalkozói nyilvántartást is. A többit ne.":
            [["A vegyes ügyeknél jelöld", "az egyéni vállalkozói nyilvántartást is."], ["A többit ne."]],
        "Az alkalmazásban koppints a „Beküldtem, feltöltöm” gombra, és töltsd fel.":
            [["Az alkalmazásban koppints", "a „Beküldtem, feltöltöm” gombra,"], ["és töltsd fel."]],
        "Végül koppints az „Ellenőrzés és benyújtás” gombra, majd a „Tovább” gombra.":
            [["Végül koppints", "az „Ellenőrzés és benyújtás” gombra,"], ["majd a „Tovább” gombra."]],
        "Ingyenes, és negyedóra alatt megvan.": [["Ingyenes, és negyedóra alatt megvan."]],
    }
    hiba = 0
    for szoveg, vart in PROBAK.items():
        kap = cue_darabok(szoveg)
        jo = kap == vart
        hiba += 0 if jo else 1
        print("OK  " if jo else "HIBA", " | ".join(" / ".join(c) for c in kap))
    assert ragaszt("te magad jelented be a NAV-nál") == "te magad jelented be a NAV-nál"
    print(f"{len(PROBAK) - hiba}/{len(PROBAK)} rendben")
    sys.exit(1 if hiba else 0)
