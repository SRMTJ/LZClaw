#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import zipfile, re, glob, os, sys

# 找到数据表目录下的xlsx文件
path = os.getcwd()
files = glob.glob(os.path.join(path, '*.xlsx'))

# 找到包含"客户成功"或"增鑫"的文件
fname = None
for f in files:
    try:
        with zipfile.ZipFile(f) as z:
            wb = z.read('xl/workbook.xml').decode('utf-8')
            if '增鑫' in wb or '客户成功' in wb:
                fname = f
                break
    except:
        pass

if not fname:
    print("未找到客户成功总表文件")
    sys.exit(1)

def get_shared_strings(z):
    try:
        xml = z.read('xl/sharedStrings.xml').decode('utf-8')
        return re.findall(r'<t[^>]*>(.*?)</t>', xml, re.DOTALL)
    except:
        return []

def get_sheet_names(z):
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    rid_map = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        rid_map[m.group(1)] = m.group(2)
    wb = z.read('xl/workbook.xml').decode()
    entries = re.findall(r'name="([^"]+)"[^>]+r:id="(rId\d+)"', wb)
    result = {}
    for name, rid in entries:
        path = rid_map.get(rid, '').lstrip('/')
        if not path.startswith('xl/'):
            path = 'xl/' + path
        result[name] = path
    return result

def read_sheet(z, path, ss):
    xml = z.read(path).decode('utf-8')
    sd = re.search(r'<sheetData>(.*?)</sheetData>', xml, re.DOTALL)
    if not sd:
        return []
    rows_data = []
    rows = re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sd.group(1), re.DOTALL)
    for row_num, row_content in rows:
        cells = re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', row_content, re.DOTALL)
        row_vals = {}
        for ref, attrs, content in cells:
            col = re.match(r'([A-Z]+)', ref).group(1)
            t_type = re.search(r'\bt="([^"]+)"', attrs)
            v_match = re.search(r'<v>(.*?)</v>', content)
            t_match = re.search(r'<t[^>]*>(.*?)</t>', content)
            if t_match:
                val = t_match.group(1)
            elif v_match:
                if t_type and t_type.group(1) == 's':
                    idx = int(v_match.group(1))
                    val = ss[idx] if idx < len(ss) else ''
                else:
                    val = v_match.group(1)
            else:
                val = ''
            row_vals[col] = val
        rows_data.append((int(row_num), row_vals))
    return rows_data

with zipfile.ZipFile(fname) as z:
    ss = get_shared_strings(z)
    sheets = get_sheet_names(z)
    
    # 找到包含"增鑫"和"总表"的sheet
    target_sheet = None
    for sheet_name in sheets.keys():
        if '增鑫' in sheet_name and '总表' in sheet_name:
            target_sheet = sheet_name
            break
    
    if not target_sheet:
        print("可用sheet列表:")
        for name in sheets.keys():
            print(f"  - {name}")
        sys.exit(1)
    
    rows = read_sheet(z, sheets[target_sheet], ss)

# 打印表头行，找所有列名
header_row = rows[0][1]
print("所有列标题：")
for col, val in sorted(header_row.items()):
    if val.strip():
        print(f"  {col}: {val}")

# 再抽查前3条数据行，看续费相关字段的值
print("\n前3条数据样本（关注续费/意向相关字段）：")
keywords = ['续', '意向', '不续', '风险', '经营', '场景']
for rn, rv in rows[1:4]:
    name = rv.get('B', '')
    print(f"\n  客户: {name}")
    for col, val in sorted(rv.items()):
        h = header_row.get(col, '')
        if any(kw in h for kw in keywords) and val.strip():
            print(f"    {col}({h}): {val}")
