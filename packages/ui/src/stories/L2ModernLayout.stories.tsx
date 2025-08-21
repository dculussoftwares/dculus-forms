import type { Meta, StoryObj } from '@storybook/react';
import { L2ModernLayout } from '../layouts/L2ModernLayout';
import { createSamplePages, createSinglePage, sampleLayouts, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';

const meta: Meta<typeof L2ModernLayout> = {
  title: 'Layouts/L2ModernLayout',
  component: L2ModernLayout,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'L2 Modern Layout offers a contemporary form design with clean lines, modern typography, and optimized spacing. Perfect for modern applications and user interfaces.',
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
    layout: sampleLayouts.modern,
    className: '',
    cdnEndpoint: 'https://cdn-handler-dev.natheeshece.workers.dev',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default modern layout
export const Default: Story = {};

// Builder mode
export const BuilderMode: Story = {
  args: {
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern layout in builder mode, showcasing editing capabilities with contemporary design.',
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
        story: 'Modern layout optimized for form submission with enhanced user experience.',
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
        story: 'Modern layout displaying a single page with contemporary styling.',
      },
    },
  },
};

// Custom modern content
export const CustomContent: Story = {
  args: {
    layout: {
      ...sampleLayouts.modern,
      content: '<h1>Modern Application Form</h1><p>Experience our streamlined, modern form design. Built for efficiency and user satisfaction.</p>',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern layout with custom content emphasizing contemporary design principles.',
      },
    },
  },
};

// Modern color scheme
export const ModernColorScheme: Story = {
  args: {
    layout: {
      ...sampleLayouts.modern,
      customBackGroundColor: '#fafafa',
      textColor: '#2d3748',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern layout with a refined color scheme for professional applications.',
      },
    },
  },
};

// Spacious modern layout
export const SpaciousLayout: Story = {
  args: {
    layout: {
      ...sampleLayouts.modern,
      spacing: 'spacious',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern layout with spacious spacing for premium user experience.',
      },
    },
  },
};

// Compact modern layout
export const CompactLayout: Story = {
  args: {
    layout: {
      ...sampleLayouts.modern,
      spacing: 'compact',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Modern layout with compact spacing for efficient space utilization.',
      },
    },
  },
};