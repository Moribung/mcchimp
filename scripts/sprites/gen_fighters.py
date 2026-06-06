import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from palette import *
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

W, H = 32, 48
SHORTS = SHORTS_R  # default shorts colour

def new_img():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x+w-1, y+h-1], fill=c)

def draw_base_body(img, d, shorts_col=SHORTS):
    # Head (hair is a separate overlay sprite — see gen_hair.py)
    rect(d, 13, 7, 6, 6, SKIN)
    # Eyes
    img.putpixel((15, 9), EYE)
    img.putpixel((17, 9), EYE)
    # Torso
    rect(d, 11, 13, 10, 9, SKIN)
    # Shorts
    rect(d, 11, 22, 10, 5, shorts_col)
    # Legs
    rect(d, 12, 27, 3, 7, SKIN)
    rect(d, 17, 27, 3, 7, SKIN)
    # Feet
    rect(d, 12, 34, 3, 1, OUTLINE)
    rect(d, 17, 34, 3, 1, OUTLINE)

def draw_guard_gloves(img, d):
    # Arms up in guard
    rect(d, 8, 13, 3, 4, SKIN)
    rect(d, 21, 13, 3, 4, SKIN)
    # Gloves raised
    rect(d, 8, 9, 3, 4, GLOVE)
    rect(d, 21, 9, 3, 4, GLOVE)
    img.putpixel((8, 8), GLOVE_D)
    img.putpixel((10, 8), GLOVE_D)
    img.putpixel((21, 8), GLOVE_D)
    img.putpixel((23, 8), GLOVE_D)
    # Tape at wrists
    rect(d, 8, 13, 3, 1, TAPE)
    rect(d, 21, 13, 3, 1, TAPE)

def draw_arms_down(d):
    # Arms hanging at sides
    rect(d, 8, 13, 3, 8, SKIN)
    rect(d, 21, 13, 3, 8, SKIN)
    rect(d, 8, 21, 3, 3, GLOVE)
    rect(d, 21, 21, 3, 3, GLOVE)

def draw_right_arm_raised(img, d):
    # Right arm (left side of sprite since fighter faces left)
    rect(d, 8, 13, 3, 4, SKIN)
    # Raised right arm
    rect(d, 8, 5, 3, 8, SKIN)
    rect(d, 8, 3, 3, 3, GLOVE)
    img.putpixel((8, 2), GLOVE_H)
    img.putpixel((10, 2), GLOVE_H)
    # Left arm hanging
    rect(d, 21, 13, 3, 8, SKIN)
    rect(d, 21, 21, 3, 3, GLOVE)

def draw_both_arms_raised(img, d):
    # Both arms up
    rect(d, 8, 5, 3, 8, SKIN)
    rect(d, 8, 3, 3, 3, GLOVE)
    img.putpixel((8, 2), GLOVE_H)
    img.putpixel((10, 2), GLOVE_H)
    rect(d, 21, 5, 3, 8, SKIN)
    rect(d, 21, 3, 3, 3, GLOVE)
    img.putpixel((21, 2), GLOVE_H)
    img.putpixel((23, 2), GLOVE_H)

# fighter_side: bladed 3/4 fighting stance facing left, both gloves up in front
def gen_fighter_side():
    img = new_img()
    d = ImageDraw.Draw(img)
    # Head (3/4 view facing left; hair is a separate overlay sprite)
    rect(d, 13, 7, 6, 6, SKIN)
    # Face: two eyes pushed toward the facing direction (left)
    img.putpixel((14, 9), EYE)
    img.putpixel((16, 9), EYE)
    # Wide shoulders (bladed stance — broad across the top)
    rect(d, 11, 13, 10, 2, SKIN)    # shoulder line x=11-20
    # Back shoulder (rear deltoid) drops lower for a bladed look
    rect(d, 18, 13, 3, 4, SKIN)     # x=18-20, y=13-16
    # Torso
    rect(d, 12, 15, 8, 7, SKIN)
    # Shorts (wider to cover the spread stance)
    rect(d, 11, 22, 9, 5, SHORTS)
    # Legs — WIDE bladed stance: front foot forward (left), back foot planted (right)
    rect(d, 10, 27, 3, 7, SKIN)     # front leg
    rect(d, 18, 27, 3, 7, SKIN)     # back leg
    rect(d, 10, 34, 3, 1, OUTLINE)  # front foot
    rect(d, 18, 34, 3, 1, OUTLINE)  # back foot
    # Rear hand guards the chin, lead hand extends out front
    rect(d, 11, 12, 2, 2, SKIN)     # rear forearm up to the chin
    rect(d, 10, 10, 3, 3, GLOVE)    # chin glove just in front of the jaw (borders the face)
    img.putpixel((10, 10), GLOVE_H)
    rect(d, 9, 15, 3, 3, SKIN)      # lead forearm reaching out
    rect(d, 6, 14, 3, 3, GLOVE)     # lead glove out front
    img.putpixel((6, 14), GLOVE_H)
    img.save(os.path.join(OUT, 'fighter_side.png'))
    print('  fighter_side.png')

# fighter_forward: neutral forward-facing stance
def gen_fighter_forward():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_base_body(img, d)
    draw_arms_down(d)
    img.save(os.path.join(OUT, 'fighter_forward.png'))
    print('  fighter_forward.png')

# fighter_win_one: right arm raised
def gen_fighter_win_one():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_base_body(img, d)
    draw_right_arm_raised(img, d)
    img.save(os.path.join(OUT, 'fighter_win_one.png'))
    print('  fighter_win_one.png')

# fighter_win_both: both arms raised
def gen_fighter_win_both():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_base_body(img, d)
    draw_both_arms_raised(img, d)
    img.save(os.path.join(OUT, 'fighter_win_both.png'))
    print('  fighter_win_both.png')

# fighter_loss: arms hanging low, defeated posture
def gen_fighter_loss():
    img = new_img()
    d = ImageDraw.Draw(img)
    draw_base_body(img, d)
    # Slumped arms hanging low at the sides
    rect(d, 8, 13, 3, 10, SKIN)
    rect(d, 21, 13, 3, 10, SKIN)
    rect(d, 8, 23, 3, 3, GLOVE)
    rect(d, 21, 23, 3, 3, GLOVE)
    img.save(os.path.join(OUT, 'fighter_loss.png'))
    print('  fighter_loss.png')

print('Generating fighter sprites...')
gen_fighter_side()
gen_fighter_forward()
gen_fighter_win_one()
gen_fighter_win_both()
gen_fighter_loss()
print('Done.')
