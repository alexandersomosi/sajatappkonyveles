"""Kinyeri a letöltött hivatalos NAV-segédletekből a képeket (csak olvasás; semmit nem futtat a forrásból).
Használat: python -I kinyer.py <forras_mappa> <cel_mappa>   (kell: pip install pymupdf; a cél NE a _forras mappa legyen)
2026-11-18-án: python -I kinyer.py ../_forras <scratchpad>/kinyert  (uv-s Python 3.12, PyMuPDF 1.28.2)
"""
import sys, os, json, zipfile, re
import fitz  # PyMuPDF

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
meta = {}
for name in sorted(os.listdir(src)):
    p = os.path.join(src, name)
    base = os.path.splitext(name)[0]
    out = os.path.join(dst, base)
    os.makedirs(out, exist_ok=True)
    if name.lower().endswith('.pdf'):
        doc = fitz.open(p)
        info = {'pages': doc.page_count, 'metadata': doc.metadata, 'images': []}
        with open(os.path.join(out, 'szoveg.txt'), 'w', encoding='utf-8') as f:
            for i, page in enumerate(doc):
                f.write(f'\n===== OLDAL {i+1} =====\n')
                f.write(page.get_text())
                pix = page.get_pixmap(dpi=200)
                pix.save(os.path.join(out, f'oldal_{i+1:02d}.png'))
                for j, im in enumerate(page.get_images(full=True)):
                    xref = im[0]
                    try:
                        d = doc.extract_image(xref)
                    except Exception as e:
                        continue
                    ext = d.get('ext', 'png')
                    if ext not in ('png', 'jpeg', 'jpg', 'bmp', 'tiff'):
                        continue
                    fn = f'kep_o{i+1:02d}_{j+1:02d}.{ext}'
                    with open(os.path.join(out, fn), 'wb') as g:
                        g.write(d['image'])
                    rects = [list(r) for r in page.get_image_rects(xref)]
                    info['images'].append({'file': fn, 'page': i+1, 'w': d.get('width'), 'h': d.get('height'), 'rects': rects})
        meta[name] = info
    elif name.lower().endswith('.pptx'):
        z = zipfile.ZipFile(p)
        info = {'slides': [], 'media': []}
        slides = sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)], key=lambda s: int(re.findall(r'\d+', s)[0]))
        with open(os.path.join(out, 'szoveg.txt'), 'w', encoding='utf-8') as f:
            for s in slides:
                num = int(re.findall(r'\d+', s)[0])
                xml = z.read(s).decode('utf-8', 'replace')
                txt = ' | '.join(re.findall(r'<a:t>([^<]*)</a:t>', xml))
                rels_name = f'ppt/slides/_rels/slide{num}.xml.rels'
                media = []
                if rels_name in z.namelist():
                    rels = z.read(rels_name).decode('utf-8', 'replace')
                    media = re.findall(r'Target="\.\./media/([^"]+)"', rels)
                f.write(f'\n===== DIA {num} ===== kepek: {media}\n{txt}\n')
                info['slides'].append({'slide': num, 'media': media})
        for n in z.namelist():
            if n.startswith('ppt/media/'):
                fn = os.path.basename(n)
                if os.path.splitext(fn)[1].lower() in ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.emf', '.wmf', '.svg'):
                    with open(os.path.join(out, fn), 'wb') as g:
                        g.write(z.read(n))
                    info['media'].append(fn)
        meta[name] = info
with open(os.path.join(dst, 'meta.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print('kész', {k: (v.get('pages') or len(v.get('slides', []))) for k, v in meta.items()})
