import type { Meta, StoryObj } from '@storybook/react';
import { LayoutRenderer } from '../renderers/LayoutRenderer';
import { createSamplePages, createSinglePage, sampleLayouts, layoutCodes, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';
import { LayoutCode } from '@dculus/types';

const meta: Meta<typeof LayoutRenderer> = {
  title: 'Renderers/LayoutRenderer',
  component: LayoutRenderer,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'The LayoutRenderer component renders different form layouts (L1-L9) with various themes and configurations. It supports multiple rendering modes and customizable styling options.',
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
    layoutCode: {
      control: { type: 'select' },
      options: layoutCodes,
      description: 'Layout code determining which layout component to render',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(formModes),
      description: 'Rendering mode affecting behavior and interactivity',
    },
    pages: {
      control: false,
      description: 'Array of form pages to render',
    },
    layout: {
      control: false,
      description: 'Layout configuration object',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    cdnEndpoint: {
      control: 'text',
      description: 'CDN endpoint for assets',
    },
  },
  args: {
    pages: createSamplePages(),
    className: '',
    cdnEndpoint: 'https://cdn-handler-dev.natheeshece.workers.dev',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with L1 Classic Layout
export const Default: Story = {
  args: {
    layoutCode: 'L1' as LayoutCode,
    layout: sampleLayouts.classic,
  },
};

// L1 Classic Layout
export const L1Classic: Story = {
  args: {
    layoutCode: 'L1' as LayoutCode,
    layout: sampleLayouts.classic,
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional classic form layout with clean typography and standard spacing.',
      },
    },
  },
};

// L2 Modern Layout
export const L2Modern: Story = {
  args: {
    layoutCode: 'L2' as LayoutCode,
    layout: sampleLayouts.modern,
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern form layout with contemporary design elements and spacious layout.',
      },
    },
  },
};

// L3 Card Layout
export const L3Card: Story = {
  args: {
    layoutCode: 'L3' as LayoutCode,
    layout: sampleLayouts.card,
  },
  parameters: {
    docs: {
      description: {
        story: 'Card-based layout organizing form sections into distinct cards.',
      },
    },
  },
};

// L4 Minimal Layout
export const L4Minimal: Story = {
  args: {
    layoutCode: 'L4' as LayoutCode,
    layout: sampleLayouts.minimal,
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal design focusing on simplicity and reduced visual clutter.',
      },
    },
  },
};

// L5 Split Layout
export const L5Split: Story = {
  args: {
    layoutCode: 'L5' as LayoutCode,
    layout: sampleLayouts.split,
  },
  parameters: {
    docs: {
      description: {
        story: 'Two-column split layout for optimal space utilization.',
      },
    },
  },
};

// L6 Wizard Layout
export const L6Wizard: Story = {
  args: {
    layoutCode: 'L6' as LayoutCode,
    layout: sampleLayouts.wizard,
  },
  parameters: {
    docs: {
      description: {
        story: 'Step-by-step wizard layout with progress tracking and navigation.',
      },
    },
  },
};

// L7 Single Layout
export const L7Single: Story = {
  args: {
    layoutCode: 'L7' as LayoutCode,
    layout: sampleLayouts.single,
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional single-column layout for straightforward forms.',
      },
    },
  },
};

// L8 Image Layout
export const L8Image: Story = {
  args: {
    layoutCode: 'L8' as LayoutCode,
    layout: sampleLayouts.image,
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout with background image support and overlay text.',
      },
    },
  },
};

// L9 Pages Layout
export const L9Pages: Story = {
  args: {
    layoutCode: 'L9' as LayoutCode,
    layout: sampleLayouts.pages,
  },
  parameters: {
    docs: {
      description: {
        story: 'Advanced multi-page layout with page navigation and progress indicators.',
      },
    },
  },
};

// Builder Mode Example
export const BuilderMode: Story = {
  args: {
    layoutCode: 'L2' as LayoutCode,
    layout: sampleLayouts.modern,
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer in builder mode, showing editable state with form building capabilities.',
      },
    },
  },
};

// Submission Mode Example
export const SubmissionMode: Story = {
  args: {
    layoutCode: 'L1' as LayoutCode,
    layout: sampleLayouts.classic,
    mode: RendererMode.SUBMISSION,
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer in submission mode, optimized for form completion and validation.',
      },
    },
  },
};

// Single Page Form
export const SinglePageForm: Story = {
  args: {
    layoutCode: 'L3' as LayoutCode,
    layout: sampleLayouts.card,
    pages: createSinglePage(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer with a single page containing all form fields.',
      },
    },
  },
};

// Custom Styling Example
export const CustomStyling: Story = {
  args: {
    layoutCode: 'L4' as LayoutCode,
    layout: {
      ...sampleLayouts.minimal,
      customBackGroundColor: '#f0f9ff',
      textColor: '#0369a1',
      customCTAButtonName: 'Custom Submit',
    },
    className: 'custom-form-styling',
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer with custom background color, text color, and CTA button text.',
      },
    },
  },
};

// Dark Theme Example
export const DarkTheme: Story = {
  args: {
    layoutCode: 'L2' as LayoutCode,
    layout: {
      ...sampleLayouts.modern,
      theme: 'dark',
      customBackGroundColor: '#1f2937',
      textColor: '#f9fafb',
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Layout renderer with dark theme configuration.',
      },
    },
  },
};

// Compact Spacing
export const CompactSpacing: Story = {
  args: {
    layoutCode: 'L1' as LayoutCode,
    layout: {
      ...sampleLayouts.classic,
      spacing: 'compact',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer with compact spacing for dense form layouts.',
      },
    },
  },
};

// Spacious Layout
export const SpaciousLayout: Story = {
  args: {
    layoutCode: 'L5' as LayoutCode,
    layout: {
      ...sampleLayouts.split,
      spacing: 'spacious',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Layout renderer with spacious layout for better readability.',
      },
    },
  },
};