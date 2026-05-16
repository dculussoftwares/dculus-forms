import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

const OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D'];

const DemoSelect: React.FC<{ placeholder?: string; disabled?: boolean; value?: string; error?: boolean }> = ({
  placeholder = 'Select an option…',
  disabled = false,
  value,
  error = false,
}) => (
  <Select defaultValue={value} disabled={disabled}>
    <SelectTrigger className={error ? 'border-[#ce5d55]' : ''}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);

const meta: Meta = {
  title: 'Atoms/Select',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Default (empty)</p>
        <DemoSelect />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">With pre-selected value</p>
        <DemoSelect value="Option B" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Error state</p>
        <DemoSelect error />
        <p className="text-xs mt-1 text-[#ce5d55]">Please select an option</p>
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Disabled</p>
        <DemoSelect disabled value="Option A" />
      </div>
    </div>
  ),
};

export const InFormContext: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)] space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1.5">Country</label>
        <DemoSelect placeholder="Select country…" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1.5">Language <span className="text-red-500 ml-1">*</span></label>
        <DemoSelect placeholder="Select language…" />
        <p className="text-xs mt-1.5 text-[#655d67]">This affects form display language</p>
      </div>
    </div>
  ),
};
