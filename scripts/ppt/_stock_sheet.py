import glob, os, re
from PIL import Image, ImageDraw

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_stock')
files = sorted(glob.glob(os.path.join(d, '*.jpg')))
cols, rows = 6, 7
tw, th = 320, 200
pad = 6
sheet = Image.new('RGB', (cols * tw + pad * (cols + 1), rows * th + pad * (rows + 1)), (24, 26, 30))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    r = max(tw / im.width, th / im.height)
    im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
    l = (im.width - tw) // 2
    t = (im.height - th) // 2
    im = im.crop((l, t, l + tw, t + th))
    c, rr = i % cols, i // cols
    x = pad + c * (tw + pad)
    y = pad + rr * (th + pad)
    sheet.paste(im, (x, y))
    n = os.path.splitext(os.path.basename(f))[0]
    dr.rectangle([x, y, x + 34, y + 22], fill=(0, 0, 0))
    dr.text((x + 9, y + 6), n, fill=(255, 255, 255))
out = os.path.join(d, '_sheet.png')
sheet.save(out)
print('OK', out, sheet.size, len(files))