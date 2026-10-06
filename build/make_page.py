"""Inject data.json into template.html -> index.html. Usage: python3 build/make_page.py"""
import os
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(H)
t = open(os.path.join(H, 'template.html'), encoding='utf-8').read()
import base64
t = t.replace('__LOGO__', 'data:image/png;base64,' + base64.b64encode(open(os.path.join(R, 'assets', 'livestock-logo.png'), 'rb').read()).decode())
t = t.replace('/*__SCENARIOS__*/', open(os.path.join(H, 'scenarios.js'), encoding='utf-8').read())
d = open(os.path.join(R, 'data.json'), encoding='utf-8').read().replace('</', '<\\/')
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(t.replace('/*__DATA__*/null', d))
print('index.html', len(t) + len(d))
