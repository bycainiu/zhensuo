#!/usr/bin/env python3
"""Editorial 1200×630 share card for 帧索 FrameSeek. Staged under .grok/ only."""

from __future__ import annotations

import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 2400, 1260  # 2×, downscaled at the end
CX, CY = W // 2, H // 2

INK = (9, 9, 11, 255)
PAPER = (244, 244, 245, 255)
SILVER = (200, 204, 212, 255)

ZH_FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
EN_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def hex_rgba(rgb, a=255):
    return (rgb[0], rgb[1], rgb[2], a)


def draw_ring(draw, c, r, width, fill):
    bbox = [c[0] - r, c[1] - r, c[0] + r, c[1] + r]
    draw.ellipse(bbox, outline=fill, width=width)


def hexagon_pts(c, r, rot_deg=0.0):
    pts = []
    for i in range(6):
        a = math.radians(rot_deg + i * 60.0)
        pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    return pts


def tracked_text(draw, text, font, fill, y, tracking, anchor_x=CX):
    widths = []
    for ch in text:
        bbox = font.getbbox(ch)
        widths.append(bbox[2] - bbox[0])
    total = sum(widths) + tracking * (len(text) - 1)
    x = anchor_x - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill, anchor="lt")
        x += w + tracking
    return total


def main():
    rng = random.Random(27)
    base = Image.new("RGBA", (W, H), INK)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    well = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(well)
    for i, r in enumerate(range(620, 80, -8)):
        t = i / 70.0
        a = int(28 * (1.0 - t) ** 2)
        wd.ellipse([CX - r, CY - r, CX + r, CY + r], fill=(18, 18, 20, a))
    base = Image.alpha_composite(base, well)

    rings = [
        (560, 3, 32),
        (508, 2, 46),
        (430, 5, 78),
        (318, 2, 40),
        (236, 6, 36),
        (168, 2, 22),
    ]
    for r, w, a in rings:
        draw_ring(d, (CX, CY), r, w, hex_rgba(SILVER, a))

    hex_r = 390
    d.polygon(hexagon_pts((CX, CY), hex_r, rot_deg=90), outline=hex_rgba(SILVER, 78), width=3)
    d.polygon(hexagon_pts((CX, CY), hex_r - 18, rot_deg=90), outline=hex_rgba(SILVER, 36), width=2)

    blade_r = 470
    for i in range(6):
        a0 = math.radians(90 + i * 60 - 11)
        a1 = math.radians(90 + i * 60 + 11)
        p0 = (CX + blade_r * math.cos(a0), CY + blade_r * math.sin(a0))
        p1 = (CX + blade_r * math.cos(a1), CY + blade_r * math.sin(a1))
        inner = 210
        mid = math.radians(90 + i * 60)
        p2 = (CX + inner * math.cos(mid), CY + inner * math.sin(mid))
        d.polygon([p0, p1, p2], outline=hex_rgba(SILVER, 48), width=2)

    draw_ring(d, (CX, CY), 132, 3, hex_rgba(SILVER, 40))

    m, arm, thick = 96, 72, 4
    silver_mark = hex_rgba(SILVER, 90)
    corners = [
        (m, m, 1, 1),
        (W - m, m, -1, 1),
        (m, H - m, 1, -1),
        (W - m, H - m, -1, -1),
    ]
    for x, y, sx, sy in corners:
        d.line([(x, y), (x + sx * arm, y)], fill=silver_mark, width=thick)
        d.line([(x, y), (x, y + sy * arm)], fill=silver_mark, width=thick)

    base = Image.alpha_composite(base, overlay)

    # Soft ink plate so the wordmark sits on a quiet field
    plate = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.ellipse([CX - 520, CY - 280, CX + 520, CY + 280], fill=(9, 9, 11, 210))
    plate = plate.filter(ImageFilter.GaussianBlur(radius=28))
    base = Image.alpha_composite(base, plate)

    grain = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gp = grain.load()
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            n = rng.randint(0, 18)
            gp[x, y] = (200, 204, 212, n)
    grain = grain.filter(ImageFilter.GaussianBlur(radius=0.6))
    base = Image.alpha_composite(base, grain)

    type_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(type_layer)
    zh = ImageFont.truetype(ZH_FONT, 268, index=0)
    en = ImageFont.truetype(EN_BOLD, 44)

    zh_text = "帧索"
    zb = zh.getbbox(zh_text)
    zh_w, zh_h = zb[2] - zb[0], zb[3] - zb[1]
    zh_x = CX - zh_w / 2 - zb[0]
    zh_y = CY - 168
    td.text((zh_x, zh_y), zh_text, font=zh, fill=PAPER)

    rule_w = 420
    rule_y = zh_y + zh_h + 36
    td.line(
        [(CX - rule_w / 2, rule_y), (CX + rule_w / 2, rule_y)],
        fill=hex_rgba(SILVER, 140),
        width=2,
    )

    en_y = rule_y + 28
    tracked_text(td, "FRAMESEEK", en, SILVER, en_y, tracking=22)

    base = Image.alpha_composite(base, type_layer)

    out = base.convert("RGB").resize((1200, 630), Image.Resampling.LANCZOS)
    dest = "/workspace/.grok/card-raw.jpg"
    out.save(dest, "JPEG", quality=95, subsampling=0, optimize=True)
    print(f"wrote {dest} {out.size}")


if __name__ == "__main__":
    main()
