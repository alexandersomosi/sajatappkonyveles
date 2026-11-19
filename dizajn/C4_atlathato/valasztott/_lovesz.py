# -*- coding: utf-8 -*-
"""C4/C: fooldal + urlap képek @2x (390x844), teljes hosszú fooldal, és hunyorítás-próba (GaussianBlur 6)."""
import os, re, sys, subprocess, tempfile, uuid
from PIL import Image, ImageFilter

CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
D = 'C:/Users/UpgradePC/konyvelo_app/dizajn/C4_atlathato/C'


def prof():
    return (tempfile.gettempdir() + '/c4c_prof_' + uuid.uuid4().hex[:10]).replace('\\', '/')


def url(html, q=''):
    return 'file:///' + html + (('?' + q) if q else '')


def magassag(html):
    cmd = [CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
           '--allow-file-access-from-files', f'--user-data-dir={prof()}', '--window-size=390,844',
           '--virtual-time-budget=6000', '--dump-dom', url(html, 'meres=1')]
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    m = re.search(rb'data-magassag="(\d+)"', r.stdout)
    return int(m.group(1)) if m else None


def lo(html, out, h=844):
    cmd = [CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
           '--allow-file-access-from-files', f'--user-data-dir={prof()}', '--force-device-scale-factor=2',
           f'--window-size=390,{h}', '--virtual-time-budget=9000', f'--screenshot={out}', url(html)]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    print(out, h, Image.open(out).size if os.path.exists(out) else 'HIBA')


def hunyorit(nevek):
    ims = [Image.open(f'{D}/{n}.png').convert('RGB') for n in nevek]
    W, H, G = 390, 844, 16
    lap = Image.new('RGB', (len(ims) * 2 * (W + G) + G, H + 2 * G), '#8C95A5')
    for i, im in enumerate(ims):
        x = G + i * 2 * (W + G)
        lap.paste(im.resize((W, H), Image.LANCZOS), (x, G))
        lap.paste(im.filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.LANCZOS), (x + W + G, G))
    lap.save(f'{D}/_hunyoritas.png')
    print('hunyoritas', lap.size)


if __name__ == '__main__':
    a = sys.argv[1:] or ['fooldal', 'urlap']
    for n in a:
        lo(f'{D}/{n}.html', f'{D}/{n}.png')
    if 'fooldal' in a:
        h = magassag(f'{D}/fooldal.html')
        print('magassag', h)
        lo(f'{D}/fooldal.html', f'{D}/fooldal_teljes.png', max(844, h or 844))
    hunyorit([n for n in ['fooldal', 'urlap'] if os.path.exists(f'{D}/{n}.png')])
