# -*- coding: utf-8 -*-
"""Képernyőképek fej nélküli Chrome-mal, @2x.
Használat: python lovesz.py [név ...]   (név nélkül mind a hat képernyő és az elemlap)
Minden lövés saját --user-data-dir mappát kap (KEZJEGY_PROFIL vagy a rendszer ideiglenes mappája alatt).
A profilmappákat nem töröljük (a tulaj szabálya: nem törlünk).
A 02, 03, 04 és 05 teljes hosszban is elkészül (_teljes.png)."""
import os, sys, subprocess, tempfile, uuid

CH = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')).replace('\\', '/')
KEPERNYOK = ['01_belepes', '02_bekotes', '03_fooldal', '04_dosszie', '05_tetel', '06_uzenetek', '07_elemek']
TELJES = {'02_bekotes': 1000, '03_fooldal': 1790, '04_dosszie': 1240, '05_tetel': 1200}
MAGASSAG = {'07_elemek': 1000}   # az elemlap nem telefonképernyő, a saját hosszában készül

def lo(nev, h=844, kimenet=None, html=None):
    kimenet = kimenet or f'{D}/{nev}.png'
    html = html or f'{D}/{nev}.html'
    prof = os.path.join(os.environ.get('KEZJEGY_PROFIL', tempfile.gettempdir()), 'kezjegy_prof_' + uuid.uuid4().hex[:10]).replace('\\', '/')
    cmd = [CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run',
           '--no-default-browser-check', f'--user-data-dir={prof}', '--force-device-scale-factor=2',
           f'--window-size=390,{h}', '--virtual-time-budget=9000',
           f'--screenshot={kimenet}', 'file:///' + html.replace('\\', '/')]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    print(kimenet, os.path.getsize(kimenet) if os.path.exists(kimenet) else 'HIBA')

if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--html':          # tetszőleges oldal: --html út kimenet magasság
        lo('x', int(args[3]) if len(args) > 3 else 844, args[2], args[1]); sys.exit()
    for n in (args or KEPERNYOK):
        lo(n, MAGASSAG.get(n, 844))
        if n in TELJES:
            lo(n, TELJES[n], f'{D}/{n}_teljes.png')
