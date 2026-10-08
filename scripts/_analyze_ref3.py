import zipfile, re
path = r'c:\Users\lyh\.trae-cn\attachments\6ac2a83de89284df23b21b6c\701ade55-a079-4315-8787-941e19100f5e_5c396821-42e2-4f6c-8ce3-a5f35adff59f_S4A_产品说明书.docx'

with zipfile.ZipFile(path) as z:
    dm = z.read('word/document.xml').decode('utf-8')
    
    # 检查是否有表格
    tables = re.findall(r'<w:tbl[ >](.*?)</w:tbl>', dm, re.DOTALL)
    print(f'表格数量: {len(tables)}')
    
    if tables:
        for ti, t in enumerate(tables):
            print(f'\n=== 表格 {ti} ===')
            # 表格属性
            tblPr_m = re.search(r'<w:tblPr>(.*?)</w:tblPr>', t, re.DOTALL)
            if tblPr_m:
                print('  tblPr:', tblPr_m.group(1)[:500])
            
            # 表格行
            rows = re.findall(r'<w:tr[ >](.*?)</w:tr>', t, re.DOTALL)
            print(f'  行数: {len(rows)}')
            
            for ri, row in enumerate(rows[:3]):
                cells = re.findall(r'<w:tc[ >](.*?)</w:tc>', row, re.DOTALL)
                print(f'  行{ri}: {len(cells)} 个单元格')
                for ci, cell in enumerate(cells):
                    tcPr_m = re.search(r'<w:tcPr>(.*?)</w:tcPr>', cell, re.DOTALL)
                    tcPr = tcPr_m.group(1) if tcPr_m else ''
                    
                    # 单元格文本
                    cell_texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', cell)
                    cell_txt = ''.join(cell_texts)[:20]
                    
                    # 单元格内段落属性
                    p_m = re.search(r'<w:pPr>(.*?)</w:pPr>', cell, re.DOTALL)
                    pPr = p_m.group(1) if p_m else ''
                    jc = re.search(r'w:val="([^"]+)"', re.search(r'<w:jc[^>]*/>', pPr).group(0)) if re.search(r'<w:jc[^>]*/>', pPr) else None
                    align = jc.group(1) if jc else 'left'
                    
                    # 运行属性
                    rPr_m = re.search(r'<w:rPr>(.*?)</w:rPr>', cell, re.DOTALL)
                    rPr = rPr_m.group(1) if rPr_m else ''
                    sz_m = re.search(r'w:sz w:val="(\d+)"', rPr)
                    sz = sz_m.group(1) if sz_m else '?'
                    bold = 'Y' if re.search(r'<w:b/>', rPr) else 'N'
                    
                    # 字体
                    rFonts_m = re.search(r'<w:rFonts([^/]*)/>', rPr)
                    fonts = rFonts_m.group(1) if rFonts_m else ''
                    
                    # 底纹
                    shd_m = re.search(r'<w:shd([^/]*)/>', tcPr)
                    shd = shd_m.group(1) if shd_m else 'none'
                    
                    print(f'    单元格{ci}: "{cell_txt}" align={align} sz={sz} bold={bold} shd={shd.strip()[:50]}')
                    if fonts:
                        print(f'            fonts: {fonts.strip()[:80]}')
    
    # 检查页眉页脚
    print('\n=== 页眉 ===')
    hdr = z.read('word/header1.xml').decode('utf-8')
    hdr_texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', hdr)
    print('  文本:', ''.join(hdr_texts))
    
    print('\n=== 页脚 ===')
    ftr = z.read('word/footer1.xml').decode('utf-8')
    ftr_texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', ftr)
    print('  文本:', ''.join(ftr_texts))
