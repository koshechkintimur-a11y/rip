#!/usr/bin/env python3
"""Генерация PWA-иконок RIP: 512, 192, maskable."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

FONT = 'C:/Windows/Fonts/georgia.ttf'

def draw_rip(size):
    img = Image.new('RGB', (size, size), '#000000')
    d = ImageDraw.Draw(img)
    s = size / 512.0  # scale

    # скруглённый чёрный фон (радиус 112)
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=112 * s, fill=255)
    bg = Image.new('RGB', (size, size), '#000000')
    img = Image.composite(bg, img, mask)
    d = ImageDraw.Draw(img)

    # тень
    d.ellipse([256 * s - 150 * s, 410 * s - 16 * s, 256 * s + 150 * s, 410 * s + 16 * s], fill='#141414')

    # надгробье
    d.polygon([(156 * s, 410 * s), (156 * s, 220 * s)], fill=None)
    d.pieslice([156 * s, 120 * s, 356 * s, 320 * s], 180, 360, fill='#2E2E2E')
    d.rectangle([156 * s, 220 * s, 356 * s, 410 * s], fill='#2E2E2E')

    # внутренняя рамка (stroke)
    d.arc([178 * s, 148 * s, 334 * s, 304 * s], 180, 360, fill='#4B4B4B', width=max(2, int(4 * s)))
    d.line([(178 * s, 226 * s), (178 * s, 402 * s)], fill='#4B4B4B', width=max(2, int(4 * s)))
    d.line([(334 * s, 226 * s), (334 * s, 402 * s)], fill='#4B4B4B', width=max(2, int(4 * s)))
    d.line([(178 * s, 402 * s), (334 * s, 402 * s)], fill='#4B4B4B', width=max(2, int(4 * s)))

    # текст RIP
    font = ImageFont.truetype(FONT, int(76 * s))
    # letter-spacing 6: рисуем по буквам
    text = 'RIP'
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    spacing = 6 * s * 2  # letter-spacing с обеих сторон каждой буквы кроме первой? просто добавим суммарно
    total_w = tw + 6 * s * 2  # 2 промежутка между 3 буквами
    x = 256 * s - total_w / 2
    for ch in text:
        cb = d.textbbox((0, 0), ch, font=font)
        d.text((x - cb[0], 286 * s - (cb[1] + cb[3]) / 2), ch, font=font, fill='#C8C8C8')
        chw = cb[2] - cb[0]
        x += chw + 6 * s

    # линия земли
    d.line([(86 * s, 410 * s), (426 * s, 410 * s)], fill='#1C1C1C', width=max(3, int(8 * s)))

    return img

img512 = draw_rip(512)
img512.save(os.path.join(OUT, 'icon-512.png'))
print('icon-512.png', os.path.getsize(os.path.join(OUT, 'icon-512.png')))

img192 = draw_rip(192)
img192.save(os.path.join(OUT, 'icon-192.png'))
print('icon-192.png', os.path.getsize(os.path.join(OUT, 'icon-192.png')))

# maskable: контент в 80% центра
pad = int(512 * 0.1)
canvas = Image.new('RGB', (512, 512), '#000000')
inner = draw_rip(512).resize((512 - pad * 2, 512 - pad * 2), Image.LANCZOS)
canvas.paste(inner, (pad, pad))
canvas.save(os.path.join(OUT, 'icon-maskable-512.png'))
print('icon-maskable-512.png', os.path.getsize(os.path.join(OUT, 'icon-maskable-512.png')))

print('Готово')
