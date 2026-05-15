const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel } = require('docx');
const fs = require('fs');

const markdown = fs.readFileSync('销售周报_终极版_20260320.md', 'utf-8');
const lines = markdown.split('\n');
const doc = new Document({
  sections: [{
    properties: {},
    children: parseMarkdown(lines)
  }]
});

function parseMarkdown(lines) {
  const children = [];
  let currentTable = [];
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 150 }
      }));
    } else if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      
      if (cells.some(c => c.includes('---'))) {
        if (currentTable.length > 0) continue;
      } else {
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }
        currentTable.push(cells);
      }
    } else if (line.trim() === '') {
      if (inTable && currentTable.length > 0) {
        children.push(createTable(currentTable));
        inTable = false;
        currentTable = [];
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    } else if (line.startsWith('- ')) {
      children.push(new Paragraph({
        text: line.replace('- ', ''),
        bullet: { level: 0 },
        spacing: { after: 100 }
      }));
    } else if (line.match(/^\d+\. /)) {
      children.push(new Paragraph({
        text: line.replace(/^\d+\. /, ''),
        numbering: { reference: 'numbering', level: 0 },
        spacing: { after: 100 }
      }));
    } else if (line.trim() !== '' && !line.startsWith('**') && !line.includes('报告时间') && !line.includes('数据说明')) {
      children.push(new Paragraph({
        text: line,
        spacing: { after: 100 }
      }));
    } else if (line.includes('**') && !line.startsWith('#')) {
      const text = line.replace(/\*\*/g, '');
      children.push(new Paragraph({
        children: [new TextRun({ text: text, bold: true })],
        spacing: { after: 150 }
      }));
    }
  }
  
  if (inTable && currentTable.length > 0) {
    children.push(createTable(currentTable));
  }
  
  return children;
}

function createTable(rows) {
  if (rows.length === 0) return new Paragraph({ text: '' });
  
  const tableRows = rows.map(row => {
    const cells = row.map(cell => {
      let content = cell;
      let bold = false;
      
      if (content.includes('**') && content.split('**').length === 3) {
        content = content.replace(/\*\*/g, '');
        bold = true;
      }
      
      if (content.includes('[完成]')) {
        content = content.replace('[完成]', '');
      }
      
      return new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: content, bold: bold })],
          spacing: { after: 50 }
        })],
        width: { size: 15, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 80, right: 80 }
      });
    });
    
    return new TableRow({ children: cells });
  });
  
  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100 }
  });
}

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('销售周报_终极版_20260320.docx', buffer);
  console.log('[完成] Word文档已生成: 销售周报_终极版_20260320.docx');
});
