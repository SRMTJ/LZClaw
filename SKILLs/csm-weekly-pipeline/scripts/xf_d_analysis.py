import pandas as pd, warnings
warnings.filterwarnings('ignore')
xl = pd.ExcelFile('销售管理系统 .xlsx')
df = xl.parse('肖芳D')

# 过滤有效行
df = df[df['客户名称'].notna()]
df = df[~df['客户名称'].astype(str).str.contains('多行文本|必填|文本', na=False)]
df = df[df['客户名称'].astype(str).str.strip() != 'nan']
df = df.reset_index(drop=True)

print(f'肖芳 D阶段有效客户数：{len(df)}\n')

for i, row in df.iterrows():
    name   = str(row.get('客户名称','')).strip()
    wechat = str(row.get('是否已加微信','')).strip()
    kp     = str(row.get('KP姓名','')).strip()
    phone  = str(row.get('KP联系方式','')).strip()
    pain   = str(row.get('核心痛点★','')).strip()
    action = str(row.get('短期动作建议★','')).strip()
    risk   = str(row.get('转化风险★','')).strip()
    stay   = row.get('阶段停留天数', 0)
    next_d = row.get('下次跟进日期★', None)
    status = str(row.get('跟进状态★','')).strip()
    result = str(row.get('跟进结果','')).strip()
    enter  = row.get('进入 D 日期★', None)
    solution = str(row.get('有赞解决方案匹配★','')).strip()

    nd_str = str(next_d).split(' ')[0] if pd.notna(next_d) else '未设置'
    ed_str = str(enter).split(' ')[0] if pd.notna(enter) else '未知'

    def v(s): return s if s not in ('nan','NaN','') else '未填'

    print(f"【{i+1}】{name}")
    print(f"  微信：{wechat} | KP：{v(kp)} | 电话：{v(phone)}")
    print(f"  进入D：{ed_str} | 停留：{stay}天 | 下次跟进：{nd_str}")
    print(f"  跟进状态：{v(status)} | 跟进结果：{v(result)}")
    print(f"  核心痛点：{v(pain)}")
    print(f"  解决方案：{v(solution)}")
    print(f"  短期动作：{v(action)}")
    print(f"  转化风险：{v(risk)}")
    print()
