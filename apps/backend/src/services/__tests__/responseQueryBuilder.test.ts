import { describe, it, expect } from 'vitest';
import { buildPostgreSQLFilter } from '../responseQueryBuilder.js';

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
});
