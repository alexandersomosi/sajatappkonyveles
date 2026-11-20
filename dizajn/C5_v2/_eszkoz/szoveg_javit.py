# A Gemini-ellenőrzés (szoveg_ellenor.py) elfogadott/átírt javaslatai, kézi bírálat után (11-20).
# Használat (C5_v2-ből): python _eszkoz/szoveg_javit.py  -> az előző állapot _regi/elotte_szovegjavitas/ alá kerül.
import glob, os, re, shutil, json
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

MIND = '*'  # minden képernyőn
J = [
 # fájl-minta, eredeti, javított
 ('01_fooldal.html', 'számlázhatsz ÁFA nélkül. Ennyi fér még az alanyi ÁFA-mentességbe.', 'ennyit számlázhatsz még ÁFA nélkül, az alanyi ÁFA-mentesség keretén belül.'),
 ('01_fooldal.html', 'bevételed jött be idén eddig.', 'bevételed volt idén eddig.'),
 ('10_belepes.html', 'Pár perc, és bekötünk.', 'Pár perc, és kész is vagy.'),
 (MIND, 'Nézd meg a levélszemét mappát', 'Nézd meg a Spam (levélszemét) mappát'),
 (MIND, 'tartalék kód', 'tartalékkód'),
 ('20_bevezeto.html', 'Betöltjük a lépéseidet', 'Betöltjük az adataidat'),
 ('21_udv*.html', 'Szia Péter!', 'Szia, Péter!'),
 ('21_udv*.html', 'A könyvelődnek az appban írsz', 'A könyvelődnek az appban írhatsz'),
 ('21_udv*.html', 'Szerződés és engedély a NAV-nál', 'Szerződés, majd meghatalmazás a NAV-nál'),
 ('24_var.html', 'most jóváhagyja', 'most hagyja jóvá'),
 ('24_var.html', 'Tovább: A kártyád megadása', 'Tovább: a kártyád megadása'),
 ('31_bekotes_adatok.html', '1. lap a 3-ból', '1. lépés a 3-ból'),
 ('33_bekotes_azonositas.html', 'Melyik igazolvánnyal azonosítasz?', 'Melyik igazolvánnyal azonosítod magad?'),
 ('33_bekotes_azonositas.html', 'Kártya formátumú', 'Kártyaformátumú'),
 ('36_bekotes_szerzodes.html', 'Általános Szerződési Feltételeket', 'általános szerződési feltételeket'),
 ('36_bekotes_szerzodes.html', 'Milyen adatodat', 'Milyen adataidat'),
 ('36_bekotes_szerzodes.html', 'az Adatkezelési tájékoztatót', 'az adatkezelési tájékoztatót'),
 ('36_bekotes_szerzodes.html', 'a Megbízási szerződést', 'a megbízási szerződést'),
 ('42_vallalkozas*.html', '>Mutasd mind<', '>Mutasd mindet<'),
 ('44_vallalkozas_engedely.html', 'Előre dátumot nem lehet megadni.', 'Jövőbeli dátumot nem lehet megadni.'),
 ('45_vallalkozas_feltoltes.html', 'DÁP alkalmazással', 'DÁP-alkalmazással'),
 ('46_vallalkozas_kamara.html', 'A kamarai tagsággal évi', 'A kamarai regisztrációval évi'),
 (MIND, 'Vissza a Főoldalra', 'Vissza a főoldalra'),
 ('47_vallalkozas_utmutato.html', 'Itt választod ki, hogy nem kell ÁFÁ-t felszámolnod.', 'Itt választod ki, hogy ÁFA nélkül számlázhass.'),
 ('47_vallalkozas_utmutato.html', 'ha kimarad, idén ÁFÁ-t kell felszámolnod.', 'ha kimarad, idén nem számlázhatsz ÁFA nélkül.'),
 ('47_vallalkozas_utmutato.html', 'Így nem kell ÁFÁ-t felszámolnod, amíg', 'Így ÁFA nélkül számlázhatsz, amíg'),
 ('47_vallalkozas_utmutato.html', '>Hagyd<', '>Hagyd üresen<'),
 ('52_fizesd_ki.html', 'A(z) 2026. 10. 01.–10. 31. havidíja.', 'A 2026. októberi havidíjad.'),
 ('52_fizesd_ki.html', 'ezért most kézzel kell kifizetned.', 'ezért most itt kell kifizetned.'),
 ('52_fizesd_ki.html', 'Fizesd ki (19 999 Ft)', 'Kifizetem (19 999 Ft)'),
 ('83_dijak.html', 'Fizetek (4 999 Ft)', 'Kifizetem (4 999 Ft)'),
 ('53_hataridok.html', 'Feliratkozom a naptáramban', 'Hozzáadom a naptáramhoz'),
 (MIND, 'az SZJA-t', 'az szja-t'),
 (MIND, 'SZJA-előleg', 'szja-előleg'),
 (MIND, 'SZJA, TB-járulék, szocho', 'Szja, TB-járulék, szocho'),
 (MIND, '>SZJA-bevallás', '>Szja-bevallás'),
 (MIND, 'kevesebb SZJA,', 'kevesebb szja,'),
 ('54_kereset.html', 'Ha így folytatod: kb. 19 400 000 Ft bevételből, kb. 1 980 000 Ft adóval.', 'Ha így folytatod, kb. 19 400 000 Ft bevételed lesz, és kb. 1 980 000 Ft adót fizetsz.'),
 ('56_ertesitesek.html', 'Megnézte az októberi számláidat, szólt, ha kérdése van.', 'Megnézte az októberi számláidat. Ha kérdése lesz, szól.'),
 ('56_ertesitesek.html', 'Mikről kérsz', 'Miről kérsz'),
 ('57_valtozott.html', 'Kezdtél munkaviszonyt?', 'Elkezdtél alkalmazottként is dolgozni?'),
 ('60_dosszie.html', 'Szja-előleg bevallás', 'Szja-előleg kiszámítása'),
 ('65_feltoltes.html', 'nyugta, levél, vagy kézzel', 'nyugta, levél vagy kézzel'),
 ('66_igazolasok.html', 'Kész igazolást itt letöltheted.', 'A kész igazolást itt töltheted le.'),
 ('67_igazolas.html', 'csak ebben a fájlban hiteles', 'csak elektronikus formában hiteles'),
 ('68_igazolas_uj*.html', 'áll rólad', 'szerepel rólad'),
 (MIND, 'Most a Főoldalon látod', 'Most a főoldalon látod'),
 (MIND, 'a Főoldalon', 'a főoldalon'),
 ('73_helyettunk.html', 'Ezen a számon hívjunk<', 'Ezen a számon hívjunk?<'),
 ('73_helyettunk.html', 'Megkapod az adószámodat.', 'Kiadja az adószámodat.'),
 ('73_helyettunk.html', 'Mentsd el a profilomba is', 'Mentsd el a fiókomba is'),
 ('75_keres_uj*.html', 'Bank, hitel, albérlet, ösztöndíj szokta kérni.', 'Hitelhez, albérlethez, ösztöndíjhoz kérik.'),
 ('75_keres_uj*.html', 'nem fér egy üzenetbe', 'nem fér bele egy üzenetbe'),
 ('76_jogi.html', 'Általános Szerződési Feltételek', 'Általános szerződési feltételek'),
 ('80_fiok.html', 'Amit rólad tárolunk, és a letöltésük', 'Amit rólad tárolunk, és hogyan töltheted le'),
 ('81_adataim.html', '>holnap 14:20-ig', '>Holnap 14:20-ig'),
 ('82_biztonsag.html', 'egymagában', 'önmagában'),
 ('82_biztonsag.html', '(ez)', '(ez az eszköz)'),
 ('85_elofizetes.html', '>Él<', '>Aktív<'),
 ('86_ertesitesi_beallitasok.html', 'Ha még hiányzik egy hónap iratai közül.', 'Ha egy hónap iratai közül még hiányzik valami.'),
 ('86_ertesitesi_beallitasok.html', 'Most hív kollégánk', 'Most hív a kollégánk'),
 ('87_ketlepcsos*.html', 'jelszavadat is megkérjük', 'jelszavadat is elkérjük'),
 ('87_ketlepcsos*.html', 'Mind kimásolom', 'Mindet kimásolom'),
 ('88_fiok_torlese.html', 'Sajnáljuk, hogy mész.', 'Sajnáljuk, hogy elmész.'),
 ('88_fiok_torlese.html', 'Miért mész?', 'Miért mész el?'),
 ('88_fiok_torlese.html', 'Stripe-nél', 'Stripe-nál'),
 ('88_fiok_torlese.html', '30 napig meggondolhatod:', '30 napig meggondolhatod magad:'),
 ('88_fiok_torlese.html', 'amit a törvény nem kötelez megőrizni', 'amit a törvény szerint nem kötelező megőrizni'),
 ('90_valtozas.html', 'munkaviszonyt kezdesz vagy befejezel', 'munkaviszonyod kezdődik vagy megszűnik'),
 ('91_valtozas_engedely.html', 'mielőtt engedélyezel', 'mielőtt engedélyt adsz'),
 ('93_valtozas_kerem*.html', 'Így megy', 'Így működik'),
 ('94_valtozas_utmutato.html', '>Válaszd<', '>Válaszd ki<'),
 ('94_valtozas_utmutato.html', 'előre fizetve', 'előre kell fizetni'),
 ('96_eves_kerdoiv.html', 'Ingatlant vagy autót adtam el', 'Ingatlan vagy autó eladása'),
 ('96_eves_kerdoiv.html', '>Külföldről<', '>Külföldi jövedelem<'),
 ('97_kedvezmenyek.html', 'kevesebb adót fizetsz.', 'kevesebb adót fizettél.'),
 ('97_kedvezmenyek.html', '>Kérdése van<', '>Kérdés érkezett<'),
 ('34_bekotes_elofizetes.html', 'Havi díj', 'Havidíj'),
]

def nbsp(t):
    # nem törő szóköz csak számcsoportok között és a szám és a Ft között
    t = re.sub(r'(?<=\d) (?=\d{3}\b)', '&nbsp;', t)
    return re.sub(r'(?<=\d) (?=Ft\b)', '&nbsp;', t)

def minta(s):
    # a szóköz a HTML-ben lehet &nbsp; vagy U+00A0 is
    return re.compile(r'(?:\s|&nbsp;| )+'.join(re.escape(r) for r in s.split(' ')))

ment = '_regi/elotte_szovegjavitas'
os.makedirs(ment, exist_ok=True)
valtozott, kimaradt = set(), []
for fm, er, uj in J:
    fajlok = sorted(glob.glob('[0-9][0-9]_*.html')) if fm == MIND else sorted(glob.glob(fm))
    talalat = 0
    for f in fajlok:
        s = open(f, encoding='utf-8').read()
        # aria-label és látható szöveg egyaránt
        s2, n = minta(er).subn(lambda m: nbsp(uj), s)
        if n:
            if not os.path.exists(f'{ment}/{f}'): shutil.copy2(f, f'{ment}/{f}')
            open(f, 'w', encoding='utf-8').write(s2); valtozott.add(f); talalat += n
    if not talalat and fm != MIND: kimaradt.append((fm, er))
print('módosított fájlok:', len(valtozott)); print(' '.join(sorted(valtozott)))
print('NEM TALÁLT:', json.dumps(kimaradt, ensure_ascii=False, indent=0))
open('_eszkoz/szoveg/_valtozott.txt', 'w', encoding='utf-8').write('\n'.join(sorted(valtozott)))
