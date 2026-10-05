"""
Generate crisp, beautiful icons for CookieSmith at 16x16, 48x48, and 128x128 PNG dimensions.
Uses standard library struct and zlib - zero external dependencies required.
CookieSmith aesthetic: Golden cookie + blacksmith anvil / spark motif.
"""

import os
import math
import struct
import zlib

def make_png(width, height, rgba_data):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(rgba_data[y * width * 4 : (y + 1) * width * 4])
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def blend_pixel(bg, fg, alpha_factor=1.0):
    """fg and bg are (r, g, b, a). Returns blended (r, g, b, a)."""
    fg_a = (fg[3] / 255.0) * alpha_factor
    bg_a = bg[3] / 255.0
    out_a = fg_a + bg_a * (1.0 - fg_a)
    if out_a <= 0:
        return (0, 0, 0, 0)
    out_r = (fg[0] * fg_a + bg[0] * bg_a * (1.0 - fg_a)) / out_a
    out_g = (fg[1] * fg_a + bg[1] * bg_a * (1.0 - fg_a)) / out_a
    out_b = (fg[2] * fg_a + bg[2] * bg_a * (1.0 - fg_a)) / out_a
    return (int(round(out_r)), int(round(out_g)), int(round(out_b)), int(round(out_a * 255)))

def render_cookiesmith_icon(size):
    # We will supersample 4x for smooth anti-aliasing
    scale = 4
    ss = size * scale
    buf = [(0, 0, 0, 0)] * (ss * ss)

    cx = ss / 2.0
    cy = ss / 2.0
    radius = ss * 0.44

    # Cookie colors: Warm golden amber cookie body with chocolate chips & anvil smith emblem
    # Base cookie body: circle with slight organic bite/indent
    cookie_color = (217, 140, 54, 255)       # Rich golden amber
    cookie_edge = (168, 98, 28, 255)         # Darker crust
    cookie_highlight = (245, 185, 100, 255)  # Warm highlight
    chip_color = (68, 38, 20, 255)           # Dark chocolate
    chip_high = (105, 60, 32, 255)

    # Chocolate chip centers relative to radius (dx, dy, chip_radius)
    chips = [
        (-0.45, -0.35, 0.16),
        (0.25, -0.45, 0.18),
        (-0.50, 0.25, 0.17),
        (0.48, 0.20, 0.15),
        (-0.10, -0.55, 0.13),
        (0.15, 0.45, 0.16),
    ]

    # Render background cookie
    for y in range(ss):
        for x in range(ss):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            if dist <= radius:
                # Edge shade
                edge_factor = dist / radius
                if edge_factor > 0.82:
                    t = (edge_factor - 0.82) / 0.18
                    r = int(cookie_color[0] * (1-t) + cookie_edge[0] * t)
                    g = int(cookie_color[1] * (1-t) + cookie_edge[1] * t)
                    b = int(cookie_color[2] * (1-t) + cookie_edge[2] * t)
                    buf[y * ss + x] = (r, g, b, 255)
                else:
                    # Top-left gentle highlight
                    hl = max(0.0, (-dx - dy) / (radius * 1.5)) * 0.35
                    r = min(255, int(cookie_color[0] + (cookie_highlight[0] - cookie_color[0]) * hl))
                    g = min(255, int(cookie_color[1] + (cookie_highlight[1] - cookie_color[1]) * hl))
                    b = min(255, int(cookie_color[2] + (cookie_highlight[2] - cookie_color[2]) * hl))
                    buf[y * ss + x] = (r, g, b, 255)

    # Draw chocolate chips
    for (cdx, cdy, cr) in chips:
        chip_cx = cx + cdx * radius
        chip_cy = cy + cdy * radius
        chip_r = cr * radius
        for y in range(max(0, int(chip_cy - chip_r - 2)), min(ss, int(chip_cy + chip_r + 3))):
            for x in range(max(0, int(chip_cx - chip_r - 2)), min(ss, int(chip_cx + chip_r + 3))):
                dx = x - chip_cx
                dy = y - chip_cy
                d = math.sqrt(dx*dx + dy*dy)
                if d <= chip_r:
                    # check if inside cookie
                    if math.sqrt((x - cx)**2 + (y - cy)**2) <= radius - 2:
                        buf[y * ss + x] = chip_color

    # In center: Anvil / Smith Hammer icon silhouette (crisp forge steel #1e293b with cyan glow #38bdf8)
    # Anvil coordinates centered
    anvil_y_mid = cy + ss * 0.04
    anvil_w_top = ss * 0.44
    anvil_h = ss * 0.28

    for y in range(int(anvil_y_mid - anvil_h/2), int(anvil_y_mid + anvil_h/2)):
        for x in range(int(cx - anvil_w_top/2 - ss*0.06), int(cx + anvil_w_top/2 + ss*0.06)):
            if 0 <= x < ss and 0 <= y < ss:
                rel_y = (y - (anvil_y_mid - anvil_h/2)) / anvil_h
                rel_x = (x - cx) / (anvil_w_top / 2)

                is_anvil = False
                # Top plate
                if rel_y < 0.32:
                    # horn on left, shelf on right
                    if -1.2 <= rel_x <= 1.0:
                        is_anvil = True
                # Waist / center column
                elif rel_y < 0.75:
                    if -0.42 <= rel_x <= 0.42:
                        is_anvil = True
                # Base foot
                else:
                    if -0.85 <= rel_x <= 0.85:
                        is_anvil = True

                if is_anvil:
                    # Steel dark navy with subtle bevel
                    bevel = 1.0 if rel_y < 0.15 else (0.85 if rel_x > 0.3 else 0.7)
                    sr = int(30 * bevel)
                    sg = int(41 * bevel)
                    sb = int(59 * bevel)
                    buf[y * ss + x] = (sr, sg, sb, 255)

    # Downsample supersampled grid to target size (box filter average)
    out_rgba = bytearray(size * size * 4)
    samples = scale * scale
    for y in range(size):
        for x in range(size):
            r_acc, g_acc, b_acc, a_acc = 0, 0, 0, 0
            for sy in range(scale):
                for sx in range(scale):
                    p = buf[(y * scale + sy) * ss + (x * scale + sx)]
                    r_acc += p[0]
                    g_acc += p[1]
                    b_acc += p[2]
                    a_acc += p[3]
            idx = (y * size + x) * 4
            out_rgba[idx + 0] = r_acc // samples
            out_rgba[idx + 1] = g_acc // samples
            out_rgba[idx + 2] = b_acc // samples
            out_rgba[idx + 3] = a_acc // samples

    return make_png(size, size, out_rgba)

def main():
    os.makedirs('icons', exist_ok=True)
    for size in [16, 48, 128]:
        png_data = render_cookiesmith_icon(size)
        filepath = os.path.join('icons', f'icon-{size}.png')
        with open(filepath, 'wb') as f:
            f.write(png_data)
        print(f"Created {filepath} ({size}x{size}, {len(png_data)} bytes)")

if __name__ == '__main__':
    main()
