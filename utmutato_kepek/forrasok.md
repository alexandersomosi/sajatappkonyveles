# Források – jelölt NAV-képek

2026-11-18, kiegészítve 2026-11-19 (NAV kisfilm). Részletes, gépi lista: `forrasok.json` (letöltött fájlok SHA-256-tal, forrásképenként oldal/dia, kimeneti képenként forrás).

## Letöltött hivatalos fájlok (`_forras/`, csak a nav.gov.hu-ról)

| Fájl | Dokumentum | Dátum | Mire használtuk |
|---|---|---|---|
| `vallalkozoi_ugyseged_utmutato.pdf` | A NAV ÜPO Vállalkozói Ügysegédjének útmutatója – https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fvallalkozoknak%2Findulo-vallalkozas%2Fkapcsolodo-tartalmak%2Fa-vallalkozoi-ugyseged-utmutatoja | 2026.03.19. | A képernyők és rovatok nevei (III.3., 10–16. o.) a rajzolt illusztrációkhoz. **Képernyőképet nem tartalmaz.** |
| `segedlet_15_18_ujegyke_onya.pdf` | Segédlet a 15-ös és 18-as jogcímű szervezetek ONYA-s képviseleti bejelentéséhez – https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/eljarasi-kerdesek/segedlet_15_18_ujegyke_onya_honlapra | 2025.03.11. (régebbi felület) | 1.1.1 „Bejelentés magánszemély meghatalmazóként”, 2–4. oldal |
| `onya_altalanos_bemutato.pptx` | Online Nyomtatványkitöltő Alkalmazás – Általános bemutató – https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek_egyeb/onya-segedletek/online-nyomtatvanykitolto-alkalmazas--altalanos-bemutato | 2026.01.23. (a címdián „2025”) | 7., 8., 10. dia |

A `_forras/` mappa letöltött, nem megbízható adat: semmit nem futtattunk belőle. A képeket külön mappában lévő szkripttel
(`_eszkoz/kinyer.py`, PyMuPDF, `python -I`) nyertük ki. A `_nyers/` mappa a kiválasztott képek **előre elmosott** másolata.

**Figyelem:** a 2025-ös segédlet PDF-jébe ágyazott eredeti képeken a NAV fekete takarósávja alatt (ami csak egy ráhelyezett
rajzelem) valódinak látszó név, adóazonosító jel, cégnév, érkeztetési szám is van. Ezeket a `_nyers/` másolaton elmostuk;
a `_forras/` PDF-et ne tegyük ki sehova, és ne nyissunk belőle képet közvetlenül.

## A NAV hivatalos kisfilmje (2026-11-19, 6 valódi kép a vállalkozás-bejelentéshez)

| Forrás | Dátum | Mire használtuk |
|---|---|---|
| NAV: „Megújul az Ügysegéd” – kisfilm, YouTube, NAVgovHu csatorna – https://youtu.be/DQnbjo2lrv8 (a NAV sajtóközleménye, https://nav.gov.hu/sajtoszoba/hirek/Matol_elerheto_a_Vallalkozoi_Ugyseged, és a nav.gov.hu „Új ügysegéd” csempéjének „Segédlet” linkje mutat rá) | 2026.02.19. | `vallalkozas_bejelentes/` 02 (0:32), 03 (0:28), 04 (0:22), 11 (0:24), 13 (0:37), 14 (0:42) |

Rögzítés: a beépített böngészőben, hd1080 lejátszás közben a kocka canvasra rajzolva és 1:1-es képernyőképekből (780×590-es
csempék) összerakva – **a videót nem töltöttük le**. Csempék és kockák: `_forras2/kisfilm_kockak/` (`kockak.json`). A kisfilm a NAV
bemutató-felületét mutatja tesztadatokkal („SAMPLE ELLÁK”, „SAMPLE ERHARD”, ügyazonosító): ezeket is elmostuk
(`_eszkoz/kisfilm_nyers.py` → `_nyers/kisfilm_2026-02-19/`). A tesztkörnyezet fejlesztői buborékát („evny.main.tabs…”) és egy
böngésző-állapotsort a háttér színével eltakartuk, a NAV felületének tartalmán nem változtattunk. Minden kép alján:
„Képernyőkép: NAV, „Megújul az Ügysegéd” kisfilm (2026.02.19.), p:mm. A NAV bemutató-felülete, a mintaadatok elmosva.”

**[JOGI]** A kisfilm kockáinak felhasználása ugyanaz a kérdés, mint a segédleteké (Szjt. 1. § (4) hivatalos közlemény, illetve
idézés, Szjt. 34. §): a jogász erősítse meg. Ha nem használható, a régi rajzok a `_regi/vallalkozas_bejelentes/` alatt megvannak
(`index.json` → `illusztracio_elotte`), és a tulaj saját képeivel (`SAJAT_KEPEK.md`) bármikor cserélhetők.

## Letöltött, de fel nem használt (2026-11-19, `_forras2/nav_lepesrol_lepesre/`, csak nav.gov.hu)

- „Egyéni vállalkozás lépésről lépésre” (NAV, 2026.02.19.): a 15 kártya és a PDF – a kártyákon csak a **régi** Webes Ügysegéd apró
  képei vannak, ezért nem használtuk. https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/-egyeni-vallalkozas-lepesrol-lepesre

## Csak hivatkozás (magánoldalak – képet nem veszünk át)

Az új Ügysegédről szóló hírek, képernyőkép nélkül: adozona.hu (NAV_mar_elerheto_a_Vallalkozoi_Ugyseged_777R7M,
hianyossag_Vallalkozoi_Ugyseged_MKOE_BAHVYS), economx.hu (2026.03.01.), privatbankar.hu („csütörtökön meglepte a vállalkozókat a
NAV”), szekhelypartner.hu. Képernyőképes könyvelő-blogot nem találtunk.

## Saját képernyőképek nyilvános oldalakról (2026.11.18., belépés nélkül)

Headless Chrome-mal, belépés nélkül: https://onya.nav.gov.hu (nyitóoldal), https://onya-public.nav.gov.hu (azonosítás nélküli
nyomtatványkitöltő: Meghatalmazások → UJEGYKE 13.0 → Kiválaszt, a webnyk-public.nav.gov.hu űrlap), és
https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main (ez a kormányzati azonosító oldalra, kau.gov.hu, irányít át).
Adatot nem írtunk be, semmit nem küldtünk be, sütit nem fogadtunk el (az ONYA süti-ablakát a saját böngészőnkben a kép elől
eltávolítottuk). Eszköz: `_eszkoz/rogzit.mjs` (újrafuttatható, ha a NAV felülete változik).

## Rajzolt illusztrációk

`_illusztracio/` – a Vállalkozói Ügysegéd képernyőinek vázlata (2026-11-19 óta csak a 05–10. és a 12. lépésnél használjuk) a 2026.03.19-i útmutató alapján (`kepernyok.py` → HTML,
`render.mjs` → PNG). Minden ilyen kép alján „Illusztráció” címke és „A valódi képernyő eltérhet” szöveg áll. Személyes adat nincs rajtuk
(a kitöltött mezők helyén szürke sáv).

## Szerzői jog – a jogásznak [JOGI]

- A NAV útmutatói és segédletei **feltehetően „hivatalos közlemény”**, ezért nem állnak szerzői jogi védelem alatt
  (1999. évi LXXVI. törvény (Szjt.) 1. § (4): „Nem tartozik a szerzői jogi védelem alá a jogszabály, … a hatósági vagy egyéb
  hivatalos közlemény …”). **Ezt a jogász erősítse meg**, mert egy felhasználói segédlet közlemény-volta nem egyértelmű.
- A **szoftverfelületek** (ONYA, Vállalkozói Ügysegéd, a kormányzati belépő oldal) grafikai elemei – logók, rajzok, ikonok –
  külön védelem alatt állhatnak. Ezért: a nyitóoldali nagy rajzot és a segédlet szerepkör-rajzát kivágtuk; az ONYA-csempék
  3D-s tárgyai (04) és az „iD” logó (01/02) a képen maradt. Kérdés a jogásznak: tájékoztató célú, forrásmegjelöléses
  használatuk egy fizetős szolgáltatás appjában rendben van-e (idézés, Szjt. 34. §; vagy cseréljük rajzra).
- Minden kép alján ott a forrás és a dátum; az appban is (SPEC §26.6.4). NAV-logót, -névjegyet nem használunk a saját
  felületünkön; a rajzolt vázlatokon csak szöveg („NAV ÜPO”, „Vállalkozói Ügysegéd”) áll, logó nincs.
- A képek nem azt sugallják, hogy a NAV ajánlana minket; ha a jogász szükségesnek látja, a lábléchez hozzá lehet írni:
  „A NAV nem kapcsolódik a szolgáltatáshoz.”

## Betűk

`_betu/Geist_wght.ttf` (feliratok) és `_betu/Inter_opsz_wght.ttf` (a vázlat-képernyők szövege) – mindkettő SIL Open Font License 1.1
(lásd `_betu/LICENC.md`).
