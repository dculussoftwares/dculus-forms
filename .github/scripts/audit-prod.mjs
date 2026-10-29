// Blocking dependency audit for runtime dependencies.
//
// Runs `pnpm audit --prod` and fails on any advisory at or above the threshold that is not
// listed (and unexpired) in .github/audit-allowlist.json. Each allow-list entry needs a
// reason and an expiry date, so accepted risk is reviewed instead of silently permanent.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const THRESHOLD = (process.env.AUDIT_LEVEL ?? 'high').toLowerCase();
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
if (!(THRESHOLD in RANK)) {
  console.error(`::error::Unknown AUDIT_LEVEL "${THRESHOLD}".`);
  process.exit(1);
}

const allowlist = JSON.parse(readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const allowed = new Map();
const errors = [];
for (const entry of allowlist.advisories ?? []) {
  if (!entry.id || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
    errors.push(`Allow-list entry needs "id", "reason" and an "expires" date (YYYY-MM-DD): ${JSON.stringify(entry)}`);
  } else if (entry.expires < today) {
    errors.push(`Allow-list entry ${entry.id} expired on ${entry.expires}; fix the dependency or renew it with a new review.`);
  } else {
    allowed.set(entry.id, entry);
  }
}

let raw;
try {
  raw = execSync('pnpm audit --prod --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // pnpm exits non-zero when it finds vulnerabilities but still prints the JSON report.
  raw = err.stdout ?? '';
}

let report;
try {
  report = JSON.parse(raw.slice(raw.indexOf('{')));
} catch {
  console.error('::error::Could not parse `pnpm audit --prod --json` output (registry unreachable?).');
  process.exit(1);
}

const failing = [];
for (const advisory of Object.values(report.advisories ?? {})) {
  if (RANK[advisory.severity] < RANK[THRESHOLD]) continue;
  const id = advisory.github_advisory_id;
  if (allowed.has(id)) continue;
  const versions = [...new Set((advisory.findings ?? []).map((f) => f.version))].join(', ');
  failing.push(`${advisory.severity.toUpperCase()} ${id} ${advisory.module_name}@${versions}: ${advisory.title}`);
}

errors.push(...failing.map((f) => `Unaccepted runtime advisory: ${f}`));
if (errors.length > 0) {
  console.error(errors.map((e) => `::error::${e}`).join('\n'));
  process.exit(1);
}
console.log(`Runtime dependency audit passed (threshold: ${THRESHOLD}, ${allowed.size} allow-listed advisories).`);
