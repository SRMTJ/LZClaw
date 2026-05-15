const { spawnSync } = require('child_process');
const path = require('path');

const commandMap = {
  'analyze-conversion': 'analyze-conversion.js',
  'analyze-industry': 'analyze-industry.js',
  'analyze-industry-focus': 'analyze-industry-focus.js',
  'analyze-source': 'analyze-source.js',
  'analyze-revenue': 'analyze-revenue.js',
};

function printUsage() {
  const commands = Object.keys(commandMap).join(', ');
  console.error('[csm-sales-insight] missing or invalid subcommand');
  console.error(`[csm-sales-insight] supported subcommands: ${commands}`);
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
    console.error('[csm-sales-insight] failed to execute subcommand:', result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

main();
