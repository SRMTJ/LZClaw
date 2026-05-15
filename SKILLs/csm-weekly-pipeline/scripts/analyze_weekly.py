import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

file_path = '销售管理表.xlsx'
sales_people = ['齐健彪', '肖芳', '李志远', '刘欣萌', '张浩', '范鑫']

def parse_date(date_val):
    if isinstance(date_val, datetime):
        return date_val
    if pd.isna(date_val) or date_val == '':
        return None
    if not isinstance(date_val, str):
        return None
    year = 2026
    try:
        if ('-' in date_val or '/' in date_val or '.' in date_val) and len(date_val) >= 8:
            date_str = date_val.split()[0]
            for sep in ['-', '/', '.']:
                if sep in date_str and len(date_str.split(sep)) == 3:
                    return datetime.strptime(date_str, f"%Y{sep}%m{sep}%d")
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

# 本周日期范围
start_date = datetime(2026, 3, 16)
end_date = datetime(2026, 3, 20, 23, 59, 59)

print("\n" + "="*120)
print("本周各销售转化率分析（3月16日-3月20日）")
print("="*120)
print(f"{'销售':<10}{'本周L':<10}{'本周D':<10}{'本周C':<10}{'本周B':<10}{'本周S':<10}{'L→D%':<10}{'D→C%':<10}{'C→B%':<10}{'B→S%':<10}")
print("-"*120)

week_stats = {}

for sales in sales_people:
    week_data = {'L': 0, 'D': 0, 'C': 0, 'B': 0, 'S': 0}
    
    try:
        # L阶段
        df_l = pd.read_excel(file_path, sheet_name=f'{sales}L', engine='openpyxl')
        for idx, row in df_l.iterrows():
            date_obj = parse_date(row['获取日期★'])
            if date_obj and start_date <= date_obj <= end_date:
                week_data['L'] += 1
        
        # D阶段
        df_d = pd.read_excel(file_path, sheet_name=f'{sales}D', engine='openpyxl')
        for idx, row in df_d.iterrows():
            date_obj = parse_date(row['进入 D 日期★'])
            if date_obj and start_date <= date_obj <= end_date:
                week_data['D'] += 1
        
        # C阶段
        df_c = pd.read_excel(file_path, sheet_name=f'{sales}C', engine='openpyxl')
        for idx, row in df_c.iterrows():
            date_obj = parse_date(row['进入 C 日期★'])
            if date_obj and start_date <= date_obj <= end_date:
                week_data['C'] += 1
        
        # B阶段
        df_b = pd.read_excel(file_path, sheet_name=f'{sales}B', engine='openpyxl')
        for idx, row in df_b.iterrows():
            date_obj = parse_date(row['进入 B 日期★'])
            if date_obj and start_date <= date_obj <= end_date:
                week_data['B'] += 1
        
        # S阶段
        try:
            df_s = pd.read_excel(file_path, sheet_name=f'{sales}S', engine='openpyxl')
            for idx, row in df_s.iterrows():
                date_obj = parse_date(row['进入 S 日期★'])
                if date_obj and start_date <= date_obj <= end_date:
                    week_data['S'] += 1
        except:
            pass
        
        # 计算转化率
        ld_rate = f"{week_data['D']/week_data['L']*100:.1f}%" if week_data['L'] > 0 else "0.0%"
        dc_rate = f"{week_data['C']/week_data['D']*100:.1f}%" if week_data['D'] > 0 else "0.0%"
        cb_rate = f"{week_data['B']/week_data['C']*100:.1f}%" if week_data['C'] > 0 else "0.0%"
        bs_rate = f"{week_data['S']/week_data['B']*100:.1f}%" if week_data['B'] > 0 else "0.0%"
        
        print(f"{sales:<10}{week_data['L']:<10}{week_data['D']:<10}{week_data['C']:<10}{week_data['B']:<10}{week_data['S']:<10}{ld_rate:<10}{dc_rate:<10}{cb_rate:<10}{bs_rate:<10}")
        
        week_stats[sales] = week_data
        
    except Exception as e:
        print(f"{sales:<10}读取失败: {e}")

print("="*120)

# 重点发现
print("\n" + "="*120)
print("【重点发现】")
print("="*120)

max_l_sales = max(week_stats.items(), key=lambda x: x[1]['L'])
max_c_sales = max(week_stats.items(), key=lambda x: x[1]['C'])

print(f"✓ 本周新增L最多：{max_l_sales[0]}，共{max_l_sales[1]['L']}条")
print(f"✓ 本周新增C最多：{max_c_sales[0]}，共{max_c_sales[1]['C']}条")

# 检查D→C转化率最低的
dc_rates = {}
for sales in sales_people:
    if sales in week_stats:
        l, d, c, b, s = week_stats[sales].values()
        dc_rates[sales] = c / d if d > 0 else 0

min_dc = min(dc_rates.items(), key=lambda x: x[1])
print(f"[错误] 本周D→C转化率最低：{min_dc[0]}，{dc_rates[min_dc[0]]*100:.1f}%")

# 检查C→B转化率
cb_rates = {}
for sales in sales_people:
    if sales in week_stats:
        l, d, c, b, s = week_stats[sales].values()
        cb_rates[sales] = b / c if c > 0 else 0

min_cb = min(cb_rates.items(), key=lambda x: x[1])
print(f"[错误] 本周C→B转化率最低：{min_cb[0]}，{cb_rates[min_cb[0]]*100:.1f}%")

# 本周成单总数
total_s = sum(week_stats[s]['S'] for s in sales_people if s in week_stats)
print(f"✓ 本周成单总数：{total_s}个")

print("="*120)
