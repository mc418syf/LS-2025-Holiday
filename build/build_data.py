"""Build data.json for the Livestock Q4 2025 holiday dashboard.

Usage: python3 build/build_data.py <raw_dir> <out.json>

<raw_dir> holds the source exports:
  shopify_total_sales_breakdown.csv   Shopify "Total sales breakdown" 2025-10-01..2025-12-31 vs PY
  gsc_performance_on_search.xlsx      Google Search Console export
  google_ads/                         Google Ads "Overview cards" CSVs
  ga4/acquisition.csv                 GA4 User acquisition (first user channel)
  ga4/acquisition_revenue.csv         GA4 User acquisition cohorts (revenue, transactions)
  ga4/pages.csv                       GA4 Pages and screens (page title)
Release calendar lives in build/launches.csv (transcribed from the launch calendar).
"""
import csv, glob, json, os, re, sys
from datetime import date, timedelta

RAW, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))


def num(s):
    if s is None:
        return None
    s = str(s).strip().replace('CA$', '').replace(',', '').replace('%', '')
    if s in ('', '--', 'null'):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def r2(v, n=2):
    return None if v is None else round(v, n)


# ---------------- Shopify daily ----------------
daily = []
with open(os.path.join(RAW, 'shopify_total_sales_breakdown.csv'), newline='') as f:
    rows = list(csv.reader(f))
for r in rows[1:]:
    if not r or not r[0]:
        continue
    d = r[0]
    disc, rev, net, cvr, aov, ses = (num(x) for x in r[1:7])
    pdisc, prev, pnet, pcvr, paov, pses = (num(x) for x in r[8:14])
    dt = date.fromisoformat(d)
    daily.append(dict(
        d=d, dow=dt.strftime('%a'),
        net=net, py_net=pnet,
        gross=r2(net - disc - rev), py_gross=r2(pnet - pdisc - prev),
        disc=-disc, py_disc=-pdisc, ret=-rev, py_ret=-prev,
        sess=ses, py_sess=pses,
        cvr=r2(cvr, 5), py_cvr=r2(pcvr, 5),
        aov=aov, py_aov=paov,
        orders=round(cvr * ses), py_orders=round(pcvr * pses),
    ))
DI = {r['d']: r for r in daily}
# 364-day (same weekday) prior-year alignment: 2025-d pairs with PY row of 2025-(d+1)
for r in daily:
    nxt = (date.fromisoformat(r['d']) + timedelta(days=1)).isoformat()
    n = DI.get(nxt)
    for k in ('net', 'gross', 'sess', 'orders', 'cvr', 'aov', 'disc', 'ret'):
        r['wpy_' + k] = n['py_' + k] if n else None
    r['wpyd'] = (date.fromisoformat(r['d']) - timedelta(days=364)).isoformat()

# ---------------- Google Ads ----------------
GA = os.path.join(RAW, 'google_ads')


def ads_file(prefix):
    return glob.glob(os.path.join(GA, prefix + '*.csv'))[0]


def read_csv(p):
    with open(p, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


for r in read_csv(ads_file('Time_series')):
    if not r['Date']:
        continue
    from datetime import datetime
    d = datetime.strptime(r['Date'], '%a, %b %d, %Y').date().isoformat()
    x = DI.get(d)
    if not x:
        continue
    x.update(g_clk=num(r['Clicks']), py_g_clk=num(r['Clicks(Comparison)']),
             g_conv=num(r['Conversions']), py_g_conv=num(r['Conversions(Comparison)']),
             g_cost=num(r['Cost']), py_g_cost=num(r['Cost(Comparison)']))

ads = {}
ads['campaigns'] = [dict(name=r['Campaign Name'], group=r['Campaign Group Name'], status=r['Campaign Status'],
                         cost=num(r['Cost']), py_cost=num(r['Cost (Comparison)']),
                         conv=num(r['Conversions']), py_conv=num(r['Conversions (Comparison)']),
                         cpa=num(r['Cost / conv.']), py_cpa=num(r['Cost / conv. (Comparison)']))
                    for r in read_csv(ads_file('Campaigns')) if r['Campaign Name']]
ads['adgroups'] = [dict(group=r['Campaign Group Name'], adgroup=r['Ad Group Name'], campaign=r['Campaign Name'],
                        cost=num(r['Cost']), py_cost=num(r['Cost (Comparison)']),
                        clk=num(r['Clicks']), py_clk=num(r['Clicks (Comparison)']))
                   for r in read_csv(ads_file('Biggest_changes')) if r['Ad Group Name'] or r['Campaign Name']]
ads['devices'] = [dict(dev=r['Device'], cost=num(r['Cost']), py_cost=num(r['Cost (Comparison)']),
                       clk=num(r['Clicks']), py_clk=num(r['Clicks (Comparison)']),
                       conv=num(r['Conversions']), py_conv=num(r['Conversions (Comparison)']))
                  for r in read_csv(ads_file('Devices'))]
ads['keywords'] = [dict(kw=r['Search Keyword'], match=r['Match type'], cost=num(r['Cost']), py_cost=num(r['Cost (Comparison)']),
                        clk=num(r['Clicks']), py_clk=num(r['Clicks (Comparison)']),
                        ctr=num(r['CTR']), py_ctr=num(r['CTR (Comparison)']))
                   for r in read_csv(ads_file('Search_keywords')) if (num(r['Clicks']) or 0) + (num(r['Clicks (Comparison)']) or 0) > 0]
ads['searches'] = [dict(q=r['Search'], cost=num(r['Cost']), clk=num(r['Clicks']), imp=num(r['Impressions']))
                   for r in read_csv(ads_file('Searches(Search'))]
ads['words'] = [dict(w=r['Word'], cost=num(r['Cost']), clk=num(r['Clicks']), imp=num(r['Impressions']),
                     top=r['Top Containing Queries'].strip('()'))
                for r in read_csv(ads_file('Searches(Word'))]
ads['age'] = [dict(k=r['Age Range'], imp=num(r['Impressions']), py_imp=num(r['Impressions (Comparison)']))
              for r in read_csv(ads_file('Demographics(Age_'))]
ads['gender'] = [dict(k=r['Gender'], imp=num(r['Impressions']), py_imp=num(r['Impressions (Comparison)']))
                 for r in read_csv(ads_file('Demographics(Gender_2'))]
ads['dayhour'] = [dict(day=r['Day'], hr=r['Start Hour'], imp=num(r['Impressions']), py_imp=num(r['Impressions (Comparison)']))
                  for r in read_csv(ads_file('Day_&_hour(Day_Hour'))]
ads['optscore'] = [dict(name=r['Campaign Name'], score=num(r['Optimization Score'])) for r in read_csv(ads_file('Optimization_score'))]

# ---------------- Search Console ----------------
import openpyxl
wb = openpyxl.load_workbook(os.path.join(RAW, 'gsc_performance_on_search.xlsx'), read_only=True, data_only=True)


def sheet(name):
    it = wb[name].iter_rows(values_only=True)
    next(it)
    return [r for r in it if r and r[0] is not None]


for d, c, i, ctr, pos in sheet('Chart'):
    x = DI.get(str(d)[:10])
    if x:
        x.update(sc_clk=c, sc_imp=i, sc_ctr=r2(ctr, 4), sc_pos=pos)
gsc = {k: [dict(k=r[0], clk=r[1], imp=r[2], ctr=r2(r[3], 4), pos=r2(r[4], 1)) for r in sheet(s)[:lim]]
       for k, s, lim in (('queries', 'Queries', 60), ('pages', 'Pages', 40), ('countries', 'Countries', 15),
                         ('devices', 'Devices', 5), ('appearance', 'Search appearance', 5))}

# ---------------- GA4 ----------------
def ga_rows(p):
    with open(p, newline='', encoding='utf-8-sig') as f:
        lines = [l for l in f if not l.startswith('#') and l.strip()]
    rd = list(csv.reader(lines))
    return rd[0], rd[1:]


h, rows = ga_rows(os.path.join(RAW, 'ga4', 'acquisition.csv'))
acq = {r[0]: dict(users=num(r[1]), newu=num(r[2]), retu=num(r[3]), eng=num(r[4]), ev=num(r[5]), ke=num(r[6]), ker=num(r[7]))
       for r in rows if r[0]}
h, rows = ga_rows(os.path.join(RAW, 'ga4', 'acquisition_revenue.csv'))
channels = []
for r in rows:
    if not r[0]:
        continue
    a = acq.get(r[0], {})
    channels.append(dict(ch=r[0], newu=num(r[1]), rev=num(r[2]), tx=num(r[3]), users=a.get('users'),
                         retu=a.get('retu'), ke=a.get('ke'), ker=a.get('ker'), eng=a.get('eng')))
channels.sort(key=lambda c: -(c['rev'] or 0))

h, rows = ga_rows(os.path.join(RAW, 'ga4', 'pages.csv'))
BRANDS = [('Air Jordan', 'Jordan'), ('Jordan', 'Jordan'), ('Nike', 'Nike'), ('ASICS', 'ASICS'), ('Asics', 'ASICS'),
          ('adidas', 'adidas'), ('Women\'s adidas', 'adidas'), ('New Balance', 'New Balance'), ('Salomon', 'Salomon'),
          ('On ', 'On'), ('On x', 'On'), ('Vans', 'Vans'), ("Arc'teryx", "Arc'teryx"), ('PUMA', 'Puma'), ('Puma', 'Puma'),
          ('Carhartt', 'Carhartt WIP'), ('Saucony', 'Saucony'), ('Oakley', 'Oakley'), ('Converse', 'Converse'),
          ('Reebok', 'Reebok'), ('Clarks', 'Clarks'), ('Birkenstock', 'Birkenstock'), ('HOKA', 'HOKA'), ('Hoka', 'HOKA'),
          ('Stussy', 'Stüssy'), ('Stüssy', 'Stüssy'), ('ANTA', 'ANTA'), ('Anta', 'ANTA'), ('Mizuno', 'Mizuno'),
          ('Livestock', 'Livestock'), ('Women\'s Nike', 'Nike'), ('Women\'s Jordan', 'Jordan'), ('Kids', None),
          ('Auralee', 'Auralee'), ('Norse Projects', 'Norse Projects'), ('Patta', 'Patta'), ('UGG', 'UGG'),
          ('Timberland', 'Timberland'), ('Merrell', 'Merrell'), ('Brain Dead', 'Brain Dead'), ('Sinclair', 'Sinclair'),
          ('Nike SB', 'Nike'), ('The North Face', 'The North Face'), ('LeBron', 'Nike'), ('Lebron', 'Nike'), ('The Arc', None)]


def brand_of(t):
    for p, b in sorted(BRANDS, key=lambda x: -len(x[0])):
        if t.startswith(p) and b:
            return b
    return t.split(' ')[0]


SUFFIX = ' – Livestock'
products, pages_all = [], []
for r in rows:
    t = r[0]
    if not t or not t.endswith(SUFFIX):
        continue
    v, u, ev, ke = num(r[1]), num(r[2]), num(r[4]), num(r[5])
    name = t[:-len(SUFFIX)]
    pages_all.append((name, v, u, ke))
    if ' / ' in name and not name.startswith('Search:'):
        products.append(dict(p=name, b=brand_of(name), v=v, u=u, ke=ke))
products.sort(key=lambda p: -p['v'])
brands = {}
for p in products:
    b = brands.setdefault(p['b'], dict(b=p['b'], n=0, v=0, u=0, ke=0))
    b['n'] += 1; b['v'] += p['v']; b['u'] += p['u']; b['ke'] += p['ke'] or 0
brands = sorted(brands.values(), key=lambda b: -b['v'])[:25]
# non-product pages of interest
keypages = [dict(p=n, v=v, u=u, ke=ke) for n, v, u, ke in pages_all
            if ' / ' not in n and not n.startswith('Search:')][:30]


def norm(s):
    s = s.lower().replace('air jordan', 'jordan').replace('"', '').replace('“', '').replace('”', '')
    s = s.replace('women\'s ', '').replace(' x ', ' ').replace('protro', 'protro')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


PIDX = [(set(norm(n).split()), dict(p=n, v=v, u=u, ke=ke)) for n, v, u, ke in pages_all if not n.startswith('Search:')]

# ---------------- Launches ----------------
launches, used = [], set()
with open(os.path.join(HERE, 'launches.csv'), newline='') as f:
    for r in csv.DictReader(f):
        key = norm(r['name'].rstrip('.').rstrip('-').strip())
        toks = key.split()
        cands = []
        for pt, p in PIDX:
            s = sum(1 for t in toks if t in pt) / max(len(toks), 1)
            if s >= 0.85 and p['p'] not in used:
                cands.append((s, p['v'], p))
        m = max(cands, key=lambda c: (c[0], c[1]))[2] if cands else None
        if m:
            used.add(m['p'])
        launches.append(dict(d=r['date'], name=r['name'], b=brand_of(r['name']),
                             match=m['p'] if m else None, v=m['v'] if m else None,
                             u=m['u'] if m else None, ke=m['ke'] if m else None))


# ---------------- Optional: Klaviyo campaigns + GA4 daily channel revenue ----------------
# Drop exports at raw/klaviyo_campaigns.csv and raw/ga4/channel_daily.csv and rebuild;
# the calendar day pop-up lists them. Column names are matched loosely.
def pick(row, *names):
    low = {k.strip().lower(): v for k, v in row.items() if k}
    for n in names:
        if n in low and str(low[n]).strip() != '':
            return low[n]
    return None


def to_date(v):
    from datetime import datetime
    if not v:
        return None
    v = str(v).strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d', '%Y%m%d',
                '%m/%d/%Y %H:%M', '%m/%d/%Y %I:%M %p', '%m/%d/%Y', '%b %d, %Y %I:%M %p', '%b %d, %Y'):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    m = re.match(r'(\d{4}-\d{2}-\d{2})', v)
    return m.group(1) if m else None


def rate(v):
    x = num(v)
    if x is None:
        return None
    return x / 100 if (isinstance(v, str) and '%' in v) or x > 1 else x


comms = []
kp = os.path.join(RAW, 'klaviyo_campaigns.csv')
if os.path.exists(kp):
    for r in read_csv(kp):
        d = to_date(pick(r, 'send time', 'send date', 'sent at', 'date', 'scheduled send time'))
        if not d or d not in DI:
            continue
        comms.append(dict(d=d, name=pick(r, 'campaign name', 'name', 'campaign') or '',
                          subj=pick(r, 'subject', 'subject line') or '',
                          seg=pick(r, 'list', 'lists', 'audience', 'included lists', 'segments') or '',
                          ch=pick(r, 'channel', 'campaign channel', 'message channel') or 'Email',
                          rcpt=num(pick(r, 'total recipients', 'recipients', 'delivered', 'successful deliveries')),
                          open=rate(pick(r, 'open rate', 'unique open rate')),
                          click=rate(pick(r, 'click rate', 'unique click rate')),
                          rev=num(pick(r, 'revenue', 'placed order value', 'conversion value', 'placed order revenue')),
                          ord=num(pick(r, 'placed order', 'unique placed order', 'orders', 'conversions')),
                          t=(pick(r, 'send time') or '')[11:16], clicks=num(pick(r, 'unique clicks')),
                          aos=num(pick(r, 'unique active on site')), unsub=num(pick(r, 'unsubscribes')),
                          ))
comms.sort(key=lambda c: (c['d'], c['t']))
chan_daily = {}
cp = os.path.join(RAW, 'ga4', 'channel_daily.csv')
if os.path.exists(cp):
    with open(cp, newline='', encoding='utf-8-sig') as f:
        lines = [l for l in f if not l.startswith('#') and l.strip()]
    for r in csv.DictReader(lines):
        d = to_date(pick(r, 'date'))
        ch = pick(r, 'session default channel group', 'session primary channel group (default channel group)',
                  'session primary channel group', 'default channel group', 'channel', 'first user primary channel group (default channel group)')
        if not d or d not in DI or not ch:
            continue
        chan_daily.setdefault(d, []).append(dict(ch=ch, rev=num(pick(r, 'total revenue', 'purchase revenue', 'revenue')),
                                                 sess=num(pick(r, 'sessions')), tx=num(pick(r, 'transactions', 'purchases')),
                                                 ke=num(pick(r, 'key events')), eng=num(pick(r, 'engaged sessions'))))

# ---------------- Calendar markers ----------------
events = [
    dict(d='2025-10-13', n='Thanksgiving (CA)', k='hol'),
    dict(d='2025-10-31', n='Halloween', k='hol'),
    dict(d='2025-11-13', n='Early Black Friday sale (50% off)', k='bf', src='Klaviyo'),
    dict(d='2025-11-25', n='Black Friday sale, up to 70% off', k='bf', src='Klaviyo'),
    dict(d='2025-11-27', n='US Thanksgiving', k='mkt'),
    dict(d='2025-11-28', n='Black Friday', k='bf'),
    dict(d='2025-12-01', n='Cyber Monday', k='bf'),
    dict(d='2025-12-02', n='BF sale last chance (ends in 24h)', k='bf', src='Klaviyo'),
    dict(d='2025-12-24', n='Boxing Week sale live', k='box', src='Klaviyo'),
    dict(d='2025-12-24', n='Christmas Eve', k='hol'),
    dict(d='2025-12-25', n='Christmas Day', k='hol'),
    dict(d='2025-12-26', n='Boxing Day', k='box'),
    dict(d='2025-12-31', n="New Year's Eve", k='hol'),
]
periods = [
    dict(n='October build', s='2025-10-01', e='2025-10-31', k='bau'),
    dict(n='Early November', s='2025-11-01', e='2025-11-20', k='bau'),
    dict(n='BFCM run', s='2025-11-21', e='2025-12-01', k='bf'),
    dict(n='Holiday gifting', s='2025-12-02', e='2025-12-23', k='gift'),
    dict(n='Christmas & Boxing Week', s='2025-12-24', e='2025-12-31', k='box'),
]
# Shopify channel performance (whole quarter, last click by referring platform)
shop_ch = []
sp = os.path.join(RAW, 'shopify_channel_performance.csv')
if os.path.exists(sp):
    for r in read_csv(sp):
        shop_ch.append(dict(plat=r['Referring platform'], ch=r['Channel'], type=r['Type'], sess=num(r['Sessions']) or 0,
                            sales=num(r['Sales']) or 0, ord=num(r['Orders']) or 0,
                            newo=num(r['Orders from new customers']) or 0, reto=num(r['Orders from returning customers']) or 0))

# Markdown windows inferred from Klaviyo send dates and subject lines (no promo calendar was supplied)
sales = [
    dict(n='Black Friday sale', s='2025-11-13', e='2025-12-03', k='bf',
         src='Klaviyo: "Early Black Friday is live" (13 Nov, 50% off), "NOW Up to 70% OFF" (25 Nov), "ENDING in 24 hours" (2 Dec)'),
    dict(n='Boxing Week sale', s='2025-12-24', e='2025-12-31', k='box',
         src='Klaviyo: "Boxing Week is Here!" (24 Dec), "Boxing Week Continues!" (29 Dec). End date not stated; runs to the end of the data'),
]

out = dict(shop_ch=shop_ch, sales=sales, comms=comms, chan_daily=chan_daily, daily=daily, ads=ads, gsc=gsc, channels=channels, products=products[:300], brands=brands,
           keypages=keypages, launches=launches, events=events, periods=periods,
           ga_total=dict(rev=1574189.30, tx=8000, users=360925, newu=366398, views=2366985))
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
print('comms', len(comms), 'chan_daily days', len(chan_daily), 'daily', len(daily), 'launches', len(launches), 'matched', sum(1 for l in launches if l['match']),
      'products', len(products), 'bytes', os.path.getsize(OUT))
