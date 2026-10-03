# Review sheets for eval query writing: 2-col, 300px thumbs with id labels.
from PIL import Image, ImageDraw, ImageFont
import os, json

APP = '/home/z/my-project/app'
OUT = f'{APP}/eval/sheets'
os.makedirs(OUT, exist_ok=True)
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)

splits = json.load(open(f'{APP}/eval/splits.json'))
manifest = json.load(open(f'{APP}/data/library-manifest.json'))
byid = {i['id']: i for i in manifest['items']}

groups = {
  'targets-a': splits['queryTargets'][:9],
  'targets-b': splits['queryTargets'][9:18],
  'targets-c': splits['queryTargets'][18:],
  'absent': splits['absentTargets'],
  'ghosts': splits['ghosts'],
}

COLS, TH_W, TH_H, LABEL_H = 3, 320, 240, 22
for gname, ids in groups.items():
    rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS*TH_W, rows*(TH_H+LABEL_H)), (24,24,24))
    d = ImageDraw.Draw(sheet)
    for i, pid in enumerate(ids):
        item = byid[pid]
        path = os.path.join(APP, 'public/photos-v2', item['file'])
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert('RGB')
        im.thumbnail((TH_W, TH_H))
        x, y = (i % COLS)*TH_W, (i // COLS)*(TH_H+LABEL_H)
        sheet.paste(im, (x + (TH_W-im.width)//2, y + (TH_H-im.height)//2))
        d.text((x+4, y+TH_H+3), f'{i}: {pid[:26]}', font=FONT, fill=(255,255,80))
    sheet.save(os.path.join(OUT, f'q-{gname}.png'))
    print(gname, len(ids))
