import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Textarea } from '../textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Atoms/Textarea',
  component: Textarea,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
  args: { placeholder: 'Type your answer here…' },
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Default</p>
        <Textarea placeholder="Type your message…" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">With value</p>
        <Textarea defaultValue="This is some existing content that the user has already typed in the textarea field." />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Error state</p>
        <Textarea placeholder="Required field" className="border-[#ce5d55] focus-visible:border-[#ce5d55]" />
        <p className="text-xs mt-1 text-[#ce5d55]">This field is required</p>
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Disabled</p>
        <Textarea placeholder="Cannot edit" disabled />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { placeholder: 'Type something…', disabled: false },
};
