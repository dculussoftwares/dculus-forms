// Guards the security `overrides` against being silently ignored.
//
// The repo is pinned to pnpm 8.15.0 (package.json "packageManager"). pnpm 8 only reads
// overrides from package.json "pnpm.overrides" -- an `overrides:` block in
// pnpm-workspace.yaml is ignored, and a newer pnpm ignores package.json instead. Either
// way the CVE pins would stop being applied with no error. Fail fast if that happens.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const pinned = String(pkg.packageManager ?? '').replace(/^pnpm@/, '');
const actual = execSync('pnpm --version', { encoding: 'utf8' }).trim();
if (!pinned || actual !== pinned) {
  errors.push(`pnpm version is "${actual}" but package.json pins "${pinned}".`);
}

if (existsSync('pnpm-workspace.yaml') && /^overrides:/m.test(readFileSync('pnpm-workspace.yaml', 'utf8'))) {
  errors.push('pnpm-workspace.yaml defines "overrides:", which pnpm 8 ignores. Keep them in package.json "pnpm.overrides".');
}

const unquote = (s) => s.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
const lock = readFileSync('pnpm-lock.yaml', 'utf8');
const block = lock.match(/^overrides:\n((?: {2}.+\n)+)/m);
const lockOverrides = new Map();
for (const line of block ? block[1].split('\n').filter(Boolean) : []) {
  const idx = line.lastIndexOf(': ');
  lockOverrides.set(unquote(line.slice(0, idx)), unquote(line.slice(idx + 2)));
}

const wanted = Object.entries(pkg.pnpm?.overrides ?? {});
if (wanted.length === 0) errors.push('package.json has no "pnpm.overrides".');
if (lockOverrides.size === 0) errors.push('pnpm-lock.yaml has an empty or missing "overrides:" block.');
for (const [name, range] of wanted) {
  if (lockOverrides.get(name) !== range) {
    errors.push(`override "${name}": package.json has "${range}", lockfile has "${lockOverrides.get(name) ?? '<missing>'}".`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `::error::${e}`).join('\n'));
  process.exit(1);
}
console.log(`pnpm ${actual}: ${wanted.length} overrides present in package.json and pnpm-lock.yaml.`);
