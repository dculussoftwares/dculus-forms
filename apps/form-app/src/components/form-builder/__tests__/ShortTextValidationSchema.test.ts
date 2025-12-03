/**
 * Direct tests for Short Text Field validation schema
 * Tests the actual Zod schema validation from @dculus/types
 */
import { textInputFieldValidationSchema } from '../../../../../../packages/types/src/validation';

describe('Real Short Text Validation Schema', () => {
  test('validates actual schema exists', () => {
    expect(textInputFieldValidationSchema).toBeDefined();
    expect(textInputFieldValidationSchema.safeParse).toBeInstanceOf(Function);
  });

  test('real schema validates minimum length constraints', async () => {
    const testData = {
      label: 'Test Field',
      validation: {
        minLength: 10,
        maxLength: 100
      }
    };

    const result = textInputFieldValidationSchema.safeParse(testData);
    expect(result.success).toBe(true);
  });

  test('real schema enforces 5000 character limit', async () => {
    const testData = {
      label: 'Test Field',
      validation: {
        minLength: 6000
      }
    };

    const result = textInputFieldValidationSchema.safeParse(testData);

    expect(result.success).toBe(false);
    expect(
      result?.error?.issues.some((issue: any) =>
        issue.message.includes('fieldSettingsConstants:errorMessages.characterLimitExceeded')
      )
    ).toBe(true);
  });
});
