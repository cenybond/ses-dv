"""Нарезка видео hero на кадры для прокрутки (src/scripts/hero-frame.ts).

Запуск:  python scripts/build-hero-frames.py <путь к mp4> [шаг=2]
Нужны: ffmpeg в PATH, python-пакеты opencv-python-headless, numpy, pillow.

Что делает
1. Берёт каждый `шаг`-й кадр видео (121 кадр при шаге 2 → 61).
2. Совмещает первый кадр видео с фотографией hero на сайте (SIFT + подобранное преобразование «сдвиг + масштаб») и применяет
   это же преобразование ко всем кадрам: здание, деревья и скамейки стоят ровно там же, где на фото.
3. Кадр 0000 — сама фотография (копия файла, 1 в 1). Следующие кадры плавно (smoothstep на RAMP кадрах) переходят
   от фотографии к кадрам видео: небо и мелкие детали в видео перерисованы, без перехода был бы заметен скачок.
4. Поля, куда видео не дотягивает (оно уже фотографии), заполняются растяжением края кадра.
5. Пишет WebP: lg (ширина фото, 1792). Набор sm не нужен: до 960 px кадры не проигрываются (решение владельца 2026-11-19).
Исходное видео в репозиторий не кладём: оно 13 МБ; кадры — результат, скрипт — воспроизводимость.
"""
import os, shutil, subprocess, sys, tempfile
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTO = os.path.join(ROOT, 'design/client-preview/hero/assets/hero-building.webp')
OUT = os.path.join(ROOT, 'design/client-preview/hero/frames')
RAMP = 8          # на скольких кадрах фото переходит в видео
SIZES = {'lg': (1792, 72)}   # ширина, качество WebP

if len(sys.argv) < 2:
    sys.exit(__doc__)
video = sys.argv[1]
step = int(sys.argv[2]) if len(sys.argv) > 2 else 2

tmp = tempfile.mkdtemp(prefix='hero-frames-')
try:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select=not(mod(n\\,{step}))', '-fps_mode', 'vfr',
                    os.path.join(tmp, 'f%04d.png')], check=True)
    files = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    print('кадров:', len(files))

    photo = cv2.imdecode(np.fromfile(PHOTO, np.uint8), cv2.IMREAD_COLOR)
    ph, pw = photo.shape[:2]
    first = cv2.imread(os.path.join(tmp, files[0]))

    # совмещение первого кадра с фото: только верхняя часть кадра, где сцена та же (ниже в видео срез земли)
    sift = cv2.SIFT_create(4000)
    k0, d0 = sift.detectAndCompute(cv2.cvtColor(first, cv2.COLOR_BGR2GRAY)[:900], None)
    kp, dp = sift.detectAndCompute(cv2.cvtColor(photo, cv2.COLOR_BGR2GRAY), None)
    good = [a for a, b in cv2.BFMatcher().knnMatch(d0, dp, k=2) if a.distance < 0.7 * b.distance]
    src = np.float32([k0[a.queryIdx].pt for a in good]); dst = np.float32([kp[a.trainIdx].pt for a in good])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    print('масштаб %.4f, сдвиг %.1f/%.1f, точек %d из %d' % (np.hypot(M[0, 0], M[1, 0]), M[0, 2], M[1, 2], inl.sum(), len(good)))

    for name, (width, quality) in SIZES.items():
        d = os.path.join(OUT, name)
        shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        w = width; h = round(ph * width / pw)
        photo_s = cv2.resize(photo, (w, h), interpolation=cv2.INTER_AREA)
        k = w / pw
        Ms = M.copy(); Ms[:, :2] *= k; Ms[:, 2] *= k
        for i, f in enumerate(files):
            if i == 0:
                # кадр 0 = фото 1 в 1 (для lg — тот же файл, для sm — то же фото, уменьшенное)
                if name == 'lg':
                    shutil.copyfile(PHOTO, os.path.join(d, '0000.webp'))
                else:
                    Image.fromarray(cv2.cvtColor(photo_s, cv2.COLOR_BGR2RGB)).save(os.path.join(d, '0000.webp'), quality=quality, method=6)
                continue
            fr = cv2.imread(os.path.join(tmp, f))
            warped = cv2.warpAffine(fr, Ms, (w, h), flags=cv2.INTER_AREA if k < 0.8 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            t = min(1.0, i / RAMP)
            a = t * t * (3 - 2 * t)  # smoothstep
            out = cv2.addWeighted(photo_s, 1 - a, warped, a, 0) if a < 1 else warped
            Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).save(os.path.join(d, f'{i:04d}.webp'), quality=quality, method=6)
        size = sum(os.path.getsize(os.path.join(d, x)) for x in os.listdir(d))
        print(f'{name}: {len(files)} кадров {w}x{h}, {size / 1e6:.1f} МБ')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
