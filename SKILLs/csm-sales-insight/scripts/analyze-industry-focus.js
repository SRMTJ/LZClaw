const xlsx = require('xlsx');
const wb = xlsx.readFile('增鑫销售客户管理工具.xlsx');

const salesPeople = ['肖芳', '刘欣萌', '张浩', '李志远', '齐健彪', '王雨薇', '范鑫'];

// 每人主攻行业定义
const focusIndustry = {
  '肖芳': '蛋糕门店',
  '刘欣萌': '农产品',
  '张浩': '美妆',
  '李志远': '医疗服务',
  '齐健彪': '宠物',
  '王雨薇': '空间零售',
  '范鑫': '农产品'
};

console.log('========== 销售主攻行业专注度分析 ==========\n');

const analysis = {};

salesPeople.forEach(name => {
  let lSheet = wb.Sheets['L' + name + '线索表'] || wb.Sheets['L ' + name + ' 线索表'] || wb.Sheets['L' + name + '数据表'];
  if (lSheet) {
    const lData = xlsx.utils.sheet_to_json(lSheet, {header:1});
    
    if (lData.length > 1) {
      const headers = lData[0];
      const industryCol = headers.findIndex(h => 
        h && (h.includes('行业') || h.includes('领域') || h.includes('分类') || h.includes('类型') || h.includes('赛道'))
      );
      
      if (industryCol !== -1) {
        const industryCount = {};
        let total = 0;
        
        for (let i = 1; i < lData.length; i++) {
          const row = lData[i];
          if (row && row[industryCol]) {
            const industry = String(row[industryCol]).trim();
            if (industry) {
              industryCount[industry] = (industryCount[industry] || 0) + 1;
              total++;
            }
          }
        }
        
        const focus = focusIndustry[name];
        const focusCount = industryCount[focus] || 0;
        const focusRate = total > 0 ? ((focusCount / total) * 100).toFixed(1) : 0;
        
        analysis[name] = {
          focus: focus,
          focusCount: focusCount,
          total: total,
          focusRate: parseFloat(focusRate),
          otherIndustries: Object.entries(industryCount)
            .filter(([ind]) => ind !== focus)
            .sort((a, b) => b[1] - a[1])
        };
      }
    }
  }
});

// 输出分析结果
console.log('【一、主攻行业专注度排名】\n');
const sortedByFocus = Object.entries(analysis).sort((a, b) => b[1].focusRate - a[1].focusRate);
sortedByFocus.forEach(([name, data], idx) => {
  const status = data.focusRate >= 95 ? '[完成] 优秀' : data.focusRate >= 90 ? '[成长] 良好' : '[流失] 需整改';
  console.log(`${idx + 1}. ${name} - ${data.focus} (${data.focusCount}/${data.total}条, ${data.focusRate}%) ${status}`);
});

console.log('\n【二、非主攻行业分布（需要清理）】\n');
Object.entries(analysis).forEach(([name, data]) => {
  if (data.otherIndustries.length > 0) {
    console.log(`${name} (${data.focus}):`);
    data.otherIndustries.forEach(([ind, count]) => {
      console.log(`   - ${ind}: ${count}条`);
    });
    console.log('');
  }
});

console.log('【三、行业冲突分析】\n');
const industryOwners = {};
Object.entries(focusIndustry).forEach(([name, industry]) => {
  if (!industryOwners[industry]) {
    industryOwners[industry] = [];
  }
  industryOwners[industry].push(name);
});

Object.entries(industryOwners).forEach(([industry, owners]) => {
  if (owners.length > 1) {
    console.log(`[警告]  行业冲突: ${industry} 被 ${owners.join('、')} 同时主攻`);
    console.log(`   建议: 明确划分区域或细分品类`);
  }
});

console.log('\n【四、建议调整方案】\n');
console.log('1. 刘欣萌 vs 范鑫 (农产品冲突):');
console.log('   - 方案A: 按地域划分（刘欣萌-华北，范鑫-华南）');
console.log('   - 方案B: 按细分品类（刘欣萌-生鲜果蔬，范鑫-粮油干货）');
console.log('   - 方案C: 其中一人转攻其他行业（如范鑫转攻餐饮）');
