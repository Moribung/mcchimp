import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from palette import *
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

W, H = 24, 40

def new_img():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x+w-1, y+h-1], fill=c)

def draw_ref_base(img, d):
    # Hair
    rect(d, 9, 2, 6, 2, HAIR)
    # Head
    rect(d, 9, 4, 6, 6, SKIN)
    img.putpixel((11, 6), EYE)
    img.putpixel((13, 6), EYE)
    # Shirt (torso)
    rect(d, 8, 10, 8, 7, REF_SHIRT)
    # Pants
    rect(d, 8, 17, 8, 4, REF_PANTS)
    # Legs
    rect(d, 9, 21, 3, 6, REF_PANTS)
    rect(d, 13, 21, 3, 6, REF_PANTS)
    # Feet
    rect(d, 9, 27, 3, 1, OUTLINE)
    rect(d, 13, 27, 3, 1, OUTLINE)

def gen_ref_neutral():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_ref_base(img, d)
    # Arms at sides
    rect(d, 5, 10, 3, 7, SKIN)
    rect(d, 16, 10, 3, 7, SKIN)
    img.save(os.path.join(OUT, 'ref_neutral.png'))
    print('  ref_neutral.png')

def gen_ref_raise():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_ref_base(img, d)
    # Right arm at side
    rect(d, 16, 10, 3, 7, SKIN)
    # Left arm raised above head
    rect(d, 5, 2, 3, 8, SKIN)
    img.save(os.path.join(OUT, 'ref_raise.png'))
    print('  ref_raise.png')

print('Generating referee sprites...')
gen_ref_neutral()
gen_ref_raise()
print('Done.')
