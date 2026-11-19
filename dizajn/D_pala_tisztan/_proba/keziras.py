"""Kézírásszerű SVG-vonalak a nyugta-rajzhoz (saját rajz, nem betűtípus)."""
import random
random.seed(7)
D = {'0':'M3,0 C0,0 0,10 3,10 C6,10 6,0 3,0','1':'M1,2.2 L3.6,0 L3.4,10','2':'M0.5,2.6 C1,-0.2 5.6,-0.6 5.5,2.8 C5.4,5 2,7.4 0.3,10 L6,9.8',
 '3':'M0.6,1.2 C2,-0.6 5.6,0 5.1,2.6 C4.8,4.2 3.2,4.8 2.1,4.8 C4.2,4.8 6.1,6.1 5.6,8.1 C5,10.6 1.6,10.5 0.3,9','6':'M5.2,0.4 C2,0 0.4,4 0.5,7 C0.6,9.6 2,10 3.1,10 C5,10 5.8,8.5 5.6,7 C5.4,5.5 4,4.8 3,4.9 C1.5,5 0.6,6.1 0.5,7',
 '.':'M0.8,9.4 L1.1,10','-':'M0,6 L4,6',',':'M1,9 L0.4,11.6',' ':''}
W = {'0':7.2,'1':5.5,'2':7.4,'3':7.2,'6':7.2,'.':3.2,'-':6,',':4,' ':4.5}
import re
def tr(path, ox, oy, s, sl=0.2):
    nums = re.findall(r'[A-Z]|-?\d*\.?\d+', path); out=[]; i=0
    while i < len(nums):
        t = nums[i]
        if t.isalpha(): out.append(t); i+=1; continue
        x=float(nums[i]); y=float(nums[i+1]); i+=2
        X = ox + (x + (10-y)*sl)*s; Y = oy + y*s
        out.append(f"{X:.1f},{Y:.1f}")
    return ' '.join(out)
def szamok(text, x, y, s):
    d=[]
    for ch in text:
        if D[ch]: d.append(tr(D[ch], x, y, s))
        x += W[ch]*s
    return ' '.join(d), x
def kurziv(x, base, h, betuk):
    d=[f"M{x:.1f},{base:.1f}"]; pont=[]
    for b in betuk:
        j=random.uniform(-.4,.4)
        if b=='n': d.append(f"C{x+.6:.1f},{base-h*1.25:.1f} {x+4.4:.1f},{base-h*1.25:.1f} {x+5:.1f},{base+j:.1f}"); x+=5
        elif b=='m': d.append(f"C{x+.5:.1f},{base-h*1.2:.1f} {x+3.5:.1f},{base-h*1.2:.1f} {x+4:.1f},{base:.1f} C{x+4.5:.1f},{base-h*1.2:.1f} {x+7.5:.1f},{base-h*1.2:.1f} {x+8:.1f},{base+j:.1f}"); x+=8
        elif b=='e': d.append(f"C{x+3:.1f},{base-1.5:.1f} {x+4.5:.1f},{base-h:.1f} {x+2.8:.1f},{base-h:.1f} C{x+1:.1f},{base-h:.1f} {x+.8:.1f},{base+.4:.1f} {x+5:.1f},{base+j:.1f}"); x+=5
        elif b=='l': d.append(f"C{x+3:.1f},{base-3:.1f} {x+4.4:.1f},{base-h*2.3:.1f} {x+2.8:.1f},{base-h*2.3:.1f} C{x+1.2:.1f},{base-h*2.3:.1f} {x+1.6:.1f},{base:.1f} {x+4.5:.1f},{base+j:.1f}"); x+=4.5
        elif b=='i': d.append(f"C{x+1:.1f},{base-h*.6:.1f} {x+2:.1f},{base-h:.1f} {x+2.2:.1f},{base-h:.1f} L{x+2:.1f},{base-1:.1f} C{x+2.2:.1f},{base+.3:.1f} {x+3:.1f},{base:.1f} {x+4:.1f},{base-.6:.1f}"); pont.append((x+2.6,base-h-3.5)); x+=4
        elif b=='z': d.append(f"C{x+1:.1f},{base-h:.1f} {x+4:.1f},{base-h*1.1:.1f} {x+4.5:.1f},{base-h:.1f} L{x+1:.1f},{base:.1f} C{x+3:.1f},{base-1:.1f} {x+5:.1f},{base+.5:.1f} {x+6:.1f},{base-.5+j:.1f}"); x+=6
        elif b=='r': d.append(f"C{x+1:.1f},{base-h*.8:.1f} {x+1.5:.1f},{base-h:.1f} {x+2:.1f},{base-h:.1f} C{x+2.5:.1f},{base-h*.6:.1f} {x+4:.1f},{base-h*1.1:.1f} {x+5:.1f},{base-h*.8:.1f}"); x+=5
        elif b=='k': d.append(f"C{x+3:.1f},{base-3:.1f} {x+4.4:.1f},{base-h*2.3:.1f} {x+2.8:.1f},{base-h*2.3:.1f} C{x+1.2:.1f},{base-h*2.3:.1f} {x+1.6:.1f},{base:.1f} {x+2:.1f},{base:.1f} C{x+3:.1f},{base-h:.1f} {x+6:.1f},{base-h:.1f} {x+4:.1f},{base-h*.4:.1f} L{x+6.5:.1f},{base:.1f}"); x+=6.5
        elif b=='t': d.append(f"C{x+2:.1f},{base-h*1.6:.1f} {x+2.5:.1f},{base-h*2:.1f} {x+2.6:.1f},{base-h*2:.1f} L{x+2.4:.1f},{base-.5:.1f} C{x+2.6:.1f},{base+.3:.1f} {x+3.6:.1f},{base:.1f} {x+4.6:.1f},{base-.6:.1f}"); pont.append(('t',x+.6,x+5,base-h*1.2)); x+=4.6
    s=' '.join(d)
    for p in pont:
        if p[0]=='t': s+=f" M{p[1]:.1f},{p[3]:.1f} L{p[2]:.1f},{p[3]-.4:.1f}"
        else: s+=f" M{p[0]:.1f},{p[1]:.1f} l.4,-.6"
    return s
kelt,_ = szamok('2026.10.03.', 52, 51, 1.05)
osszeg,_ = szamok('12 000,-', 228, 91, 1.45)
azaz = kurziv(54, 146, 5.5, 'tizenketezer')
print('KELT', kelt); print('OSSZEG', osszeg); print('AZAZ', azaz)
import pathlib
p = pathlib.Path('05_tetel.html'); s = p.read_text(encoding='utf-8')
s = re.sub(r'(<!-- Kelt -->.*?<path d="M44 64h130"[^>]*/>\s*<path d=")[^"]*(")', lambda m: m.group(1)+kelt+m.group(2), s, flags=re.S)
s = re.sub(r'(<path d="M222 108h96"[^>]*/>\s*<path d=")[^"]*(")', lambda m: m.group(1)+osszeg+m.group(2), s, flags=re.S)
s = re.sub(r'(<path d="M46 150h270"[^>]*/>\s*<path d=")[^"]*(")', lambda m: m.group(1)+azaz+m.group(2), s, flags=re.S)
p.write_text(s, encoding='utf-8')
