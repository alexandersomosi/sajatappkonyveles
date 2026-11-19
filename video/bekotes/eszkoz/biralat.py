# biralat.py - two INDEPENDENT reviewers of the narration script (no shared context, different models):
#   1. nyelv  - Hungarian language editor (google/gemini-3.8-flash): natural spoken Hungarian, tegeződés, plain short words, tone
#   2. tenyek - fact check against SPEC §26 (the relevant subsections) and FUNKCIOK.md (anthropic/claude-haiku-5.5)
# Output: szoveg/biralat_<kor>.json (both answers, raw + parsed). Costs go to ../koltseg.jsonl.
#   python eszkoz/biralat.py [kor]      (kor = round label, default 1)
import json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import or_hang as H

KOD = "C:/Users/UpgradePC/konyvelo_app/kod"
FUNKCIOK = "C:/Users/UpgradePC/konyvelo_app/FUNKCIOK.md"
SPEC_RESZEK = ["26.0", "26.1.1", "26.1.2", "26.1.4", "26.1.6", "26.1.7", "26.1.9", "26.2.1", "26.2.2", "26.5.1", "26.5.2",
               "26.6.1", "26.6.3", "26.7.3", "26.7.4"]


def spec_reszek():
    t = open(os.path.join(KOD, "SPEC.md"), encoding="utf-8").read()
    i = t.index("## 26. Tulaj-kérések")
    t = t[i:]
    ki = []
    for r in SPEC_RESZEK:
        m = re.search(r"^(#{3,4}) " + re.escape(r) + r"\b.*$", t, re.M)
        if not m:
            continue
        szint = len(m.group(1))
        veg = re.compile(r"^#{3," + str(szint) + r"} ", re.M)
        n = veg.search(t, m.end())
        ki.append(t[m.start(): n.start() if n else len(t)].strip())
    return "\n\n".join(ki)


def forgatokonyv():
    d = json.load(open(os.path.join(H.ROOT, "szoveg", "sorok.json"), encoding="utf-8"))
    sorok = []
    for s in d["sorok"]:
        sz = re.sub(r"\s*\|\s*", " ", s["szoveg"])
        sor = f'{s["id"]} [{s["jelenet"]}] {sz}'
        if s.get("tts"):
            sor += f'   (kimondva: {s["tts"]})'
        sorok.append(sor)
    return "\n".join(sorok)


NYELV = """Te egy tapasztalt magyar szerkesztő és szinkronrendező vagy. Egy mobilalkalmazás bemutató videójának narrációját nézed át.
A videó a bekötési (regisztráció utáni) oldal tetején fut, új ügyfeleknek: egyéni vállalkozóknak, akik saját könyvelőt kapnak havidíjért.
Követelmények: tegeződés végig; egyszerű, rövid, hétköznapi szavak (egy 60 éves vállalkozó is értse elsőre); meleg, nyugodt, megbízható
hangnem, mint egy privátbanki ügyintézőé (nem reklámos, nem harsány); jól kimondható, természetes beszélt magyar; egy sor 1-2 mondat;
a terméknév és a könyvelő neve nem hangozhat el (helyette: "az alkalmazás", "a könyvelőd", "csapatunk"); mesterséges intelligencia
semmilyen formában nem szerepelhet. A '(kimondva: ...)' a felolvasott alak, ahol a felirat számjegyes.

Feladat: nézd át soronként. Jelezz minden nyelvtani hibát, ragozási hibát, nehézkes vagy hivatalos szót, ismétlést a szomszédos
sorokban, félreérthető mondatot, rossz szórendet, hangnemtörést. Ahol javítanál, adj konkrét új szöveget (ugyanazzal a tartalommal).
Ha egy sor jó, ne írj róla. Ne találj ki új tartalmat.

Válaszolj CSAK JSON-nal: {"osszkep": "<1-2 mondat>", "javaslatok": [{"id": "L05", "gond": "...", "uj_szoveg": "..."}]}

A narráció:
"""

TENYEK = """You are a strict fact checker. Below is the narration script (Hungarian) of a short onboarding explainer video for a
Hungarian accounting app, then the product CONTRACT (SPEC §26 excerpts, English) and the FEATURE LIST (FUNKCIOK.md, Hungarian).
Check every narration line against the contract and the feature list. Report:
- any claim that contradicts them or is not supported by them (e.g. wrong step order, wrong promise, wrong time frame, a document
  or data item the app must NOT ask for, team filing on the client's behalf, booking/appointments, a mandatory call);
- anything the contract's content outline for the 'bekotes' video (§26.7.4) requires that the script is missing;
- forbidden content: the product name, the accountant's personal name, any mention of AI.
Notes: the script deliberately describes both paths (existing business, and new business via self-service guide) in one flow.
Steps of path 'van': fiok, adatok, szerzodes, elofizetes, meghatalmazas, azonositas, nav_bekotes. Path 'inditas' inserts
vallalkozas_inditas after adatok and moves elofizetes after azonositas (charged after the tax number exists, default policy).
Do not report style. Be concrete: quote the line id.

Answer ONLY with JSON: {"summary": "<1-2 sentences>", "issues": [{"id": "L05", "severity": "high|medium|low", "issue": "...",
"evidence": "<SPEC § or FUNKCIOK point>", "fix": "<concrete Hungarian rewrite or what to add>"}]}

=== NARRATION SCRIPT ===
{script}

=== SPEC §26 EXCERPTS ===
{spec}

=== FUNKCIOK.md ===
{funkciok}
"""


def json_ki(t):
    t = t.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.S)
        try:
            return json.loads(m.group(0)) if m else {"nyers": t}
        except Exception:
            return {"nyers": t}


def main():
    kor = sys.argv[1] if len(sys.argv) > 1 else "1"
    fk = forgatokonyv()
    ny = H.chat("google/gemini-3.8-flash", NYELV + fk, tag=f"biralat_nyelv_{kor}", max_tokens=9000, temperature=0.3)
    tp = TENYEK.replace("{script}", fk).replace("{spec}", spec_reszek()).replace("{funkciok}", open(FUNKCIOK, encoding="utf-8").read())
    te = H.chat("anthropic/claude-haiku-5.5", tp, tag=f"biralat_tenyek_{kor}", max_tokens=9000, temperature=0.1)
    ki = dict(kor=kor, forgatokonyv=fk, nyelv=json_ki(ny), tenyek=json_ki(te))
    out = os.path.join(H.ROOT, "szoveg", f"biralat_{kor}.json")
    json.dump(ki, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(ki["nyelv"], ensure_ascii=False, indent=1))
    print(json.dumps(ki["tenyek"], ensure_ascii=False, indent=1))
    print("költés eddig:", round(H.koltes(), 5), "USD ->", out)


if __name__ == "__main__":
    main()
