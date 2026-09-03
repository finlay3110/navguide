'use strict';

// Runs every suite in tests/*.test.js as its own child process, so a hard
// crash in one cannot take the rest down, and each stays runnable on its own
// with `node tests/<name>.test.js`.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const only = process.argv.slice(2);

const suites = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => only.length === 0 || only.some(a => f.includes(a)))
  .sort();

if (suites.length === 0) {
  console.error('No suites matched ' + JSON.stringify(only));
  process.exit(1);
}

const results = [];
for (const file of suites) {
  const name = file.replace('.test.js', '');
  process.stdout.write('\n── ' + name + ' ' + '─'.repeat(Math.max(0, 56 - name.length)) + '\n');
  const run = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  results.push({ name, code: run.status === null ? 1 : run.status, crashed: run.status === null });
}

console.log('\n' + '='.repeat(60));
let failed = 0;
for (const r of results) {
  if (r.code !== 0) failed++;
  console.log((r.code === 0 ? '  PASS  ' : r.crashed ? '  CRASH ' : '  FAIL  ') + r.name);
}
console.log('='.repeat(60));
console.log(failed === 0
  ? results.length + ' suites passed'
  : failed + ' of ' + results.length + ' suites failed');
process.exit(failed ? 1 : 0);
