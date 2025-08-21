import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { PageRenderer } from '../renderers/PageRenderer';
import { createSamplePages, createSinglePage, createValidationTestPages, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';

const meta: Meta<typeof PageRenderer> = {
  title: 'Renderers/PageRenderer',
  component: PageRenderer,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'The PageRenderer component handles rendering of form pages in both single page and multipage modes. It supports form validation, navigation, and different rendering modes.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box', overflow: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    pageMode: {
      control: { type: 'select' },
      options: ['single_page', 'multipage'],
      description: 'Whether to render all pages at once or one at a time',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(formModes),
      description: 'Rendering mode affecting validation and interactivity',
    },
    showPageNavigation: {
      control: 'boolean',
      description: 'Show/hide page navigation controls in multipage mode',
    },
    pages: {
      control: false,
      description: 'Array of form pages to render',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    layoutStyles: {
      control: false,
      description: 'Custom styling for form elements',
    },
  },
  args: {
    pages: createSamplePages(),
    pageMode: 'multipage',
    showPageNavigation: true,
    className: '',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default multipage story
export const Default: Story = {
  args: {
    pageMode: 'multipage',
  },
};

// Single page mode
export const SinglePageMode: Story = {
  args: {
    pageMode: 'single_page',
  },
  parameters: {
    docs: {
      description: {
        story: 'Single page mode displays all form pages in a scrollable view, useful for shorter forms or when users prefer to see all fields at once.',
      },
    },
  },
};

// Multipage mode
export const MultipageMode: Story = {
  args: {
    pageMode: 'multipage',
  },
  parameters: {
    docs: {
      description: {
        story: 'Multipage mode shows one page at a time with navigation controls, ideal for longer forms or guided workflows.',
      },
    },
  },
};

// Builder mode - allows navigation without validation
export const BuilderMode: Story = {
  args: {
    pageMode: 'multipage',
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'Builder mode allows unrestricted navigation between pages without validation, useful for form design and editing.',
      },
    },
  },
};

// Submission mode - enforces validation
export const SubmissionMode: Story = {
  args: {
    pageMode: 'multipage',
    mode: RendererMode.SUBMISSION,
  },
  parameters: {
    docs: {
      description: {
        story: 'Submission mode enforces field validation before allowing page navigation, ensuring data completeness.',
      },
    },
  },
};

// Preview mode
export const PreviewMode: Story = {
  args: {
    pageMode: 'multipage',
    mode: RendererMode.PREVIEW,
  },
  parameters: {
    docs: {
      description: {
        story: 'Preview mode allows users to interact with the form while maintaining validation constraints.',
      },
    },
  },
};

// Hidden navigation
export const HiddenNavigation: Story = {
  args: {
    pageMode: 'multipage',
    showPageNavigation: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Multipage mode with hidden navigation controls, useful for programmatically controlled page transitions.',
      },
    },
  },
};

// Single page form
export const SinglePageForm: Story = {
  args: {
    pages: createSinglePage(),
    pageMode: 'single_page',
  },
  parameters: {
    docs: {
      description: {
        story: 'A form with only one page containing all fields, displayed in single page mode.',
      },
    },
  },
};

// Empty form
export const EmptyForm: Story = {
  args: {
    pages: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty form state when no pages are provided, showing appropriate placeholder message.',
      },
    },
  },
};

// Pages with no fields
export const PagesWithNoFields: Story = {
  args: {
    pages: [
      {
        id: '1',
        title: 'Empty Page 1',
        fields: [],
        order: 0,
      },
      {
        id: '2',
        title: 'Empty Page 2',
        fields: [],
        order: 1,
      },
    ],
    pageMode: 'multipage',
  },
  parameters: {
    docs: {
      description: {
        story: 'Pages that exist but contain no fields, showing appropriate empty state messages.',
      },
    },
  },
};

// Custom layout styles
export const CustomLayoutStyles: Story = {
  args: {
    pageMode: 'single_page',
    layoutStyles: {
      field: {
        container: 'mb-6 p-4 border-2 border-blue-200 rounded-lg',
        label: 'block text-lg font-bold text-blue-800 mb-3',
        input: 'w-full h-12 bg-blue-50 border-2 border-blue-300 rounded-lg px-4 text-blue-900 focus:border-blue-500',
        textarea: 'w-full h-32 bg-blue-50 border-2 border-blue-300 rounded-lg px-4 py-3 text-blue-900 focus:border-blue-500',
        select: 'w-full h-12 bg-blue-50 border-2 border-blue-300 rounded-lg px-4 text-blue-900 focus:border-blue-500',
      },
      submitButton: 'w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-lg transition-colors',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'PageRenderer with custom layout styles applied to form fields and submit button.',
      },
    },
  },
};

// Form with controlled values
export const ControlledForm: Story = {
  args: {
    pageMode: 'single_page',
    formValues: {
      'field-1': 'John Doe',
      'field-2': 'john.doe@example.com',
      'field-3': 30,
      'field-4': 'This is a sample comment',
    },
    onFieldChange: (fieldId: string, value: any) => {
      console.log('Field changed:', fieldId, value);
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'PageRenderer with externally controlled form values and change handler.',
      },
    },
  },
};

// Dark theme styling
export const DarkTheme: Story = {
  args: {
    pageMode: 'multipage',
    className: 'dark',
    layoutStyles: {
      field: {
        container: 'mb-4',
        label: 'block text-sm font-medium text-gray-200 mb-2',
        input: 'w-full h-10 bg-gray-800 border border-gray-600 rounded-md px-3 text-gray-200 focus:border-gray-400',
        textarea: 'w-full h-24 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:border-gray-400',
        select: 'w-full h-10 bg-gray-800 border border-gray-600 rounded-md px-3 text-gray-200 focus:border-gray-400',
      },
      submitButton: 'w-full h-10 bg-gray-700 hover:bg-gray-600 rounded-md flex items-center justify-center text-white transition-colors',
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'PageRenderer styled for dark theme with appropriate colors and contrast.',
      },
    },
  },
};

// Comprehensive validation testing story
export const ValidationTestForm: Story = {
  args: {
    pages: createValidationTestPages(),
    pageMode: 'multipage',
    mode: RendererMode.SUBMISSION,
    showPageNavigation: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive validation test form with all supported field types across 4 pages. Includes required/optional fields, min/max constraints, email validation, date ranges, and selection fields. Perfect for testing React Hook Form + Zod validation behavior.',
      },
    },
  },
};