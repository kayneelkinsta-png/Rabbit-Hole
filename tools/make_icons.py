# Draws the app icon (a silver iris door with a glowing centre) as PNGs, with no libraries.
#   python tools/make_icons.py
import math, struct, zlib, os

def png(path, size, px):
    raw = b''.join(b'\x00' + bytes(px[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def sstep(a, b, v): t = max(0.0, min(1.0, (v - a) / (b - a))); return t * t * (3 - 2 * t)
def hue(h):
    h = h % 1.0; k = lambda n: (n + h * 6) % 6
    return tuple(1 - max(0, min(k(n), 4 - k(n), 1)) for n in (5, 3, 1))

N, CURL, APER, RI, RO = 7, 1.7, .085, .318, .37
STEP = 2 * math.pi / N
RIVETS = [(.5 + math.cos(i / 16 * 2 * math.pi + .3) * .344, .5 + math.sin(i / 16 * 2 * math.pi + .3) * .344) for i in range(16)]

def colour(x, y):
    dx, dy = x - .5, y - .5; r = math.hypot(dx, dy); th = math.atan2(dy, dx)
    c = mix((.105, .135, .32), (.024, .035, .08), sstep(0, .72, r))
    g = math.exp(-((r - RO) / .06) ** 2) * .5 + math.exp(-(r / .12) ** 2) * .25
    c = tuple(c[i] + g * (.35, .45, 1.0)[i] for i in range(3))
    if RI < r <= RO:
        t = .5 + .5 * math.cos(th + 2.3)
        c = mix((.30, .33, .42), (.97, .98, 1.0), t ** 1.4)
        c = mix(c, (.12, .13, .18), sstep(.0, .012, abs(r - RI)) * 0 + (1 - sstep(0, .01, r - RI)) * .6 + (1 - sstep(0, .008, RO - r)) * .5)
        for (rx, ry) in RIVETS:
            d = math.hypot(x - rx, y - ry)
            if d < .0095: c = mix(c, (1, 1, 1), 1 - sstep(.004, .0095, d))
    elif r <= RI:
        if r < APER:
            c = mix((1, 1, 1), (.55, .66, 1.0), sstep(0, APER, r))
            c = tuple(min(1.0, v * 1.05) for v in c)
        else:
            tp = th - CURL * (RI - r) / RI
            u = (tp + math.pi) / STEP; k = math.floor(u); f = u - k
            lit = 1.0 if k % 2 else .8
            shade = (.55 + .45 * (1 - f)) * lit * (.82 + .18 * (r - APER) / (RI - APER))
            c = tuple(v * shade for v in (.86, .89, .97))
            tint = hue((th / (2 * math.pi)) + .1)
            c = mix(c, tint, .16)
            if f < .035: c = mix(c, (.1, .11, .16), .75)
            elif f < .07: c = mix(c, (1, 1, 1), .35)
            c = mix(c, (.72, .8, 1.0), (1 - sstep(APER, APER + .03, r)) * .6)
    return c

def render(size, ss=2):
    px = bytearray(size * size * 3)
    for py in range(size):
        for pxl in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    c = colour((pxl + (sx + .5) / ss) / size, (py + (sy + .5) / ss) / size)
                    for i in range(3): acc[i] += c[i]
            o = (py * size + pxl) * 3
            for i in range(3): px[o + i] = max(0, min(255, int(acc[i] / (ss * ss) ** 1 * 255 / 1 + .5)))
    return px

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(here, exist_ok=True)
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (48, 'favicon-48.png')]:
    png(os.path.join(here, name), size, render(size, 2 if size > 100 else 3))
    print('wrote', name)
