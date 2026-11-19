# minta.py - three 8-10 s voice samples of the SAME sentence with different calm voices (the shared base style of
# ../hang.json), blind transcription x2 each; score = share of expected words found in both transcripts.
# Writes hang/minta/<voice>.wav + hang/minta/eredmeny.json and prints the winner.
#   python eszkoz/minta.py                 make / reuse the samples (cached), print the scores
#   python eszkoz/minta.py --hang-json     ...and write the winner into ../hang.json (allapot: MÉRT). Do this BEFORE anyone
#                                          voices a real video with the provisional voice: all three videos share one voice.
import datetime, json, os, re, sys, unicodedata, wave
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import or_hang as H

HANG_JSON = os.path.join(os.path.dirname(H.ROOT), "hang.json")
SZOVEG = ("Köszönjük, hogy telepítetted az alkalmazásunkat! Megmutatjuk, mire jó, "
          "és mi kell ahhoz, hogy a könyvelőd elkezdhesse a munkát.")
JELOLTEK = ["Charon", "Sulafat", "Umbriel"]   # Charon/Umbriel: 0 blind errors in Hungarian on 10-22; Sulafat: warm female


def szavak(s):
    s = unicodedata.normalize("NFC", s.lower())
    return [w for w in re.split(r"[^a-záéíóöőúüű]+", s) if w]


def pontszam(vart, atiratok):
    hiany = [w for w in szavak(vart) if sum(w in set(szavak(t)) for t in atiratok) < len(atiratok)]
    return 1 - len(hiany) / len(szavak(vart)), hiany


def main():
    hj = json.load(open(HANG_JSON, encoding="utf-8"))
    stilus = hj["alap_stilus"] + ", " + hj["hangulatok"]["udvozlo"] + ". " + hj["nativ_vege"]
    ki = []
    for hang in JELOLTEK:
        raw = H.tts(SZOVEG, hang, stilus, tag=f"minta_{hang}", becsult_mp=10)
        wav = H.pcm_wav(raw, os.path.join(H.ROOT, "hang", "minta", f"{hang}.wav"))
        with wave.open(wav) as w:
            mp = w.getnframes() / w.getframerate()
        atiratok = [H.atir(wav, f"minta_{hang}", proba=p) for p in range(2)]
        pont, hiany = pontszam(SZOVEG, atiratok)
        sor = dict(hang=hang, mp=round(mp, 2), pont=round(pont, 3), hianyzo=hiany, atiratok=atiratok, wav=wav)
        ki.append(sor)
        print(json.dumps(sor, ensure_ascii=False))
    # winner: best score; tie -> the current hang.json voice, then the list order
    ki.sort(key=lambda s: (-s["pont"], s["hang"] != hj["hang"], JELOLTEK.index(s["hang"])))
    gyoztes = ki[0]
    json.dump(dict(szoveg=SZOVEG, stilus=stilus, mintak=ki, gyoztes=gyoztes["hang"]),
              open(os.path.join(H.ROOT, "hang", "minta", "eredmeny.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("GYŐZTES:", gyoztes["hang"], gyoztes["pont"], "| költés eddig:", round(H.koltes(), 5), "USD")
    if "--hang-json" in sys.argv:
        hj["hang"] = gyoztes["hang"]
        hj["keres_forma"]["body"]["voice"] = gyoztes["hang"]
        pontok = ", ".join("%s %s" % (s["hang"], s["pont"]) for s in ki)
        hj["allapot"] = f"MÉRT – {datetime.date.today()} minta.py: {pontok}"
        hj["frissitve"] = datetime.datetime.now().isoformat(timespec="minutes")
        json.dump(hj, open(HANG_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("hang.json frissítve:", gyoztes["hang"])


if __name__ == "__main__":
    main()
