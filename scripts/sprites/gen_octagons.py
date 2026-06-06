import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '../../static/sprites')
os.makedirs(OUT, exist_ok=True)

W, H = 96, 48
LINE  = (255, 255, 255, 60)
POST  = (255, 255, 255, 80)
ROPE  = (255, 255, 255, 50)

def make_gfl():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Octagon outline on mat (y 36-47), just the mat section markings
    # Center circle approximation using rect pixels
    cx, cy = 48, 41
    r = 8
    for x in range(cx - r, cx + r + 1):
        for y in range(cy - r, cy + r + 1):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5
            if abs(dist - r) < 1.0 and 36 <= y <= 47 and 0 <= x < W:
                img.putpixel((x, y), LINE)
    # octagon flat sides on mat boundary
    d.rectangle([32, 36, 64, 36], fill=LINE)
    img.save(os.path.join(OUT, 'oct_gfl.png'))
    print('  oct_gfl.png')

def make_cage():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Two cage posts — tall, rising up into the arena
    for px in [8, 87]:
        d.rectangle([px, 16, px, 47], fill=POST)
    # Chain-link dots filling the taller cage
    for y in range(16, 36, 2):
        for x in range(4, W-4, 4):
            img.putpixel((x, y), LINE)
    img.save(os.path.join(OUT, 'oct_cage.png'))
    print('  oct_cage.png')

def make_ring():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Two corner posts
    for px in [4, 91]:
        d.rectangle([px, 30, px+1, 47], fill=POST)
    # Two rope lines
    d.rectangle([4, 32, 91, 32], fill=ROPE)
    d.rectangle([4, 35, 91, 35], fill=ROPE)
    img.save(os.path.join(OUT, 'oct_ring.png'))
    print('  oct_ring.png')

print('Generating octagon overlays...')
make_gfl()
make_cage()
make_ring()
print('Done.')
