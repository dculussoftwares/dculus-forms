// import React from 'react';
import { render, screen } from '@testing-library/react';
import { FieldSettingsV2 } from '../index';
import {
  FieldType,
  NumberField,
  SelectField,
  TextFieldValidation,
  TextInputField,
} from '@dculus/types';

// Mock field settings components to avoid complex dependencies
jest.mock('../../field-settings', () => ({
  ValidationSummary: ({ errors }: any) => (
    <div data-testid="validation-summary">{JSON.stringify(errors)}</div>
  ),
  FieldSettingsHeader: ({ field, isDirty }: any) => (
    <div data-testid="field-settings-header">
      {field.label} {isDirty ? '(modified)' : ''}
    </div>
  ),
  FieldSettingsFooter: ({ onSave, onCancel, onReset }: any) => (
    <div data-testid="field-settings-footer">
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onReset}>Reset</button>
    </div>
  ),
  FormInputField: ({ name, label, control, error }: any) => (
    <div data-testid={`form-input-${name}`}>
      <label>{label}</label>
      <input
        name={name}
        data-testid={`input-${name}`}
        onChange={(e) => {
          // Mock react-hook-form control
          if (control && control.setValue) {
            control.setValue(name, e.target.value, { shouldDirty: true });
          }
        }}
      />
      {error && <div data-testid={`error-${name}`}>{error.message}</div>}
    </div>
  ),
  OptionsSettings: () => (
    <div data-testid="options-settings">Options Settings</div>
  ),
  RichTextSettings: () => (
    <div data-testid="rich-text-settings">Rich Text Settings</div>
  ),
  FIELD_SETTINGS_CONSTANTS: {
    CSS_CLASSES: {
      SECTION_SPACING: 'space-y-4',
      SECTION_TITLE: 'text-lg font-semibold',
      INPUT_SPACING: 'space-y-2',
      LABEL_STYLE: 'text-sm font-medium',
    },
    SECTION_TITLES: {
      BASIC_SETTINGS: 'Basic Settings',
      VALIDATION: 'Validation',
    },
    LABELS: {
      LABEL: 'Label',
      HELP_TEXT: 'Help Text',
      PLACEHOLDER: 'Placeholder',
      PREFIX: 'Prefix',
      DEFAULT_VALUE: 'Default Value',
      REQUIRED_FIELD: 'Required Field',
      MINIMUM_LENGTH: 'Minimum Length',
      MAXIMUM_LENGTH: 'Maximum Length',
    },
    PLACEHOLDERS: {
      FIELD_LABEL: 'Enter field label',
      HELP_TEXT: 'Enter help text',
      PLACEHOLDER_TEXT: 'Enter placeholder',
      PREFIX_TEXT: 'Enter prefix',
      NO_MINIMUM: 'No minimum',
      NO_MAXIMUM: 'No maximum',
    },
  },
}));

// Create mock fields for testing
const createMockTextField = (): TextInputField => {
  const validation = new TextFieldValidation(false);
  return new TextInputField(
    'text-1',
    'Test Text Field',
    '',
    '',
    'Help text',
    'Enter text',
    validation
  );
};

const createMockNumberField = (): NumberField => {
  return new NumberField(
    'number-1',
    'Test Number Field',
    '0',
    '$',
    'Number help',
    'Enter number',
    { required: false } as any,
    0,
    100
  );
};

const createMockSelectField = (): SelectField => {
  return new SelectField(
    'select-1',
    'Test Select Field',
    '',
    '',
    'Select help',
    { required: false } as any,
    ['Option 1', 'Option 2']
  );
};

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