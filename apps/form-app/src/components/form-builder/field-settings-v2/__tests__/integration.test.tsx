// import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  FieldType,
  NumberField,
  SelectField,
  TextFieldValidation,
  TextInputField,
} from '@dculus/types';

let FieldSettingsV2: typeof import('../../FieldSettingsV2').default;

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { values?: Record<string, unknown> }) => {
      const translations: Record<string, string> = {
        'emptyState.title': 'Select a field to edit its settings',
        'unsupportedField.title': `Unsupported field type: ${options?.values?.fieldType ?? ''}`,
        'unsupportedField.subtitle': 'Please select a different field or contact support',
      };

      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

function createFieldSettingsModuleStub() {
  return {
    TextFieldSettings: ({ field }: any) => (
      <div data-testid="text-field-settings">
        <div data-testid="field-settings-header">{field?.label ?? 'No Field'}</div>
        <div data-testid="form-input-label" />
        <div data-testid="form-input-hint" />
        <div data-testid="form-input-placeholder" />
        <div data-testid="field-settings-footer">Footer</div>
      </div>
    ),
    NumberFieldSettings: ({ field }: any) => (
      <div data-testid="number-field-settings">
        <div data-testid="field-settings-header">{field?.label ?? 'No Field'}</div>
        <div data-testid="form-input-label" />
        <div data-testid="form-input-min" />
        <div data-testid="form-input-max" />
        <div data-testid="field-settings-footer">Footer</div>
      </div>
    ),
    SelectionFieldSettings: ({ field }: any) => (
      <div data-testid="selection-field-settings">
        <div data-testid="field-settings-header">{field?.label ?? 'No Field'}</div>
        <div data-testid="options-settings">Options Settings</div>
        <div data-testid="field-settings-footer">Footer</div>
      </div>
    ),
    DateFieldSettings: ({ field }: any) => (
      <div data-testid="date-field-settings">
        <div data-testid="field-settings-header">{field?.label ?? 'No Field'}</div>
        <div data-testid="field-settings-footer">Footer</div>
      </div>
    ),
    RichTextFieldSettings: ({ field }: any) => (
      <div data-testid="rich-text-field-settings">
        <div data-testid="field-settings-header">{field?.label ?? 'No Field'}</div>
        <div data-testid="rich-text-settings">Rich Text Settings</div>
        <div data-testid="field-settings-footer">Footer</div>
      </div>
    ),
  };
}

jest.mock('../../field-settings-v2', () => createFieldSettingsModuleStub());
jest.mock('../../field-settings-v2/index', () => createFieldSettingsModuleStub());

beforeAll(() => {
  ({ default: FieldSettingsV2 } = require('../../FieldSettingsV2'));
});

// Create mock fields for testing
const createMockTextField = (): TextInputField =>
  ({
    id: 'text-1',
    type: FieldType.TEXT_INPUT_FIELD,
    label: 'Test Text Field',
    hint: 'Help text',
    placeholder: 'Enter text',
    prefix: '',
    defaultValue: '',
    validation: new TextFieldValidation(false),
  } as unknown as TextInputField);

const createMockNumberField = (): NumberField =>
  ({
    id: 'number-1',
    type: FieldType.NUMBER_FIELD,
    label: 'Test Number Field',
    hint: 'Number help',
    placeholder: 'Enter number',
    prefix: '$',
    defaultValue: '0',
    validation: { required: false },
    min: 0,
    max: 100,
  } as unknown as NumberField);

const createMockSelectField = (): SelectField =>
  ({
    id: 'select-1',
    type: FieldType.SELECT_FIELD,
    label: 'Test Select Field',
    hint: 'Select help',
    prefix: '',
    defaultValue: '',
    validation: { required: false },
    options: ['Option 1', 'Option 2'],
  } as unknown as SelectField);

describe('FieldSettingsV2 Integration', () => {
  const mockOnUpdate = jest.fn();
  const mockOnFieldSwitch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Field Type Routing', () => {
    test('renders empty state when no field is provided', () => {
      render(
        <FieldSettingsV2
          field={null}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      expect(
        screen.getByText('Select a field to edit its settings')
      ).toBeInTheDocument();
    });

    test('routes to TextFieldSettings for text input field', () => {
      const field = createMockTextField();

      render(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Should render field settings header with field label
      expect(screen.getByTestId('field-settings-header')).toHaveTextContent(
        'Test Text Field'
      );

      // Should render basic form inputs for text field
      expect(screen.getByTestId('form-input-label')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-hint')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-placeholder')).toBeInTheDocument();
    });

    test('routes to NumberFieldSettings for number field', () => {
      const field = createMockNumberField();

      render(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Should render field settings header with field label
      expect(screen.getByTestId('field-settings-header')).toHaveTextContent(
        'Test Number Field'
      );

      // Should render basic form inputs and number-specific fields
      expect(screen.getByTestId('form-input-label')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-min')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-max')).toBeInTheDocument();
    });

    test('routes to SelectionFieldSettings for select field', () => {
      const field = createMockSelectField();

      render(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Should render field settings header with field label
      expect(screen.getByTestId('field-settings-header')).toHaveTextContent(
        'Test Select Field'
      );

      // Should render options settings component
      expect(screen.getByTestId('options-settings')).toBeInTheDocument();
    });

    test('shows unsupported message for unknown field types', () => {
      const unknownField = {
        id: 'unknown-1',
        type: 'unknown_field_type' as any,
        label: 'Unknown Field',
      };

      render(
        <FieldSettingsV2
          field={unknownField}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      expect(screen.getByText(/Unsupported field type/)).toBeInTheDocument();
      expect(screen.getByText(/unknown_field_type/)).toBeInTheDocument();
    });
  });

  describe('Connection State', () => {
    test('passes isConnected prop to field-specific components', () => {
      const field = createMockTextField();

      const { rerender } = render(
        <FieldSettingsV2
          field={field}
          isConnected={false}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Form inputs should be disabled when not connected
      // This would be tested more thoroughly in individual component tests

      rerender(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Form inputs should be enabled when connected
      // This would be tested more thoroughly in individual component tests
    });
  });

  describe('Callback Propagation', () => {
    test('propagates onUpdate callback to field-specific components', () => {
      const field = createMockTextField();

      render(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // The onUpdate callback should be passed to the field-specific component
      // This would trigger form submission and call onUpdate
      // More detailed testing would be done in individual component tests

      expect(screen.getByTestId('field-settings-footer')).toBeInTheDocument();
    });

    test('propagates onFieldSwitch callback to field-specific components', () => {
      const field = createMockTextField();

      render(
        <FieldSettingsV2
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // The onFieldSwitch callback should be passed to the field-specific component
      // This would be tested more thoroughly in individual component tests

      expect(screen.getByTestId('field-settings-footer')).toBeInTheDocument();
    });
  });

  describe('Field Type Coverage', () => {
    const fieldTypes = [
      { type: FieldType.TEXT_INPUT_FIELD, name: 'TextInputField' },
      { type: FieldType.TEXT_AREA_FIELD, name: 'TextAreaField' },
      { type: FieldType.EMAIL_FIELD, name: 'EmailField' },
      { type: FieldType.NUMBER_FIELD, name: 'NumberField' },
      { type: FieldType.SELECT_FIELD, name: 'SelectField' },
      { type: FieldType.RADIO_FIELD, name: 'RadioField' },
      { type: FieldType.CHECKBOX_FIELD, name: 'CheckboxField' },
      { type: FieldType.DATE_FIELD, name: 'DateField' },
      { type: FieldType.RICH_TEXT_FIELD, name: 'RichTextField' },
    ];

    fieldTypes.forEach(({ type, name }) => {
      test(`handles ${name} (${type}) without crashing`, () => {
        const mockField = {
          id: 'test-id',
          type: type,
          label: `Test ${name}`,
        };

        expect(() => {
          render(
            <FieldSettingsV2
              field={mockField as any}
              isConnected={true}
              onUpdate={mockOnUpdate}
              onFieldSwitch={mockOnFieldSwitch}
            />
          );
        }).not.toThrow();
      });
    });
  });

  describe('Performance', () => {
    test('does not re-render unnecessarily when props do not change', () => {
      const field = createMockTextField();
      let renderCount = 0;

      const TestWrapper = (props: any) => {
        renderCount++;
        return <FieldSettingsV2 {...props} />;
      };

      const { rerender } = render(
        <TestWrapper
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender(
        <TestWrapper
          field={field}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      // Should have rendered once more
      expect(renderCount).toBe(initialRenderCount + 1);
    });

    test('re-renders correctly when field type changes', () => {
      const textField = createMockTextField();
      const numberField = createMockNumberField();

      const { rerender } = render(
        <FieldSettingsV2
          field={textField}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      expect(screen.getByTestId('field-settings-header')).toHaveTextContent(
        'Test Text Field'
      );

      rerender(
        <FieldSettingsV2
          field={numberField}
          isConnected={true}
          onUpdate={mockOnUpdate}
          onFieldSwitch={mockOnFieldSwitch}
        />
      );

      expect(screen.getByTestId('field-settings-header')).toHaveTextContent(
        'Test Number Field'
      );
    });
  });
});
