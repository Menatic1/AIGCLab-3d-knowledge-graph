import zipfile, re
path = r'c:\Users\lyh\.trae-cn\attachments\6ac2a83de89284df23b21b6c\701ade55-a079-4315-8787-941e19100f5e_5c396821-42e2-4f6c-8ce3-a5f35adff59f_S4A_产品说明书.docx'

with zipfile.ZipFile(path) as z:
    hdr = z.read('word/header1.xml').decode('utf-8')
    print('=== 页眉完整内容 ===')
    print(hdr)
    
    ftr = z.read('word/footer1.xml').decode('utf-8')
    print('\n=== 页脚完整内容 ===')
    print(ftr)
    
    # 段前段后距
    dm = z.read('word/document.xml').decode('utf-8')
    paras = re.findall(r'<w:p[ >](.*?)</w:p>', dm, re.DOTALL)
    print('\n=== 各段落 spacing 详情 ===')
    for i, p in enumerate(paras[:25]):
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
        txt = ''.join(texts).strip()
        if not txt:
            continue
        sp_m = re.search(r'<w:spacing([^/]*)/>', p)
        sp = sp_m.group(1).strip() if sp_m else 'none'
        pPr_m = re.search(r'<w:pPr>(.*?)</w:pPr>', p, re.DOTALL)
        pPr = pPr_m.group(1) if pPr_m else ''
        # 提取 spacing
        for attr in ['before', 'after', 'line', 'lineRule']:
            m = re.search(rf'w:{attr}="([^"]+)"', sp)
            if m:
                pass
        # 找大纲级别
        outline = re.search(r'w:outlineLvl w:val="(\d+)"', pPr)
        ol = outline.group(1) if outline else 'none'
        print(f'  P{i:2d} [{txt[:20]:20s}] spacing=[{sp}] outlineLvl={ol}')
