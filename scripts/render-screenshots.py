# Phase 1g: render 8 chat-app screenshots (640x1280) for the library.
# Rendered with PIL for this prototype; labeled synthetic in the manifest.
from PIL import Image, ImageDraw, ImageFont
import os

OUT = '/home/z/my-project/app/public/photos-v2'
os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def font(sz, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, sz)

GREEN = (220, 248, 198)   # outgoing bubble
WHITE = (255, 255, 255)   # incoming bubble
BG = (240, 238, 233)
HEADER = (7, 94, 84)
TXT = (30, 30, 30)
SUB = (120, 120, 120)

def new_screen(title, subtitle):
    im = Image.new('RGB', (640, 1280), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 640, 110], fill=HEADER)
    d.ellipse([16, 20, 88, 92], fill=(200, 200, 200))
    d.text((100, 30), title, font=font(30, True), fill=(255, 255, 255))
    d.text((100, 68), subtitle, font=font(22), fill=(210, 230, 225))
    return im, d

def bubble(d, y, text, outgoing, w=None, pad=14):
    f = font(24)
    lines = []
    for raw in text.split('\n'):
        line = ''
        for word in raw.split(' '):
            trial = (line + ' ' + word).strip()
            if d.textlength(trial, font=f) > 480:
                lines.append(line); line = word
            else:
                line = trial
        lines.append(line)
    if w is None:
        w = int(max(d.textlength(l, font=f) for l in lines)) + pad * 2
    h = len(lines) * 34 + pad * 2 - 8
    x0 = 640 - 16 - w if outgoing else 16
    d.rounded_rectangle([x0, y, x0 + w, y + h], radius=14, fill=GREEN if outgoing else WHITE)
    ty = y + pad - 4
    for l in lines:
        d.text((x0 + pad, ty), l, font=f, fill=TXT)
        ty += 34
    return y + h + 16

def photo_placeholder(d, y, label, h=300):
    d.rounded_rectangle([140, y, 500, y + h], radius=10, fill=(210, 208, 200))
    d.text((160, y + h // 2 - 14), label, font=font(22), fill=(110, 110, 110))
    return y + h + 16

def save(im, name):
    im.save(os.path.join(OUT, name), 'PNG')
    print(name, 'ok')

# 1. Exam meme forward (Jun 2025)
im, d = new_screen('Rahul + 3 others', 'forwarded many times')
y = 140
y = bubble(d, y, 'bro look at this, our entire prep mood', outgoing=False)
y = photo_placeholder(d, y, 'meme image: book vs panic', 260)
y = bubble(d, y, 'sent it in the class group too', outgoing=False)
y = bubble(d, y, 'this is literally me tomorrow', outgoing=True)
save(im, 'SS_20250620_2214_1.png')

# 2. Train ticket confirmation (Jan 2026)
im, d = new_screen('Indian Railways booking', 'official account')
y = 140
y = bubble(d, y, 'PNR 4472198305 confirmed', outgoing=False, w=560)
y = bubble(d, y, 'Train 12657 Bengaluru to Mangaluru\nSat, 17 Jan 2026\nCoach S4, Seat 42, 43\nDep 21:15, Arr 06:40', outgoing=False, w=560)
y = bubble(d, y, 'ticket confirmed for the weekend trip', outgoing=False)
y = bubble(d, y, 'got it, saving this', outgoing=True)
save(im, 'SS_20260117_0912_2.png')

# 3. Wedding invite card (Nov 2024)
im, d = new_screen('Family group', '12 members')
y = 140
y = bubble(d, y, 'the printed card came out so pretty', outgoing=False)
y = photo_placeholder(d, y, 'invite card: Anjali weds Arjun, 14 Dec, Goa', 340)
y = bubble(d, y, 'save the date everyone', outgoing=False)
y = bubble(d, y, 'counting down the days', outgoing=True)
save(im, 'SS_20241128_1830_3.png')

# 4. Whiteboard notes shared (Sep 2025)
im, d = new_screen('Study group CSE', 'group')
y = 140
y = bubble(d, y, 'sharing today\'s board before it gets erased', outgoing=False)
y = photo_placeholder(d, y, 'photo of whiteboard with formulas', 320)
y = bubble(d, y, 'lifesaver, thanks', outgoing=True)
y = bubble(d, y, 'exam syllabus ends at page 4', outgoing=False)
save(im, 'SS_20250908_1426_4.png')

# 5. Friend status: dog photo (Mar 2026)
im, d = new_screen('Status - Priya', 'status update')
y = 140
y = photo_placeholder(d, y, 'status photo: golden dog on the grass', 420)
y = bubble(d, y, 'posted 3h ago', outgoing=False, w=300)
y = bubble(d, y, 'viewed', outgoing=False, w=200)
save(im, 'SS_20260307_2001_5.png')

# 6. Concert e-ticket (Aug 2025)
im, d = new_screen('BookMyShow', 'your e-ticket')
y = 140
y = bubble(d, y, 'Sunburn Arena, Mumbai\nSat 23 Aug 2025, 7:00 PM\nGate 3, Row C, Seat 18\nGeneral standing', outgoing=False, w=560)
y = bubble(d, y, 'show this at the gate', outgoing=False, w=380)
y = bubble(d, y, 'doors open at 6, reach early', outgoing=True)
save(im, 'SS_20250823_1200_6.png')

# 7. Recipe forward (Feb 2026)
im, d = new_screen('Mom', 'online')
y = 140
y = bubble(d, y, 'making paneer butter masala tonight, sending you the recipe', outgoing=False)
y = bubble(d, y, '1. fry onions and tomatoes\n2. add paneer cubes\n3. two spoons of butter, cream at the end\n4. simmer 10 minutes', outgoing=False, w=540)
y = bubble(d, y, 'send photos when it is done', outgoing=False)
y = bubble(d, y, 'will do', outgoing=True)
save(im, 'SS_20260219_2010_7.png')

# 8. Trek planning checklist (Oct 2025)
im, d = new_screen('Trek squad', '6 members')
y = 140
y = bubble(d, y, 'Kedarkantha packing list', outgoing=True)
y = bubble(d, y, '- layers, it goes below zero\n- headlamp\n- water bottle\n- snacks\n- power bank', outgoing=True, w=500)
y = bubble(d, y, 'pickup 5 am from the hostel gate on the 17th', outgoing=False)
y = bubble(d, y, 'summit push is on day 3 morning', outgoing=False)
y = bubble(d, y, 'so excited', outgoing=True)
save(im, 'SS_20251016_2130_8.png')
