"""Сборка SVG-логотипов СЭС из оригинального PDF заказчика.

Запуск (из корня репозитория):  python -I brand/build_logo_svg.py

Что делает:
  1. Читает векторные контуры из brand/source/logotip-vektor.pdf (только стандартная библиотека).
  2. Сверяет геометрию с Figma-SVG того же файла (brand/source/logotip-vektor.figma-export.svg).
  3. Пишет оптимизированные SVG в design/system/logo/.

Геометрия не изменяется: координаты исходные (округление до 0,01 ед. при ширине 1384 ед.),
варианты получаются только отбором контуров и обрезкой через viewBox.
Меняется лишь цвет текстовых контуров в вариантах «на тёмном» (разрешено заданием PHASE 4).
"""
import re
import sys
import zlib
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'brand/source/logotip-vektor.pdf'
FIGMA_SVG = ROOT / 'brand/source/logotip-vektor.figma-export.svg'
OUT = ROOT / 'design/system/logo'

# ---------- 1. PDF -> контуры ----------
data = PDF.read_bytes()
assert not re.search(rb'/Subtype\s*/Image', data), 'в PDF есть растровое изображение'
assert not re.search(rb'/(Shading|Pattern)\b', data), 'в PDF есть градиент или паттерн'
mb = re.search(rb'/MediaBox \[ ([\d. ]+) \]', data).group(1).split()
W, H = float(mb[2]), float(mb[3])
cid = re.search(rb'/Contents (\d+) 0 R', data).group(1)
stream = re.search(rb'\n' + cid + rb' 0 obj.*?stream\r?\n(.*?)endstream', data, re.S).group(1)
content = zlib.decompress(stream).decode('latin1')

cm = (1, 0, 0, 1, 0, 0)
color = None
args = []
subs = []
fills = []


def pt(x, y):
    a, b, c, d, e, f = cm
    return (a * x + c * y + e, H - (b * x + d * y + f))


for t in content.split():
    if re.fullmatch(r'-?\d*\.?\d+', t):
        args.append(float(t))
        continue
    if t.startswith('/') or t in ('<<', '>>', '[', ']') or t.startswith('('):
        args = []
        continue
    if t == 'cm':
        cm = tuple(args[-6:])
    elif t == 'scn':
        color = tuple(round(v * 255) for v in args[-3:])
    elif t == 'm':
        subs.append([('M', [pt(*args[-2:])])])
    elif t == 'l':
        subs[-1].append(('L', [pt(*args[-2:])]))
    elif t == 'c':
        a = args[-6:]
        subs[-1].append(('C', [pt(a[0], a[1]), pt(a[2], a[3]), pt(a[4], a[5])]))
    elif t == 'h':
        subs[-1].append(('Z', []))
    elif t in ('f', 'f*'):
        assert t == 'f', 'even-odd заливка не поддержана'
        fills.append(('#%02X%02X%02X' % color, subs))
        subs = []
    elif t == 'n':
        subs = []
    args = []

# убрать вырожденные подконтуры (только M + Z, нулевая площадь)
dropped = 0
clean = []
for col, sp in fills:
    keep = [s for s in sp if any(c in ('L', 'C') for c, _ in s)]
    dropped += len(sp) - len(keep)
    clean.append((col, keep))
fills = clean
assert len(fills) == 14, len(fills)


# ---------- 2. Сверка с Figma-SVG ----------
def expand_svg(d):
    assert not re.search(r'[mlhvcsqtaz]', d), 'относительные команды не ожидались'
    toks = re.findall(r'[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?', d)
    i = 0
    cur = (0.0, 0.0)
    cmd = None
    out = []
    while i < len(toks):
        if toks[i] in 'MLHVCZ':
            cmd = toks[i]
            i += 1
            if cmd == 'Z':
                out.append(('Z', []))
                continue
        k = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6}[cmd]
        v = [float(x) for x in toks[i:i + k]]
        i += k
        if cmd == 'H':
            cur = (v[0], cur[1])
            out.append(('L', [cur]))
        elif cmd == 'V':
            cur = (cur[0], v[0])
            out.append(('L', [cur]))
        elif cmd == 'C':
            ps = [(v[0], v[1]), (v[2], v[3]), (v[4], v[5])]
            cur = ps[2]
            out.append(('C', ps))
        else:
            cur = (v[0], v[1])
            out.append((cmd, [cur]))
            if cmd == 'M':
                cmd = 'L'
    return out


svg = FIGMA_SVG.read_text(encoding='utf8')
fpaths = re.findall(r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"', svg)
assert len(fpaths) == 14
maxdev = 0.0
colors_equal = True
shapes_equal = True
for (d, fc), (pc, psub) in zip(fpaths, fills):
    colors_equal &= fc.upper() == pc
    a = expand_svg(d)
    b = [c for s in psub for c in s]
    if [x[0] for x in a] != [x[0] for x in b]:
        shapes_equal = False
        continue
    for (_, p), (_, q) in zip(a, b):
        for (x1, y1), (x2, y2) in zip(p, q):
            maxdev = max(maxdev, abs(x1 - x2), abs(y1 - y2))
print(f'PDF {W:g} x {H:g}; контуров {len(fills)}; вырожденных подконтуров отброшено: {dropped}')
print(f'сверка с Figma-SVG: команды совпали={shapes_equal}, цвета совпали={colors_equal}, макс. отклонение={maxdev:.5f} ед.')
# Figma-SVG округлён до 6 значащих цифр, поэтому допуск 0,01 ед. (< 0,002 px при ширине 200 px)
assert shapes_equal and colors_equal and maxdev < 0.01


# ---------- 3. Запись SVG ----------
def n(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def d_of(sub_list):
    out = []
    for s in sub_list:
        for c, ps in s:
            out.append('Z' if c == 'Z' else c + ' '.join(n(x) + ' ' + n(y) for x, y in ps))
    return ''.join(out).replace(' -', '-')


def bbox(sel):
    xs, ys = [], []
    for i in sel:
        for s in fills[i][1]:
            for _, ps in s:
                for x, y in ps:
                    xs.append(x)
                    ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


NAME, SES, MARK_TOP = [0], [1, 2, 3], [5, 7, 9, 11, 13]


def svg_file(title, sel, vb, on_dark=False):
    x0, y0, w, h = vb
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{n(x0)} {n(y0)} {n(w)} {n(h)}" '
           f'width="{n(w)}" height="{n(h)}" role="img"><title>{title}</title>']
    for i in sel:
        col = fills[i][0]
        if on_dark and i in NAME + SES:
            col = '#FFFFFF'
        out.append(f'<path fill="{col}" d="{d_of(fills[i][1])}"/>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


OUT.mkdir(parents=True, exist_ok=True)
allp = list(range(14))
nx0, ny0, nx1, ny1 = bbox(NAME)
mx0, my0, mx1, my1 = bbox(MARK_TOP)
T = 'Связь Энергострой'
files = {
    'logo-full.svg': svg_file(T, allp, (0, 0, W, H)),
    'logo-full-on-dark.svg': svg_file(T, allp, (0, 0, W, H), True),
    'logo-wordmark.svg': svg_file(T, NAME, (nx0, ny0, nx1 - nx0, ny1 - ny0)),
    'logo-wordmark-on-dark.svg': svg_file(T, NAME, (nx0, ny0, nx1 - nx0, ny1 - ny0), True),
    'logo-mark.svg': svg_file(T + ' — знак', MARK_TOP, (mx0, my0, mx1 - mx0, my1 - my0)),
}
# favicon: знак по центру квадрата с полем 6 % с каждой стороны; ничего не добавляется, фон прозрачный
side = (mx1 - mx0) * 1.12
files['favicon.svg'] = svg_file(T, MARK_TOP, (mx0 - (side - (mx1 - mx0)) / 2, (my0 + my1) / 2 - side / 2, side, side))
for name, body in files.items():
    (OUT / name).write_text(body, encoding='utf8')
    print(f'{name:28} {len(body.encode("utf8")):6d} байт')
print('bbox name %.2f %.2f %.2f %.2f | mark %.2f %.2f %.2f %.2f' % (nx0, ny0, nx1, ny1, mx0, my0, mx1, my1))
