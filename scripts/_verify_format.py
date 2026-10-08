import zipfile, re
import sys

def check_format(path, name):
    print(f'\n{"="*50}')
    print(f'  格式校验: {name}')
    print(f'{"="*50}')
    
    with zipfile.ZipFile(path) as z:
        dm = z.read('word/document.xml').decode('utf-8')
        
        # 页面设置
        sect_m = re.findall(r'<w:sectPr[^>]*?>(.*?)</w:sectPr>', dm, re.DOTALL)
        if sect_m:
            s = sect_m[-1]
            pgSz = re.search(r'w:pgSz w:w="(\d+)" w:h="(\d+)"', s)
            pgMar = re.search(r'w:pgMar w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"', s)
            if pgSz:
                print(f'  页面大小: {pgSz.group(1)} x {pgSz.group(2)} (参考: 11906 x 16838) {"✓" if pgSz.group(1)=="11906" and pgSz.group(2)=="16838" else "✗"}')
            if pgMar:
                print(f'  页边距: 上{pgMar.group(1)} 下{pgMar.group(3)} 左{pgMar.group(4)} 右{pgMar.group(2)} (参考: 上1440 下1440 左1800 右1800) {"✓" if pgMar.group(1)=="1440" and pgMar.group(3)=="1440" and pgMar.group(4)=="1800" and pgMar.group(2)=="1800" else "✗"}')
        
        # 段落抽样检查
        paras = re.findall(r'<w:p[ >](.*?)</w:p>', dm, re.DOTALL)
        print(f'\n  段落总数: {len(paras)}')
        
        # 检查前5个非空段落的格式
        checked = 0
        for i, p in enumerate(paras):
            texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
            txt = ''.join(texts).strip()
            if not txt:
                continue
            if checked >= 5:
                break
            checked += 1
            
            # 字号
            sz_m = re.search(r'w:sz w:val="(\d+)"', p)
            sz = sz_m.group(1) if sz_m else '?'
            
            # 字体
            rFonts_m = re.search(r'<w:rFonts[^>]*w:eastAsia="([^"]+)"', p)
            font = rFonts_m.group(1) if rFonts_m else '?'
            
            # 西文字体
            ascii_m = re.search(r'<w:rFonts[^>]*w:ascii="([^"]+)"', p)
            ascii_font = ascii_m.group(1) if ascii_m else '?'
            
            # 加粗
            bold = 'Y' if re.search(r'<w:b/>', p) else 'N'
            
            # 对齐
            jc_m = re.search(r'<w:jc w:val="([^"]+)"', p)
            align = jc_m.group(1) if jc_m else 'left'
            
            # 行距
            line_m = re.search(r'w:line="(\d+)" w:lineRule="([^"]+)"', p)
            line = f'{line_m.group(1)}/{line_m.group(2)}' if line_m else '?'
            
            # 首行缩进
            ind_m = re.search(r'w:firstLine="(\d+)"', p)
            indent = ind_m.group(1) if ind_m else '无'
            
            print(f'\n  段落"{txt[:20]}":')
            print(f'    字号: {sz}  字体(中): {font}  字体(西): {ascii_font}  加粗: {bold}')
            print(f'    对齐: {align}  行距: {line}  首行缩进: {indent}')
        
        # 页眉检查
        try:
            hdr = z.read('word/header1.xml').decode('utf-8')
            hdr_texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', hdr)
            hdr_txt = ''.join(hdr_texts)
            hdr_sz = re.search(r'w:sz w:val="(\d+)"', hdr)
            hdr_font = re.search(r'<w:rFonts[^>]*w:eastAsia="([^"]+)"', hdr)
            hdr_bold = 'Y' if '<w:b/>' in hdr else 'N'
            print(f'\n  页眉: "{hdr_txt}"  字号: {hdr_sz.group(1) if hdr_sz else "?"}  字体: {hdr_font.group(1) if hdr_font else "?"}  加粗: {hdr_bold}')
        except:
            print('\n  页眉: 无 (或读取失败)')
        
        # 页脚检查
        try:
            ftr = z.read('word/footer1.xml').decode('utf-8')
            has_page = 'PAGE' in ftr
            print(f'  页脚: {"有PAGE域" if has_page else "无页码"}')
        except:
            print('  页脚: 无 (或读取失败)')

check_format(r'd:\项目文件夹\aigc课程\docs\撰写材料\S2A_目标与服务模型.docx', 'S2A')
check_format(r'd:\项目文件夹\aigc课程\docs\撰写材料\S2B_组织管理与业务分析方案.docx', 'S2B')
check_format(r'd:\项目文件夹\aigc课程\docs\撰写材料\S2C_技术路线及实现方案.docx', 'S2C')
check_format(r'd:\项目文件夹\aigc课程\docs\撰写材料\S2D_成本模型及可行性分析.docx', 'S2D')

print(f'\n\n{"="*50}')
print('  参考文档基准值:')
print(f'  页面: 11906x16838 | 边距: 上1440 下1440 左1800 右1800')
print('  标题: 黑体+TNR 18pt(36) 居中 / 16pt(32) 两端 / 15pt(30) 左')
print('  正文: 仿宋+TNR 14pt(28) 首行缩进560')
print('  图注: 仿宋+TNR 12pt(24) 居中')
print('  行距: 360/auto (1.5倍)')
print('  页眉: 仿宋 12pt 加粗')
print('  页脚: 居中页码')
print(f'{"="*50}')
