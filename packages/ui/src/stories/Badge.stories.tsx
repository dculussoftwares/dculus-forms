import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Badge } from '../badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
  argTypes: {
    variant: { control: 'select', options: ['default', 'primary', 'secondary', 'destructive', 'outline', 'accent', 'salmon'] },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="accent">NEW</Badge>
      <Badge variant="salmon">File Upload</Badge>
    </div>
  ),
};

export const UseCases: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#3c323e]">Form status:</span>
        <Badge variant="accent" style={{ backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }}>● Published</Badge>
        <Badge variant="secondary" style={{ backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' }}>Draft</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#3c323e]">Responses:</span>
        <Badge style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}>+1</Badge>
        <Badge style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}>42</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#3c323e]">Permission:</span>
        <Badge variant="default">Owner</Badge>
        <Badge variant="secondary">Editor</Badge>
        <Badge variant="outline">Viewer</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#3c323e]">Plan features:</span>
        <Badge variant="accent">Demo</Badge>
        <Badge variant="accent">NEW</Badge>
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { variant: 'default', children: 'Badge text' },
};
