import '@testing-library/jest-dom';
import React from 'react';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Zustand
jest.mock('zustand', () => ({
  create: jest.fn(() => jest.fn()),
}));

// Mock Apollo Client
jest.mock('@apollo/client', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  ApolloClient: jest.fn(),
  InMemoryCache: jest.fn(),
  createHttpLink: jest.fn(),
  from: jest.fn(),
}));


// Mock @dculus/ui components
jest.mock('@dculus/ui', () => {
  return {
    Button: ({ children, ...props }: any) => React.createElement('button', props, children),
    Input: (props: any) => React.createElement('input', props),
    Label: ({ children, ...props }: any) => React.createElement('label', props, children),
    Card: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardContent: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardHeader: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardTitle: ({ children, ...props }: any) => React.createElement('h3', props, children),
  };
});

// Mock @dculus/types
jest.mock('@dculus/types', () => {
  const FieldType = {
    TEXT_INPUT_FIELD: 'text_input_field',
    TEXT_AREA_FIELD: 'text_area_field',
    EMAIL_FIELD: 'email_field',
    NUMBER_FIELD: 'number_field',
    SELECT_FIELD: 'select_field',
    RADIO_FIELD: 'radio_field',
    CHECKBOX_FIELD: 'checkbox_field',
    DATE_FIELD: 'date_field',
  };

  class TextFieldValidation {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    type: string;

    constructor(required: boolean, minLength?: number, maxLength?: number) {
      this.required = required;
      this.minLength = minLength;
      this.maxLength = maxLength;
      this.type = 'text_field_validation';
    }
  }

  class TextInputField {
    id: string;
    label: string;
    defaultValue: string;
    prefix: string;
    hint: string;
    placeholder: string;
    validation: TextFieldValidation;
    type: string;

    constructor(
      id: string,
      label: string,
      defaultValue: string,
      prefix: string,
      hint: string,
      placeholder: string,
      validation: TextFieldValidation
    ) {
      this.id = id;
      this.label = label;
      this.defaultValue = defaultValue;
      this.prefix = prefix;
      this.hint = hint;
      this.placeholder = placeholder;
      this.validation = validation;
      this.type = FieldType.TEXT_INPUT_FIELD;
    }
  }

  class TextAreaField extends TextInputField {
    constructor(
      id: string,
      label: string,
      defaultValue: string,
      prefix: string,
      hint: string,
      placeholder: string,
      validation: TextFieldValidation
    ) {
      super(id, label, defaultValue, prefix, hint, placeholder, validation);
      this.type = FieldType.TEXT_AREA_FIELD;
    }
  }

  // Mock validation schema
  const textInputFieldValidationSchema = {
    safeParse: jest.fn((data: any) => {
      const errors = [];
      
      // Test label requirement
      if (!data.label || data.label.trim() === '') {
        errors.push({ message: 'Field label is required' });
      }
      
      // Test label length
      if (data.label && data.label.length > 200) {
        errors.push({ message: 'Label is too long' });
      }
      
      // Test hint length
      if (data.hint && data.hint.length > 500) {
        errors.push({ message: 'Help text is too long' });
      }
      
      // Test placeholder length
      if (data.placeholder && data.placeholder.length > 100) {
        errors.push({ message: 'Placeholder is too long' });
      }
      
      // Test character limits
      if (data.validation) {
        const { minLength, maxLength } = data.validation;
        
        // Test min length limits
        if (minLength !== undefined && minLength !== '') {
          const minNum = typeof minLength === 'string' ? parseInt(minLength) : minLength;
          if (minNum < 0) {
            errors.push({ message: 'Minimum length must be 0 or greater' });
          }
          if (minNum > 5000) {
            errors.push({ message: 'Minimum length cannot exceed 5000 characters' });
          }
        }
        
        // Test max length limits
        if (maxLength !== undefined && maxLength !== '') {
          const maxNum = typeof maxLength === 'string' ? parseInt(maxLength) : maxLength;
          if (maxNum < 1) {
            errors.push({ message: 'Maximum length must be 1 or greater' });
          }
          if (maxNum > 5000) {
            errors.push({ message: 'Maximum length cannot exceed 5000 characters' });
          }
        }
        
        // Test min <= max
        if (minLength !== undefined && maxLength !== undefined && minLength !== '' && maxLength !== '') {
          const minNum = typeof minLength === 'string' ? parseInt(minLength) : minLength;
          const maxNum = typeof maxLength === 'string' ? parseInt(maxLength) : maxLength;
          if (minNum > maxNum) {
            errors.push({ message: 'Minimum length must be less than or equal to maximum length' });
          }
        }
      }
      
      return errors.length === 0 
        ? { success: true, data }
        : { success: false, error: { issues: errors } };
    })
  };

  return {
    FieldType,
    TextFieldValidation,
    TextInputField,
    TextAreaField,
    textInputFieldValidationSchema,
    getFieldValidationSchema: jest.fn(() => ({})),
  };
});
