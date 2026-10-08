# Android launcher icons from the same iris-door drawing: square (old phones), round, and the adaptive-icon foreground.
#   python tools/make_android_icons.py      (run after `npx cap add android`)
import math, os, struct, zlib
from make_icons import colour

BG = (0x0b, 0x0f, 0x1e)

def png_rgba(path, size, px):
    raw = b''.join(b'\x00' + bytes(px[y * size * 4:(y + 1) * size * 4]) for y in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def draw(size, kind, ss=2):
    # kind: 'square' (the full drawing), 'round' (circle-cut), 'fore' (the door at 62% on transparent, for adaptive icons)
    px = bytearray(size * size * 4)
    for py in range(size):
        for pxl in range(size):
            r = g = b = a = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x, y = (pxl + (sx + .5) / ss) / size, (py + (sy + .5) / ss) / size
                    if kind == 'fore':
                        x, y = (x - .5) / .62 + .5, (y - .5) / .62 + .5
                        inside = math.hypot(x - .5, y - .5) <= .385
                    elif kind == 'round':
                        inside = math.hypot(x - .5, y - .5) <= .5
                    else:
                        inside = True
                    if inside:
                        c = colour(x, y); r += c[0]; g += c[1]; b += c[2]; a += 1
            n = ss * ss; o = (py * size + pxl) * 4
            if a:
                px[o:o + 3] = bytes(max(0, min(255, int(v / a * 255 + .5))) for v in (r, g, b)); px[o + 3] = int(a / n * 255)
    return px

res = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'android', 'app', 'src', 'main', 'res')
for dens, base in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    d = os.path.join(res, 'mipmap-' + dens)
    png_rgba(os.path.join(d, 'ic_launcher.png'), base, draw(base, 'square', 3))
    png_rgba(os.path.join(d, 'ic_launcher_round.png'), base, draw(base, 'round', 3))
    png_rgba(os.path.join(d, 'ic_launcher_foreground.png'), base * 108 // 48, draw(base * 108 // 48, 'fore', 2))
    print('wrote', dens)
open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02x%02x%02x</color>\n</resources>\n' % BG)
