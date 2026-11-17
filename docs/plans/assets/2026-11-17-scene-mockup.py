# Throwaway mockup v2: three key frames of the redesigned "How it works" scene.
import sys
OUT = sys.argv[1]
NAVY, NAVY2, GOLD, GSOFT = '#0B2545', '#13315C', '#C9A227', '#F3E7B3'
WALLS = ['#F6EEDC', '#DDE8F0', '#E4EEDF', '#F7E1D3']
CURT = ['#E8B4A0', '#9DB8D2', '#B9CFA0', '#E3C27A']
ROOF, GLASS, LIT = '#A9472F', '#A9C4DA', '#FFD27A'
HX = [350, 470, 590, 710]          # house centres; factory 20..230, gap 60 to the terrace at 290
INK = '#2B2F36'
# worker looks: skin, shirt, trousers, hair style
LOOKS = [('#C68B59', '#3F7CAC', '#3B4250', 'short'), ('#8D5524', '#C8553D', '#4A3B30', 'scarf'),
         ('#E0AC69', '#6A994E', '#33415C', 'bun'), ('#A86B3C', '#8E6C8A', '#3B4250', 'short')]
DRIVER = ('#E3B48A', NAVY2, '#2B3440', 'cap')
QC = ('#7A4A2A', '#FFFFFF', '#3B4250', 'short')

def head(look, cy=-40):
    sk, sh, tr, hair = look
    h = f'<rect x="-2" y="{cy+5}" width="4" height="4" fill="{sk}"/><circle cx="0" cy="{cy}" r="6.2" fill="{sk}"/>'
    if hair == 'scarf':
        h += (f'<path d="M-7.2 {cy+1} a7.2 7.6 0 0 1 14.4 0 v4 q-1 5 -7.2 7 q-6.2 -2 -7.2 -7 Z" fill="#5E548E"/>'
              f'<ellipse cx="0" cy="{cy+0.6}" rx="5" ry="5.4" fill="{sk}"/>')
    elif hair == 'bun':
        h += f'<circle cx="0" cy="{cy-7}" r="3" fill="{INK}"/><path d="M-6.4 {cy-0.5} a6.4 6.6 0 0 1 12.8 0 q-6 -4.5 -12.8 0" fill="{INK}"/>'
    elif hair == 'cap':
        h += (f'<path d="M-6.6 {cy-1.5} a6.6 6.6 0 0 1 13.2 0 Z" fill="{GOLD}"/><rect x="-7.5" y="{cy-2.4}" width="15" height="2.2" rx="1" fill="{GOLD}"/>'
              f'<path d="M-5 {cy-1.2} q5 3.2 10 0 v1.6 q-5 2.2 -10 0 Z" fill="#A8861D"/>')
    else:
        h += f'<path d="M-6.4 {cy-0.5} a6.4 6.6 0 0 1 12.8 0 l-1.2 -0.6 q-5 -3.2 -10.4 0 Z" fill="{INK}"/>'
    h += (f'<circle cx="-2.2" cy="{cy+0.6}" r=".85" fill="{INK}"/><circle cx="2.2" cy="{cy+0.6}" r=".85" fill="{INK}"/>'
          f'<path d="M-1.8 {cy+3} q1.8 1.4 3.6 0" stroke="{INK}" stroke-width=".7" fill="none" stroke-linecap="round"/>')
    return h

def torso(look, collar=True):
    sk, sh, tr, hair = look
    t = f'<rect x="-7.5" y="-31" width="15" height="17" rx="4.5" fill="{sh}"/>'
    if collar:
        t += f'<path d="M-3 -31 L0 -27 L3 -31" stroke="{NAVY}" stroke-width=".7" fill="none" opacity=".45"/>'
    if hair == 'cap':
        t += f'<text x="0" y="-21" font-size="4" font-weight="800" fill="{GOLD}" text-anchor="middle" font-family="Manrope, sans-serif">KTRON</text>'
    if sh == '#FFFFFF':
        t += f'<rect x="-7.5" y="-31" width="15" height="17" rx="4.5" fill="none" stroke="#9AA5B1" stroke-width=".6"/><rect x="-.3" y="-27" width=".6" height="12" fill="#C9D3DD"/>'
    return t

def legs(look):
    sk, sh, tr, hair = look
    return (f'<rect x="-6" y="-16" width="5.2" height="15" rx="2" fill="{tr}"/><rect x=".8" y="-16" width="5.2" height="15" rx="2" fill="{tr}"/>'
            f'<ellipse cx="-3.6" cy="-.6" rx="3.6" ry="1.6" fill="{INK}"/><ellipse cx="3.6" cy="-.6" rx="3.6" ry="1.6" fill="{INK}"/>')

def person(x, y, look, pose='stand', s=1.35):
    sk, sh, tr, hair = look
    g = legs(look) + torso(look)
    if pose == 'carry':
        g += (f'<rect x="-10" y="-25" width="20" height="13" rx="1.6" fill="{GOLD}"/><rect x="-10" y="-20" width="20" height="2.4" fill="{NAVY}" opacity=".28"/>'
              f'<rect x="-11.5" y="-29" width="4" height="10" rx="2" fill="{sh}"/><rect x="7.5" y="-29" width="4" height="10" rx="2" fill="{sh}"/>'
              f'<circle cx="-9" cy="-18" r="2.2" fill="{sk}"/><circle cx="9" cy="-18" r="2.2" fill="{sk}"/>')
    elif pose == 'thumb':
        # left arm relaxed, right arm bent up: forearm vertical, fist with the thumb pointing up
        g += (f'<rect x="-11" y="-29" width="4" height="13" rx="2" fill="{sh}"/><circle cx="-9" cy="-15" r="2.2" fill="{sk}"/>'
              f'<path d="M7 -28 L12.5 -21" stroke="{sh}" stroke-width="4.2" stroke-linecap="round"/>'
              f'<path d="M12.5 -21 L12.5 -32" stroke="{sh}" stroke-width="4" stroke-linecap="round"/>'
              f'<rect x="9.6" y="-38.5" width="6.4" height="6" rx="2.2" fill="{sk}"/>'
              f'<path d="M10.2 -37.6 h5.2 M10.2 -35.9 h5.2" stroke="#8A5A36" stroke-width=".5"/>'
              f'<rect x="9.4" y="-44.5" width="2.6" height="7.4" rx="1.3" fill="{sk}"/>')
    else:
        g += (f'<rect x="-11" y="-29" width="4" height="13" rx="2" fill="{sh}"/><rect x="7" y="-29" width="4" height="13" rx="2" fill="{sh}"/>'
              f'<circle cx="-9" cy="-15" r="2.2" fill="{sk}"/><circle cx="9" cy="-15" r="2.2" fill="{sk}"/>')
    g += head(look)
    return g if s is None else f'<g transform="translate({x} {y}) scale({s})">{g}</g>'

def bust(x, y, look, s=1.0, tool='part'):
    """Seated at a table, seen through a window: torso and head, hands on the table."""
    sk, sh, tr, hair = look
    t = (f'<path d="M-9 -12 L-14 -3" stroke="{sh}" stroke-width="4" stroke-linecap="round"/><path d="M9 -12 L14 -3" stroke="{sh}" stroke-width="4" stroke-linecap="round"/>'
         f'<circle cx="-13" cy="-2" r="2.1" fill="{sk}"/><circle cx="13" cy="-2" r="2.1" fill="{sk}"/>')
    g = f'<g transform="translate(0 17)">{torso(look)}</g>' + t + head(look, cy=-23)
    return f'<g transform="translate({x} {y}) scale({s})">{g}</g>'

def sky(phase):
    stops = {'day': ['#CFE0EE', '#E9F0F4', '#F6F2E4'], 'sunset': ['#1E3A66', '#8A4F7D', '#E9875B', '#F7C873'],
             'night': ['#06172E', '#0B2545', '#1B3A63']}[phase]
    n = len(stops) - 1
    s = ''.join(f'<stop offset="{k / n:.2f}" stop-color="{c}"/>' for k, c in enumerate(stops))
    return f'<defs><linearGradient id="sky-{phase}" x1="0" y1="0" x2="0" y2="1">{s}</linearGradient></defs><rect width="1040" height="320" fill="url(#sky-{phase})"/>'

def palm(x, y, s=1, c='#4E7D57'):
    fr = ''.join(f'<path d="M{x} {y} q{dx*0.5} {-14*s} {dx} {dy}" stroke="{c}" stroke-width="{5*s}" fill="none" stroke-linecap="round"/>'
                 for dx, dy in [(-34*s, 6*s), (-26*s, -14*s), (-6*s, -24*s), (18*s, -20*s), (32*s, 2*s), (24*s, 14*s), (-20*s, 16*s)])
    return f'<path d="M{x-6} {y+90*s} q-6 {-50*s} 6 {-90*s}" stroke="#6E5A43" stroke-width="{6*s}" fill="none" stroke-linecap="round"/>{fr}'

def hills(c):
    return f'<path d="M0 262 Q120 212 260 246 T560 236 T860 232 T1040 244 V320 H0 Z" fill="{c}"/>'

def ground():
    dashes = ''.join(f'<rect x="{x}" y="333" width="26" height="3" fill="#F4F4F4"/>' for x in range(10, 1040, 52))
    return (f'<rect y="300" width="1040" height="18" fill="#8DB07F"/><rect y="316" width="1040" height="38" fill="#5B6672"/>{dashes}'
            f'<rect y="352" width="1040" height="7" fill="#C9D3DD"/><rect y="359" width="1040" height="41" fill="#9DBF8C"/>')

def window(L, i, lit, worker):
    x0, y0, w, h = L + 10, 230, 46, 36
    glass = LIT if lit else GLASS
    inside = ''
    if worker:
        inside = (f'<clipPath id="w{i}"><rect x="{x0+2}" y="{y0+2}" width="{w-4}" height="{h-4}"/></clipPath><g clip-path="url(#w{i})">'
                  + bust(x0 + w/2, y0 + 29, LOOKS[i], 0.9)
                  + f'<rect x="{x0}" y="{y0+27}" width="{w}" height="3" fill="#7A5A3A"/><rect x="{x0+w/2+3}" y="{y0+23}" width="9" height="4.5" rx=".8" fill="{GOLD}"/>'
                  f'<circle cx="{x0+w/2-6}" cy="{y0+26}" r="1.6" fill="#1F2933"/><circle cx="{x0+w/2-2}" cy="{y0+26.2}" r="1.4" fill="#1F2933"/></g>')
    curt = (f'<path d="M{x0+2} {y0+2} h9 q-3 12 -1 {h-6} h-8 Z" fill="{CURT[i]}"/>'
            f'<path d="M{x0+w-2} {y0+2} h-9 q3 12 1 {h-6} h8 Z" fill="{CURT[i]}"/>')
    glow = f'<rect x="{x0-4}" y="{y0-4}" width="{w+8}" height="{h+8}" fill="{LIT}" opacity=".35" filter="url(#blur)"/>' if lit else ''
    return (f'{glow}<rect x="{x0-2}" y="{y0-2}" width="{w+4}" height="{h+4}" fill="#FFFFFF"/><rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="{glass}"/>'
            f'{inside}{curt}<rect x="{x0-4}" y="{y0+h+1}" width="{w+8}" height="3" fill="#FFFFFF"/>')

def house(x, i, lit=False, door=False, worker=False):
    L = x - 60
    tiles = ''.join(f'<path d="M{L-4+k*8} 214 L{x} 178" stroke="#8A3A26" stroke-width=".8" opacity=".35"/>' for k in range(17))
    d = (f'<rect x="{x+4}" y="256" width="26" height="44" fill="#1F2933"/><rect x="{x+4}" y="256" width="7" height="44" fill="#7A5230"/>' if door
         else f'<rect x="{x+4}" y="256" width="26" height="44" fill="#7A5230"/><rect x="{x+8}" y="261" width="18" height="15" rx="1" fill="#6A4628"/><circle cx="{x+25}" cy="279" r="1.6" fill="{GOLD}"/>')
    return (f'<g><rect x="{L}" y="212" width="120" height="88" fill="{WALLS[i]}"/>'
            f'<path d="M{L-6} 216 L{x} 176 L{L+126} 216 Z" fill="{ROOF}"/>{tiles}<rect x="{L-6}" y="214" width="132" height="4" fill="#FFFFFF"/>'
            f'<path d="M{x-2} 250 H{x+38} L{x+42} 256 H{x-6} Z" fill="{NAVY2}"/>{window(L, i, lit, worker)}'
            f'{d}<rect x="{L+86}" y="284" width="16" height="16" rx="2" fill="#B5683F"/><circle cx="{L+90}" cy="280" r="7" fill="#5E8C61"/><circle cx="{L+98}" cy="278" r="8" fill="#6FA06F"/>'
            f'<rect x="{L}" y="292" width="120" height="8" fill="#FFFFFF" opacity=".55"/>'
            f'<text x="{L+66}" y="230" font-size="7" fill="{NAVY2}" opacity=".6" font-family="Manrope, sans-serif">{12 + i * 2}</text></g>')

def crate(x, y):
    return f'<rect x="{x}" y="{y}" width="20" height="13" rx="1.6" fill="{GOLD}"/><rect x="{x}" y="{y+5}" width="20" height="2.4" fill="{NAVY}" opacity=".28"/>'

def factory(door_open=True, smoke=True, stack=0):
    o = -20
    teeth = ''.join(f'<path d="M{40+o+70*k} 200 V168 L{110+o+70*k} 200 Z" fill="{NAVY2}"/><rect x="{40+o+70*k}" y="168" width="7" height="32" fill="{GLASS}"/>' for k in range(3))
    wins = ''.join(f'<rect x="{52+o+30*k}" y="234" width="22" height="18" fill="{GLASS}"/><rect x="{62+o+30*k}" y="234" width="1.5" height="18" fill="#FFFFFF"/>' for k in range(3))
    slats = ''.join(f'<rect x="{162+o}" y="{240+6*k}" width="68" height="1.2" fill="#9AA5B1"/>' for k in range(10))
    door = (f'<rect x="{160+o}" y="236" width="72" height="64" fill="#1F2933"/><rect x="{160+o}" y="236" width="72" height="14" fill="#C9D3DD"/>'
            if door_open else f'<rect x="{160+o}" y="236" width="72" height="64" fill="#C9D3DD"/>{slats}')
    crates = ''.join(crate(x, y) for x, y in [(132, 281), (154, 281), (143, 268)][:stack])
    puffs = ''.join(f'<circle cx="{cx+o}" cy="{cy}" r="{r}" fill="#FFFFFF" opacity="{op}"/>' for cx, cy, r, op in [(224, 128, 8, .8), (234, 110, 11, .6), (250, 90, 15, .4)]) if smoke else ''
    return (f'<g>{puffs}<rect x="{215+o}" y="136" width="16" height="66" fill="#9AA5B1"/><rect x="{215+o}" y="146" width="16" height="6" fill="{GOLD}"/>'
            f'{teeth}<rect x="{40+o}" y="200" width="210" height="100" fill="#E4E7EB"/><rect x="{40+o}" y="200" width="210" height="22" fill="{NAVY}"/>'
            f'<text x="{145+o}" y="216" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle" font-family="Manrope, sans-serif">Your factory</text>'
            f'{wins}{door}<rect x="{150+o}" y="294" width="94" height="8" fill="#9AA5B1"/>{crates}</g>')

def inspection(glow=True, tick=True, lit=False):
    I = 880
    g = f'<circle cx="{I}" cy="128" r="36" fill="{GSOFT}" opacity=".9" filter="url(#blur)"/>' if glow else ''
    t = (f'<circle cx="{I+40}" cy="104" r="11" fill="{GOLD}"/><path d="M{I+35} 104 l4 4 l7 -8" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>') if tick else ''
    room = (f'<clipPath id="qc"><rect x="826" y="228" width="72" height="44"/></clipPath><g clip-path="url(#qc)">'
            f'<rect x="826" y="228" width="72" height="44" fill="{LIT if lit else GLASS}"/>'
            + bust(850, 261, QC, 1.05)
            + f'<rect x="826" y="258" width="72" height="4" fill="#7A5A3A"/>'
            f'<rect x="866" y="254" width="14" height="4" rx="1" fill="{NAVY}"/><path d="M873 254 v-10" stroke="{NAVY}" stroke-width="2.6"/>'
            f'<path d="M869 242 l8 -6" stroke="{NAVY}" stroke-width="4" stroke-linecap="round"/><rect x="871" y="244" width="5" height="3" fill="#C9D3DD"/>'
            f'<path d="M856 248 L866 244" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round"/>'
            f'{crate(884, 245)}</g>'
            f'<rect x="824" y="226" width="76" height="48" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>')
    return (f'<g><rect x="815" y="206" width="130" height="94" fill="#FFFFFF"/><rect x="808" y="198" width="144" height="10" fill="{NAVY}"/>'
            f'<text x="880" y="222" font-size="8" font-weight="800" fill="{NAVY2}" text-anchor="middle" font-family="Manrope, sans-serif">QC 10x</text>'
            f'{room}<rect x="908" y="256" width="26" height="44" fill="{NAVY2}"/>'
            f'<rect x="{I-2}" y="150" width="4" height="48" fill="{NAVY2}"/>{g}'
            f'<circle cx="{I}" cy="128" r="18" fill="{NAVY2}" stroke="{GOLD}" stroke-width="6"/><path d="M{I+13} 141 L{I+26} 154" stroke="{GOLD}" stroke-width="7" stroke-linecap="round"/>{t}</g>')

def van(x, face=1, crates=4, lights=False):
    cr = ''.join(f'<rect x="{-36+k*16}" y="-66" width="14" height="12" rx="1.5" fill="{GOLD}"/><rect x="{-36+k*16}" y="-61" width="14" height="2" fill="{NAVY}" opacity=".3"/>' for k in range(crates))
    body = (f'<rect x="-40" y="-54" width="70" height="46" rx="5" fill="#FFFFFF"/><path d="M30 -42 H46 L58 -24 V-8 H30 Z" fill="#FFFFFF"/>'
            f'<path d="M34 -38 H45 L53 -25 H34 Z" fill="{NAVY2}"/><rect x="-40" y="-22" width="98" height="4" fill="{NAVY}"/><rect x="-40" y="-18" width="98" height="2" fill="{GOLD}"/>'
            f'<rect x="54" y="-16" width="5" height="4" rx="1" fill="#E4E7EB"/><rect x="-40" y="-56" width="70" height="3" rx="1.5" fill="#9AA5B1"/>'
            f'<circle cx="-22" cy="-6" r="9" fill="#1F2933"/><circle cx="-22" cy="-6" r="3.6" fill="#C9D3DD"/><circle cx="42" cy="-6" r="9" fill="#1F2933"/><circle cx="42" cy="-6" r="3.6" fill="#C9D3DD"/>')
    return (f'<g transform="translate({x} 344)"><ellipse cx="{10*face}" cy="2" rx="52" ry="4" fill="#000" opacity=".18"/><g transform="scale({face} 1)">{body}</g>{cr}'
            f'<text x="{-5*face}" y="-30" font-size="14" font-weight="800" fill="{NAVY}" text-anchor="middle" font-family="Manrope, sans-serif">KTRON</text></g>')

def stars():
    pts = [(40, 40), (130, 80), (220, 30), (310, 70), (420, 40), (520, 90), (610, 35), (700, 75), (790, 45), (880, 60), (1000, 30), (360, 110), (560, 140), (470, 20), (750, 120), (170, 130)]
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{1.2 + (k % 3) * .6}" fill="#FFFFFF" opacity="{.6 + (k % 2) * .4}"/>' for k, (x, y) in enumerate(pts))

def frame(cam, body):
    defs = '<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs>'
    return f'<svg viewBox="0 0 800 400" width="800" height="400" xmlns="http://www.w3.org/2000/svg">{defs}<g transform="translate({-cam} 0)">{body}</g></svg>'

def palms(c=None):
    return palm(415, 120, .9, c or '#4E7D57') + palm(652, 116, 1, c or '#4E7D57')

sunset = (sky('sunset') + '<circle cx="790" cy="262" r="30" fill="#FBD38D"/><circle cx="790" cy="262" r="48" fill="#FBD38D" opacity=".25"/>'
          + hills('#7B5C7A') + palms('#3E5E4A') + ground() + factory(True, True)
          + house(HX[0], 0, lit=True) + house(HX[1], 1, lit=True) + house(HX[2], 2, door=True, lit=True) + house(HX[3], 3) + inspection(False, False)
          + '<rect y="290" width="1040" height="110" fill="#E9875B" opacity=".12"/>'
          + person(HX[2] + 40, 313, LOOKS[2], 'carry') + van(HX[2] - 40, 1, 1))
moon = f'<circle cx="300" cy="70" r="22" fill="{GSOFT}"/><circle cx="311" cy="62" r="20" fill="#0B2545"/><circle cx="300" cy="70" r="40" fill="{GSOFT}" opacity=".12"/>'
night = (sky('night') + stars() + moon + hills('#132B4A') + palms('#0E2238') + ground() + factory(False, False)
         + ''.join(house(x, i) for i, x in enumerate(HX)) + inspection(False, False)
         + '<rect width="1040" height="400" fill="#06172E" opacity=".5"/>'
         + ''.join(f'<g>{window(x - 60, i, True, True)}</g>' for i, x in enumerate(HX)))
qc = (sky('day') + '<circle cx="560" cy="70" r="26" fill="#F7D774"/><circle cx="560" cy="70" r="42" fill="#F7D774" opacity=".25"/>' + hills('#B7C9B0')
      + palms() + ground() + factory(True, True) + ''.join(house(x, i) for i, x in enumerate(HX)) + inspection(True, True) + van(880, 1, 4))
# step 5: crates stacked at the dock; driver faces front, leaning on the van's nose, thumbs up
finish = (sky('day') + '<circle cx="660" cy="70" r="26" fill="#F7D774"/><circle cx="660" cy="70" r="42" fill="#F7D774" opacity=".25"/>' + hills('#B7C9B0')
          + palms() + ground() + factory(True, True, stack=3) + ''.join(house(x, i) for i, x in enumerate(HX)) + inspection(True, True)
          + van(330, -1, 0)
          + person(205, 316, DRIVER, 'carry', s=1.5))

svgs = [frame(240, sunset), frame(240, night), frame(240, qc), frame(0, finish)]
caps = ['Step 2 — sunset: a worker takes the crate in', 'Step 3 — night: work at home under the moon',
        'Step 4 — the inspector at the 10x microscope', 'Step 5 — the driver carries the last crate to the factory']
html = '<html><body style="margin:0;background:#FAFAF7;font-family:sans-serif">' + ''.join(
    f'<div style="padding:12px 16px 4px;font-weight:700;color:#0B2545">{c}</div><div style="padding:0 16px 8px">{s}</div>' for c, s in zip(caps, svgs)) + '</body></html>'
open(OUT, 'w').write(html)
