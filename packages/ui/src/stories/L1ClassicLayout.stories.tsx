import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { L1ClassicLayout } from '../layouts/L1ClassicLayout';
import { createSamplePages, createSinglePage, sampleLayouts, formModes } from './mocks';
import { RendererMode } from '@dculus/utils';

const meta: Meta<typeof L1ClassicLayout> = {
  title: 'Layouts/L1ClassicLayout',
  component: L1ClassicLayout,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'large',
    },
    docs: {
      description: {
        component: 'L1 Classic Layout provides a traditional, clean form design with standard typography and spacing. This layout is ideal for professional forms and surveys.',
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
    layout: sampleLayouts.classic,
    className: '',
    cdnEndpoint: 'https://cdn-handler-dev.natheeshece.workers.dev',
    mode: RendererMode.PREVIEW,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default classic layout - Intro view
export const Default: Story = {};

// Builder mode
export const BuilderMode: Story = {
  args: {
    mode: RendererMode.BUILDER,
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout in builder mode, allowing form editing and customization.',
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
        story: 'Classic layout optimized for form submission with validation enabled.',
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
        story: 'Classic layout displaying a single page with all form fields.',
      },
    },
  },
};

// Custom content
export const CustomContent: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      content: '<h1>Custom Survey Title</h1><p>This is a custom survey with personalized content and instructions. Please fill out all required fields carefully.</p>',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout with custom HTML content for the header section.',
      },
    },
  },
};

// Custom background color
export const CustomBackground: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      customBackGroundColor: '#f0f9ff',
      textColor: '#0369a1',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout with custom background and text colors.',
      },
    },
  },
};

// Custom CTA button
export const CustomCTAButton: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      customCTAButtonName: 'Complete Survey',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout with a custom call-to-action button label.',
      },
    },
  },
};

// Compact spacing
export const CompactSpacing: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      spacing: 'compact',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout with compact spacing for denser form presentation.',
      },
    },
  },
};

// Spacious layout
export const SpaciousLayout: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      spacing: 'spacious',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Classic layout with spacious spacing for improved readability.',
      },
    },
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    layout: {
      ...sampleLayouts.classic,
      theme: 'dark',
      customBackGroundColor: '#1f2937',
      textColor: '#f9fafb',
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Classic layout configured for dark theme with appropriate colors.',
      },
    },
  },
};

// Note: To see the form fields in L1 layout, click the "Submit" button in the intro view
// The L1 layout is designed as a two-step flow: intro → form