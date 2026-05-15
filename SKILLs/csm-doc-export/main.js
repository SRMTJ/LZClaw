const { spawnSync } = require('child_process');
const path = require('path');

const commandMap = {
  'detailed-analysis': 'gen_detailed_analysis.js',
  'md-to-docx': 'md_to_docx_ultimate.js',
};

function printUsage() {
  const commands = Object.keys(commandMap).join(', ');
  console.error('[csm-doc-export] missing or invalid subcommand');
  console.error(`[csm-doc-export] supported subcommands: ${commands}`);
}

function main() {
  const subcommand = process.argv[2];
  const scriptName = commandMap[subcommand];
  if (!scriptName) {
    printUsage();
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(3)], {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error('[csm-doc-export] failed to execute subcommand:', result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

main();
