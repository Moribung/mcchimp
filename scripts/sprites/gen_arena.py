import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

W, H = 96, 48
LINE = (255, 255, 255, 70)   # semi-transparent (cage chain-link + mat octagon markings)
POST = (255, 255, 255, 95)
GOLD = (216, 178, 34, 235)

def new():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

# ── Cage ── the chain-link enclosure, wall zone only (no lines across the mat).
def make_cage():
    img = new()
    d = ImageDraw.Draw(img)
    # Chain-link diamonds across the back wall only
    for y in range(18, 36):
        for x in range(10, 87):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0:
                img.putpixel((x, y), LINE)
    # Corner posts + 3px top bar
    d.rectangle([7, 18, 8, 35], fill=POST)
    d.rectangle([87, 18, 88, 35], fill=POST)
    d.rectangle([7, 18, 88, 20], fill=POST)
    img.save(os.path.join(OUT, 'cage.png'))
    print('  cage.png')

# ── Ring ── boxing-ring enclosure: corner posts + ropes, above the mat.
def make_ring():
    img = new()
    d = ImageDraw.Draw(img)
    POSTc = (200, 200, 212, 175)
    ROPEc = (210, 210, 224, 150)
    # Corner posts (turnbuckles) standing at the ring edge
    d.rectangle([6, 27, 8, 38], fill=POSTc)
    d.rectangle([87, 27, 89, 38], fill=POSTc)
    # Three ropes strung between the posts, all above the mat (y36)
    for ry in (29, 32, 35):
        d.rectangle([8, ry, 87, ry], fill=ROPEc)
    img.save(os.path.join(OUT, 'ring.png'))
    print('  ring.png')

# ── Canvas (the mat floor) ── three separate designs. "None" needs no asset.

# Current GFL designation: the octagon outline on the mat.
def make_canvas_gfl():
    img = new()
    cx, cy, r = 48, 42, 9
    for x in range(cx - r, cx + r + 1):
        for y in range(cy - r, cy + r + 1):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if abs(dist - r) < 0.8 and 37 <= y <= 47 and 0 <= x < W:
                img.putpixel((x, y), LINE)
    img.save(os.path.join(OUT, 'canvas_gfl.png'))
    print('  canvas_gfl.png')

# GFL spelled out in pixels on the mat.
LETTERS = {
    'G': ["0111", "1000", "1011", "1001", "0111"],
    'F': ["1111", "1000", "1110", "1000", "1000"],
    'L': ["1000", "1000", "1000", "1000", "1111"],
}
def make_canvas_gfl_text():
    img = new()
    word = "GFL"
    lw, gap = 4, 1
    total = len(word) * lw + (len(word) - 1) * gap
    x0 = (W - total) // 2
    y0 = 39
    x = x0
    for ch in word:
        for ry, row in enumerate(LETTERS[ch]):
            for rx, c in enumerate(row):
                if c == '1':
                    img.putpixel((x + rx, y0 + ry), LINE)  # same colour as the octagon pattern
        x += lw + gap
    img.save(os.path.join(OUT, 'canvas_gfl_text.png'))
    print('  canvas_gfl_text.png')

print('Generating arena (cage + canvas) assets...')
make_cage()
make_ring()
make_canvas_gfl()
make_canvas_gfl_text()
print('Done.')
