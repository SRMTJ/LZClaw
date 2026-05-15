import pandas as pd, warnings
warnings.filterwarnings('ignore')
xl = pd.ExcelFile('销售管理表.xlsx')
for p in ['李志远', '刘欣萌']:
    for s in ['B', 'A', 'S']:
        try:
            df = xl.parse(f'{p}{s}')
            df = df[df.iloc[:,0].notna() & ~df.iloc[:,0].astype(str).str.contains('多行文本|必填|文本|关联', na=False)]
            if len(df) == 0:
                continue
            print(f'\n=== {p}{s} ({len(df)}行) ===')
            for _, row in df.iterrows():
                name = row.get('客户名称', '')
                if not name and len(row) > 1:
                    name = row.iloc[1]
                ver = row.get('是否确认产品版本', '')
                fee = row.get('是否确认费用', '')
                stage_v = row.get('客户阶段', '')
                follow = row.get('下次跟进日期★', '')
                record = row.get('商务推进记录', '')
                pay_time = row.get('付款时间', '')
                print(f'  {name} | 版本:{ver} | 费用:{fee} | 阶段:{stage_v} | 跟进:{follow} | 付款:{pay_time}')
                if pd.notna(record):
                    print(f'    记录: {str(record)[:120]}')
        except Exception as e:
            print(f'  error {p}{s}: {e}')
