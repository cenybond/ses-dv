"""Векторизация логотипов заказчиков для бегущей строки на главной (src/components/ClientsMarquee.astro).

Запуск:  python -I scripts/build-client-logos.py
Нужны: python-пакеты opencv-python, numpy, pillow, scikit-image.

Источник — design/client-preview/clients/clients-source.png (растровая подборка восьми логотипов от заказчика).
Что делает
1. Режет каждый логотип по рамке (BOXES, пиксели исходника), кладёт на белый фон.
2. Берёт «густоту» знака (255 − яркость), увеличивает в 4 раза и режет по половине локального максимума: край проходит
   по середине сглаженного пикселя, у тёмных и светлых цветов одинаково.
3. Контуры (с отверстиями) сглаживает и упрощает, пишет SVG: один <path fill-rule="evenodd" fill="currentColor">, один цвет.
   Цвет задаёт CSS (серый), поэтому и знак, и название получаются серыми. Белые зоны (штрихи шара ДРСК, буквы на красном МТС) остаются дырами.
Результат: src/assets/clients/*.svg. Если у заказчика появятся векторные оригиналы — подменить файлы, код не меняется.
"""
import os
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design/client-preview/clients/clients-source.png')
OUT = os.path.join(ROOT, 'src/assets/clients')
S = 4  # во сколько раз увеличиваем перед трассировкой

# имя файла: (левый, верхний, правый, нижний край в пикселях исходника)
BOXES = {
    'drsk': (50, 45, 290, 138),
    'region': (396, 48, 640, 125),
    'mts': (742, 52, 884, 192),
    'rks': (46, 188, 308, 296),
    'rzd': (396, 170, 652, 218),
    'octet': (398, 272, 636, 326),
    'rostelecom': (56, 340, 322, 442),
    'kanikurgan': (398, 372, 664, 442),
}

# Доля локального максимума, по которой проходит край (0,5 — середина).
# (доля, ширина зоны слева в px исходника): у плашки ОСТЕТ порог выше, чтобы светлые линии домика стали заметными отверстиями; слово правее — обычный порог.
FACTOR = {'octet': (0.8, 46)}
# Радиус (px исходника) окна, где ищется локальный максимум. У ДРСК узкий: иначе светлое оранжевое рядом с тёмным синим теряется.
RADIUS = {'drsk': 1}
# Двухтонные знаки: оранжевая часть рисуется светлее (прозрачность 50 %) — иначе витки шара ДРСК сливаются в пятно.
TWOTONE = {'drsk'}
# Каникурган: темно-зелёный фон (полный тон), оранжевый квадрат (светлее), белые знаки — отверстия. Порог — густота (255 − яркость) между тонами.
LEVELS = {'kanikurgan': 140}
# Градиент знака (фиолетовый → оранжевый у Ростелекома): серый градиент по густоте исходных цветов, слово — сплошное.
GRAD = {'rostelecom'}
# Утолщение светлых линий внутри тёмной плашки (домик ОСТЕТ): сжатие маски на N шагов по 1 px увеличения в зоне плашки.
ERODE = {'octet': (1, 46)}  # (шагов, ширина зоны плашки в px исходника: слово правее не трогаем)

os.makedirs(OUT, exist_ok=True)
img = Image.open(SRC).convert('RGBA')
white = Image.new('RGBA', img.size, (255, 255, 255, 255))
white.alpha_composite(img)
gray = np.asarray(white.convert('L'), dtype=np.float32)


def edge_smooth(pts, w=7, corner=0.35):
    """Сглаживает шум вдоль края, но оставляет углы: там, где контур резко поворачивает, точки не двигаются."""
    n = len(pts)
    if n < w * 4:
        return pts
    h = w // 2
    ext = np.concatenate([pts[-w:], pts, pts[:w]])
    k = np.ones(w) / w
    sm = np.stack([np.convolve(ext[:, i], k, 'same') for i in (0, 1)], 1)[w:-w]
    a = np.roll(pts, h * 2, 0) - pts
    b = np.roll(pts, -h * 2, 0) - pts
    cos = (a * b).sum(1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1) + 1e-6)
    # угол между плечами: cos ≈ −1 у прямой, больше −0,2 — это острый поворот (угол буквы)
    is_corner = cos > -0.2
    is_corner = np.convolve(np.concatenate([is_corner[-h * 2:], is_corner, is_corner[:h * 2]]).astype(float), np.ones(h * 2 + 1), 'same')[h * 2:-h * 2] > 0
    out = sm.copy()
    out[is_corner] = pts[is_corner]
    return out.astype(np.float32)


# Исходник мягкий: вес букв берём как есть (край — середина перехода), а углы не сглаживаем — они остаются острыми.

for name, (x0, y0, x1, y1) in BOXES.items():
    d = 255.0 - gray[y0:y1, x0:x1]
    d = d.astype(np.float32)
    up = cv2.resize(d, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (0, 0), 0.35 * S / 2)
    k = 2 * S * RADIUS.get(name, 2) // 2 + 1
    local_max = cv2.dilate(up, np.ones((k, k), np.uint8))
    factor = np.full(up.shape, 0.5, np.float32)
    if name in FACTOR:
        factor[:, :FACTOR[name][1] * S] = FACTOR[name][0]
    thr = np.maximum(factor * local_max, 28.0)
    mask = (up > thr).astype(np.uint8) * 255
    # Рамка в 2 px белого: контуры не упираются в край
    mask[:2 * S, :] = 0; mask[-2 * S:, :] = 0; mask[:, :2 * S] = 0; mask[:, -2 * S:] = 0
    if name in ERODE:
        steps, zone = ERODE[name]
        eroded = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=steps)
        mask[:, :zone * S] = eroded[:, :zone * S]
    def trace(m):
        contours, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        out = []
        for c in contours:
            if cv2.contourArea(c) < 14:
                continue
            c = edge_smooth(c[:, 0, :].astype(np.float32))
            c = cv2.approxPolyDP(c.reshape(-1, 1, 2), 0.7, True)[:, 0, :]
            if len(c) >= 3:
                out.append(c)
        return out

    def path(polys, bx0, by0):
        return ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in (c - [bx0, by0]) / S) + 'Z' for c in polys)

    ys, xs = np.nonzero(mask)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    w, h = (bx1 - bx0) / S, (by1 - by0) / S
    fill = '<path fill="currentColor" fill-rule="evenodd" d="%s"/>'
    if name in TWOTONE:
        rgb = np.asarray(white.convert('RGB'), dtype=np.float32)[y0:y1, x0:x1]
        warm = cv2.resize(rgb[..., 0] - rgb[..., 2], None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
        warm_mask = ((warm > 40) & (mask > 0)).astype(np.uint8) * 255
        warm_mask = cv2.morphologyEx(warm_mask, cv2.MORPH_OPEN, np.ones((S, S), np.uint8))
        dark_mask = cv2.subtract(mask, warm_mask)
        body = (fill % path(trace(dark_mask), bx0, by0)) + ('<path fill="currentColor" fill-opacity=".5" fill-rule="evenodd" d="%s"/>' % path(trace(warm_mask), bx0, by0))
        polys = trace(mask)
    elif name in LEVELS:
        mid = ((up < LEVELS[name]) & (mask > 0)).astype(np.uint8) * 255
        mid = cv2.morphologyEx(mid, cv2.MORPH_OPEN, np.ones((2 * S, 2 * S), np.uint8))
        dark_mask = cv2.subtract(mask, mid)
        mid = cv2.dilate(mid, np.ones((3, 3), np.uint8))  # подложка под тёмным: без белого шва
        body = ('<path fill="currentColor" fill-opacity=".5" fill-rule="evenodd" d="%s"/>' % path(trace(mid), bx0, by0)) + (fill % path(trace(dark_mask), bx0, by0))
        polys = trace(mask)
    elif name in GRAD:
        rgb = np.asarray(white.convert('RGB'), dtype=np.float32)[y0:y1, x0:x1]
        sat = rgb.max(2) - rgb.min(2)
        sat_up = cv2.resize(sat, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
        mark = ((sat_up > 30) & (mask > 0)).astype(np.uint8) * 255
        mark = cv2.morphologyEx(mark, cv2.MORPH_OPEN, np.ones((2 * S, 2 * S), np.uint8))
        text = cv2.subtract(mask, cv2.dilate(mark, np.ones((3, 3), np.uint8)))
        text = cv2.morphologyEx(text, cv2.MORPH_OPEN, np.ones((S, S), np.uint8))
        # Тон знака: густота исходных цветов раскладывается на 8 ступеней прозрачности (0,3 … 1), слои лежат один на другом —
        # получается плавный серый «градиент»: тёмный фиолетовый, светлее оранжевый, тёмная тень на стыке.
        dens = 255.0 - gray[y0:y1, x0:x1]
        core = sat > 60
        lo, hi = np.percentile(dens[core], 3), np.percentile(dens[core], 97)
        dens_up = cv2.GaussianBlur(cv2.resize(dens, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC), (0, 0), 1.2 * S / 2)
        tone = 0.3 + 0.7 * np.clip((dens_up - lo) / (hi - lo), 0, 1)
        N = 8
        levels = [0.3 + 0.7 * j / (N - 1) for j in range(N)]
        layers = []
        prev = 0.0
        for j, lv in enumerate(levels):
            region = mark if j == 0 else ((tone >= lv - 0.35 / (N - 1)) & (mark > 0)).astype(np.uint8) * 255
            region = cv2.morphologyEx(region, cv2.MORPH_OPEN, np.ones((S, S), np.uint8)) if j else region
            alpha = lv if j == 0 else 1 - (1 - lv) / (1 - prev)
            layers.append('<path fill="currentColor" fill-opacity="%.2f" fill-rule="evenodd" d="%s"/>' % (alpha, path(trace(region), bx0, by0)))
            prev = lv
        body = ''.join(layers) + (fill % path(trace(text), bx0, by0))
        polys = trace(mask)
    else:
        polys = trace(mask)
        body = fill % path(polys, bx0, by0)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.1f}" height="{h:.1f}" focusable="false">{body}</svg>\n')
    with open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf-8', newline='') as f:
        f.write(svg)
    print(f'{name}: {w:.0f}x{h:.0f}, контуров {len(polys)}, {len(svg) // 1024} КБ')
