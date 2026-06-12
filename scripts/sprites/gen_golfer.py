"""
gen_golfer.py
─────────────
Render the procedural placeholder golfer (from src/lib/golf/golferSprites.js
`drawPlaceholder`) into flat, key-coloured, horizontal sprite-sheet strips —
one PNG per animation at static/sprites/golfer/golfer_<anim>.png.

Each sheet is (frames × 64) wide, 64 tall, RGBA, transparent background, frames
laid out left→right. The recolourable roles (skin, cap, shirt, trousers) use the
SAME reserved key colours the JS recolour pass swaps, so the colours chosen on
the character-creation screen apply to these PNGs unchanged. Fixed roles (shoes,
club shaft, club head, ball) are drawn in their final colours.

This mirrors the MMA pipeline (scripts/sprites/gen_fighter_layers.py): a Python
render of the procedural art, flat-keyed so the JS recolour() pass works on it.

Run:  python3 scripts/sprites/gen_golfer.py
"""
import os
import math
from PIL import Image, ImageDraw

FRAME = 64
OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites/golfer')
os.makedirs(OUT, exist_ok=True)

# ── Reserved key colours (must match golferSprites.js GOLF_KEY_RGB) ──
K_SKIN  = (255, 0, 255, 255)   # skin
K_CAP   = (0, 255, 0, 255)     # cap
K_SHIRT = (0, 0, 255, 255)     # shirt (also the arms)
K_PANTS = (255, 255, 0, 255)   # trousers

# ── Fixed (non-recolourable) ──
SHOE  = (26, 26, 31, 255)      # #1a1a1f
SHAFT = (216, 216, 216, 255)   # #d8d8d8
HEAD  = (144, 144, 152, 255)   # #909098 club head
BALL  = (255, 255, 255, 255)

# Animation frame counts (must match GOLFER_ANIMS in golferSprites.js).
ANIMS = {
    'idle':       4,
    'windup':     8,
    'swing_soft': 6,
    'swing_full': 8,
    'putt':       5,
    'whiff':      6,
    'celebrate':  6,
    'frustrated': 4,
}


def jr(x):
    """JS Math.round (round half up), unlike Python's banker's rounding."""
    return math.floor(x + 0.5)


def rect(d, x, y, w, h, c):
    # matches canvas fillRect(x,y,w,h): covers x..x+w-1 inclusive
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def draw_frame(anim, frame, frames):
    im = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = frame / (frames - 1) if frames > 1 else 0.0

    bob = 0
    lean = 0
    arms_up = False
    head_drop = 0

    if anim == 'idle':
        bob = frame % 2
        club_deg = 78
    elif anim == 'windup':
        club_deg = 95 - p * 240
        lean = -jr(p * 2)
    elif anim == 'swing_soft':
        club_deg = -100 + p * 250
        lean = jr((p - 0.4) * 3)
    elif anim == 'swing_full':
        club_deg = -145 + p * 340
        lean = jr((p - 0.4) * 4)
    elif anim == 'putt':
        club_deg = 100 - math.sin(p * math.pi) * 25
    elif anim == 'whiff':
        club_deg = -120 + p * 230
        head_drop = 1 if p > 0.7 else 0
        lean = 2 if p > 0.7 else 0
    elif anim == 'celebrate':
        bob = -(frame % 2) * 2
        arms_up = True
        club_deg = -90
    elif anim == 'frustrated':
        head_drop = 2
        club_deg = 95
        lean = 1
    else:
        club_deg = 78

    cx = 30 + lean
    base_y = 56 + bob

    # legs (trousers)
    rect(d, cx - 1, base_y - 12, 3, 12, K_PANTS)
    rect(d, cx + 4, base_y - 12, 3, 12, K_PANTS)
    # shoes
    rect(d, cx - 1, base_y - 1, 4, 2, SHOE)
    rect(d, cx + 4, base_y - 1, 4, 2, SHOE)
    # torso (shirt)
    rect(d, cx - 2, base_y - 26, 10, 14, K_SHIRT)
    # head (skin)
    rect(d, cx - 1, base_y - 35 + head_drop, 8, 8, K_SKIN)
    # cap
    rect(d, cx - 1, base_y - 37 + head_drop, 8, 3, K_CAP)
    rect(d, cx + 6, base_y - 35 + head_drop, 3, 1, K_CAP)

    # arms + club from the shoulder
    sx = cx + 5
    sy = base_y - 22
    rad = math.radians(club_deg)
    hx = sx + math.cos(rad) * 8
    hy = sy + math.sin(rad) * 8

    if arms_up:
        d.line([(cx, sy), (cx - 4, sy - 9)], fill=K_SHIRT, width=2)
        d.line([(sx, sy), (sx + 4, sy - 9)], fill=K_SHIRT, width=2)
    else:
        d.line([(sx, sy), (hx, hy)], fill=K_SHIRT, width=2)

    # club shaft + head
    chx = sx + 4 if arms_up else hx
    chy = sy - 9 if arms_up else hy
    cex = chx + math.cos(rad) * 14
    cey = chy + math.sin(rad) * 14
    d.line([(chx, chy), (cex, cey)], fill=SHAFT, width=1)
    rect(d, jr(cex) - 1, jr(cey) - 1, 3, 2, HEAD)

    # ball at address-ish poses
    if anim in ('idle', 'windup', 'putt'):
        rect(d, sx + 12, base_y - 1, 2, 2, BALL)

    return im


def main():
    for anim, frames in ANIMS.items():
        strip = Image.new('RGBA', (FRAME * frames, FRAME), (0, 0, 0, 0))
        for f in range(frames):
            strip.paste(draw_frame(anim, f, frames), (f * FRAME, 0))
        name = f'golfer_{anim}.png'
        strip.save(os.path.join(OUT, name))
        print('  golfer/' + name)
    print('\nGolfer sprites generated.')


if __name__ == '__main__':
    main()
