import pandas as pd, warnings
warnings.filterwarnings('ignore')
xl = pd.ExcelFile('销售管理系统 .xlsx')

for name in ['肖芳','张浩','李志远','刘欣萌','齐健彪','范鑫']:
    for stage in ['C','B','A','S']:
        df = xl.parse(f'{name}{stage}')
        df = df[df['客户名称'].notna()]
        df = df[~df['客户名称'].astype(str).str.contains('多行文本|必填|文本', na=False)]
        df = df[df['客户名称'].astype(str).str.strip() != 'nan']
        if len(df) > 0:
            print(f'=== {name}{stage} ===')
            for _, row in df.iterrows():
                info = {}
                for col in df.columns:
                    val = str(row[col]).strip()
                    if val and val != 'nan':
                        info[col] = val
                print(f"  客户: {info.get('客户名称','')}")
                print(f"  行业: {info.get('行业','')} | 门店: {info.get('门店数量','')} | 分层: {info.get('客户分层★','')}")
                stay_key = f'进入 {stage} 日期★'
                print(f"  进入日期: {info.get(stay_key,'')} | 停留: {info.get('阶段停留天数','')}天")
                print(f"  痛点: {info.get('核心痛点★','')}")
                print(f"  版本确认: {info.get('是否确认产品版本','')} | 费用确认: {info.get('是否确认费用','')}")
                print(f"  合同: {info.get('合同确认日期','')} | 付款: {info.get('付款时间','')}")
                print(f"  商务推进: {info.get('商务推进记录','')}")
                print(f"  下次跟进: {info.get('下次跟进日期★','')}")
                # 金额相关
                for k, v in info.items():
                    if any(x in k for x in ['金额','版本','费用','价格','产品','套餐']):
                        print(f"  [{k}]: {v}")
                print()
            print()
