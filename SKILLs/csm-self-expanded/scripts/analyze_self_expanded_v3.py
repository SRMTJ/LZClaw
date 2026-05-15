import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

file_path = '销售管理表.xlsx'
sales_people = ['齐健彪', '肖芳', '李志远', '刘欣萌', '张浩', '范鑫']

start_date = datetime(2026, 3, 1)
end_date = datetime(2026, 3, 20, 23, 59, 59)

def parse_date(date_val):
    """解析日期字符串"""
    if isinstance(date_val, datetime):
        return date_val
    if pd.isna(date_val) or date_val == '':
        return None
    if not isinstance(date_val, str):
        return None

    year = 2026
    try:
        # 标准格式
        if ('-' in date_val or '/' in date_val or '.' in date_val) and len(date_val) >= 8:
            date_str = date_val.split()[0]
            for sep in ['-', '/', '.']:
                if sep in date_str and len(date_str.split(sep)) == 3:
                    return datetime.strptime(date_str, f"%Y{sep}%m{sep}%d")

        # 中文格式
        if '月' in date_val:
            month_str = date_val.split('月')[0]
            day_part = date_val.split('月')[1]
            month = int(month_str.strip())
            day_str = ''
            for char in day_part:
                if char.isdigit():
                    day_str += char
                else:
                    break
            if day_str:
                day = int(day_str)
                return datetime(year, month, day)
    except:
        pass
    return None

def is_self_expanded(source):
    """判断是否为自拓线索"""
    if pd.isna(source):
        return False
    source_str = str(source).lower()
    return '自拓' in source_str or '自主开发' in source_str

results = []

for sales in sales_people:
    try:
        print(f"\n处理 {sales}...")

        # 读取L阶段表
        df_l = pd.read_excel(file_path, sheet_name=f'{sales}L', engine='openpyxl')

        # 查找列名
        date_col = '获取日期★'
        source_col = '线索来源★'
        industry_col = '主营行业★'
        company_col = '客户名称★'

        # 筛选本月自拓线索
        l_data = []
        for idx, row in df_l.iterrows():
            date_val = row[date_col]
            date_obj = parse_date(date_val)

            if date_obj and start_date <= date_obj <= end_date:
                source_val = row[source_col]
                if is_self_expanded(source_val):
                    l_data.append({
                        '公司名称': str(row[company_col]).strip(),
                        '行业': str(row[industry_col]).strip(),
                        '日期': date_obj,
                        '来源': str(source_val)
                    })

        # 读取C阶段表
        try:
            df_c = pd.read_excel(file_path, sheet_name=f'{sales}C', engine='openpyxl')
            date_col_c = '进入 C 日期★'
            company_col_c = '客户名称'

            # 筛选C阶段并匹配自拓线索
            c_count = 0
            c_companies = []
            for idx, row in df_c.iterrows():
                date_val_c = row[date_col_c]
                date_obj_c = parse_date(date_val_c)

                if date_obj_c and start_date <= date_obj_c <= end_date:
                    company_c = str(row[company_col_c]).strip()

                    # 检查是否在自拓线索列表中
                    for l_item in l_data:
                        l_company = str(l_item['公司名称']).strip()
                        if company_c == l_company:
                            c_count += 1
                            c_companies.append({
                                '公司名称': company_c,
                                '行业': l_item['行业'],
                                '日期': date_obj_c
                            })
                            break
        except Exception as e:
            print(f"  读取C表失败: {e}")
            c_count = 0
            c_companies = []

        # 读取S阶段（成单）
        try:
            df_s = pd.read_excel(file_path, sheet_name=f'{sales}S', engine='openpyxl')
            date_col_s = '进入 S 日期★'
            company_col_s = '客户名称'

            # 筛选S阶段成单
            s_count = 0
            s_companies = []
            for idx, row in df_s.iterrows():
                date_val_s = row[date_col_s]
                date_obj_s = parse_date(date_val_s)

                if date_obj_s and start_date <= date_obj_s <= end_date:
                    company_s = str(row[company_col_s]).strip()

                    # 检查是否在自拓线索列表中
                    for l_item in l_data:
                        l_company = str(l_item['公司名称']).strip()
                        if company_s == l_company:
                            s_count += 1
                            s_companies.append({
                                '公司名称': company_s,
                                '行业': l_item['行业'],
                                '日期': date_obj_s
                            })
                            break
        except Exception as e:
            print(f"  读取S表失败: {e}")
            s_count = 0
            s_companies = []

        results.append({
            '销售': sales,
            '本月自拓线索数': len(l_data),
            '自拓L→C数量': c_count,
            '自拓成单数': s_count,
            'C公司列表': c_companies,
            'S公司列表': s_companies
        })

    except Exception as e:
        print(f"处理{sales}时出错: {str(e)}")
        import traceback
        traceback.print_exc()

# 汇总结果
total_l = sum(r['本月自拓线索数'] for r in results)
total_c = sum(r['自拓L→C数量'] for r in results)
total_s = sum(r['自拓成单数'] for r in results)

print("\n" + "="*80)
print("本月（3月1日-3月20日）自拓线索转化统计")
print("="*80)
print(f"{'销售':<10}{'自拓线索':<12}{'自拓L→C':<12}{'自拓成单':<12}{'C转化率':<12}")
print("-"*80)
for r in results:
    rate = f"{r['自拓L→C数量']/r['本月自拓线索数']*100:.1f}%" if r['本月自拓线索数'] > 0 else "0.0%"
    print(f"{r['销售']:<10}{r['本月自拓线索数']:<12}{r['自拓L→C数量']:<12}{r['自拓成单数']:<12}{rate:<12}")
print("-"*80)
print(f"{'总计':<10}{total_l:<12}{total_c:<12}{total_s:<12}{f'{total_c/total_l*100:.1f}%' if total_l > 0 else '0.0%':<12}")
print("="*80)

# 详细列表
print("\n【自拓L→C详细列表】")
for r in results:
    if r['自拓L→C数量'] > 0:
        print(f"\n{r['销售']}（{r['自拓L→C数量']}条）:")
        for c in r['C公司列表']:
            print(f"  - {c['公司名称']} | {c['行业']} | {c['日期'].strftime('%m-%d')}")

print("\n【自拓成单详细列表】")
for r in results:
    if r['自拓成单数'] > 0:
        print(f"\n{r['销售']}（{r['自拓成单数']}条）:")
        for s in r['S公司列表']:
            print(f"  - {s['公司名称']} | {s['行业']} | {s['日期'].strftime('%m-%d')}")
