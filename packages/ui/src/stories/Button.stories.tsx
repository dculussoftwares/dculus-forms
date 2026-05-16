import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from '../button';
import { ArrowRight, Download, Plus, Trash2, Loader2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline', 'ghost', 'secondary', 'destructive', 'link'] },
    size:    { control: 'select', options: ['default', 'sm', 'lg', 'icon', 'pill'] },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Button', variant: 'default', size: 'default' },
};
export default meta;
type Story = StoryObj<typeof Button>;

/* ── All variants ── */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6 bg-[#f7f7f8] rounded-xl">
      <Button variant="default">Primary</Button>
      <Button variant="outline">Outline / Ghost</Button>
      <Button variant="ghost">Text Ghost</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/* ── All sizes ── */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6 bg-[#f7f7f8] rounded-xl">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="pill">Pill</Button>
      <Button size="icon"><Plus className="h-4 w-4" /></Button>
    </div>
  ),
};

/* ── With icons ── */
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6 bg-[#f7f7f8] rounded-xl">
      <Button><Plus className="h-3.5 w-3.5" /> New form</Button>
      <Button variant="outline"><Download className="h-3.5 w-3.5" /> Export</Button>
      <Button variant="ghost"><ArrowRight className="h-3.5 w-3.5" /> View all</Button>
      <Button variant="destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
    </div>
  ),
};

/* ── States ── */
export const States: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6 bg-[#f7f7f8] rounded-xl">
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button disabled>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </Button>
    </div>
  ),
};

/* ── Full width ── */
export const FullWidth: Story = {
  render: () => (
    <div className="p-6 max-w-sm bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <Button className="w-full mb-2">Create form</Button>
      <Button variant="outline" className="w-full">Browse templates</Button>
    </div>
  ),
};

/* ── Green CTA (Typeform "View plans" style) ── */
export const GreenCTA: Story = {
  render: () => (
    <Button className="bg-[#177767] hover:bg-[#136b5c] text-white">
      View plans
    </Button>
  ),
};

/* ── Playground ── */
export const Playground: Story = {
  args: { children: 'Click me', variant: 'default', size: 'default' },
};
