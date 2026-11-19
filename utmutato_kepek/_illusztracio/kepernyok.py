"""A NAV Vállalkozói Ügysegéd képernyőinek RAJZOLT, vázlatos újraalkotása („Illusztráció”).

Miért: a NAV 2026-os Ügysegéd-útmutatója (2026.03.19.) nem tartalmaz képernyőképet, a felület pedig csak
belépés után látszik, és mi nem lépünk be. Ezért a képernyők nevét, a rovatok és pontok nevét az útmutató
III.3. fejezetéből vettük; az elrendezés, a gombok és a választható sorok pontos felirata a valódi felületen
ELTÉRHET. Minden kép „Illusztráció” címkét kap (annotate.py), és a hianyzik.md-ben szerepel.

Használat:  python kepernyok.py           -> html/*.html
            node render.mjs               -> png/*.png + png/*.json (a data-jel elemek helye eszköz-pixelben)
Személyes adat nincs: a kitöltött mezők helyén szürke sáv áll.
"""
import os, html

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'html')
os.makedirs(OUT, exist_ok=True)

LEPESEK = ['Személyi adatok', 'Vállalkozói címadatok', 'Tevékenységek', 'Adózási adatok', 'Nyilatkozatok', 'Ellenőrzés']
URLAP_CIM = 'Egyéni vállalkozói tevékenység elkezdése'

CSS = """
@font-face { font-family: "Inter"; src: url("../../_betu/Inter_opsz_wght.ttf") format("truetype"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #F3F5F8; }
body { width: 412px; font-family: "Inter", Arial, sans-serif; color: #1D2433; font-size: 15px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
.top { height: 54px; background: #fff; border-bottom: 1px solid #D9DEE6; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.top b { font-size: 15px; letter-spacing: .5px; color: #1F3B63; }
.top span { font-size: 13px; color: #4B5567; font-weight: 600; }
.lap { padding: 16px 16px 56px; }
.lepes { font-size: 12.5px; color: #4B5567; font-weight: 600; margin-bottom: 4px; }
.sav { display: flex; gap: 4px; margin: 6px 0 14px; }
.urlapcim { font-size: 15px; font-weight: 700; color: #1D2433; margin-bottom: 10px; }
.lepesek { display: flex; align-items: center; margin: 0 2px 6px; }
.lepesek .k { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #C3CAD6; background: #fff; color: #6B7487; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.lepesek .k.most { background: #0A5FA8; border-color: #0A5FA8; color: #fff; }
.lepesek .k.kesz { background: #2E9B45; border-color: #2E9B45; color: #fff; font-size: 14px; }
.lepesek .v { flex: 1; height: 2px; background: #C3CAD6; margin: 0 3px; }
.lepesnev { font-size: 12.5px; font-weight: 700; color: #1D2433; margin: 2px 0 14px; }
.sav i { flex: 1; height: 5px; border-radius: 3px; background: #D3D9E3; }
.sav i.kesz { background: #6E8FC0; } .sav i.most { background: #0A66C2; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; letter-spacing: -.2px; }
h2 { font-size: 15.5px; font-weight: 700; margin-bottom: 8px; }
.kartya { background: #fff; border: 1px solid #D9DEE6; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.mezo { margin-bottom: 10px; } .mezo:last-child { margin-bottom: 0; }
.mezo label { display: block; font-size: 12.5px; font-weight: 600; color: #3A4352; margin-bottom: 4px; }
.input { height: 40px; border: 1px solid #8E98A9; border-radius: 6px; background: #fff; display: flex; align-items: center; padding: 0 10px; color: #6B7487; font-size: 14px; }
.input.ro { background: #EEF1F5; border-color: #C9D0DB; }
.adat { display: inline-block; height: 11px; border-radius: 6px; background: #B7C0CE; }
.sor { display: flex; gap: 10px; } .sor > * { flex: 1; }
.pipa { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid #EDF0F4; }
.pipa:first-of-type { border-top: 0; }
.doboz { flex: none; width: 22px; height: 22px; border: 2px solid #5B6578; border-radius: 4px; background: #fff; color: #fff; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.doboz.be { background: #0A66C2; border-color: #0A66C2; }
.kor { flex: none; width: 22px; height: 22px; border: 2px solid #5B6578; border-radius: 50%; background: #fff; margin-top: 1px; display: flex; align-items: center; justify-content: center; }
.kor.be { border-color: #0A66C2; } .kor.be::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: #0A66C2; }
.pipa span { font-size: 14px; }
.pont { font-weight: 700; margin-right: 2px; }
.kicsi { font-size: 12.5px; color: #4B5567; }
.info { background: #E8F1FB; border: 1px solid #BCD4EF; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #24364F; margin-bottom: 12px; }
.figyel { background: #FFF4DC; border: 1px solid #E9C77A; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #4A3608; margin-bottom: 12px; }
.gombok { display: flex; gap: 10px; margin-top: 14px; }
.gomb { flex: 1; height: 44px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14.5px; }
.gomb.elso { background: #0A66C2; color: #fff; } .gomb.masod { background: #fff; color: #0A66C2; border: 2px solid #0A66C2; }
.csempe { background: #fff; border: 1px solid #D9DEE6; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
.csempe b { display: block; font-size: 16px; margin-bottom: 4px; color: #123A6B; }
.lista .elem { background: #fff; border: 1px solid #D9DEE6; border-radius: 8px; padding: 14px; margin-bottom: 8px; font-size: 14.5px; font-weight: 600; color: #123A6B; }
.osszes { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-top: 1px solid #EDF0F4; font-size: 13.5px; }
.osszes:first-child { border-top: 0; } .osszes em { font-style: normal; font-weight: 700; }
.link { color: #0A66C2; font-weight: 700; text-decoration: underline; font-size: 14px; }
.sor-gomb { height: 40px; border: 2px dashed #9AA6B8; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #0A66C2; font-weight: 700; font-size: 14px; }
"""


def adat(w):
    return f'<span class="adat" style="width:{w}px"></span>'


def mezo(cimke, w=150, ro=False, jel=None, tartalom=None):
    j = f' data-jel="{jel}"' if jel else ''
    belso = tartalom if tartalom is not None else adat(w)
    return f'<div class="mezo"{j}><label>{html.escape(cimke)}</label><div class="input{" ro" if ro else ""}">{belso}</div></div>'


def pipa(szoveg, be=False, jel=None, kor=False, pont=None):
    j = f' data-jel="{jel}"' if jel else ''
    jelolo = f'<div class="kor{" be" if be else ""}"></div>' if kor else f'<div class="doboz{" be" if be else ""}">{"✓" if be else ""}</div>'
    p = f'<span class="pont">{pont}</span> ' if pont else ''
    return f'<div class="pipa"{j}>{jelolo}<span>{p}{html.escape(szoveg)}</span></div>'


def oldal(cim, belso, lepes=None, gombok=('Mentés', 'Tovább'), fejlec=URLAP_CIM):
    sav = ''
    if lepes is not None:
        korok = []
        for i in range(len(LEPESEK)):
            if i:
                korok.append('<i class="v"></i>')
            osztaly = 'kesz' if i < lepes else 'most' if i == lepes else ''
            korok.append(f'<span class="k {osztaly}">{"✓" if i < lepes else i + 1}</span>')
        sav = f'<div class="urlapcim">{html.escape(fejlec)}</div><div class="lepesek" style="margin-bottom:16px">' + ''.join(korok) + '</div>'
    g = ''
    if gombok:
        g = '<div class="gombok">' + ''.join(
            f'<div class="gomb {"masod" if i == 0 and len(gombok) > 1 else "elso"}" data-jel="gomb_{i}">{html.escape(t)}</div>' for i, t in enumerate(gombok)) + '</div>'
    return (f'<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
            f'<div class="top"><b>NAV ÜPO</b><span>Vállalkozói Ügysegéd</span></div>'
            f'<div class="lap">{sav}<h1>{html.escape(cim)}</h1>{belso}{g}</div></body></html>')


K = {}

K['ugyseged_fooldal'] = oldal('Vállalkozói Ügysegéd', (
    '<div class="csempe"><b>Bejelentéseim, kérelmeim</b><span class="kicsi">A korábbi bejelentéseid megtekintése és keresése</span></div>'
    '<div class="csempe" data-jel="uj"><b>Új bejelentés, kérelem benyújtása</b><span class="kicsi">Új bejelentés, kérelem kitöltése és benyújtása</span></div>'
    '<div class="csempe"><b>Tájékoztató</b><span class="kicsi">Rövid tájékoztatók és linkek</span></div>'), gombok=None)

K['ugyseged_ugytipus'] = oldal('Új bejelentés, kérelem', (
    '<div class="lista">'
    '<div class="elem" data-jel="kezdes">Egyéni vállalkozói tevékenység elkezdése (vállalkozói bejelentkezés)</div>'
    '<div class="elem">Vállalkozói adatváltozás bejelentése</div>'
    '<div class="elem">A vállalkozás szüneteltetésének bejelentése</div>'
    '<div class="elem">A szünetelés utáni folytatás bejelentése</div>'
    '<div class="elem">A vállalkozás megszüntetésének bejelentése</div>'
    '<div class="elem">Hatósági bizonyítvány igénylése</div>'
    '</div>'), gombok=None)

K['szemelyi_adatok'] = oldal('Személyi adatok', (
    '<div class="info">A személyi adataid a nyilvántartásból jelennek meg.</div>'
    '<div class="kartya" data-jel="adatok">'
    + mezo('Családi és utónév', 170, True) + mezo('Születési családi és utónév', 170, True)
    + mezo('Anyja születési családi és utóneve', 150, True)
    + '<div class="sor">' + mezo('Születési hely', 80, True) + mezo('Születési idő', 70, True) + '</div>'
    + mezo('Állampolgárság', 70, True) + mezo('Lakcím', 230, True) + mezo('Adóazonosító jel', 90, True)
    + '</div>'), lepes=0)

# 11-19 javító kör 2: a vázlatokon csak NAV-feliratok vannak; a saját (tegező) segítő mondataink a képaláírásba kerültek.
K['cimadatok'] = oldal('Vállalkozói címadatok', (
    '<div class="kartya" data-jel="szekhely"><h2>Székhely</h2>'
    + '<div class="sor">' + mezo('Irányítószám', 40) + mezo('Település', 90) + '</div>'
    + '<div class="sor">' + mezo('Közterület neve', 80) + mezo('Közterület jellege', 50) + '</div>'
    + '<div class="sor">' + mezo('Házszám', 30) + mezo('Épület, emelet, ajtó', 50) + '</div>'
    + '</div>'
    '<div class="kartya" data-jel="telephely"><h2>Telephely, fióktelep</h2>'
    '<div class="sor-gomb">Telephely hozzáadása</div><div style="height:8px"></div><div class="sor-gomb">Fióktelep hozzáadása</div></div>'), lepes=1)

K['tevekenysegek'] = oldal('Tevékenységek', (
    '<div class="kartya" data-jel="fo"><h2>Főtevékenység</h2>'
    '<div class="sor-gomb">Új főtevékenység</div><div style="height:10px"></div>'
    + mezo('Kiválasztott főtevékenység (ÖVTJ-kód és megnevezés)', 200, True) + '</div>'
    '<div class="kartya" data-jel="egyeb"><h2>Tevékenység(ek)</h2>'
    '<div class="sor-gomb">Új tevékenység hozzáadása</div></div>'), lepes=2)

MUNKA = [
    ('fofoglalkozas', 'Főfoglalkozású egyéni vállalkozó'),
    ('munkaviszony_mellett', 'Mellékfoglalkozású: heti legalább 36 órás munkaviszony mellett'),
    ('tanulmany_mellett', 'Mellékfoglalkozású: nappali rendszerű tanulmányok mellett'),
    ('nyugdij_mellett', 'Kiegészítő tevékenységet folytató: saját jogú nyugdíj mellett'),
    ('egt', 'Az EGT más tagállamában létesített munkaviszony mellett'),
]
for valaszt, _ in MUNKA[:4]:
    K[f'adozas_munkavegzes_{valaszt}'] = oldal('Adózási adatok', (
        '<div class="kartya" data-jel="munkavegzes"><h2>A munkavégzés jellege *</h2>'
        '<div class="kicsi" style="margin-bottom:4px">Kötelező kitölteni.</div>'
        + ''.join(pipa(t, be=(k == valaszt), jel=f'mv_{k}', kor=True) for k, t in MUNKA) + '</div>'), lepes=3)

K['adozas_kata_atalany'] = oldal('Adózási adatok', (
    '<div class="kartya" data-jel="kata"><h2>A katával kapcsolatos nyilatkozat</h2>'
    + pipa('A kisadózó vállalkozók tételes adóját (katát) választom', be=False, jel='kata_pipa') + '</div>'
    '<div class="kartya" data-jel="atalany"><h2>Az átalányadózás választásával kapcsolatos nyilatkozat</h2>'
    '<div class="kicsi" style="margin-bottom:4px">Szja tv. 50. § (6) bekezdés</div>'
    + pipa('Az átalányadózást választom', be=True, jel='atalany_pipa') + '</div>'), lepes=3)

K['adozas_afa_mentesseg'] = oldal('Adózási adatok', (
    '<div class="kartya" data-jel="afafizetes"><h2>Az áfafizetési kötelezettség megállapításának módja</h2>'
    + pipa('Általános szabályok szerinti adómegállapítás', pont='1.') + pipa('Viszonteladói tevékenység (Áfa tv. XVI/2. alfejezet)', pont='2.')
    + '<div class="kicsi" style="padding-top:6px">… további pontok (3–13.)</div></div>'
    '<div class="kartya" data-jel="afamentesseg"><h2>Áfamentesség</h2>'
    + pipa('Kizárólag közérdekű vagy egyéb sajátos jellegű adómentes tevékenység', pont='1.')
    + '<div data-jel="alanyi">' + pipa('Az alanyi adómentesség választása', be=True, pont='2.') + '</div>'
    + pipa('Mezőgazdasági kompenzációs rendszer', pont='3.')
    + pipa('Alanyi adómentesség a mezőgazdasági tevékenységen kívüli tevékenységre', pont='4.')
    + pipa('Lemondás a kompenzációs rendszerről, alanyi adómentesség', pont='5.') + '</div>'), lepes=3)

for eu in ('igen', 'nem'):
    K[f'adozas_afa_tobbi_eu_{eu}'] = oldal('Adózási adatok', (
        '<div class="kartya" data-jel="kozossegi"><h2>Közösségi adószám igénylése</h2>'
        + pipa('Közösségi adószámot igénylek', be=(eu == 'igen'), jel='kozossegi_pipa') + '</div>'
        '<div class="kartya" data-jel="mnb"><h2>Az MNB- vagy EKB-árfolyam alkalmazásának bejelentése</h2>'
        + pipa('Az MNB / EKB árfolyamát alkalmazom') + '</div>'
        '<div class="kartya" data-jel="penzforgalmi"><h2>A pénzforgalmi elszámolás választásával kapcsolatos nyilatkozat</h2>'
        + pipa('A pénzforgalmi elszámolást választom') + '</div>'
        '<div class="kartya" data-jel="aftv"><h2>Bejelentés az Áfa tv. 49/A. §, 89/A. § és 96. § alapján</h2>'
        + pipa('49/A. § szerinti bejelentés') + pipa('89/A. § és 96. § szerinti bejelentés') + '</div>'), lepes=3)

K['nyilatkozatok'] = oldal('Nyilatkozatok', (
    '<div class="kartya" data-jel="kizaro"><h2>Nyilatkozat a kizáró okokról</h2>'
    + pipa('Kijelentem, hogy velem szemben az egyéni vállalkozói tevékenységet kizáró ok nem áll fenn.', be=True)
    + '</div>'), lepes=4)

K['ellenorzes'] = oldal('Ellenőrzés', (
    '<div class="kartya" data-jel="osszesito">'
    + ''.join(f'<div class="osszes"><span>{html.escape(a)}</span><em>{b}</em></div>' for a, b in [
        ('Székhely', adat(120)), ('Főtevékenység', adat(110)), ('A munkavégzés jellege', adat(90)),
        ('Kata', 'nem'), ('Átalányadózás', 'igen'), ('Alanyi adómentesség', 'igen'), ('Pénzforgalmi elszámolás', 'nem')])
    + '</div>'), lepes=5, gombok=('Vissza', 'Bejelentés megtétele'))

K['bekuldes'] = oldal('Ellenőrzés', (
    '<div class="kartya"><div class="osszes"><span>…</span><em>' + adat(90) + '</em></div>'
    '<div class="osszes"><span>…</span><em>' + adat(70) + '</em></div></div>'
    '<div class="figyel" data-jel="figyelem">A bejelentést a „Bejelentés megtétele” után módosítani vagy visszavonni nem lehet.</div>'),
    lepes=5, gombok=('Vissza', 'Bejelentés megtétele'))

K['megtekintes_pdf'] = oldal('Megtekintés', (
    '<div class="kartya" data-jel="ertesites"><h2>Értesítés</h2>'
    + ''.join(f'<div style="padding:5px 0">{adat(w)}</div>' for w in (260, 220, 240, 150))
    + '<div class="gombok"><div class="gomb elso" data-jel="pdf">Letöltés (PDF)</div></div></div>'
    '<div style="text-align:center;padding:6px" data-jel="bejelenteseim"><span class="link">Bejelentéseim, kérelmeim</span></div>'), gombok=None)

for nev, tartalom in K.items():
    with open(os.path.join(OUT, f'{nev}.html'), 'w', encoding='utf-8') as f:
        f.write(tartalom)
print(len(K), 'képernyő ->', OUT)
