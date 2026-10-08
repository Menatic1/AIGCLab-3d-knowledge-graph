import zipfile, re
path = r'c:\Users\lyh\.trae-cn\attachments\6ac2a83de89284df23b21b6c\701ade55-a079-4315-8787-941e19100f5e_5c396821-42e2-4f6c-8ce3-a5f35adff59f_S4A_产品说明书.docx'

with zipfile.ZipFile(path) as z:
    print('=== 文件列表 ===')
    for n in z.namelist():
        print(' ', n)

    sx = z.read('word/styles.xml').decode('utf-8')
    print('\n=== 所有样式ID和名称 ===')
    for m in re.finditer(r'<w:style[^>]*?w:styleId="([^"]+)"[^>]*?>.*?<w:name w:val="([^"]+)"', sx, re.DOTALL):
        print(f'  {m.group(1):30s} -> {m.group(2)}')

    # 提取 Normal 正文样式详情
    print('\n=== Normal 正文样式 ===')
    nm = re.search(r'<w:style[^>]*?w:styleId="Normal"[^>]*?>(.*?)</w:style>', sx, re.DOTALL)
    if nm:
        print(nm.group(1)[:2000])

    # 提取标题样式
    for sid in ['Heading1', 'Heading2', 'Heading3', 'Title']:
        m = re.search(rf'<w:style[^>]*?w:styleId="{sid}"[^>]*?>(.*?)</w:style>', sx, re.DOTALL)
        if m:
            print(f'\n=== {sid} ===')
            print(m.group(1)[:2000])

    # 页面设置
    print('\n=== 页面设置 (sectPr) ===')
    dm = z.read('word/document.xml').decode('utf-8')
    sm = re.findall(r'<w:sectPr[^>]*?>(.*?)</w:sectPr>', dm, re.DOTALL)
    for i, s in enumerate(sm):
        print(f'  Section {i}:')
        print(s[:1500])

    # 检查文档中实际段落的格式
    print('\n=== 前 10 个段落的样式 ===')
    paras = re.findall(r'<w:p[ >].*?</w:p>', dm, re.DOTALL)
    for i, p in enumerate(paras[:10]):
        style_m = re.search(r'w:style="([^"]+)"', p)
        style = style_m.group(1) if style_m else '(none)'
        # 取文本
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
        txt = ''.join(texts)[:30]
        print(f'  P{i}: style={style:20s} text={txt}')
