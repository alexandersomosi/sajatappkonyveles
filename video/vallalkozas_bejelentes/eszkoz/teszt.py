"""Gyors tesztek (hálózat és renderelés nélkül): python teszt.py  -> 'OK n teszt' vagy AssertionError."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402
import kepek as KP  # noqa: E402
import render as R  # noqa: E402
import vak as V  # noqa: E402
import ellenoriz as E  # noqa: E402

n = 0


def ok(felt, uzenet):
    global n
    n += 1
    assert felt, uzenet


# feliratbontás: <= 2 sor x 42 karakter, nincs egyszavas árva cue, a szöveg nem vész el
for nev in K.NEVEK:
    fk = K.forgatokonyv(nev)
    for _, s in K.sorok(fk):
        cuek = R.cue_darabok(s["felirat"])
        ok(" ".join(" ".join(c) for c in cuek).split() == s["felirat"].split(), f"{s['id']}: a felirat szövege elveszett")
        for c in cuek:
            ok(1 <= len(c) <= 2 and all(len(x) <= 42 for x in c), f"{s['id']}: túl hosszú cue {c}")
            ok(not (len(cuek) > 1 and len(" ".join(c).split()) == 1), f"{s['id']}: árva szó {c}")
ok(R.cue_darabok("Ingyenes, és negyedóra alatt megvan.") == [["Ingyenes, és negyedóra alatt megvan."]], "rövid felirat egyben")
# 2026-11-19, 2. kör: a sor a mondat tagolása szerint törik; ige + igekötő / simulószó, névelő + szó, szám + szó együtt marad
import felirat_tores as FT  # noqa: E402
for nev in K.NEVEK:
    for _, s in K.sorok(K.forgatokonyv(nev)):
        cuek = R.sor_cuek(s)
        ok(" ".join(" ".join(c) for c in cuek).split() == s["felirat"].split(), f"{s['id']}: a (kézi) tördelés szövege eltér a felirattól")
        szavak_ = s["felirat"].split()
        hely = 0
        for c in cuek:
            ok(1 <= len(c) <= 2 and all(len(x) <= 42 for x in c), f"{s['id']}: túl hosszú cue {c}")
            if len(c) == 2:
                i = hely + len(c[0].split())
                ok(FT.tores_ar(szavak_, i) < FT.TILOS, f"{s['id']}: tiltott sortörés: {c}")
            hely += sum(len(x.split()) for x in c)
ok(R.cue_darabok("Megmutatjuk, hogyan jelented be a vállalkozásodat. Ingyenes.")[0][0].endswith("jelented be"), "ige + igekötő egy sorban")
ok(FT.tores_ar("a 2. pontot jelöld".split(), 2) >= FT.TILOS, "sorszám + főnév nem válik el")

# hang: a sor eleji kattanás csak akkor marad a szó része, ha a sor zárhanggal kezdődik
import numpy as _np  # noqa: E402
import hang as _HG  # noqa: E402
_sr = 48000
_t = _np.arange(int(0.4 * _sr)) / _sr
_besz = (0.3 * _np.sin(2 * _np.pi * 180 * _t)).astype(_np.float32)
_katt = _np.zeros(int(0.002 * _sr), dtype=_np.float32); _katt[::2] = 0.08; _katt[1::2] = -0.08
_jel = _np.concatenate([_np.zeros(int(0.06 * _sr), dtype=_np.float32), _katt, _np.zeros(int(0.08 * _sr), dtype=_np.float32), _besz])
_maganh, _ = _HG.eleje_elemzes(_jel, _sr, "A NAV tölti ki")
_zar, _ = _HG.eleje_elemzes(_jel, _sr, "Koppints az Új")
ok(abs(_maganh / _sr - 0.142) < 0.012, f"magánhangzós sor: a kattanás nem a beszéd része ({_maganh / _sr:.3f} s)")
ok(abs(_zar / _sr - 0.060) < 0.012, f"zárhangos sor: a pattanás a szó része marad ({_zar / _sr:.3f} s)")
ok(_HG.eleje_elemzes(_jel, _sr, "A NAV tölti ki")[1] and not _HG.eleje_elemzes(_jel, _sr, "Koppints az Új")[1], "kattanás-jelző")

# vak-összevetés
ok(V.megvan("plusszal", "Lépj be DÁP-pal vagy Ügyfélkapu+-szal"), "plusszal ~ +-szal")
ok(V.megvan("ónyát", "Nyisd meg az ONYA-t"), "ónyát ~ ONYA-t")
ok(V.megvan("onyát", "Nyisd meg az Onya-t"), "onyát ~ Onya-t")
ok(V.megvan("huszonnégy", "24–48 órán belül hív"), "számszó ~ számjegy")
ok(not V.megvan("lúgot", "a lógot nézd"), "rossz magánhangzó = hiba")
ok(V.szavak("NAV-nál, DÁP-pal") == ["nav", "nál", "dáp", "pal"], "szóbontás")

# forgatókönyv: minden horgonyszó, kép és jelölés létezik; tiltott szavak nincsenek; mond != üres
for nev in K.NEVEK:
    fk = K.forgatokonyv(nev)
    kepek = KP.lepes_by_kep(fk["utmutato"])
    for j, s in K.sorok(fk):
        ok(s["mond"].strip() and s["felirat"].strip(), f"{s['id']}: üres szöveg")
        ok(not re.search(r"\d", s["mond"]), f"{s['id']}: számjegy a kimondott szövegben (betűvel kell)")
        for minta in E.TILTOTT:
            ok(not re.search(minta, s["mond"] + " " + s["felirat"]), f"{s['id']}: tiltott ({minta})")
        if s.get("kep"):
            ok(s["kep"] in kepek, f"{s['id']}: nincs ilyen kép {s['kep']}")
        for x in s.get("jel", []):
            ok(x["szo"] in s["mond"], f"{s['id']}: a horgonyszó nincs a szövegben: {x['szo']}")
            if "n" in x:
                kep = x.get("kep") or s.get("kep")
                ok(x["n"] in KP.retegek(fk["utmutato"], kep)["jelek"], f"{s['id']}: nincs {x['n']}. jelölés a {kep} képen")
            if "elem" in x:
                ok(0 <= x["elem"] < len(j["elemek"]), f"{s['id']}: nincs {x['elem']}. elem")
        if j["tipus"] == "kep":
            ok(bool(s.get("kep")), f"{s['id']}: képjelenet kép nélkül")
    # becsült hossz a SPEC-sávban
    # 2026-11-19: ha minden sornak van felvétele, a valódi (az epit.py enyhe gyorsítása utáni) hossz számít; különben a becslés
    try:
        iv, mi = R.idovonal(nev, fk, R.hosszak(nev, fk, False)), "valódi"
    except SystemExit:
        iv, mi = R.idovonal(nev, fk, R.hosszak(nev, fk, True)), "becsült"
    lo, hi = E.HOSSZ[nev]
    ok(lo <= iv["hossz"] <= hi, f"{nev}: {mi} hossz {iv['hossz']:.1f} s, sáv {lo}-{hi}")

# SPEC §26.6.3 tények a bejelentés-szövegben
osszes = " ".join(s["mond"] for _, s in K.sorok(K.forgatokonyv("vallalkozas_bejelentes"))).lower()
for kell in ["átalányadózás", "alanyi", "katát ne", "pénzforgalmi", "munkavégzés jellegét", "közösségi adószám", "ellenőrzés",
             "nem módosítható", "aznap indul", "pdf", "alkalmazásban", "átnézzük", "kamaránál", "ingyenes", "visszahívást"]:
    ok(kell in osszes, f"bejelentés: hiányzik: {kell}")
osszes = " ".join(s["mond"] for _, s in K.sorok(K.forgatokonyv("meghatalmazas"))).lower()
for kell in ["onyát", "profil", "új nyomtatvány", "meghatalmazás", "ujegyke", "meghatalmazó", "új bejelentés", "adóazonosító",
             "kimásolod", "kilencest", "nyilvántartási", "mai nap", "adóügyeket", "egyéni vállalkozói nyilvántartás", "tovább",
             "húsz perc", "beküldtem", "visszahívást"]:
    ok(kell in osszes, f"meghatalmazás: hiányzik: {kell}")

print(f"OK {n} teszt")
