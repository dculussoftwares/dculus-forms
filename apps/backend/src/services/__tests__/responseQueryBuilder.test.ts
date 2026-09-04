import { describe, it, expect } from 'vitest';
import {
  buildPostgreSQLFilter,
  buildRawSQLCondition,
  canFilterAtDatabase,
  filtersNeedGradeJoin,
  buildJoinClause,
  isMetaFilterFieldId,
} from '../responseQueryBuilder.js';

describe('Response Query Builder', () => {
  describe('Security - SQL Injection Protection', () => {
    it('should reject field IDs with SQL injection attempts', () => {
      const maliciousFieldIds = [
        // Classic SQL injection
        "field'; DROP TABLE response; --",
        "field' OR '1'='1",
        "field'); DELETE FROM response WHERE ('1'='1",
        "field\\'; --",
        
        // UNION attacks
        "field' UNION SELECT * FROM users --",
        "field' UNION SELECT password FROM users WHERE '1'='1",
        
        // Path traversal
        "../../../etc/passwd",
        "../../response",
        
        // Update/Insert attacks
        "field'; UPDATE response SET data = '{}'::jsonb WHERE '1'='1",
        "field'; INSERT INTO response VALUES ('malicious') --",
        
        // JSON injection
        "field', malicious: 'data", 
        "field'::jsonb",
        
        // Special characters
        "field;",
        "field'",
        "field\"",
        "field`",
        "field$",
        "field%",
        "field&",
        "field*",
        "field(",
        "field)",
        "field[",
        "field]",
        "field{",
        "field}",
        "field|",
        "field\\",
        "field/",
        "field<",
        "field>",
        "field?",
        "field!",
        "field@",
        "field#",
        "field~",
        "field+",
        "field=",
        "field ",
        "field\n",
        "field\t",
        
        // Encoded attacks
        "field%27",
        "field%3B",
        
        // Empty/null
        "",
        " ",
      ];

      for (const maliciousId of maliciousFieldIds) {
        expect(
          () => buildPostgreSQLFilter('form-123', [
            { fieldId: maliciousId, operator: 'EQUALS', value: 'test' }
          ]),
          `Field ID "${maliciousId}" should be rejected`
        ).toThrow(/Invalid fieldId/);
      }
    });

    it('should accept valid field IDs matching the pattern', () => {
      const validFieldIds = [
        // Standard format
        'field-123',
        'field_abc',
        'MyField123',
        
        // Generated field IDs
        'field-1763441183000-swnb74nwn',
        'interests-field',
        'name-field',
        'age-field',
        'email-field',
        'country-field',
        'gender-field',
        'birthdate-field',
        'comments-field',
        
        // Edge cases
        'a',
        'A',
        '1',
        '_',
        '-',
        'a1',
        'A_B',
        'field-with-many-hyphens-123',
        'field_with_many_underscores_456',
        'MixedCase_With-Separators123',
        
        // Real examples from codebase
        'field-1',
        'field-2',
        'field-3',
      ];

      for (const validId of validFieldIds) {
        expect(
          () => buildPostgreSQLFilter('form-123', [
            { fieldId: validId, operator: 'EQUALS', value: 'test' }
          ]),
          `Field ID "${validId}" should be accepted`
        ).not.toThrow();
      }
    });

    it('should sanitize field IDs before building SQL queries', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'valid-field-123', operator: 'EQUALS', value: 'test' }
      ]);

      // Should return proper SQL structure
      expect(result.conditions).toHaveLength(1);
      expect(result.params).toContain('form-123');
      expect(result.params).toContain('test');
      
      // SQL should use safe field accessor (EQUALS uses text accessor ->>)
      expect(result.conditions[0]).toContain("data->>'valid-field-123'");
      expect(result.conditions[0]).toContain("LOWER(");
      expect(result.conditions[0]).toMatch(/\$\d+/); // Contains parameterized placeholder
    });

    it('should handle multiple filters with safe field IDs', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'field-1', operator: 'EQUALS', value: 'value1' },
        { fieldId: 'field_2', operator: 'CONTAINS', value: 'value2' },
        { fieldId: 'Field3', operator: 'GREATER_THAN', value: '100' },
      ]);

      expect(result.conditions).toHaveLength(3);
      expect(result.params[0]).toBe('form-123');
    });

    it('should reject mixed valid/invalid field IDs', () => {
      // First filter valid, second invalid
      expect(() => 
        buildPostgreSQLFilter('form-123', [
          { fieldId: 'valid-field', operator: 'EQUALS', value: 'test' },
          { fieldId: "malicious'; DROP TABLE--", operator: 'EQUALS', value: 'test' },
        ])
      ).toThrow(/Invalid fieldId/);
    });

    it('should protect against operator value injection separately', () => {
      // Field ID is safe, but operator VALUES should be parameterized
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'safe-field',
          operator: 'EQUALS',
          value: "'; DROP TABLE response; --" // Malicious value
        }
      ]);

      // Should not throw (values are parameterized)
      expect(result.conditions).toHaveLength(1);
      
      // Malicious value should be in params (parameterized, not in SQL string)
      expect(result.params).toContain("'; DROP TABLE response; --");
      
      // SQL should use placeholder, not direct interpolation
      expect(result.conditions[0]).toMatch(/\$\d+/); // Contains $1, $2, etc.
      expect(result.conditions[0]).not.toContain("DROP TABLE");
    });
  });

  describe('Query Building', () => {
    it('should build empty filter when no filters provided', () => {
      const result = buildPostgreSQLFilter('form-123', []);
      
      expect(result.conditions).toHaveLength(0);
      expect(result.params).toEqual(['form-123']);
    });

    it('should build empty filter when filters undefined', () => {
      const result = buildPostgreSQLFilter('form-123', undefined);
      
      expect(result.conditions).toHaveLength(0);
      expect(result.params).toEqual(['form-123']);
    });

    it('should handle IS_EMPTY operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'test-field', operator: 'IS_EMPTY' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain("data->'test-field' IS NULL");
      expect(result.conditions[0]).toContain("data->>'test-field' = ''");
      // Should also check for empty arrays
      expect(result.conditions[0]).toContain("jsonb_typeof");
      expect(result.conditions[0]).toContain("jsonb_array_length");
    });

    it('should handle IS_NOT_EMPTY operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'test-field', operator: 'IS_NOT_EMPTY' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain("data->'test-field' IS NOT NULL");
      expect(result.conditions[0]).toContain("data->>'test-field' != ''");
      // Should also exclude empty arrays
      expect(result.conditions[0]).toContain("jsonb_typeof");
      expect(result.conditions[0]).toContain("jsonb_array_length");
    });

    it('should handle EQUALS operator with string value', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'name', operator: 'EQUALS', value: 'John' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain("LOWER(data->>'name')");
      expect(result.params).toContain('John');
    });

    it('should handle CONTAINS operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'description', operator: 'CONTAINS', value: 'test' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain("jsonb_typeof");
      expect(result.params).toContain('test');
    });

    it('should handle CONTAINS_ALL operator with multiple values', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'tags', operator: 'CONTAINS_ALL', values: ['tag1', 'tag2'] }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain("jsonb_typeof");
      expect(result.params).toContain('tag1');
      expect(result.params).toContain('tag2');
    });

    it('should handle numeric comparisons', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'age', operator: 'GREATER_THAN', value: '18' },
        { fieldId: 'score', operator: 'LESS_THAN', value: '100' },
      ]);

      expect(result.conditions).toHaveLength(2);
      expect(result.params).toContain('18');
      expect(result.params).toContain('100');
      // Should use CASE statements for safe casting
      expect(result.conditions[0]).toContain('CASE');
      expect(result.conditions[0]).toContain('WHEN');
      // Should validate numeric pattern with regex
      expect(result.conditions[0]).toContain('~');
    });

    it('should handle date operators', () => {
      const date = '2025-01-01';
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'created', operator: 'DATE_EQUALS', value: date }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.params).toContain(date);
      // Should use CASE statements for safe casting
      expect(result.conditions[0]).toContain('CASE');
      expect(result.conditions[0]).toContain('WHEN');
      // Should validate date pattern with regex
      expect(result.conditions[0]).toContain('~');
    });

    it('should handle invalid numeric values safely', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'age', operator: 'GREATER_THAN', value: '18' }
      ]);

      // Should generate SQL that returns FALSE for non-numeric values
      expect(result.conditions[0]).toContain('ELSE FALSE');
      expect(result.conditions[0]).toContain('END');
    });

    it('should handle invalid date values safely', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'created', operator: 'DATE_AFTER', value: '2025-01-01' }
      ]);

      // Should generate SQL that returns FALSE for non-date values
      expect(result.conditions[0]).toContain('ELSE FALSE');
      expect(result.conditions[0]).toContain('END');
    });
  });

  describe('Missing SQL Operators', () => {
    it('should handle NOT_CONTAINS operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'description', operator: 'NOT_CONTAINS', value: 'test' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('NOT EXISTS');
      expect(result.conditions[0]).toContain('NOT ILIKE');
      expect(result.params).toContain('test');
    });

    it('should handle STARTS_WITH operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'name', operator: 'STARTS_WITH', value: 'John' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('ILIKE');
      expect(result.params).toContain('John%');
    });

    it('should handle ENDS_WITH operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'email', operator: 'ENDS_WITH', value: '@example.com' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('ILIKE');
      expect(result.params).toContain('%@example.com');
    });

    it('should handle BETWEEN operator with min and max', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'score', 
          operator: 'BETWEEN', 
          numberRange: { min: 50, max: 100 } 
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('>=');
      expect(result.conditions[0]).toContain('<=');
      expect(result.conditions[0]).toContain('CASE');
      expect(result.params).toContain(50);
      expect(result.params).toContain(100);
    });

    it('should handle BETWEEN operator with only min', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'score', 
          operator: 'BETWEEN', 
          numberRange: { min: 50 } 
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('>=');
      expect(result.params).toContain(50);
    });

    it('should handle BETWEEN operator with only max', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'score', 
          operator: 'BETWEEN', 
          numberRange: { max: 100 } 
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('<=');
      expect(result.params).toContain(100);
    });

    it('should handle DATE_BEFORE operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'deadline', operator: 'DATE_BEFORE', value: '2025-12-31' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('timestamp');
      expect(result.conditions[0]).toContain('<');
      expect(result.conditions[0]).toContain('CASE');
      expect(result.params).toContain('2025-12-31');
    });

    it('should handle DATE_AFTER operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'startDate', operator: 'DATE_AFTER', value: '2025-01-01' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('timestamp');
      expect(result.conditions[0]).toContain('>');
      expect(result.conditions[0]).toContain('CASE');
      expect(result.params).toContain('2025-01-01');
    });

    it('should handle DATE_BETWEEN operator with both dates', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'createdAt', 
          operator: 'DATE_BETWEEN',
          dateRange: { from: '2025-01-01', to: '2025-12-31' }
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('>=');
      expect(result.conditions[0]).toContain('<=');
      expect(result.conditions[0]).toContain('CASE');
      expect(result.params).toContain('2025-01-01');
      expect(result.params).toContain('2025-12-31');
    });

    it('should handle DATE_BETWEEN operator with only from date', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'createdAt', 
          operator: 'DATE_BETWEEN',
          dateRange: { from: '2025-01-01' }
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('>=');
      expect(result.params).toContain('2025-01-01');
    });

    it('should handle DATE_BETWEEN operator with only to date', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { 
          fieldId: 'createdAt', 
          operator: 'DATE_BETWEEN',
          dateRange: { to: '2025-12-31' }
        }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('<=');
      expect(result.params).toContain('2025-12-31');
    });

    it('should handle IN operator for strings', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'status', operator: 'IN', values: ['active', 'pending'] }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('LOWER');
      expect(result.conditions[0]).toContain('ANY');
      expect(result.params).toContain('active');
      expect(result.params).toContain('pending');
    });

    it('should handle NOT_IN operator for strings', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'status', operator: 'NOT_IN', values: ['archived', 'deleted'] }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('NOT');
      expect(result.conditions[0]).toContain('IS NULL');
      expect(result.params).toContain('archived');
      expect(result.params).toContain('deleted');
    });

    it('should handle NOT_EQUALS operator', () => {
      const result = buildPostgreSQLFilter('form-123', [
        { fieldId: 'status', operator: 'NOT_EQUALS', value: 'draft' }
      ]);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('!=');
      expect(result.conditions[0]).toContain('LOWER');
      expect(result.params).toContain('draft');
    });
  });
});

describe('canFilterAtDatabase', () => {
  it('always returns true', () => {
    expect(canFilterAtDatabase()).toBe(true);
    expect(canFilterAtDatabase([])).toBe(true);
  });
});

describe('buildRawSQLCondition', () => {
  // __submittedAt field — delegates to buildSubmittedAtCondition
  describe('__submittedAt filters', () => {
    it('DATE_EQUALS with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_EQUALS', value: '2026-06-01' }, 1);
      expect(r.sql).toContain('DATE(');
      expect(r.values).toEqual(['2026-06-01']);
    });
    it('DATE_EQUALS without value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_BEFORE with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_BEFORE', value: '2026-06-01' }, 1);
      expect(r.sql).toContain('<');
    });
    it('DATE_BEFORE without value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_BEFORE' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_AFTER with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_AFTER', value: '2026-06-01' }, 1);
      expect(r.sql).toContain('>');
    });
    it('DATE_AFTER without value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_AFTER' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_BETWEEN with from and to', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_BETWEEN', dateRange: { from: '2026-01-01', to: '2026-06-01' } }, 1);
      expect(r.sql).toContain('>=');
      expect(r.sql).toContain('<=');
    });
    it('DATE_BETWEEN with from only', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_BETWEEN', dateRange: { from: '2026-01-01' } }, 1);
      expect(r.sql).toContain('>=');
    });
    it('DATE_BETWEEN without dateRange', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_BETWEEN' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_TODAY', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_TODAY' }, 1);
      expect(r.sql).toContain('CURRENT_DATE');
    });
    it('DATE_LAST_N_DAYS with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'DATE_LAST_N_DAYS', value: '14' }, 1);
      expect(r.sql).toContain('days');
    });
    it('unknown submittedAt operator returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__submittedAt', operator: 'UNKNOWN' as any }, 1);
      expect(r.sql).toBe('');
    });
  });

  // __tags field
  describe('__tags filters', () => {
    it('returns empty when values are missing', () => {
      const r = buildRawSQLCondition({ fieldId: '__tags', operator: 'EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('returns empty for empty values array', () => {
      const r = buildRawSQLCondition({ fieldId: '__tags', operator: 'EQUALS', values: [] }, 1);
      expect(r.sql).toBe('');
    });
    it('returns tag EXISTS query for provided tag IDs', () => {
      const r = buildRawSQLCondition({ fieldId: '__tags', operator: 'EQUALS', values: ['tag-1', 'tag-2'] }, 1);
      expect(r.sql).toContain('EXISTS');
      expect(r.values).toEqual(['tag-1', 'tag-2']);
    });
  });

  // field-level operators
  describe('field operators', () => {
    it('IS_EMPTY', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'IS_EMPTY' }, 1);
      expect(r.sql).toContain('IS NULL');
      expect(r.values).toEqual([]);
    });
    it('IS_NOT_EMPTY', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'IS_NOT_EMPTY' }, 1);
      expect(r.sql).toContain('IS NOT NULL');
    });
    it('EQUALS with single value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'EQUALS', value: 'hello' }, 1);
      expect(r.sql).toContain('LOWER');
      expect(r.values).toContain('hello');
    });
    it('EQUALS with multiple values', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'EQUALS', values: ['a', 'b'] }, 1);
      expect(r.sql).toContain('jsonb_array_length');
      expect(r.values).toEqual(['a', 'b']);
    });
    it('EQUALS with no value or values', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('NOT_EQUALS with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'NOT_EQUALS', value: 'x' }, 1);
      expect(r.sql).toContain('!=');
    });
    it('NOT_EQUALS without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'NOT_EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('CONTAINS with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'CONTAINS', value: 'foo' }, 1);
      expect(r.sql).toContain('ILIKE');
    });
    it('CONTAINS without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'CONTAINS' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_TODAY for a field', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_TODAY' }, 1);
      expect(r.sql).toContain('CURRENT_DATE');
    });
    it('DATE_LAST_N_DAYS with valid days', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_LAST_N_DAYS', value: '30' }, 1);
      expect(r.values).toEqual([30]);
    });
    it('DATE_LAST_N_DAYS with invalid value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_LAST_N_DAYS', value: 'abc' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_LAST_N_DAYS with empty value falls back to 7', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_LAST_N_DAYS', value: '' }, 1);
      expect(r.values).toEqual([7]);
    });
    it('unknown operator returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'UNKNOWN' as any }, 1);
      expect(r.sql).toBe('');
    });
    it('NOT_CONTAINS with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'NOT_CONTAINS', value: 'bar' }, 1);
      expect(r.sql).toContain('NOT ILIKE');
    });
    it('NOT_CONTAINS without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'NOT_CONTAINS' }, 1);
      expect(r.sql).toBe('');
    });
    it('STARTS_WITH with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'STARTS_WITH', value: 'foo' }, 1);
      expect(r.sql).toContain('ILIKE');
      expect(r.values[0]).toMatch(/^foo/);
    });
    it('STARTS_WITH without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'STARTS_WITH' }, 1);
      expect(r.sql).toBe('');
    });
    it('ENDS_WITH with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'ENDS_WITH', value: 'baz' }, 1);
      expect(r.sql).toContain('ILIKE');
      expect(r.values[0]).toMatch(/baz$/);
    });
    it('ENDS_WITH without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-1', operator: 'ENDS_WITH' }, 1);
      expect(r.sql).toBe('');
    });
    it('GREATER_THAN with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'GREATER_THAN', value: '10' }, 1);
      expect(r.sql).toContain('>');
    });
    it('GREATER_THAN without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'GREATER_THAN' }, 1);
      expect(r.sql).toBe('');
    });
    it('GREATER_THAN_OR_EQUAL with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'GREATER_THAN_OR_EQUAL', value: '5' }, 1);
      expect(r.sql).toContain('>=');
    });
    it('GREATER_THAN_OR_EQUAL without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'GREATER_THAN_OR_EQUAL' }, 1);
      expect(r.sql).toBe('');
    });
    it('LESS_THAN with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'LESS_THAN', value: '100' }, 1);
      expect(r.sql).toContain('<');
    });
    it('LESS_THAN without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'LESS_THAN' }, 1);
      expect(r.sql).toBe('');
    });
    it('LESS_THAN_OR_EQUAL with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'LESS_THAN_OR_EQUAL', value: '50' }, 1);
      expect(r.sql).toContain('<=');
    });
    it('LESS_THAN_OR_EQUAL without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-n', operator: 'LESS_THAN_OR_EQUAL' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_EQUALS for a field with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_EQUALS', value: '2026-06-01' }, 1);
      expect(r.sql).toContain('date');
    });
    it('DATE_EQUALS for a field without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_BEFORE for a field with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_BEFORE', value: '2026-06-01' }, 1);
      expect(r.sql).not.toBe('');
    });
    it('DATE_BEFORE for a field without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_BEFORE' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_AFTER for a field with value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_AFTER', value: '2026-01-01' }, 1);
      expect(r.sql).not.toBe('');
    });
    it('DATE_AFTER for a field without value', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_AFTER' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_BETWEEN for a field with from+to', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_BETWEEN', dateRange: { from: '2026-01-01', to: '2026-06-01' } }, 1);
      expect(r.sql).not.toBe('');
    });
    it('DATE_BETWEEN for a field without dateRange', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_BETWEEN' }, 1);
      expect(r.sql).toBe('');
    });
    it('DATE_LAST_N_DAYS for field with negative days (invalid)', () => {
      const r = buildRawSQLCondition({ fieldId: 'field-date', operator: 'DATE_LAST_N_DAYS', value: '-5' }, 1);
      expect(r.sql).toBe('');
    });
  });

  // Native Quiz (epic #289, Story 11): grade filters, built against the
  // joined `rg` alias rather than the JSONB `data` column.
  describe('__gradePercentage filters', () => {
    it('GREATER_THAN_OR_EQUAL with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'GREATER_THAN_OR_EQUAL', value: '80' }, 1);
      expect(r.sql).toBe('rg.percentage >= $1::numeric');
      expect(r.values).toEqual(['80']);
    });
    it('GREATER_THAN_OR_EQUAL without value', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'GREATER_THAN_OR_EQUAL' }, 1);
      expect(r.sql).toBe('');
    });
    it('EQUALS with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'EQUALS', value: '50' }, 1);
      expect(r.sql).toContain('rg.percentage =');
    });
    it('BETWEEN with min and max', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'BETWEEN', numberRange: { min: 40, max: 90 } }, 1);
      expect(r.sql).toContain('rg.percentage >= $1::numeric');
      expect(r.sql).toContain('rg.percentage <= $2::numeric');
      expect(r.values).toEqual([40, 90]);
    });
    it('BETWEEN without numberRange returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'BETWEEN' }, 1);
      expect(r.sql).toBe('');
    });
    it('unsupported operator returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'CONTAINS' as any, value: '1' }, 1);
      expect(r.sql).toBe('');
    });
  });

  describe('__gradePassed filters', () => {
    it('EQUALS true', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePassed', operator: 'EQUALS', value: 'true' }, 1);
      expect(r.sql).toBe('rg.passed = $1::boolean');
      expect(r.values).toEqual([true]);
    });
    it('EQUALS false', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePassed', operator: 'EQUALS', value: 'false' }, 1);
      expect(r.values).toEqual([false]);
    });
    it('non-EQUALS operator returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePassed', operator: 'CONTAINS' as any, value: 'true' }, 1);
      expect(r.sql).toBe('');
    });
    it('missing value returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradePassed', operator: 'EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
  });

  describe('__gradeStatus filters', () => {
    it('EQUALS with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'EQUALS', value: 'NEEDS_REVIEW' }, 1);
      expect(r.sql).toBe('rg.status = $1');
      expect(r.values).toEqual(['NEEDS_REVIEW']);
    });
    it('EQUALS without value returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'EQUALS' }, 1);
      expect(r.sql).toBe('');
    });
    it('IN with values', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'IN', values: ['NEEDS_REVIEW', 'AUTO_GRADED'] }, 1);
      expect(r.sql).toContain('rg.status = ANY(ARRAY[$1, $2]::text[])');
      expect(r.values).toEqual(['NEEDS_REVIEW', 'AUTO_GRADED']);
    });
    it('IN without values returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'IN' }, 1);
      expect(r.sql).toBe('');
    });
    it('NOT_IN with values', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'NOT_IN', values: ['RELEASED'] }, 1);
      expect(r.sql).toContain('NOT (rg.status = ANY(ARRAY[$1]::text[]))');
    });
    it('unsupported operator returns empty', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'CONTAINS' as any, value: 'x' }, 1);
      expect(r.sql).toBe('');
    });
  });

  describe('__tags filter is unambiguous under a grade JOIN', () => {
    it('references the response table explicitly rather than a bare id', () => {
      const r = buildRawSQLCondition({ fieldId: '__tags', operator: 'EQUALS', values: ['tag-1'] }, 1);
      expect(r.sql).toContain('rta."responseId" = "response".id');
    });
  });
});

describe('filtersNeedGradeJoin', () => {
  it('returns false for undefined/empty filters', () => {
    expect(filtersNeedGradeJoin(undefined)).toBe(false);
    expect(filtersNeedGradeJoin([])).toBe(false);
  });
  it('returns false when no filter targets a grade field', () => {
    expect(filtersNeedGradeJoin([{ fieldId: 'field-1', operator: 'EQUALS', value: 'x' }])).toBe(false);
  });
  it('returns true when a filter targets __gradePercentage', () => {
    expect(filtersNeedGradeJoin([{ fieldId: '__gradePercentage', operator: 'GREATER_THAN_OR_EQUAL', value: '80' }])).toBe(true);
  });
  it('returns true when a filter targets __gradePassed', () => {
    expect(filtersNeedGradeJoin([{ fieldId: '__gradePassed', operator: 'EQUALS', value: 'true' }])).toBe(true);
  });
  it('returns true when a filter targets __gradeStatus', () => {
    expect(filtersNeedGradeJoin([{ fieldId: '__gradeStatus', operator: 'EQUALS', value: 'NEEDS_REVIEW' }])).toBe(true);
  });
});

// Response meta-filters beyond quiz grading (P0 doc: completion time, device/geo,
// respondent identity, edit history, completeness, PDF generation status).
describe('response meta filters', () => {
  describe('__gradeAttempt filters', () => {
    it('GREATER_THAN_OR_EQUAL with value', () => {
      const r = buildRawSQLCondition({ fieldId: '__gradeAttempt', operator: 'GREATER_THAN_OR_EQUAL', value: '2' }, 1);
      expect(r.sql).toBe('rg."attemptNumber" >= $1::numeric');
      expect(r.values).toEqual(['2']);
    });
  });

  describe('grade IS_EMPTY / IS_NOT_EMPTY (no ResponseGrade row)', () => {
    it('__gradePercentage IS_EMPTY', () => {
      expect(buildRawSQLCondition({ fieldId: '__gradePercentage', operator: 'IS_EMPTY' }, 1).sql).toBe('rg.percentage IS NULL');
    });
    it('__gradePassed IS_NOT_EMPTY', () => {
      expect(buildRawSQLCondition({ fieldId: '__gradePassed', operator: 'IS_NOT_EMPTY' }, 1).sql).toBe('rg.passed IS NOT NULL');
    });
    it('__gradeStatus IS_EMPTY', () => {
      expect(buildRawSQLCondition({ fieldId: '__gradeStatus', operator: 'IS_EMPTY' }, 1).sql).toBe('rg.status IS NULL');
    });
  });

  describe('__completionTimeSeconds filters', () => {
    it('BETWEEN with min and max', () => {
      const r = buildRawSQLCondition({ fieldId: '__completionTimeSeconds', operator: 'BETWEEN', numberRange: { min: 30, max: 300 } }, 1);
      expect(r.sql).toContain('fsa."completionTimeSeconds" >= $1::numeric');
      expect(r.sql).toContain('fsa."completionTimeSeconds" <= $2::numeric');
      expect(r.values).toEqual([30, 300]);
    });
    it('IS_EMPTY', () => {
      expect(buildRawSQLCondition({ fieldId: '__completionTimeSeconds', operator: 'IS_EMPTY' }, 1).sql).toBe('fsa."completionTimeSeconds" IS NULL');
    });
  });

  describe('__browser / __operatingSystem / __country filters', () => {
    it('__browser CONTAINS', () => {
      const r = buildRawSQLCondition({ fieldId: '__browser', operator: 'CONTAINS', value: 'Chrome' }, 1);
      expect(r.sql).toBe('fsa.browser ILIKE $1');
      expect(r.values).toEqual(['%Chrome%']);
    });
    it('__operatingSystem EQUALS', () => {
      const r = buildRawSQLCondition({ fieldId: '__operatingSystem', operator: 'EQUALS', value: 'macOS' }, 1);
      expect(r.sql).toBe('LOWER(fsa."operatingSystem") = LOWER($1)');
    });
    it('__country EQUALS empty value returns empty', () => {
      expect(buildRawSQLCondition({ fieldId: '__country', operator: 'EQUALS' }, 1).sql).toBe('');
    });
  });

  describe('__respondentType filters', () => {
    it('authenticated', () => {
      const r = buildRawSQLCondition({ fieldId: '__respondentType', operator: 'EQUALS', value: 'authenticated' }, 1);
      expect(r.sql).toBe('"response"."respondentUserId" IS NOT NULL');
      expect(r.values).toEqual([]);
    });
    it('anonymous', () => {
      const r = buildRawSQLCondition({ fieldId: '__respondentType', operator: 'EQUALS', value: 'anonymous' }, 1);
      expect(r.sql).toBe('"response"."respondentUserId" IS NULL');
    });
    it('non-EQUALS operator returns empty', () => {
      expect(buildRawSQLCondition({ fieldId: '__respondentType', operator: 'CONTAINS' as any, value: 'authenticated' }, 1).sql).toBe('');
    });
  });

  describe('__respondentEmail filters', () => {
    it('CONTAINS', () => {
      const r = buildRawSQLCondition({ fieldId: '__respondentEmail', operator: 'CONTAINS', value: 'acme.com' }, 1);
      expect(r.sql).toBe('"response"."respondentEmail" ILIKE $1');
    });
  });

  describe('__duplicateEmail filters', () => {
    it('true requires a non-null email and a matching sibling response', () => {
      const r = buildRawSQLCondition({ fieldId: '__duplicateEmail', operator: 'EQUALS', value: 'true' }, 1);
      expect(r.sql).toContain('"response"."respondentEmail" IS NOT NULL');
      expect(r.sql).toContain('EXISTS');
      expect(r.sql).not.toContain('NOT EXISTS');
    });
    it('false negates the EXISTS check', () => {
      const r = buildRawSQLCondition({ fieldId: '__duplicateEmail', operator: 'EQUALS', value: 'false' }, 1);
      expect(r.sql).toContain('AND NOT EXISTS');
    });
  });

  describe('__lastEditedAt / __lastEditedByEmail filters', () => {
    it('__lastEditedAt DATE_AFTER', () => {
      const r = buildRawSQLCondition({ fieldId: '__lastEditedAt', operator: 'DATE_AFTER', value: '2026-01-01' }, 1);
      expect(r.sql).toBe('leh."editedAt" > $1::timestamptz');
    });
    it('__lastEditedAt IS_NOT_EMPTY means "was edited at all"', () => {
      expect(buildRawSQLCondition({ fieldId: '__lastEditedAt', operator: 'IS_NOT_EMPTY' }, 1).sql).toBe('leh."editedAt" IS NOT NULL');
    });
    it('__lastEditedByEmail EQUALS', () => {
      const r = buildRawSQLCondition({ fieldId: '__lastEditedByEmail', operator: 'EQUALS', value: 'a@b.com' }, 1);
      expect(r.sql).toBe('LOWER(leh."editedByEmail") = LOWER($1)');
    });
  });

  describe('__completenessPercent filters', () => {
    it('GREATER_THAN_OR_EQUAL', () => {
      const r = buildRawSQLCondition({ fieldId: '__completenessPercent', operator: 'GREATER_THAN_OR_EQUAL', value: '80' }, 1);
      expect(r.sql).toContain('NULLIF(fm."fieldCount", 0)');
      expect(r.sql).toContain('>= $1::numeric');
    });
    it('IS_EMPTY is not supported (always has a numeric value)', () => {
      expect(buildRawSQLCondition({ fieldId: '__completenessPercent', operator: 'IS_EMPTY' }, 1).sql).toBe('');
    });
  });

  describe('__pdfGenerated_<id> filters', () => {
    it('true', () => {
      const r = buildRawSQLCondition({ fieldId: '__pdfGenerated_gen123', operator: 'EQUALS', value: 'true' }, 1);
      expect(r.sql).toContain('pgr."generatorId" = $1');
      expect(r.sql).not.toContain('NOT EXISTS');
      expect(r.values).toEqual(['gen123']);
    });
    it('false negates the EXISTS check', () => {
      const r = buildRawSQLCondition({ fieldId: '__pdfGenerated_gen123', operator: 'EQUALS', value: 'false' }, 1);
      expect(r.sql.trim().startsWith('NOT EXISTS')).toBe(true);
    });
    it('rejects an unsafe generator id', () => {
      expect(() =>
        buildRawSQLCondition({ fieldId: '__pdfGenerated_gen 123;drop', operator: 'EQUALS', value: 'true' }, 1)
      ).toThrow();
    });
  });

  describe('buildJoinClause', () => {
    it('returns empty string when nothing needs a join', () => {
      expect(buildJoinClause([{ fieldId: 'field-1', operator: 'EQUALS', value: 'x' }])).toBe('');
      expect(buildJoinClause(undefined)).toBe('');
    });
    it('composes multiple joins when filters span categories', () => {
      const clause = buildJoinClause([
        { fieldId: '__gradePercentage', operator: 'GREATER_THAN', value: '50' },
        { fieldId: '__browser', operator: 'EQUALS', value: 'Chrome' },
        { fieldId: '__lastEditedAt', operator: 'IS_NOT_EMPTY' },
        { fieldId: '__completenessPercent', operator: 'GREATER_THAN', value: '50' },
      ]);
      expect(clause).toContain('response_grade');
      expect(clause).toContain('form_submission_analytics');
      expect(clause).toContain('response_edit_history');
      expect(clause).toContain('form_metadata');
    });
    it('adds the grade join for a grade sort even without a grade filter', () => {
      expect(buildJoinClause([], true)).toContain('response_grade');
    });
    it('does not add unrelated joins for a duplicate-email or pdf-generated filter (no join needed)', () => {
      const clause = buildJoinClause([
        { fieldId: '__duplicateEmail', operator: 'EQUALS', value: 'true' },
        { fieldId: '__pdfGenerated_gen1', operator: 'EQUALS', value: 'true' },
      ]);
      expect(clause).toBe('');
    });
  });

  describe('isMetaFilterFieldId', () => {
    it('recognizes every meta fieldId', () => {
      expect(isMetaFilterFieldId('__submittedAt')).toBe(true);
      expect(isMetaFilterFieldId('__tags')).toBe(true);
      expect(isMetaFilterFieldId('__gradePercentage')).toBe(true);
      expect(isMetaFilterFieldId('__completionTimeSeconds')).toBe(true);
      expect(isMetaFilterFieldId('__respondentType')).toBe(true);
      expect(isMetaFilterFieldId('__completenessPercent')).toBe(true);
      expect(isMetaFilterFieldId('__pdfGenerated_abc123')).toBe(true);
    });
    it('rejects a real form fieldId', () => {
      expect(isMetaFilterFieldId('some-form-field-id')).toBe(false);
    });
  });
});

