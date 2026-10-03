# Contact sheet for the picsum everyday fillers.
from PIL import Image, ImageDraw
import os

RAW = '/home/z/my-project/app/library-raw/picsum'
OUT = '/home/z/my-project/app/library-raw/sheets'
os.makedirs(OUT, exist_ok=True)

picks = ['70','140','142','168','187','194','173','89','110',
         '203','88','99','165','157','183','146',
         '93','98','112','82','118','18','152','33',
         '30','113','63','20','24','4','40','200','169',
         '51','16','37','135','179','147','57','101',
         '22','175','91','73','65','49','74','214','52',
         '23','102','85','129','209','139']

COLS, TH_W, TH_H, LABEL_H = 7, 150, 112, 16
rows = (len(picks) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS*TH_W, rows*(TH_H+LABEL_H)), (24,24,24))
d = ImageDraw.Draw(sheet)
for i, pid in enumerate(picks):
    path = os.path.join(RAW, pid + '.jpg')
    if not os.path.exists(path):
        continue
    im = Image.open(path).convert('RGB')
    im.thumbnail((TH_W, TH_H))
    x, y = (i % COLS)*TH_W, (i // COLS)*(TH_H+LABEL_H)
    sheet.paste(im, (x + (TH_W-im.width)//2, y + (TH_H-im.height)//2))
    d.text((x+4, y+TH_H+1), f'{i}: p{pid}', fill=(255,255,80))
sheet.save(os.path.join(OUT, 'sheet-picsum.png'))
print('ok', len(picks))
