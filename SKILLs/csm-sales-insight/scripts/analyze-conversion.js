const xlsx = require('xlsx');
const wb = xlsx.readFile('增鑫销售客户管理工具.xlsx');

const salesPeople = ['肖芳', '刘欣萌', '张浩', '李志远', '齐健彪', '王雨薇', '范鑫'];

// 统计D和C-S的来源和行业
const dStats = { source: {}, industry: {}, total: 0 };
const cStats = { source: {}, industry: {}, total: 0 };

salesPeople.forEach(name => {
  // 读取D表
  let dSheet = wb.Sheets['D' + name + '数据表'] || wb.Sheets['D' + name + '数据表 副本'];
  if (dSheet) {
    const data = xlsx.utils.sheet_to_json(dSheet, {header:1});
    const headers = data[0] || [];
    const sourceIdx = headers.findIndex(h => h && h.includes('来源'));
    const industryIdx = headers.findIndex(h => h && (h.includes('行业') || h.includes('主营')));
    
    data.slice(1).forEach(row => {
      dStats.total++;
      const source = row[sourceIdx] || '未知';
      dStats.source[source] = (dStats.source[source] || 0) + 1;
      const industry = row[industryIdx] || '未知';
      dStats.industry[industry] = (dStats.industry[industry] || 0) + 1;
    });
  }
  
  // 读取C-S表
  let cSheet = wb.Sheets['C-S' + name] || wb.Sheets['C-S' + name + ' 出访表'] || wb.Sheets['C-S' + name + '出访表 副本'];
  if (cSheet) {
    const data = xlsx.utils.sheet_to_json(cSheet, {header:1});
    const headers = data[0] || [];
    const sourceIdx = headers.findIndex(h => h && h.includes('来源'));
    const industryIdx = headers.findIndex(h => h && (h.includes('行业') || h.includes('主营')));
    
    data.slice(1).forEach(row => {
      cStats.total++;
      const source = row[sourceIdx] || '未知';
      cStats.source[source] = (cStats.source[source] || 0) + 1;
      const industry = row[industryIdx] || '未知';
      cStats.industry[industry] = (cStats.industry[industry] || 0) + 1;
    });
  }
});

console.log('D阶段统计:');
console.log('总D:', dStats.total);
console.log('来源:', dStats.source);
console.log('行业:', dStats.industry);

console.log('\nC-S阶段统计:');
console.log('总C-S:', cStats.total);
console.log('来源:', cStats.source);
console.log('行业:', cStats.industry);
