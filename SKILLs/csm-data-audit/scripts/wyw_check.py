import pandas as pd, warnings
warnings.filterwarnings('ignore')
xl = pd.ExcelFile('销售管理系统 .xlsx')
for name in ['王雨薇']:
    for stage in ['C','B','A','S']:
        try:
            df = xl.parse(f'{name}{stage}')
            df2 = df[df['客户名称'].notna()]
            df2 = df2[~df2['客户名称'].astype(str).str.contains('多行文本|必填|文本', na=False)]
            df2 = df2[df2['客户名称'].astype(str).str.strip() != 'nan']
            print(f'{name}{stage}: {len(df2)}个')
            for _, row in df2.iterrows():
                print(f"  客户:{row['客户名称']} 分层:{row.get('客户分层★','')} 停留:{row.get('阶段停留天数','')}天")
                for col in df2.columns:
                    if any(x in str(col) for x in ['金额','版本','费用','合同','付款','产品','签约']):
                        v = str(row[col]).strip()
                        if v and v not in ['nan','']:
                            print(f'    [{col}]:{v}')
        except Exception as e:
            print(f'{name}{stage} error: {e}')
