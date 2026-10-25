import base64
b64=lambda p: base64.b64encode(open(p,'rb').read()).decode()
fm='node_modules/@fontsource-variable/mona-sans/files/'
fk='node_modules/@fontsource/kapakana/files/'
lat="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
fonts=f"""@font-face{{font-family:'Mona Sans';font-style:normal;font-display:swap;font-weight:200 900;font-stretch:75% 125%;src:url(data:font/woff2;base64,{b64(fm+'mona-sans-latin-standard-normal.woff2')}) format('woff2');unicode-range:{lat}}}
@font-face{{font-family:'Kapakana';font-style:normal;font-display:swap;font-weight:300;src:url(data:font/woff2;base64,{b64(fk+'kapakana-latin-300-normal.woff2')}) format('woff2')}}"""
s=open('page.src.html').read()
s=s.replace('/*__FONTS__*/',fonts)
for i in (1,2,3,4,5): s=s.replace(f'__IMG{i}__','data:image/jpeg;base64,'+b64(f'assets/venue{i}.jpg'))
s=s.replace('__COUPLE1__','data:image/jpeg;base64,'+b64('assets/couple1.jpg')).replace('__COUPLE2__','data:image/jpeg;base64,'+b64('assets/couple2.jpg'))
s=s.replace('/*__DISCO__*/',open('disco.js').read())
import os; os.makedirs('dist',exist_ok=True)
open('dist/kaerlighedsfest.html','w').write(s)
open('test.html','w').write('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+s+'</body></html>')
print(len(s)//1024,'KB')
