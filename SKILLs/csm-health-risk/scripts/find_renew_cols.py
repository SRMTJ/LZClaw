import zipfile, re, json
from datetime import datetime, timedelta

fname = '客户成功总表.xlsx'

def get_shared_strings(z):
    try:
        xml = z.read('xl/sharedStrings.xml').decode('utf-8')
    except KeyError:
        try:
            xml = z.read('xl/SharedStrings.xml').decode('utf-8')
        except KeyError:
            return []
    return re.findall(r'<t[^>]*>(.*?)</t>', xml, re.DOTALL)

def get_sheet_path(z):
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    rid_map = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        rid_map[m.group(1)] = m.group(2)
    wb = z.read('xl/workbook.xml').decode()
    entries = re.findall(r'name="([^"]+)"[^>]+r:id="(rId\d+)"', wb)
    for name, rid in entries:
        if '增鑫' in name and '总表' in name:
            path = rid_map.get(rid, '').lstrip('/')
            if not path.startswith('xl/'):
                path = 'xl/' + path
            return path
    return None

def read_sheet_headers(z, path, ss):
    xml = z.read(path).decode('utf-8')
    sd = re.search(r'<sheetData>(.*?)</sheetData>', xml, re.DOTALL)
    if not sd:
        return {}
    rows = re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sd.group(1), re.DOTALL)
    if not rows:
        return {}
    _, row_content = rows[0]
    cells = re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', row_content, re.DOTALL)
    header = {}
    for ref, attrs, content in cells:
        col = re.match(r'([A-Z]+)', ref).group(1)
        t_type = re.search(r'\bt="([^"]+)"', attrs)
        v_match = re.search(r'<v>(.*?)</v>', content)
        t_match = re.search(r'<t[^>]*>(.*?)</t>', content)
        if t_match:
            val = t_match.group(1)
        elif v_match and t_type and t_type.group(1) == 's':
            idx = int(v_match.group(1))
            val = ss[idx] if idx < len(ss) else ''
        elif v_match:
            val = v_match.group(1)
        else:
            val = ''
        header[col] = val
    return header

with zipfile.ZipFile(fname) as z:
    ss = get_shared_strings(z)
    path = get_sheet_path(z)
    header = read_sheet_headers(z, path, ss)

print("续费/到期相关字段：")
keywords = ['到期', '续费日', '年费', '合同', '有效期', '截止', '服务期', '开始', '签约']
for col, val in sorted(header.items()):
    if any(kw in val for kw in keywords):
        print(f"  {col}: {val}")

print("\n已知续费相关列：")
for col in ['BB','BC','BD','BE','BF','BK','CF','CG','CH','CI','CJ','CK']:
    if col in header:
        print(f"  {col}: {header[col]}")
