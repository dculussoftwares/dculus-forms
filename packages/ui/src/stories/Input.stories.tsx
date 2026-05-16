import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Input } from '../input';
import { Search, Mail } from 'lucide-react';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
  argTypes: {
    type:        { control: 'select', options: ['text', 'email', 'password', 'number', 'search'] },
    placeholder: { control: 'text' },
    disabled:    { control: 'boolean' },
  },
  args: { placeholder: 'Type something…' },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Default</p>
        <Input placeholder="Enter your name" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">With value</p>
        <Input defaultValue="Natheesh Kumar" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Error state</p>
        <Input placeholder="Enter email" className="border-[#ce5d55] focus-visible:border-[#ce5d55]" />
        <p className="text-xs mt-1 text-[#ce5d55]">This field is required</p>
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Disabled</p>
        <Input placeholder="Cannot edit this" disabled />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Email type</p>
        <Input type="email" placeholder="name@example.com" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Password</p>
        <Input type="password" placeholder="••••••••" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Number</p>
        <Input type="number" placeholder="0" />
      </div>
    </div>
  ),
};

export const WithIconLeft: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: '#655d67' }} />
        <Input placeholder="Search responses…" className="pl-9" />
      </div>
      <div className="relative mt-3">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: '#655d67' }} />
        <Input type="email" placeholder="name@example.com" className="pl-9" />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { placeholder: 'Type here…', type: 'text', disabled: false },
};
