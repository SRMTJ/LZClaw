const xlsx = require('xlsx');
const wb = xlsx.readFile('增鑫销售客户管理工具.xlsx');

const salesPeople = ['肖芳', '刘欣萌', '张浩', '李志远', '齐健彪', '王雨薇', '范鑫'];
const sourceStats = {};
const industryStats = {};
let totalL = 0;

salesPeople.forEach(name => {
  let lSheet = wb.Sheets['L' + name + '线索表'] || wb.Sheets['L ' + name + ' 线索表'] || wb.Sheets['L' + name + '数据表'];
  if (lSheet) {
    const data = xlsx.utils.sheet_to_json(lSheet, {header:1});
    const headers = data[0] || [];
    const sourceIdx = headers.findIndex(h => h && h.includes('渠道'));
    const industryIdx = headers.findIndex(h => h && (h.includes('行业') || h.includes('主营')));
    
    data.slice(1).forEach(row => {
      totalL++;
      const source = row[sourceIdx] || '未知';
      sourceStats[source] = (sourceStats[source] || 0) + 1;
      const industry = row[industryIdx] || '未知';
      industryStats[industry] = (industryStats[industry] || 0) + 1;
    });
  }
});

console.log('总线索数:', totalL);
console.log('\n线索来源分布:');
Object.entries(sourceStats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(k + ': ' + v + ' (' + (v/totalL*100).toFixed(1) + '%)');
});

console.log('\n行业分布:');
Object.entries(industryStats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(k + ': ' + v + ' (' + (v/totalL*100).toFixed(1) + '%)');
});
