/**
 * A migration whose every statement is guarded (`IF NOT EXISTS`) can safely run on a
 * database that may already have its effect. On a history-less database those are left
 * for `migrate deploy` to execute instead of being marked applied — a `db push`-managed
 * database may be missing their columns, and marking them applied would hide that.
 */
export function isRerunnableMigration(sql: string): boolean {
  const statements = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  return statements.length > 0 && statements.every(statement => /\bIF\s+NOT\s+EXISTS\b/i.test(statement));
}
