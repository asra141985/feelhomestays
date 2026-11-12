#!/usr/bin/env python3
"""Builds index.html (English) and /<lang>/index.html for every language,
plus sitemap.xml. Run from the repo root:  python3 site-src/build.py
Edit texts in site-src/i18n/*.json and the layout in site-src/home.template.html."""
import json, html, re, glob, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'site-src')
SITE = 'https://feelhomestays.com'
LANGS = [  # code, native name, og locale
 ('en','English','en_GB'),('de','Deutsch','de_DE'),('fr','Français','fr_FR'),('es','Español','es_ES'),
 ('it','Italiano','it_IT'),('pt','Português','pt_BR'),('nl','Nederlands','nl_NL'),('pl','Polski','pl_PL'),
 ('ru','Русский','ru_RU'),('uk','Українська','uk_UA'),('tr','Türkçe','tr_TR'),('ar','العربية','ar_AR'),
 ('he','עברית','he_IL'),('fa','فارسی','fa_IR'),('hi','हिन्दी','hi_IN'),('bn','বাংলা','bn_IN'),
 ('ur','اردو','ur_PK'),('pa','ਪੰਜਾਬੀ','pa_IN'),('ta','தமிழ்','ta_IN'),('te','తెలుగు','te_IN'),
 ('mr','मराठी','mr_IN'),('gu','ગુજરાતી','gu_IN'),('kn','ಕನ್ನಡ','kn_IN'),('ml','മലയാളം','ml_IN'),
 ('zh','简体中文','zh_CN'),('zh-TW','繁體中文','zh_TW'),('ja','日本語','ja_JP'),('ko','한국어','ko_KR'),
 ('vi','Tiếng Việt','vi_VN'),('th','ไทย','th_TH'),('id','Bahasa Indonesia','id_ID'),('ms','Bahasa Melayu','ms_MY'),
 ('fil','Filipino','tl_PH'),('sv','Svenska','sv_SE'),('da','Dansk','da_DK'),('nb','Norsk','nb_NO'),
 ('fi','Suomi','fi_FI'),('cs','Čeština','cs_CZ'),('sk','Slovenčina','sk_SK'),('hu','Magyar','hu_HU'),
 ('ro','Română','ro_RO'),('bg','Български','bg_BG'),('el','Ελληνικά','el_GR'),('hr','Hrvatski','hr_HR'),
 ('sr','Српски','sr_RS'),('sl','Slovenščina','sl_SI'),('lt','Lietuvių','lt_LT'),('lv','Latviešu','lv_LV'),
 ('et','Eesti','et_EE'),('sw','Kiswahili','sw_KE'),
]
RTL = {'ar','he','fa','ur'}
HREFLANG = {'zh':'zh-Hans','zh-TW':'zh-Hant'}
def url(code): return SITE + ('/' if code=='en' else f'/{code}/')
def path(code): return '/' if code=='en' else f'/{code}/'

en = json.load(open(os.path.join(SRC,'i18n','en.json'), encoding='utf-8'))
tr = {'en': en}
for f in sorted(glob.glob(os.path.join(SRC,'i18n','batch*.json'))):
    tr.update(json.load(open(f, encoding='utf-8')))
tpl = open(os.path.join(SRC,'home.template.html'), encoding='utf-8').read()
hreflang = '\n'.join(f'<link rel="alternate" hreflang="{HREFLANG.get(c,c)}" href="{url(c)}">' for c,_,_ in LANGS)
hreflang += f'\n<link rel="alternate" hreflang="x-default" href="{url("en")}">'
problems = []
for code, name, og in LANGS:
    if code not in tr: problems.append(f'missing language {code}'); continue
    s = dict(en); s.update(tr[code])
    for k in en:
        if code!='en' and k not in tr[code] and k not in ('c1_name',): problems.append(f'{code}: missing {k}')
        for ph in re.findall(r'\{n\}', en[k]):
            if '{n}' not in s[k]: problems.append(f'{code}: {k} lost {{n}}')
    for n in (22,14,6): s[f'more{n}'] = s['more'].replace('{n}',str(n))
    for n in (8,2,9): s[f'reviews{n}'] = s['reviews'].replace('{n}',str(n))
    for n in (1,3): s[f'walk{n}'] = s['walk'].replace('{n}',str(n))
    for n in (10,15,20,30): s[f'mins{n}'] = s['mins'].replace('{n}',str(n))
    menu = '\n'.join(f'          <li><a href="{path(c)}" hreflang="{HREFLANG.get(c,c)}" lang="{HREFLANG.get(c,c)}"{" aria-current=\"true\"" if c==code else ""}>{html.escape(n)}</a></li>' for c,n,_ in LANGS)
    out = tpl
    special = {'LANG':HREFLANG.get(code,code),'DIR':'rtl' if code in RTL else 'ltr','CANON':url(code),'HOME':path(code),
               'HREFLANG':hreflang,'OG_LOCALE':og,'LANG_NAME':html.escape(name),'LANGMENU':menu,
               'meta_desc_json':json.dumps(s['meta_desc'], ensure_ascii=False)}
    def rep(m):
        k = m.group(1)
        if k in special: return special[k]
        if k in s: return html.escape(s[k], quote=True)
        problems.append(f'{code}: unknown key {k}'); return ''
    out = re.sub(r'\{\{(\w+)\}\}', rep, out)
    dest = os.path.join(ROOT,'index.html') if code=='en' else os.path.join(ROOT,code,'index.html')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest,'w',encoding='utf-8').write(out)
today = datetime.date.today().isoformat()
sm = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for c,_,_ in LANGS: sm.append(f'  <url><loc>{url(c)}</loc><lastmod>{today}</lastmod></url>')
for p in ('book.html','impressum.html','datenschutz.html'): sm.append(f'  <url><loc>{SITE}/{p}</loc><lastmod>{today}</lastmod></url>')
sm.append('</urlset>')
open(os.path.join(ROOT,'sitemap.xml'),'w').write('\n'.join(sm)+'\n')
print(len(LANGS),'languages built;', len(problems),'problems'); print('\n'.join(problems[:40]))
