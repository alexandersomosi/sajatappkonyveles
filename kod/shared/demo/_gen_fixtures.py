# Generates kod/shared/demo/fixtures.json (fake demo data) and prints reference tax results for SPEC.md.
import json, datetime, calendar, random
from decimal import Decimal, ROUND_HALF_UP


def r(x):
    return int(Decimal(str(x)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


MIN = 322800
GAR = 373200
FREE = 1936800


def adoszam_torzs(prefix7):
    w = [9, 7, 3, 1, 9, 7, 3]
    s = sum(int(c) * w[i] for i, c in enumerate(prefix7))
    return prefix7 + str((10 - s % 10) % 10)


def adoazon(birth, mid3):
    days = (birth - datetime.date(1867, 1, 1)).days
    base = '8' + f'{days:05d}' + mid3
    s = sum((i + 1) * int(c) for i, c in enumerate(base))
    c = s % 11
    assert c < 10, 'pick other mid3'
    return base + str(c)


def calc(rev_by_month, ratio, status='fofoglalkozasu', garant=False, kieso=None, suspended=None, year=2026):
    kieso = kieso or {}
    suspended = suspended or set()
    minimum = GAR if garant else MIN
    inc = [r(Decimal(x) * (100 - ratio) / 100) for x in rev_by_month]
    out = []
    prior = 0
    szja_prev = 0
    for q in range(4):
        months = [3 * q + i for i in range(3)]
        ytd = sum(inc[:3 * q + 3])
        taxable = max(0, ytd - FREE)
        ins = [m for m in months if m not in suspended]
        g = Decimal(0) if not ins else Decimal(max(0, taxable - prior)) / len(ins)
        bases = {}
        for m in ins:
            if status == 'nyugdijas':
                b = Decimal(0)
            elif status == 'mellekallasu':
                b = g
            else:
                dim = calendar.monthrange(year, m + 1)[1]
                mn = Decimal(minimum) if m not in kieso else min(Decimal(minimum), Decimal(minimum) / 30 * (dim - kieso[m]))
                b = max(g, mn)
            bases[m] = r(b)
        prior += sum(bases.values())
        tb = sum(r(Decimal(b) * Decimal('0.185')) for b in bases.values())
        sz = sum(r(Decimal(b) * Decimal('0.13')) for b in bases.values())
        szja_cum = r(Decimal(taxable) * Decimal('0.15'))
        szja = szja_cum - szja_prev
        szja_prev = szja_cum
        out.append(dict(q=q + 1, revenue=sum(rev_by_month[3 * q:3 * q + 3]), income=sum(inc[3 * q:3 * q + 3]),
                        ytdIncome=ytd, taxableYtd=taxable, gongyoltBasePerMonth=float(round(g, 2)),
                        monthlyBases=[bases.get(m) for m in months], tb=tb, szocho=sz, szjaAdvance=szja,
                        total=tb + sz + szja))
    return out


# --- NAV booklet 100 example check (income given directly: ratio 0) ---
ex = calc([450000, 400000, 800000, 0, 400000, 400000, 0, 0, 1300000, 300000, 300000, 0], 0,
          kieso={1: 25, 11: 5}, suspended={7})
cum = 0
for o in ex:
    cum += sum(b for b in o['monthlyBases'] if b)
    print('NAV', o['q'], o['monthlyBases'], 'cum', cum, 'szja', o['szjaAdvance'])

random.seed(20261117)
CUST = [('Bodza Kiadó Kft.', '9910203'), ('Csipkebogyó Pékség Bt.', '9920405'), ('Fecskefészek Utazási Kft.', '9930506'),
        ('Mókusvár Játékbolt Kft.', '9940607'), ('Zöldág Alapítvány', '9950708'), ('Gyöngyvirág Rendezvényház Kft.', '9960809'),
        ('Kékmadár Szoftver Kft.', '9970900'), ('Napfolt Webáruház Kft.', '9980001')]
CUST = [(n, adoszam_torzs(t)) for n, t in CUST]


def split(total, k):
    parts = []
    rest = total
    for i in range(k - 1):
        p = int(round(rest / (k - i) * random.uniform(0.7, 1.3) / 1000)) * 1000
        parts.append(p)
        rest -= p
    parts.append(rest)
    return parts


def invoices_for(prefix, supplier_tax, months_nav, cust_idx, desc, start_no, year=2026):
    inv = []
    no = start_no
    for m, total in months_nav.items():
        if total <= 0:
            continue
        k = 1 if total < 150000 else (2 if total < 500000 else 3)
        days = sorted(random.sample(range(2, 21), k))
        for amt, d in zip(split(total, k), days):
            iss = datetime.date(year, m, d)
            pay = iss + datetime.timedelta(days=8)
            c = CUST[random.choice(cust_idx)]
            inv.append(dict(invoiceNumber=f'{prefix}-{year}-{no:03d}', operation='CREATE', category='NORMAL',
                            issueDate=iss.isoformat(), deliveryDate=iss.isoformat(), paymentDate=pay.isoformat(),
                            paymentMethod='TRANSFER', currency='HUF', netAmountHuf=amt, vatAmountHuf=0,
                            grossAmountHuf=amt, vatExemption={'case': 'AAM', 'reason': 'Alanyi adómentes'},
                            supplierTaxNumber=supplier_tax,
                            customer={'name': c[0], 'taxNumber': c[1], 'vatStatus': 'DOMESTIC'},
                            lines=[{'lineNo': 1, 'description': desc, 'quantity': 1, 'unit': 'db',
                                    'unitPriceHuf': amt, 'netAmountHuf': amt}]))
            no += 1
    return inv


today = datetime.date(2026, 11, 17)
kata_tax = adoszam_torzs('6880123') + '-1-41'
reka_tax = adoszam_torzs('6890456') + '-1-10'
peter_tax = adoszam_torzs('6870789') + '-1-06'
bence_ai = adoazon(datetime.date(1984, 5, 9), '123')
kata_ai = adoazon(datetime.date(1981, 3, 14), '456')
reka_ai = adoazon(datetime.date(1990, 6, 2), '217')
peter_ai = adoazon(datetime.date(1993, 11, 23), '338')

kata_rev = [610000, 540000, 720000, 880000, 760000, 940000, 820000, 650000, 1020000, 900000, 380000]
kata_manual = {10: [('2026-10-03', 18000, 'Nyugta, készpénzes eladás (kézi nyugtatömb)')]}
kata_nav = {m + 1: kata_rev[m] - sum(a for _, a, _ in kata_manual.get(m + 1, [])) for m in range(11)}
kata_inv = invoices_for('KSZ', kata_tax[:8], kata_nav, [0, 1, 2, 3, 4], 'Grafikai tervezés és illusztráció', 1)
extra = dict(kata_inv[-1])
extra.update(invoiceNumber='KSZ-2026-%03d' % (len(kata_inv) + 1), issueDate='2026-11-12', deliveryDate='2026-11-12',
             paymentDate='2026-11-20', netAmountHuf=240000, grossAmountHuf=240000,
             customer={'name': CUST[0][0], 'taxNumber': CUST[0][1], 'vatStatus': 'DOMESTIC'},
             lines=[{'lineNo': 1, 'description': 'Könyvborító illusztráció', 'quantity': 1, 'unit': 'db',
                     'unitPriceHuf': 240000, 'netAmountHuf': 240000}])
kata_inv.append(extra)

reka_rev = [1480000, 1420000, 1550000, 1620000, 1590000, 1710000, 1760000, 1510000, 1690000, 1840000]
reka_navm = {3: 96000, 6: 118000, 9: 84000, 11: 145000}
reka_inv = invoices_for('VR', reka_tax[:8], reka_navm, [5], 'Esküvői frizurák (csoportos)', 1)
reka_manual = {m + 1: [(f'2026-{m + 1:02d}-{calendar.monthrange(2026, m + 1)[1]:02d}', reka_rev[m] - reka_navm.get(m + 1, 0),
                        'Pénztárgép havi összesítő')] for m in range(10)}

peter_rev = [420000, 380000, 510000, 600000, 450000, 700000, 520000, 480000, 650000, 610000, 300000]
peter_inv = invoices_for('NP', peter_tax[:8], {m + 1: peter_rev[m] for m in range(11)}, [6, 7],
                         'Weboldal-fejlesztés és karbantartás', 1)


def received(inv, manual, upto=today):
    by = {}
    for i in inv:
        d = datetime.date.fromisoformat(i['paymentDate'])
        if d <= upto:
            by[d.month] = by.get(d.month, 0) + i['grossAmountHuf']
    for m, items in manual.items():
        for d, a, _ in items:
            by[m] = by.get(m, 0) + a
    return [by.get(m, 0) for m in range(1, 13)]


def afa_used(inv, manual):
    s = sum(i['grossAmountHuf'] for i in inv if i['deliveryDate'] <= today.isoformat())
    return s + sum(a for v in manual.values() for _, a, _ in v)


kr = received(kata_inv, kata_manual)
rr = received(reka_inv, reka_manual)
pr = received(peter_inv, {})
print('KATA months', kr, sum(kr))
print('REKA months', rr, sum(rr))
print('PETER months', pr, sum(pr))
afa = dict(kata=afa_used(kata_inv, kata_manual), reka=afa_used(reka_inv, reka_manual), peter=afa_used(peter_inv, {}))
print('afa used', afa)
res = {'kata': calc(kr, 45), 'reka': calc(rr, 80, garant=True), 'peter': calc(pr, 45, status='mellekallasu')}
for k, v in res.items():
    for o in v:
        print(k.upper(), o)
fx = dict(
    _note='KITALÁLT DEMÓADAT. Valódi személyhez vagy céghez nem tartozik. A 99-cel kezdődő vevői törzsszámok és a 68xxxxxx ügyfél-adószámok csak formailag helyesek (ellenőrző számjegy), nem valódiak. Forrás: kod/SPEC.md 19. pont; generálta a SPEC-író 2026-11-17-én. A NAV-mock és a seed EZT használja; ne írd át kézzel, csak együtt a SPEC 7.6 várt értékeivel.',
    today=today.isoformat(),
    taxIds=dict(bence=dict(adoazonositoJel=bence_ai), kata=dict(adoszam=kata_tax, adoazonositoJel=kata_ai),
                reka=dict(adoszam=reka_tax, adoazonositoJel=reka_ai), peter=dict(adoszam=peter_tax, adoazonositoJel=peter_ai)),
    navInvoices={kata_tax[:8]: kata_inv, reka_tax[:8]: reka_inv, peter_tax[:8]: peter_inv},
    manualRevenue=dict(kata=[dict(receivedOn=d, amountHuf=a, description=t) for v in kata_manual.values() for d, a, t in v],
                       reka=[dict(receivedOn=d, amountHuf=a, description=t) for v in reka_manual.values() for d, a, t in v],
                       peter=[]),
    expectedReceivedByMonth=dict(kata=kr, reka=rr, peter=pr),
    expectedAfaKeretUsedAsOfToday=afa,
    expectedTax2026=res)
with open('C:/Users/UpgradePC/konyvelo_app/kod/shared/demo/fixtures.json', 'w', encoding='utf-8') as f:
    f.write(json.dumps(fx, ensure_ascii=False, indent=1))
print('ids', fx['taxIds'])
print('invoices', len(kata_inv), len(reka_inv), len(peter_inv))
