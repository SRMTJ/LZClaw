const xlsx = require('xlsx');
const wb = xlsx.readFile('增鑫销售客户管理工具.xlsx');

const salesPeople = ['肖芳', '刘欣萌', '张浩', '李志远', '齐健彪', '王雨薇', '范鑫'];

console.log('========== 销售业绩金额分析 ==========\n');

const revenueData = {};

salesPeople.forEach(name => {
  console.log(`\n----- ${name} -----`);
  
  // 检查C-S表（通常包含签约金额）
  let cSheet = wb.Sheets['C-S' + name] || wb.Sheets['C-S' + name + ' 出访表'] || wb.Sheets['C-S' + name + '出访表 副本'];
  
  if (cSheet) {
    const cData = xlsx.utils.sheet_to_json(cSheet, {header:1});
    
    if (cData.length > 1) {
      const headers = cData[0];
      console.log('C-S表表头:', headers);
      
      // 查找金额相关列
      const amountCols = headers.map((h, idx) => {
        if (h && (h.includes('金额') || h.includes('价格') || h.includes('费用') || h.includes('合同') || h.includes('收款') || h.includes('业绩') || h.includes('成交'))) {
          return { name: h, index: idx };
        }
        return null;
      }).filter(Boolean);
      
      if (amountCols.length > 0) {
        console.log('找到金额列:', amountCols.map(c => c.name).join(', '));
        
        // 统计每个金额列的数据
        amountCols.forEach(col => {
          let total = 0;
          let count = 0;
          const values = [];
          
          for (let i = 1; i < cData.length; i++) {
            const row = cData[i];
            if (row && row[col.index]) {
              const val = String(row[col.index]).replace(/[万元,]/g, '');
              const num = parseFloat(val);
              if (!isNaN(num) && num > 0) {
                total += num;
                count++;
                values.push(num);
              }
            }
          }
          
          console.log(`  ${col.name}: ${count}笔，总计 ${total.toFixed(2)} 元`);
          if (count > 0) {
            console.log(`    平均每笔: ${(total/count).toFixed(2)} 元`);
            console.log(`    明细: ${values.join(', ')}`);
          }
        });
      } else {
        console.log('未找到金额列');
      }
    } else {
      console.log('C-S表为空');
    }
  } else {
    console.log('未找到C-S表');
  }
  
  // 也检查D表
  let dSheet = wb.Sheets['D' + name + '数据表'] || wb.Sheets['D' + name + '数据表 副本'];
  if (dSheet) {
    const dData = xlsx.utils.sheet_to_json(dSheet, {header:1});
    if (dData.length > 1) {
      const headers = dData[0];
      const amountCol = headers.findIndex(h => h && (h.includes('金额') || h.includes('价格') || h.includes('意向金额')));
      if (amountCol !== -1) {
        console.log(`D表有金额列: ${headers[amountCol]}`);
      }
    }
  }
});

// 汇总
console.log('\n========== 业绩汇总 ==========');
