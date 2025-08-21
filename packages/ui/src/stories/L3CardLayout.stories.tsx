import type { Meta, StoryObj } from '@storybook/react';
import { L3CardLayout } from '../layouts/L3CardLayout';
import { createSamplePages, createSinglePage, sampleLayouts, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';

const meta: Meta<typeof L3CardLayout> = {
  title: 'Layouts/L3CardLayout',
  component: L3CardLayout,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'L3 Card Layout organizes form content into distinct card sections, providing visual separation and improved content organization. Ideal for complex forms with multiple sections.',
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
    layout: sampleLayouts.card,
    className: '',
    cdnEndpoint: 'https://cdn-handler-dev.natheeshece.workers.dev',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default card layout
export const Default: Story = {};

// Builder mode
export const BuilderMode: Story = {
  args: {
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout in builder mode, showing sectioned form editing with card-based organization.',
      },
    },
  },
};

// Submission mode
export const SubmissionMode: Story = {
  args: {
    mode: RendererMode.SUBMISSION,
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout optimized for form submission with clear section separation.',
      },
    },
  },
};

// Single page form
export const SinglePageForm: Story = {
  args: {
    pages: createSinglePage(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout displaying a single page with card-based field organization.',
      },
    },
  },
};

// Custom card content
export const CustomContent: Story = {
  args: {
    layout: {
      ...sampleLayouts.card,
      content: '<h1>Registration Form</h1><p>Please complete all sections below. Each card represents a different category of information.</p>',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout with custom content explaining the sectioned approach.',
      },
    },
  },
};

// Card layout with shadows
export const WithShadows: Story = {
  args: {
    layout: {
      ...sampleLayouts.card,
      customBackGroundColor: '#f8fafc',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout with enhanced visual depth through background color contrast.',
      },
    },
  },
};

// Compact card spacing
export const CompactSpacing: Story = {
  args: {
    layout: {
      ...sampleLayouts.card,
      spacing: 'compact',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout with compact spacing for dense information presentation.',
      },
    },
  },
};