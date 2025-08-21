import type { Meta, StoryObj } from '@storybook/react';
import { FormRenderer } from '../renderers/FormRenderer';
import { createSamplePages, createSinglePage, createValidationTestPages, sampleLayouts, layoutCodes, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';
import { FormSchema, LayoutCode, PageModeType } from '@dculus/types';

const meta: Meta<typeof FormRenderer> = {
  title: 'Renderers/FormRenderer',
  component: FormRenderer,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'The FormRenderer component is a high-level wrapper that renders complete forms with layouts, pages, and fields. It combines FormSchema data with layout configurations to display interactive forms across different modes (preview, builder, submission).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', width: '100%', padding: '0', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    formSchema: {
      control: false,
      description: 'Complete form schema containing pages, layout, and configuration',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(formModes),
      description: 'Rendering mode affecting behavior and interactivity',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    cdnEndpoint: {
      control: 'text',
      description: 'CDN endpoint for assets like images',
    },
  },
  args: {
    className: '',
    cdnEndpoint: 'https://cdn-handler-dev.natheeshece.workers.dev',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper function to create form schema
const createFormSchema = (layoutCode: LayoutCode, layoutName: keyof typeof sampleLayouts, pages = createSamplePages()): FormSchema => ({
  pages,
  layout: {
    ...sampleLayouts[layoutName],
    code: layoutCode,
    pageMode: PageModeType.MULTIPAGE
  },
  isShuffleEnabled: false,
});

// Default story - Newsletter Form with L1 Classic Layout
export const Default: Story = {
  args: {
    formSchema: createFormSchema('L1', 'classic'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Default FormRenderer with a newsletter subscription form using L1 Classic layout.',
      },
    },
  },
};

// Classic Layout (L1)
export const L1Classic: Story = {
  args: {
    formSchema: createFormSchema('L1', 'classic'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L1 Classic layout - traditional design with clean typography.',
      },
    },
  },
};

// Modern Layout (L2) 
export const L2Modern: Story = {
  args: {
    formSchema: createFormSchema('L2', 'modern'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L2 Modern layout - contemporary design with spacious elements.',
      },
    },
  },
};

// Card Layout (L3)
export const L3Card: Story = {
  args: {
    formSchema: createFormSchema('L3', 'card'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L3 Card layout - organized into distinct card sections.',
      },
    },
  },
};

// Minimal Layout (L4)
export const L4Minimal: Story = {
  args: {
    formSchema: createFormSchema('L4', 'minimal'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L4 Minimal layout - simplified design focusing on content.',
      },
    },
  },
};

// Split Layout (L5)
export const L5Split: Story = {
  args: {
    formSchema: createFormSchema('L5', 'split'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L5 Split layout - two-column design for optimal space usage.',
      },
    },
  },
};

// Wizard Layout (L6)
export const L6Wizard: Story = {
  args: {
    formSchema: createFormSchema('L6', 'wizard'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L6 Wizard layout - step-by-step progression with navigation.',
      },
    },
  },
};

// Single Layout (L7)
export const L7Single: Story = {
  args: {
    formSchema: createFormSchema('L7', 'single'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L7 Single layout - straightforward single-column design.',
      },
    },
  },
};

// Image Layout (L8)
export const L8Image: Story = {
  args: {
    formSchema: createFormSchema('L8', 'image'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L8 Image layout - background image with overlay text.',
      },
    },
  },
};

// Pages Layout (L9)
export const L9Pages: Story = {
  args: {
    formSchema: createFormSchema('L9', 'pages'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form with L9 Pages layout - multi-page with navigation and progress.',
      },
    },
  },
};

// Different Modes
export const PreviewMode: Story = {
  args: {
    formSchema: createFormSchema('L2', 'modern'),
    mode: RendererMode.PREVIEW,
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer in preview mode - read-only view for form preview.',
      },
    },
  },
};

export const BuilderMode: Story = {
  args: {
    formSchema: createFormSchema('L2', 'modern'),
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer in builder mode - editable state for form construction.',
      },
    },
  },
};

export const SubmissionMode: Story = {
  args: {
    formSchema: createFormSchema('L1', 'classic'),
    mode: RendererMode.SUBMISSION,
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer in submission mode - interactive form for user input.',
      },
    },
  },
};

// Single Page Form
export const SinglePage: Story = {
  args: {
    formSchema: createFormSchema('L3', 'card', createSinglePage()),
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with all fields on a single page for simple forms.',
      },
    },
  },
};

// Comprehensive Validation Test Form
export const ValidationTestForm: Story = {
  args: {
    formSchema: createFormSchema('L6', 'wizard', createValidationTestPages()),
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with comprehensive validation test form showcasing all field types and validation rules.',
      },
    },
  },
};

// Custom Styling
export const CustomStyling: Story = {
  args: {
    formSchema: {
      pages: createSamplePages(),
      layout: {
        ...sampleLayouts.minimal,
        code: 'L4',
        customBackGroundColor: '#f0f9ff',
        textColor: '#0369a1',
        customCTAButtonName: 'Subscribe Now',
      },
      isShuffleEnabled: false,
    },
    className: 'custom-form-styling',
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with custom background color, text color, and CTA button text.',
      },
    },
  },
};

// Dark Theme
export const DarkTheme: Story = {
  args: {
    formSchema: {
      pages: createSamplePages(),
      layout: {
        ...sampleLayouts.modern,
        code: 'L2',
        theme: 'dark',
        customBackGroundColor: '#1f2937',
        textColor: '#f9fafb',
      },
      isShuffleEnabled: false,
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'FormRenderer with dark theme configuration for improved accessibility.',
      },
    },
  },
};

// Compact Spacing
export const CompactSpacing: Story = {
  args: {
    formSchema: {
      pages: createSamplePages(),
      layout: {
        ...sampleLayouts.classic,
        spacing: 'compact',
      },
      isShuffleEnabled: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with compact spacing for dense layouts.',
      },
    },
  },
};

// Spacious Layout
export const SpaciousLayout: Story = {
  args: {
    formSchema: {
      pages: createSamplePages(),
      layout: {
        ...sampleLayouts.split,
        spacing: 'spacious',
      },
      isShuffleEnabled: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with spacious layout for better readability and user experience.',
      },
    },
  },
};

// Multipage Form
export const MultipageForm: Story = {
  args: {
    formSchema: createFormSchema('L9', 'pages', createValidationTestPages()),
    mode: RendererMode.SUBMISSION,
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with multiple pages showcasing step-by-step form completion with navigation and progress tracking.',
      },
    },
  },
};

// Shuffled Form
export const ShuffledForm: Story = {
  args: {
    formSchema: {
      pages: createValidationTestPages(),
      layout: sampleLayouts.modern,
      isShuffleEnabled: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with shuffled pages and fields for randomized form presentation.',
      },
    },
  },
};

// Empty Form Schema
export const EmptyForm: Story = {
  args: {
    formSchema: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with no form schema provided - shows fallback behavior.',
      },
    },
  },
};

// Minimal Form Schema
export const MinimalForm: Story = {
  args: {
    formSchema: {
      pages: [],
      layout: {
        theme: 'light',
        textColor: '#333333',
        spacing: 'normal',
        code: 'L1',
        content: '<h1>No Fields</h1><p>This form has no fields configured yet.</p>',
        customBackGroundColor: '',
        customCTAButtonName: 'Submit',
        backgroundImageKey: ''
      },
      isShuffleEnabled: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'FormRenderer with minimal form schema containing no fields.',
      },
    },
  },
};