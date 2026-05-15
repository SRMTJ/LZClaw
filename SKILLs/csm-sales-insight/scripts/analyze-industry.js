const xlsx = require('xlsx');
const wb = xlsx.readFile('增鑫销售客户管理工具.xlsx');

const salesPeople = ['肖芳', '刘欣萌', '张浩', '李志远', '齐健彪', '王雨薇', '范鑫'];

salesPeople.forEach(name => {
  console.log(`\n========== ${name} 的线索行业分析 ==========`);
  
  let lSheet = wb.Sheets['L' + name + '线索表'] || wb.Sheets['L ' + name + ' 线索表'] || wb.Sheets['L' + name + '数据表'];
  if (lSheet) {
    const lData = xlsx.utils.sheet_to_json(lSheet, {header:1});
    
    if (lData.length > 1) {
      // 查找行业列
      const headers = lData[0];
      console.log('表头:', headers);
      
      // 尝试找到行业/领域/分类列
      const industryCol = headers.findIndex(h => 
        h && (h.includes('行业') || h.includes('领域') || h.includes('分类') || h.includes('类型') || h.includes('赛道'))
      );
      
      if (industryCol !== -1) {
        console.log(`找到行业列: "${headers[industryCol]}" (第${industryCol + 1}列)`);
        
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
        
        console.log(`\n行业分布 (总计 ${total} 条):`);
        const sorted = Object.entries(industryCount).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([industry, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          console.log(`  ${industry}: ${count}条 (${pct}%)`);
        });
      } else {
        console.log('未找到行业列，可用列名:', headers.filter(h => h).join(', '));
      }
    } else {
      console.log('数据表为空');
    }
  } else {
    console.log('未找到L表');
  }
});
