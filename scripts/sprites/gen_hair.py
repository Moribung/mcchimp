import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

# Hair sprites are 32x48 transparent overlays drawn on top of a fighter sprite.
# They share the fighter geometry/anchor, so the compositor draws them at the
# same scene position as the fighter. The head occupies x=13-18, y=7-12.
W, H = 32, 48

HAIR_COLORS = {
    'black':  ( 30,  20,  10, 255),
    'brown':  ( 92,  58,  28, 255),
    'blonde': (206, 164,  78, 255),
    'ginger': (158,  66,  28, 255),
    'gray':   (150, 150, 156, 255),
}

def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x+w-1, y+h-1], fill=c)

# ── Styles ── each draws over the head (x=13-18, y=7-12) ──────────────
def s_buzz(d, c):
    rect(d, 13, 6, 6, 1, c)
    rect(d, 13, 7, 1, 1, c)   # temple framing
    rect(d, 18, 7, 1, 1, c)

def s_short(d, c):
    rect(d, 13, 5, 6, 2, c)
    rect(d, 12, 6, 1, 1, c)
    rect(d, 19, 6, 1, 1, c)

def s_spiky(d, c):
    rect(d, 13, 6, 6, 1, c)
    rect(d, 13, 4, 1, 2, c)
    rect(d, 15, 3, 1, 3, c)
    rect(d, 17, 4, 1, 2, c)

def s_mohawk(d, c):
    rect(d, 15, 2, 2, 5, c)   # tall central strip, shaved sides

def s_afro(d, c):
    rect(d, 12, 4, 8, 3, c)
    rect(d, 13, 3, 6, 1, c)   # rounded dome top
    rect(d, 11, 5, 1, 2, c)   # sides
    rect(d, 20, 5, 1, 2, c)

def s_long(d, c):
    rect(d, 13, 5, 6, 2, c)
    rect(d, 12, 6, 1, 1, c)
    rect(d, 19, 6, 1, 1, c)
    rect(d, 12, 7, 1, 5, c)   # falls down the left side past the ear
    rect(d, 19, 7, 1, 5, c)   # falls down the right side

STYLES = {
    'buzz':   s_buzz,
    'short':  s_short,
    'spiky':  s_spiky,
    'mohawk': s_mohawk,
    'afro':   s_afro,
    'long':   s_long,
}

print('Generating hair sprites...')
count = 0
for sname, sfn in STYLES.items():
    for cname, col in HAIR_COLORS.items():
        img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        sfn(d, col)
        img.save(os.path.join(OUT, f'hair_{sname}_{cname}.png'))
        count += 1
print(f'  {count} hair sprites ({len(STYLES)} styles x {len(HAIR_COLORS)} colors)')
print('Done.')
