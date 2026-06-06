import sys, os, random
sys.path.insert(0, os.path.dirname(__file__))
from palette import *
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

W, H = 96, 48
CEIL   = ( 9, 10, 17, 255)
CROWD_BG = (12, 14, 22, 255)
RAIL   = (25, 28, 42, 255)
WALL   = (18, 21, 33, 255)
MAT    = (23, 31, 55, 255)
MAT_L  = (30, 40, 68, 255)
CROWDS = [CROWD_1, CROWD_2, CROWD_3, CROWD_4, CROWD_5]

def make_bg(n_dots, filename, seed=42):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    # ceiling
    d.rectangle([0, 0, W-1, 2], fill=CEIL)
    # crowd zone
    d.rectangle([0, 3, W-1, 28], fill=CROWD_BG)
    # crowd dots
    rng = random.Random(seed)
    for _ in range(n_dots):
        x = rng.randint(0, W-1)
        y = rng.randint(3, 27)
        c = rng.choice(CROWDS)
        img.putpixel((x, y), c)
    # rail
    d.rectangle([0, 29, W-1, 29], fill=RAIL)
    # lower wall
    d.rectangle([0, 30, W-1, 35], fill=WALL)
    # mat floor
    d.rectangle([0, 36, W-1, 47], fill=MAT)
    # mat highlight line
    d.rectangle([0, 36, W-1, 36], fill=MAT_L)
    img.save(os.path.join(OUT, filename))
    print(f'  {filename}')

print('Generating backgrounds...')
make_bg(0,   'bg_empty.png')
make_bg(60,  'bg_crowd_medium.png')
make_bg(160, 'bg_crowd_packed.png')
print('Done.')
