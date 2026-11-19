# -*- coding: utf-8 -*-
"""Kézjegy C2 – képernyőképek fej nélküli Chrome-mal, @2x (390 × 844 CSS px → 780 × 1688 px).
Használat:
  python lovesz.py                      mind a 11 képernyő (+ 08_allapot) + a teljes hosszúak
  python lovesz.py 03_fooldal 07_...    csak ezek
  python lovesz.py --betuk              a betűpróba: 03_fooldal öt betűvel → ../../betuk/fooldal_<betu>.png
  python lovesz.py --html út kimenet [magasság] [lekérdezés]
4. kör: a teljes hosszú képek magasságát a lap maga méri meg (?meres=1 → data-magassag, --dump-dom), így a tartalom
nem vágódik le, és a rögzített kezdőjel nem ül rá a szövegre (02_teljes hibája). Minden lövés saját --user-data-dir
mappát kap (a rendszer ideiglenes mappája alatt), előre perjeles utakkal. A profilmappákat nem töröljük (a tulaj szabálya)."""
import os, re, sys, subprocess, tempfile, uuid

CH = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')).replace('\\', '/')
BETUK_D = os.path.abspath(os.path.join(D, '..', 'betuk')).replace('\\', '/')
KEPERNYOK = ['01_belepes', '02_bekotes', '03_fooldal', '04_dosszie', '05_tetel', '06_uzenetek',
             '07_hogyan_jott_ki', '08_befizettem', '09_fotozas', '10_widget', '11_ures_dosszie']
# külön állapotképek: név → (forrás-HTML, lekérdezés)
ALLAPOTOK = {'08_befizettem_allapot': ('03_fooldal', 'allapot=befizetve')}
TELJES = ['02_bekotes', '03_fooldal', '04_dosszie', '05_tetel']
BETUK = ['onest', 'inter', 'geist', 'golos', 'figtree']


def _prof():
    return os.path.join(tempfile.gettempdir(), 'kezjegy2_prof_' + uuid.uuid4().hex[:10]).replace('\\', '/')


def _url(html, lekerdezes):
    return 'file:///' + html.replace('\\', '/') + (('?' + lekerdezes) if lekerdezes else '')


def magassag(html, lekerdezes=''):
    """A tartalom valódi magassága CSS px-ben (a kozos.js ?meres=1 ága írja a body data-magassag attribútumába)."""
    q = (lekerdezes + '&' if lekerdezes else '') + 'meres=1'
    cmd = [CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
           '--allow-file-access-from-files', f'--user-data-dir={_prof()}', '--window-size=390,844',
           '--virtual-time-budget=6000', '--dump-dom', _url(html, q)]
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    m = re.search(rb'data-magassag="(\d+)"', r.stdout)
    return int(m.group(1)) if m else None


def lo(html, kimenet, h=844, lekerdezes=''):
    cmd = [CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run',
           '--no-default-browser-check', '--allow-file-access-from-files', f'--user-data-dir={_prof()}',
           '--force-device-scale-factor=2', f'--window-size=390,{h}', '--virtual-time-budget=9000',
           f'--screenshot={kimenet.replace(chr(92), "/")}', _url(html, lekerdezes)]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    print(kimenet, h, os.path.getsize(kimenet) if os.path.exists(kimenet) else 'HIBA')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--html':
        lo(a[1], a[2], int(a[3]) if len(a) > 3 else 844, a[4] if len(a) > 4 else ''); sys.exit()
    if a and a[0] == '--betuk':
        os.makedirs(BETUK_D, exist_ok=True)
        for b in (a[1:] or BETUK):
            lo(f'{D}/03_fooldal.html', f'{BETUK_D}/fooldal_{b}.png', 844, f'betu={b}')
            lo(f'{D}/03_fooldal.html', f'{BETUK_D}/fooldal_{b}_teljes.png', magassag(f'{D}/03_fooldal.html', f'betu={b}') or 1800, f'betu={b}')
        sys.exit()
    for n in (a or KEPERNYOK + list(ALLAPOTOK)):
        forras, q = ALLAPOTOK.get(n, (n, ''))
        lo(f'{D}/{forras}.html', f'{D}/{n}.png', 844, q)
        if n in TELJES:
            h = magassag(f'{D}/{forras}.html', q)
            lo(f'{D}/{forras}.html', f'{D}/{n}_teljes.png', max(844, h or 1600), q)
