"""Két független lektor a két útmutató-videó szövegére (SPEC §26.7.4).

  python lektor.py <kor>        # pl. kor1 -> video/vallalkozas_bejelentes/lektor/kor1_nyelv.json, kor1_tenyek.json

- nyelvi lektor (anthropic/claude-haiku-5.5): magyar nyelv, tegeződés, egyszerű szavak, nyugodt hangnem, felolvashatóság,
  feliratforma; tilos: termék- vagy könyvelőnév, MI említése.
- tényellenőr (google/gemini-3.8-flash): egyezés a SPEC §26.6.3 tényeivel, a NAV Vállalkozói Ügysegéd / ONYA-UJEGYKE
  lépéseivel (index.json + az útmutató-sablon), a kutatás tényeivel.
A két lektor nem látja egymás válaszát. Költség a koltseg.jsonl-be (tag: lektor_*).
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402

SPEC = K.APP + "/kod/SPEC.md"
BEKOTES_TS = K.APP + "/kod/shared/src/bekotes.ts"


def spec_resz(kezd, veg):
    t = open(SPEC, encoding="utf-8").read()
    a = t.index(kezd)
    b = t.index(veg, a)
    return t[a:b]


def sablon_szoveg():
    t = open(BEKOTES_TS, encoding="utf-8").read()
    a = t.index("export const GUIDE_TEMPLATES")
    b = t.index("};", t.index("outro: '{firstName} megnézi", a)) + 2
    return t[a:b]


def index_kivonat(utm):
    d = K.index_json(utm)
    out = []
    for s in d["lepesek"]:
        out.append({"kep": f"{s['sorszam']:02d}_{s['slug']}", "lepes": s["lepes_kulcs"], "kepernyo": s.get("kepernyo"),
                    "valtozat": s.get("valtozat"), "felirat": s["felirat"], "mit_csinalj": s["mit_csinalj"],
                    "mezok": s.get("mezok"), "jelolesek": [{"n": j["n"], "cimke": j["cimke"]} for j in s["kimenet"]["jelolesek_kimeneten"]],
                    "tipus": s["kimenet"]["tipus"]})
    return out


NAV_KIVONAT = """NAV, A Vállalkozói Ügysegéd útmutatója (2026.03.19) – kivonat:
- Belépés: https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main, KAÜ (Ügyfélkapu+ vagy DÁP). Főoldal csempék: „Bejelentéseim, kérelmeim” (itt megtekinthetők és kereshetők a korábbi bejelentések), „Új bejelentés, kérelem benyújtása”.
- Ügyintézési idő: a NAV haladéktalanul megállapítja az adószámot és nyilvántartásba vesz; sürgősségi eljárás nincs. Az egyéni vállalkozó a nyilvántartásba vétel napján kezdheti meg tevékenységét.
- Bejelentkezés a gazdasági kamarához: a NAV értesíti a kamarát, ettől függetlenül a vállalkozónak külön kamarai űrlapon kell benyújtania a bejegyzési kérelmet az illetékes területi gazdasági kamarához 5 munkanapon belül.
- Adózási adatok: a munkavégzés jellegének megadása kötelező; kata-nyilatkozat; átalányadózás választása (Szja tv. 50. § (6)); az áfafizetési kötelezettség megállapításának módja (csak áfafizetőknek); Áfamentesség rovat 2. pont: az alanyi adómentesség választása; közösségi adószám igénylése; MNB/EKB-árfolyam; pénzforgalmi elszámolás választása; Áfa tv. 49/A., 89/A., 96. § bejelentések.
- Nyilatkozatok: a kizáró okokra vonatkozó nyilatkozatot csak akkor jelölheti, ha a kizáró okok egyike sem áll fenn.
- Ellenőrzés: itt ellenőrizheti az adatokat; módosításhoz a „Vissza” gomb. A „Bejelentés megtétele” gombbal véglegesíti; utána módosítani vagy meg nem történtté tenni nem lehet.
- Megtekintés: az értesítés pdf-formátumban is letölthető.
- A bejelentés díj- és illetékmentes.
NAV ONYA (onya.nav.gov.hu), UJEGYKE: Bejelentkezés (KAÜ) -> jobb felső sarokban a saját profil -> Új nyomtatvány -> Meghatalmazások -> UJEGYKE Kiválaszt -> felugró ablak: Meghatalmazó szerep, Tovább -> lista alján „Új bejelentés” -> Képviselő – Magánszemély: név, adóazonosító jel -> Képviselet jogcíme Kód: 9 – Könyvelő, nyilvántartási szám -> Képviselt: előre kitöltve -> Képviseleti jogosultság kezdete: mai nap, vége: üres (visszavonásig) -> Fő ügycsoportok: ADÓÜGYEK (Ügycsoport intézésére jogosult) -> Ügycsoportok részletezése > Vegyes ügyek: Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek) -> Ellenőrzés és benyújtás -> Tovább -> Sikeres benyújtás. A meghatalmazóként beküldött meghatalmazás a nem ügyvéd meghatalmazott jóváhagyása nélkül kb. 20 perc múlva él. A meghatalmazás a magánszemély adóazonosító jeléhez kötődik, ezért a vállalkozás indulása előtt is megadható, és utána is érvényes.
Jogi szöveg (kod/jogi/app_szovegek.md) meghatalmazas.ugykorok: ADÓÜGYEK (kivéve egyes jövedéki ügyek); Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek). meghatalmazas.jelszo: Az Ügyfélkapu+ vagy DÁP belépésedet senkinek ne add meg, nekünk sem.
Szolgáltatás: valódi könyvelő, 24–48 órán belüli visszahívás a csapattól (nem feltétlenül a könyvelő), TAJ-t és anyja nevét nem kérjük el és nem tároljuk."""


def szkript_szoveg(nev):
    fk = K.forgatokonyv(nev)
    sorok = []
    for j, s in K.sorok(fk):
        sorok.append({"id": s["id"], "jelenet": j["id"], "kep": s.get("kep") or j.get("tipus"), "mond": s["mond"], "felirat": s["felirat"]})
    return sorok


def main(kor):
    os.makedirs(K.mappa("vallalkozas_bejelentes") + "/lektor", exist_ok=True)
    szkriptek = {n: szkript_szoveg(n) for n in K.NEVEK}
    sz = json.dumps(szkriptek, ensure_ascii=False, indent=1)
    kozos_szabaly = ("Két rövid, függőleges, narrált útmutató-videó szövege egy magyar könyvelési szolgáltatás alkalmazásához "
                     "(átalányadós, alanyi ÁFA-mentes egyéni vállalkozóknak). 'mond' = amit a hang felolvas (Gemini TTS; ezért a "
                     "számok betűvel, 'Ügyfélkapu plusz', 'Ónya' = ONYA, 'ujegyke' = UJEGYKE); 'felirat' = a képernyőn látható felirat. "
                     "A videó a NAV képernyőinek jelölt képein megy végig. Hossz: a bejelentés 90–150 s, a meghatalmazás 60–100 s, "
                     "tehát rövidnek kell maradnia.")
    nyelv_prompt = (kozos_szabaly + "\n\nTe vagy a NYELVI lektor (anyanyelvi magyar szerkesztő). Ellenőrizd soronként: helyes, "
                    "természetes magyar; következetes tegeződés; rövid, egyszerű szavak (egy 60 éves is értse); nyugodt, udvarias, "
                    "megbízható hangnem (privát banki stílus, nem reklámos, nem viccelődő); jól felolvasható-e (TTS: rövidítések, "
                    "kötőjelek, idézőjelek); a 'felirat' és a 'mond' tartalma egyezik-e; a felirat helyesírása (idézőjel „”, "
                    "nagybetűk, ÁFA-írás, kötőjel); tilos: terméknév, könyvelő neve, mesterséges intelligencia vagy MI/AI említése. "
                    "Csak valódi hibát jelezz, ízlésbeli apróságot ne. Válasz CSAK JSON: {\"talalatok\": [{\"id\": \"b07\", "
                    "\"mezo\": \"mond|felirat|mindketto\", \"sulyossag\": \"hiba|javaslat\", \"problema\": \"...\", "
                    "\"javitott\": \"a teljes javított mondat\"}], \"osszegzes\": \"...\"}\n\nSZÖVEG:\n" + sz)
    tenyek = {
        "spec_26_6_3": spec_resz("#### 26.6.3", "#### 26.6.4"),
        "spec_26_7_4": spec_resz("#### 26.7.4", "### 26.8"),
        "spec_26_1_4": spec_resz("#### 26.1.4", "#### 26.1.5"),
        "utmutato_sablonok_bekotes_ts": sablon_szoveg(),
        "nav_kepek_index_vallalkozas_bejelentes": index_kivonat("vallalkozas_bejelentes"),
        "nav_kepek_index_meghatalmazas": index_kivonat("meghatalmazas"),
        "nav_kivonat": NAV_KIVONAT,
    }
    teny_prompt = (kozos_szabaly + "\n\nTe vagy a TÉNYELLENŐR. Hasonlítsd össze a videószövegek MINDEN állítását és lépését a "
                   "lenti forrásokkal (SPEC, az útmutató-sablon, a jelölt NAV-képek indexe, a NAV útmutató kivonata). Keresd: "
                   "téves vagy pontatlan állítás; hiányzó kötelező lépés vagy tény (a SPEC 26.7.4 vázlata és a 26.6.3 tényei: "
                   "alanyi ÁFA-mentesség igen, átalányadózás igen, kata nem, pénzforgalmi nem, munkavégzés jellege, közösségi "
                   "adószám csak ha kell, Ellenőrzés képernyő, a Bejelentés megtétele végleges és aznap indul, PDF letöltése a "
                   "Megtekintésnél, feltöltés az appban, 'átnézzük és szólunk', kamarai regisztráció 5 munkanapon belül; a "
                   "meghatalmazásnál ONYA, profil, Új nyomtatvány, Meghatalmazások, UJEGYKE, Meghatalmazó, Új bejelentés, könyvelő "
                   "neve és adóazonosító jele (az appból másolható), jogcím 9 – könyvelő, nyilvántartási szám, ügycsoportok, kezdete "
                   "ma, vége üres, Ellenőrzés és benyújtás, ~20 perc, Beküldtem gomb); rossz sorrend; a képernyő-elnevezések "
                   "egyeznek-e a NAV-képekkel; olyan ígéret, amit a szolgáltatás nem tart (pl. mi adjuk be helyette). Csak valódi "
                   "eltérést jelezz. Válasz CSAK JSON: {\"talalatok\": [{\"id\": \"b22\", \"sulyossag\": \"hiba|hiany|javaslat\", "
                   "\"problema\": \"...\", \"forras\": \"melyik forrás mondja\", \"javitott\": \"javasolt mondat vagy új sor\"}], "
                   "\"osszegzes\": \"...\"}\n\nVIDEÓSZÖVEGEK:\n" + sz + "\n\nFORRÁSOK:\n" + json.dumps(tenyek, ensure_ascii=False))
    ki = K.mappa("vallalkozas_bejelentes") + "/lektor"
    for nev_l, modell, prompt, becs, gond in (("nyelv", "anthropic/claude-haiku-5.5", nyelv_prompt, 0.01, {"enabled": False}),
                                              ("tenyek", "google/gemini-3.8-flash", teny_prompt, 0.05, {"effort": "low"})):
        cel = f"{ki}/{kor}_{nev_l}.json"
        if os.path.exists(cel):
            print("megvan:", cel)
            continue
        valasz = K.chat("vallalkozas_bejelentes", modell, [{"role": "user", "content": prompt}], tag=f"lektor_{nev_l}_{kor} (mindkét videó)",
                        max_tokens=9000, temperature=0.2, becsult=becs, reasoning=gond)
        m = re.search(r"\{.*\}", valasz, re.S)
        try:
            adat = json.loads(m.group(0)) if m else {"nyers": valasz}
        except json.JSONDecodeError:
            adat = {"nyers": valasz}
        adat["_modell"] = modell
        json.dump(adat, open(cel, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("kész:", cel, len(adat.get("talalatok") or []), "találat")
    print("eddigi költés: %.4f USD" % K.koltes_osszesen())


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "kor1")
