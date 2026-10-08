import zipfile, re
path = r'c:\Users\lyh\.trae-cn\attachments\6ac2a83de89284df23b21b6c\701ade55-a079-4315-8787-941e19100f5e_5c396821-42e2-4f6c-8ce3-a5f35adff59f_S4A_产品说明书.docx'

with zipfile.ZipFile(path) as z:
    dm = z.read('word/document.xml').decode('utf-8')
    
    paras = re.findall(r'<w:p[ >](.*?)</w:p>', dm, re.DOTALL)
    print(f'共 {len(paras)} 个段落\n')
    
    # 分析前20个段落的详细格式
    for i, p in enumerate(paras[:25]):
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
        txt = ''.join(texts)
        if not txt.strip():
            continue
        
        # 段落属性
        pPr_m = re.search(r'<w:pPr>(.*?)</w:pPr>', p, re.DOTALL)
        pPr = pPr_m.group(1) if pPr_m else ''
        
        # 对齐
        jc = re.search(r'w:val="([^"]+)"', re.search(r'<w:jc[^>]*/>', pPr).group(0) if re.search(r'<w:jc[^>]*/>', pPr) else '')
        align = jc.group(1) if jc else 'left'
        
        # 缩进
        ind_m = re.search(r'<w:ind([^/]*)/>', pPr)
        ind = ind_m.group(1) if ind_m else ''
        
        # 段前段后
        sp_m = re.search(r'<w:spacing([^/]*)/>', pPr)
        sp = sp_m.group(1) if sp_m else ''
        
        # 运行属性（取第一个有 rPr 的 run）
        rPr_m = re.search(r'<w:rPr>(.*?)</w:rPr>', p, re.DOTALL)
        rPr = rPr_m.group(1) if rPr_m else ''
        
        # 字号
        sz_m = re.search(r'w:sz w:val="(\d+)"', rPr)
        sz = sz_m.group(1) if sz_m else '?'
        
        # 字体
        rFonts_m = re.search(r'<w:rFonts([^/]*)/>', rPr)
        rFonts = rFonts_m.group(1) if rFonts_m else ''
        
        # 加粗
        bold = 'Y' if re.search(r'<w:b/>', rPr) else 'N'
        
        print(f'P{i}: [{txt[:28]:28s}]')
        print(f'    align={align}  sz={sz}  bold={bold}')
        print(f'    spacing: {sp.strip()}')
        print(f'    indent:  {ind.strip()}')
        print(f'    fonts:   {rFonts.strip()}')
        print()
