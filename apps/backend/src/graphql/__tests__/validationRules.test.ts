import { describe, it, expect } from 'vitest';
import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { createQueryCostRule } from '../validationRules.js';

const schema = buildSchema(`
  type Form { id: ID! title: String forms: [Form!]! }
  type Query { form(id: ID!): Form forms: [Form!]! }
`);

const run = (query: string, limits = { maxAliases: 3, maxFields: 10 }) =>
  validate(schema, parse(query), [...specifiedRules, createQueryCostRule(limits)]);

describe('createQueryCostRule', () => {
  it('accepts operations within limits', () => {
    expect(run('{ a: form(id: "1") { id title } b: form(id: "2") { id } }')).toHaveLength(0);
  });

  it('rejects too many aliases', () => {
    const query = `{ ${['a', 'b', 'c', 'd'].map(k => `${k}: form(id: "1") { id }`).join(' ')} }`;
    const errors = run(query, { maxAliases: 3, maxFields: 100 });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/4 aliases.*limit of 3/);
  });

  it('counts aliases declared inside fragments', () => {
    const errors = run(
      `{ forms { ...F } } fragment F on Form { a: id b: id c: id d: id }`,
      { maxAliases: 3, maxFields: 100 }
    );
    expect(errors[0]?.message).toMatch(/aliases/);
  });

  it('rejects too many fields', () => {
    const errors = run(`{ forms { ${'id '.repeat(12)} } }`);
    expect(errors[0].message).toMatch(/fields, exceeding the limit of 10/);
  });

  it('expands fragment spreads so a fragment bomb is measured', () => {
    const errors = run(
      `{ forms { ...F ...F ...F ...F } } fragment F on Form { id title }`,
      { maxAliases: 100, maxFields: 8 }
    );
    expect(errors[0].message).toMatch(/fields/);
  });

  it('measures exponential fragment chains without hanging', () => {
    const query = `
      { forms { ...A0 } }
      fragment A0 on Form { forms { ...A1 ...A1 } }
      fragment A1 on Form { forms { ...A2 ...A2 } }
      fragment A2 on Form { forms { ...A3 ...A3 } }
      fragment A3 on Form { id }`;
    const errors = run(query, { maxAliases: 100, maxFields: 10 });
    expect(errors.some(e => /fields/.test(e.message))).toBe(true);
  });

  it('does not loop on fragment cycles', () => {
    const errors = run(
      `{ forms { ...A } } fragment A on Form { forms { ...B } } fragment B on Form { forms { ...A } }`,
      { maxAliases: 100, maxFields: 100 }
    );
    expect(errors.some(e => /within itself/.test(e.message))).toBe(true);
  });

  it('applies limits per operation, not across the whole document', () => {
    const errors = run(
      `query A { a: form(id: "1") { id } b: form(id: "1") { id } } query B { c: form(id: "1") { id } d: form(id: "1") { id } }`,
      { maxAliases: 3, maxFields: 100 }
    );
    expect(errors).toHaveLength(0);
  });
});
