# Phase 1d: build labeled contact sheets for visual verification.
from PIL import Image, ImageDraw
import os, sys

RAW = '/home/z/my-project/app/library-raw'
OUT = '/home/z/my-project/app/library-raw/sheets'
os.makedirs(OUT, exist_ok=True)

groups = {
  'wedding': ['1591604466107-ec97de577aff','1522673607200-164d1b6ce486','1520854221256-17451cc331bf','1529636798458-92182e662485','1469371670807-013ccf25f16a','1532712938310-34cb3982ef74','1519741497674-611481863552','1583939003579-730e3918a45a','1511285560929-80b456fea0bc','1522673607200'],
  'birthday': ['1602631985686-1bb0e6a8696e','1542826438-bd32f43d626f','1578985545062-69928b1d9587','1558636508-e0db3814bd1d','1530103862676-de8c9debad1d','1513151233558-d860c5398176','1481162854517-d9e353af153d','1467810563316-b5476525c0f9','1543807535-eceef0bc6599','1515169067868-5387ec356754'],
  'graduation': ['1627556704290-2b1f5853ff78','1594312915251-48db9280c8f1','1541339907198-e08756dedf3f','1523580494863-6f3031224c94','1481627834876-b7833e8f5570','1564981797816-1043664bf78d'],
  'concert-city': ['1470229722913-7c0e2dbbafd3','1493225457124-a3eb161ffa5f','1459749411175-04bf5292ceea','1501281668745-f7f57925c3b4','1524368535928-5b5e00ddc76b','1429962714451-bb934ecdc4ec','1516450360452-9312f5e86fc7','1470019693664-1d202d2c0907','1514565131-fce0801e5785','1519501025264-65ba15a82390'],
}

COLS, TH_W, TH_H, LABEL_H = 5, 220, 165, 18
for gname, ids in groups.items():
    ids = list(dict.fromkeys(ids))
    rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS*TH_W, rows*(TH_H+LABEL_H)), (24,24,24))
    d = ImageDraw.Draw(sheet)
    for i, pid in enumerate(ids):
        path = os.path.join(RAW, pid + '.jpg')
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert('RGB')
        im.thumbnail((TH_W, TH_H))
        x, y = (i % COLS)*TH_W, (i // COLS)*(TH_H+LABEL_H)
        sheet.paste(im, (x + (TH_W-im.width)//2, y + (TH_H-im.height)//2))
        d.text((x+4, y+TH_H+2), f'{i}: {pid[:13]}', fill=(255,255,80))
    sheet.save(os.path.join(OUT, f'sheet-{gname}.png'))
    print(gname, 'ok', len(ids))
