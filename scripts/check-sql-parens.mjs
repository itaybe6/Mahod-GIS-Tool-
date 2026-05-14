/**
 * 1) Default: validate balanced parentheses in a .sql file (ignores strings, $quoting$, -- comments).
 * 2) Optional: run traffic Vol4 seed (counts + volumes) against Supabase — see scripts/seed/seed-traffic-counts.ts
 *    for year filter (2025) and volume row cap (~40k).
 *
 * usage:
 *   node scripts/check-sql-parens.mjs <file.sql>
 *   node scripts/check-sql-parens.mjs --seed-traffic-counts
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const arg = process.argv[2];
if (arg === '--seed-traffic-counts') {
  const r = spawnSync('npx', ['tsx', 'scripts/seed/seed-traffic-counts.ts'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(r.status ?? 1);
}

if (!arg) {
  console.error('usage: node check-sql-parens.mjs <file.sql>');
  console.error('       node check-sql-parens.mjs --seed-traffic-counts');
  process.exit(2);
}

const path = arg;
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
