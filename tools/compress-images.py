# Writes a compressed .webp next to every .png/.jpg in img/ that doesn't have one yet; originals stay as art sources.
#   python tools/compress-images.py [--force]
import fnmatch, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'img'
# Longest on-screen width (CSS px) x 3 for dense phone screens; the first matching glob wins, unmatched files keep their size.
MAX_W = [('islands/*', 1024), ('sky/cloud_*', 768), ('icons/*', 256)]
# Smooth gradients band at lower quality.
QUALITY = [('sky/sky_*', 92)]
DEFAULT_Q = 85

def pick(rules, rel, default):
    return next((v for pat, v in rules if fnmatch.fnmatch(rel.as_posix(), pat)), default)

force = '--force' in sys.argv
before = after = 0
for src in sorted(p for p in ROOT.rglob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg')):
    dst = src.with_suffix('.webp')
    if dst.exists() and not force:
        continue
    rel = src.relative_to(ROOT)
    im = Image.open(src)
    im = im.convert('RGBA' if 'A' in im.getbands() or 'transparency' in im.info else 'RGB')
    w = pick(MAX_W, rel, None)
    if w and im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=pick(QUALITY, rel, DEFAULT_Q), method=6)
    a, b = src.stat().st_size, dst.stat().st_size
    before += a; after += b
    print(f'{rel.as_posix():28} {im.width}x{im.height}  {a // 1024:>5} KB -> {b // 1024:>4} KB')
print(f'total {before // 1024} KB -> {after // 1024} KB' if before else 'nothing to compress')
