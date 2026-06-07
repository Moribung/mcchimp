"""
gen_fighter_layers.py
─────────────────────
Render every currently-procedural fighter asset (from src/lib/avatar/fighterRenderer.js
`drawBase`) into separate, flat-keyed, transparent, anchored PNG layers.

Each layer is a 32x48 RGBA PNG using the SAME reserved key colours the JS uses, so the
existing `recolor()` pass (exact RGB match) works on them unchanged. Pieces are split so
they stay composable: body-per-pose + shorts-per-org + belt-per-type + hair + beard.

Composite order (must match drawBase): body -> shorts -> belt -> beard -> hair.

Outputs to static/sprites/fighter/. Also writes a few recoloured composite previews
(6x upscaled) so the layering can be eyeballed against the live look.
"""
import os
from PIL import Image, ImageDraw

W, H = 32, 48
OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites/fighter')
os.makedirs(OUT, exist_ok=True)

# ── Reserved key colours (must match fighterRenderer.js) ──
K_SKIN     = (255, 0, 255, 255)
K_SKIN_SH  = (200, 0, 200, 255)
K_HAIR     = (0, 255, 0, 255)
K_SHORTS   = (0, 0, 255, 255)
K_SHORTS_T = (0, 128, 255, 255)
K_GLOVE    = (255, 255, 0, 255)
K_BEARD    = (0, 255, 255, 255)
K_BELT     = (255, 128, 0, 255)
# Fixed (non-recolourable)
EYE   = (20, 20, 20, 255)
PLATE = (242, 217, 106, 255)
GOLD, GOLD2     = (216, 178, 58, 255), (244, 224, 138, 255)
SILVER, SILVER2 = (174, 174, 186, 255), (230, 230, 238, 255)


def img():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def rect(d, x, y, w, h, c):
    # matches JS fillRect(x,y,w,h): inclusive of x..x+w-1
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def save(im, name):
    im.save(os.path.join(OUT, name))
    print('  fighter/' + name)


# ── BODY (skin + eyes + pose-specific gloves; NO shorts/hair/beard/belt) ──
def body(pose):
    im = img(); d = ImageDraw.Draw(im)
    if pose == 'side':
        rect(d, 13, 14, 6, 6, K_SKIN)
        rect(d, 14, 17, 1, 1, EYE); rect(d, 16, 17, 1, 1, EYE)
        rect(d, 11, 20, 10, 2, K_SKIN)
        rect(d, 18, 20, 3, 4, K_SKIN)
        rect(d, 12, 22, 8, 6, K_SKIN)
        rect(d, 12, 27, 8, 1, K_SKIN_SH)
        rect(d, 12, 28, 8, 1, K_SKIN)
        rect(d, 11, 29, 10, 5, K_SKIN)
        rect(d, 10, 34, 3, 6, K_SKIN); rect(d, 19, 34, 3, 6, K_SKIN)
        rect(d, 10, 40, 3, 1, EYE);    rect(d, 19, 40, 3, 1, EYE)
        rect(d, 11, 19, 2, 2, K_SKIN)
        rect(d, 10, 17, 3, 3, K_GLOVE)
        rect(d, 9, 22, 3, 3, K_SKIN)
        rect(d, 6, 21, 3, 3, K_GLOVE)
    else:
        rect(d, 13, 14, 6, 6, K_SKIN)
        rect(d, 14, 17, 1, 1, EYE); rect(d, 17, 17, 1, 1, EYE)
        rect(d, 14, 20, 4, 1, K_SKIN)
        rect(d, 11, 21, 10, 8, K_SKIN)
        rect(d, 11, 27, 10, 1, K_SKIN_SH)
        rect(d, 11, 29, 10, 5, K_SKIN)
        rect(d, 12, 34, 3, 6, K_SKIN); rect(d, 17, 34, 3, 6, K_SKIN)
        rect(d, 12, 40, 3, 1, EYE);    rect(d, 17, 40, 3, 1, EYE)
        if pose == 'win2':
            rect(d, 8, 20, 3, 3, K_SKIN);  rect(d, 21, 20, 3, 3, K_SKIN)
            rect(d, 6, 15, 3, 5, K_SKIN);  rect(d, 23, 15, 3, 5, K_SKIN)
            rect(d, 5, 11, 3, 3, K_GLOVE); rect(d, 24, 11, 3, 3, K_GLOVE)
        elif pose == 'win1':
            rect(d, 8, 20, 3, 3, K_SKIN);  rect(d, 6, 15, 3, 5, K_SKIN);  rect(d, 5, 11, 3, 3, K_GLOVE)
            rect(d, 21, 21, 3, 8, K_SKIN); rect(d, 21, 28, 3, 3, K_GLOVE)
        else:  # loss
            rect(d, 8, 21, 3, 8, K_SKIN);  rect(d, 21, 21, 3, 8, K_SKIN)
            rect(d, 8, 28, 3, 3, K_GLOVE); rect(d, 21, 28, 3, 3, K_GLOVE)
    return im


# ── SHORTS (org pattern at hips anchor HX=11, HY=29) ──
def shorts(org):
    im = img(); d = ImageDraw.Draw(im)
    HX, HY = 11, 29
    rect(d, HX, HY, 10, 5, K_SHORTS)
    if org == 'kfc':
        rect(d, HX, HY + 2, 10, 1, K_SHORTS_T)
    elif org == 'apex':
        rect(d, HX, HY, 10, 1, K_SHORTS_T)
    elif org == 'gfl':
        rect(d, HX, HY, 1, 5, K_SHORTS_T); rect(d, HX + 9, HY, 1, 5, K_SHORTS_T); rect(d, HX, HY, 10, 1, K_SHORTS_T)
    # regional -> plain base
    return im


# ── BELT (championship belt at waist) ──
def belt(kind):
    im = img(); d = ImageDraw.Draw(im)
    if kind == 'gfl':
        rect(d, 11, 27, 10, 1, GOLD); rect(d, 10, 28, 12, 1, GOLD); rect(d, 11, 29, 10, 1, GOLD)
        rect(d, 14, 25, 4, 1, GOLD2); rect(d, 13, 26, 6, 4, GOLD2); rect(d, 14, 30, 4, 1, GOLD2)
    elif kind == 'apex':
        rect(d, 11, 28, 10, 2, SILVER); rect(d, 13, 28, 2, 2, SILVER2); rect(d, 17, 28, 2, 2, SILVER2)
    elif kind == 'kfc':
        rect(d, 11, 28, 10, 2, SILVER); rect(d, 14, 26, 4, 4, SILVER2)
    elif kind == 'regional':
        rect(d, 11, 28, 10, 2, K_BELT); rect(d, 15, 27, 3, 3, PLATE)
    return im


# ── BEARD (head anchor) ──
def beard(style):
    im = img(); d = ImageDraw.Draw(im)
    if style == 'full':
        rect(d, 14, 19, 4, 2, K_BEARD); rect(d, 13, 18, 1, 2, K_BEARD); rect(d, 18, 18, 1, 2, K_BEARD)
    elif style == 'goatee':
        rect(d, 15, 19, 2, 2, K_BEARD)
    return im


# ── HAIR (head anchor) ──
def hair(style):
    im = img(); d = ImageDraw.Draw(im)
    if style == 'buzz':
        rect(d, 13, 13, 6, 1, K_HAIR)
    elif style == 'short':
        rect(d, 13, 12, 6, 2, K_HAIR); rect(d, 13, 14, 1, 1, K_HAIR); rect(d, 18, 14, 1, 1, K_HAIR)
    elif style == 'mohawk':
        rect(d, 15, 9, 2, 5, K_HAIR)
    elif style == 'afro':
        rect(d, 12, 10, 8, 4, K_HAIR); rect(d, 13, 9, 6, 1, K_HAIR); rect(d, 12, 14, 2, 1, K_HAIR); rect(d, 18, 14, 2, 1, K_HAIR)
    elif style == 'long':
        rect(d, 13, 12, 6, 2, K_HAIR); rect(d, 13, 14, 1, 6, K_HAIR); rect(d, 18, 14, 1, 6, K_HAIR)
    return im


# ── Generate every layer ──
print('Generating fighter layers...')
for p in ('loss', 'side', 'win1', 'win2'):
    save(body(p), f'body_{p}.png')
for o in ('regional', 'kfc', 'apex', 'gfl'):
    save(shorts(o), f'shorts_{o}.png')
for b in ('gfl', 'apex', 'kfc', 'regional'):
    save(belt(b), f'belt_{b}.png')
for s in ('goatee', 'full'):
    save(beard(s), f'beard_{s}.png')
for s in ('buzz', 'short', 'mohawk', 'afro', 'long'):
    save(hair(s), f'hair_{s}.png')


# ── Recoloured composite previews (sanity check only) ──
RECOLOR = {
    (255, 0, 255): (207, 153, 102),  # skin  (Tan base)
    (200, 0, 200): (168, 116, 68),   # skin shadow
    (0, 255, 0):   (28, 28, 28),     # hair  (black)
    (0, 0, 255):   (180, 31, 31),    # shorts (red)
    (0, 128, 255): (232, 232, 236),  # shorts trim (white)
    (255, 255, 0): (143, 31, 31),    # gloves (red)
    (0, 255, 255): (28, 28, 28),     # beard (black)
    (255, 128, 0): (216, 178, 58),   # belt (gold)
}


def recolored_composite(layers):
    base = img()
    for lyr in layers:
        base = Image.alpha_composite(base, lyr)
    px = base.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in RECOLOR:
                nr, ng, nb = RECOLOR[(r, g, b)]
                px[x, y] = (nr, ng, nb, a)
    return base


previews = {
    'preview_side':  [body('side'), shorts('gfl'), beard('full'), hair('short')],
    'preview_win2':  [body('win2'), shorts('gfl'), belt('gfl'), beard('full'), hair('afro')],
    'preview_loss':  [body('loss'), shorts('kfc'), hair('long')],
}
for name, layers in previews.items():
    comp = recolored_composite(layers)
    comp.resize((W * 6, H * 6), Image.NEAREST).save(os.path.join(OUT, name + '_6x.png'))
    print(f'  fighter/{name}_6x.png (preview)')

print('Done.')
