import sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def para_text(p):
    return "".join(t.text or "" for t in p.iter(W + 't'))

def dump(path):
    print(f"\n\n########## {path} ##########")
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    body = root.find(W + 'body')
    for el in body:
        if el.tag == W + 'p':
            t = para_text(el).strip()
            if t:
                print(t)
        elif el.tag == W + 'tbl':
            print("  [TABLE]")
            for tr in el.findall(W + 'tr'):
                cells = []
                for tc in tr.findall(W + 'tc'):
                    cells.append(" ".join(para_text(p).strip() for p in tc.findall(W + 'p')).strip()[:60])
                print("   | " + " | ".join(cells))

for p in sys.argv[1:]:
    try:
        dump(p)
    except Exception as e:
        print(f"ERR {p}: {e}")