#!/usr/bin/env python3
"""Pathey App Store preview (iPhone 6.9"/6.5": 886x1920, 30fps, <30s).

Full-bleed screen captures only (Apple rejects device frames and framing),
caption cards overlaid for muted autoplay, plain dissolves, silent stereo AAC.

Usage (from marketing/app-store-preview/, needs ffmpeg + `pip install pillow numpy`):
  python3 build_preview.py [out.mp4]            render
  python3 build_preview.py --frames 0,90,200    dump stills only (to ./frames)

To swap in fresh recordings: drop them in marketing/captures/ with the same
names (or add new ones), delete .cfr/, and retune `start`/`dur` below.
"""
import subprocess, sys, os, math, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))

def first(*paths):
    for p in paths:
        if os.path.exists(p):
            return p
    return paths[0]

CAPTURES = first(os.path.join(REPO, 'marketing', 'captures'), os.path.join(HERE, 'src'))
# Simulator captures are variable-frame-rate: seeking into a static stretch drops
# the held frame. Normalise to 30fps CFR once and cut from those.
SRC = first(os.path.join(HERE, '.cfr'), os.path.join(HERE, 'cfr'))
FONTS = first(os.path.join(HERE, 'fonts'), os.path.join(REPO, 'node_modules', '@expo-google-fonts'))
ICON_PATH = first(os.path.join(HERE, 'icon.png'), os.path.join(REPO, 'video', 'public', 'icon.png'))
W, H, FPS = 886, 1920, 30

def ensure_cfr(names):
    os.makedirs(SRC, exist_ok=True)
    for n in names:
        out = os.path.join(SRC, n + '.mp4')
        if not os.path.exists(out):
            print('normalising', n, file=sys.stderr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(CAPTURES, n + '.mp4'),
                            '-vf', f'fps={FPS},scale={W}:-2:flags=lanczos', '-c:v', 'libx264',
                            '-crf', '12', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-an', out], check=True)
XF = 8  # dissolve length in frames

BG = (20, 19, 18)
CREAM = (247, 243, 236)
BRAND = (217, 101, 61)
MUTED = (173, 166, 156)

def font(name, size):
    hits = glob.glob(os.path.join(FONTS, '**', name), recursive=True)
    return ImageFont.truetype(hits[0], size)

SERIF = 'SourceSerif4_600SemiBold.ttf'
SERIF_B = 'SourceSerif4_700Bold.ttf'
SANS_SB = 'PublicSans_600SemiBold.ttf'

# ---------------------------------------------------------------- timeline
# src: capture name; start: seconds into capture; dur: seconds on the timeline;
# speed: playback rate; cut: hard cut into this segment instead of a dissolve;
# zoom: (from, to, anchor_x 0-1, anchor_y 0-1) gentle push-in.
SEGMENTS = [
    # 0  hook: routes list, then it scrolls into scored routes
    dict(src='01-routes-list', start=2.0, dur=6.2),
    # 1-3  prediction-market filters: Sports, Weeks, scroll to a sports route
    #      (the gaps between parts are static in the capture, so the cuts are seamless)
    dict(src='02-prediction-filters', start=45.6, dur=1.2),
    dict(src='02-prediction-filters', start=50.5, dur=1.0, cut=True),
    dict(src='02-prediction-filters', start=56.0, dur=1.6, cut=True),
    # 4  tap into the route
    dict(src='03-route-detail', start=4.4, dur=3.0),
    # 5  scroll to potential outcome
    dict(src='03-route-detail', start=22.0, dur=3.6),
    # 6-7  drag the score dials, tap Done, list re-ranks
    #      (41.38-41.72 in the capture is a stale recorder frame showing the old
    #      weights; skip it)
    dict(src='04-score-weights', start=39.7, dur=1.67),
    dict(src='04-score-weights', start=41.74, dur=0.9, cut=True),
    dict(src='04-score-weights', start=53.6, dur=2.2, cut=True),
    # 8-10 coach: type, send, answer
    dict(src='03-route-detail', start=81.9, dur=1.6),
    dict(src='03-route-detail', start=92.0, dur=1.0, cut=True),
    dict(src='04-score-weights', start=0.0, dur=2.6, cut=True),
    # 11 end card over the app
    dict(src='01-routes-list', start=0.5, dur=3.0, end=True),
]

# Same copy as the store screenshots: two short lines, the second in clay.
CAPTIONS = [
    dict(seg=0, at=0.0, until=3.0, pos='bottom',
         text='Pick a goal.\nSee every route.', instant=True, size=84),
    dict(seg=0, at=3.0, pos='top', text='Stocks and bets.\nSame math.'),
    dict(seg=1, until_seg=3, pos='top', text='Filter by topic\nand timeframe.'),
    dict(seg=4, pos='top', text='See the odds\nbefore you buy.'),
    dict(seg=5, pos='top', text='The upside.\nThe downside.'),
    dict(seg=6, until_seg=8, pos='top', text='You decide\nwhat best means.'),
    dict(seg=9, until_seg=11, pos='top', text='Ask what could\ngo wrong.'),
]

# ---------------------------------------------------------------- layout of timeline
def layout():
    t = 0
    out = []
    for i, s in enumerate(SEGMENTS):
        n = round(s['dur'] * FPS)
        if i > 0 and not s.get('cut'):
            t -= XF  # overlap for dissolve
        out.append(dict(s, f0=t, n=n, idx=i))
        t += n
    return out, t

# ---------------------------------------------------------------- video readers
class Reader:
    def __init__(self, seg):
        speed = seg.get('speed', 1.0)
        need = seg['n'] / FPS * speed + 1.0
        vf = (f"setpts=(PTS-STARTPTS)/{speed},fps={FPS},"
              f"scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})/2,format=rgb24")
        cmd = ['ffmpeg', '-v', 'error', '-ss', str(seg['start']), '-i',
               os.path.join(SRC, seg['src'] + '.mp4'), '-t', str(need),
               '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
        self.p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        self.i = -1
        self.last = None

    def get(self, k):
        while self.i < k:
            buf = self.p.stdout.read(W * H * 3)
            if len(buf) == W * H * 3:
                self.last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            self.i += 1
        return self.last

    def close(self):
        try:
            self.p.stdout.close(); self.p.kill()
        except Exception:
            pass

# ---------------------------------------------------------------- caption cards
def text_w(d, s, f):
    return d.textlength(s, font=f)

def caption_card(c):
    size = c.get('size', 76)
    f_head = font(SERIF_B, size)
    pad_top, pad_bot = 44, 50
    card_w = W - 2 * 44
    lines = c['text'].split('\n')
    lh = round(size * 1.12)
    card_h = pad_top + lh * len(lines) + pad_bot - round(size * 0.12)
    img = Image.new('RGBA', (card_w, card_h + 40), (0, 0, 0, 0))
    # soft shadow
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([6, 14, card_w - 6, card_h + 10], 40, fill=(0, 0, 0, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, card_w - 1, card_h - 1], 40, fill=BG + (243,))
    y = pad_top
    for li, line in enumerate(lines):
        col = BRAND if li == len(lines) - 1 else CREAM
        d.text(((card_w - text_w(d, line, f_head)) / 2, y - round(size * 0.08)), line, font=f_head, fill=col)
        y += lh
    return img, card_h

def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

# ---------------------------------------------------------------- end card
ICON = Image.open(ICON_PATH).convert('RGBA').resize((210, 210), Image.LANCZOS)
mask = Image.new('L', ICON.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 209, 209], 48, fill=255)
ICON.putalpha(mask)

def end_overlay(p):
    """p: 0..1 progress through end segment."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    scrim = ease_out(p / 0.18)
    img.alpha_composite(Image.new('RGBA', (W, H), BG + (int(236 * scrim),)))
    d = ImageDraw.Draw(img)
    a1 = ease_out((p - 0.06) / 0.2)
    a2 = ease_out((p - 0.2) / 0.2)
    a3 = ease_out((p - 0.32) / 0.2)
    cy = 760
    if a1 > 0:
        ic = ICON.copy()
        ic.putalpha(Image.eval(ic.getchannel('A'), lambda v: int(v * a1)))
        img.alpha_composite(ic, ((W - 210) // 2, cy - 230 + int(20 * (1 - a1))))
        f = font(SERIF_B, 128)
        tw = d.textlength('Pathey', font=f)
        d.text(((W - tw) / 2, cy + 20 + int(20 * (1 - a1))), 'Pathey', font=f, fill=CREAM + (int(255 * a1),))
    if a2 > 0:
        f = font(SERIF, 58)
        s = 'Not advice. Just the math.'
        tw = d.textlength(s, font=f)
        d.text(((W - tw) / 2, cy + 190 + int(16 * (1 - a2))), s, font=f, fill=CREAM + (int(255 * a2),))
    if a3 > 0:
        f = font(SANS_SB, 30)
        s = 'Goals · Stocks · Prediction markets'
        tw = d.textlength(s, font=f)
        d.text(((W - tw) / 2, cy + 300), s, font=f, fill=BRAND + (int(255 * a3),))
        f = font(SANS_SB, 24)
        s = 'Sign-in required. Not financial advice.'
        tw = d.textlength(s, font=f)
        d.text(((W - tw) / 2, H - 170), s, font=f, fill=MUTED + (int(220 * a3),))
    return img

# ---------------------------------------------------------------- render
def apply_zoom(arr, z, ax, ay):
    if abs(z - 1) < 1e-4:
        return arr
    im = Image.fromarray(arr)
    cw, ch = W / z, H / z
    x0 = (W - cw) * ax
    y0 = (H - ch) * ay
    return np.asarray(im.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch)))

def main():
    out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(HERE, 'pathey-app-preview.mp4')
    only = None
    if '--frames' in sys.argv:
        only = [int(x) for x in sys.argv[sys.argv.index('--frames') + 1].split(',')]
    ensure_cfr(sorted({s['src'] for s in SEGMENTS}))
    segs, total = layout()
    print(f'total frames {total} = {total / FPS:.2f}s', file=sys.stderr)
    assert total / FPS <= 29.9, 'App Store limit is 30s'

    # resolve captions to frame ranges
    caps = []
    for c in CAPTIONS:
        s = segs[c['seg']]
        a = s['f0'] + round(c.get('at', 0) * FPS)
        if 'until' in c:
            b = s['f0'] + round(c['until'] * FPS)
        elif 'until_seg' in c:
            e = segs[c['until_seg']]
            b = e['f0'] + e['n']
        else:
            b = s['f0'] + s['n']
        # hand captions over at the midpoint of a dissolve so two cards never stack
        if c.get('at', 0) == 0 and c['seg'] > 0 and not s.get('cut'):
            a += XF // 2
        last = segs[c.get('until_seg', c['seg'])]
        if 'until' not in c and last['idx'] + 1 < len(segs) and not segs[last['idx'] + 1].get('cut'):
            b -= XF // 2 + 1
        img, h = caption_card(c)
        caps.append(dict(c, a=a, b=b, img=img, h=h))

    readers = {}
    enc = None
    if only is None:
        enc = subprocess.Popen([
            'ffmpeg', '-v', 'error', '-y',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
            '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'slow',
            '-b:v', '12M', '-maxrate', '16M', '-bufsize', '24M', '-pix_fmt', 'yuv420p',
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
            '-r', str(FPS), '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
            '-shortest', '-movflags', '+faststart', '-tag:v', 'avc1', out], stdin=subprocess.PIPE)

    frames = range(total) if only is None else sorted(only)
    for f in frames:
        active = [s for s in segs if s['f0'] <= f < s['f0'] + s['n']]
        layers = []
        for s in active:
            k = f - s['f0']
            if s['idx'] not in readers:
                readers[s['idx']] = Reader(s)
            arr = readers[s['idx']].get(k)
            if 'zoom' in s:
                z0, z1, ax, ay = s['zoom']
                arr = apply_zoom(arr, z0 + (z1 - z0) * ease_out(k / s['n']), ax, ay)
            layers.append((s, arr.astype(np.float32)))
        # close finished readers
        for idx in list(readers):
            s = segs[idx]
            if f >= s['f0'] + s['n']:
                readers.pop(idx).close()
        if len(layers) == 2:
            (sa, A), (sb, B) = layers
            w = (f - sb['f0'] + 1) / (XF + 1)
            frame = A * (1 - w) + B * w
        else:
            frame = layers[0][1]
        im = Image.fromarray(frame.clip(0, 255).astype(np.uint8)).convert('RGBA')

        for c in caps:
            if not (c['a'] <= f < c['b']):
                continue
            t_in = (f - c['a'] + 1) / 9
            t_out = (c['b'] - f) / 7
            a = 1.0 if c.get('instant') and f - c['a'] < 9 else ease_out(t_in)
            a = min(a, ease_out(t_out))
            if a <= 0:
                continue
            dy = int(28 * (1 - a))
            card = c['img']
            if a < 1:
                card = card.copy()
                card.putalpha(Image.eval(card.getchannel('A'), lambda v, a=a: int(v * a)))
            y = 128 if c['pos'] == 'top' else H - 236 - c['h']
            im.alpha_composite(card, (44, y + dy))

        end = segs[-1]
        if end.get('end') and f >= end['f0']:
            p = (f - end['f0']) / end['n']
            im.alpha_composite(end_overlay(p))

        rgb = im.convert('RGB')
        if only is not None:
            fd = os.environ.get('FRAMES_DIR', os.path.join(HERE, 'frames')); os.makedirs(fd, exist_ok=True)
            rgb.save(os.path.join(os.environ.get('FRAMES_DIR', os.path.join(HERE, 'frames')), f'f{f:04d}.png'))
        else:
            enc.stdin.write(rgb.tobytes())
    for r in readers.values():
        r.close()
    if enc:
        enc.stdin.close()
        enc.wait()
        print('wrote', out, file=sys.stderr)

if __name__ == '__main__':
    main()
