import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node check-sql-parens.mjs <file.sql>');
  process.exit(2);
}

const content = readFileSync(path, 'utf-8');
const stripped = content.replace(/--[^\n]*/g, '');

let depth = 0;
let line = 1;
let inStr = false;
let dollarTag = null;
const mismatches = [];

for (let i = 0; i < stripped.length; i += 1) {
  const ch = stripped[i];
  if (ch === '\n') { line += 1; continue; }

  if (dollarTag) {
    if (stripped.startsWith(dollarTag, i)) {
      i += dollarTag.length - 1;
      dollarTag = null;
    }
    continue;
  }

  if (ch === '$') {
    const rest = stripped.slice(i);
    const m = rest.match(/^\$([A-Za-z_]*)\$/);
    if (m) {
      dollarTag = m[0];
      i += dollarTag.length - 1;
      continue;
    }
  }

  if (inStr) {
    if (ch === "'") inStr = false;
    continue;
  }
  if (ch === "'") { inStr = true; continue; }

  if (ch === '(') depth += 1;
  if (ch === ')') {
    depth -= 1;
    if (depth < 0) mismatches.push({ line, msg: 'extra )' });
  }
}

console.log('final depth:', depth);
console.log('mismatches:', mismatches.length);
if (mismatches.length > 0) {
  console.log(mismatches.slice(0, 10));
  process.exit(1);
}
if (depth !== 0) process.exit(1);
