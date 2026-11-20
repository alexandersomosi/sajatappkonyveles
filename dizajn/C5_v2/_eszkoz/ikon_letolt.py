# Ikonletöltő a próbához (tulaj engedte 11-20): csak sikeres (200) válasznál ír fájlt, semmit nem töröl.
# Használat: python _eszkoz/ikon_letolt.py flatcolor|emoji
import os, sys, urllib.request, urllib.parse
CEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_ikon_proba')
FC = dict(house='home', folder='folder', camera='camera', chat='sms', user='businessman', bell='alarm-clock', phone='phone', calendar='calendar', document='document',
          lock='lock', mail='invite', check='ok', info='info', warning='high-priority', question='faq', shield='privacy', card='paid', receipt='survey', upload='upload',
          clock='clock', settings='settings', signout='export', building='department', idcard='contacts', people='conference-call', bank='currency-exchange',
          scales='rules', trend='line-chart', wallet='money-transfer', calculator='calculator', chart='bar-chart')
EM = dict(house='House', folder='File folder', camera='Camera', chat='Speech balloon', user='Bust in silhouette', bell='Bell', phone='Telephone receiver',
          calendar='Calendar', document='Page facing up', lock='Locked', mail='Envelope', check='Check mark button', info='Information', warning='Warning',
          question='Red question mark', shield='Shield', card='Credit card', receipt='Receipt', upload='Outbox tray', clock='Alarm clock', settings='Gear',
          signout='Door', building='Office building', idcard='Identification card', people='Busts in silhouette', bank='Bank', scales='Balance scale',
          trend='Chart increasing', wallet='Purse', calculator='Abacus', chart='Bar chart',
          # 11-20: a tulaj a Fluent Emojit választotta mindenhová -> a többi tartalmi ikon is
          hourglass='Hourglass not done', memo='Memo', moneybag='Money bag', refresh='Counterclockwise arrows button', pen='Pen',
          play='Play button', mobile='Mobile phone', flash='High voltage', trash='Wastebasket', clipboard='Clipboard', picture='Framed picture',
          label='Label', key='Key')
mit = sys.argv[1]
os.makedirs(os.path.join(CEL, mit), exist_ok=True)
ok, hiany, ossz = 0, [], 0
import time
for k, v in (FC if mit == 'flatcolor' else EM).items():
    if os.path.exists(os.path.join(CEL, mit, k + '.svg')): ok += 1; continue
    time.sleep(0.4)
    url = (f'https://cdn.jsdelivr.net/gh/icons8/flat-color-icons/svg/{v.replace("-", "_")}.svg' if mit == 'flatcolor' else
           f'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/{urllib.parse.quote(v)}/Flat/{v.lower().replace(" ", "_")}_flat.svg')
    try:
        r = urllib.request.urlopen(url, timeout=30)
        b = r.read()
        if r.status == 200 and b.lstrip().startswith(b'<svg') and len(b) < 200_000:
            open(os.path.join(CEL, mit, k + '.svg'), 'wb').write(b); ok += 1; ossz += len(b)
        else: hiany.append(k)
    except Exception as e:
        hiany.append(f'{k} ({getattr(e, "code", type(e).__name__)})')
print(f'{mit}: {ok} ok, {ossz // 1024} KB; hiányzik: {hiany}')
