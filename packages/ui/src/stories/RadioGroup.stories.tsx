import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '../radio-group';
import { Label } from '../label';

const meta: Meta = {
  title: 'Atoms/RadioGroup',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

const OPTIONS = ['Yes, definitely', 'Maybe', 'No, not really'];

export const Default: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <p className="text-sm font-medium text-gray-900 mb-3">Would you recommend us?</p>
      <RadioGroup defaultValue="Yes, definitely" className="space-y-2">
        {OPTIONS.map((o, i) => (
          <div key={o} className="flex items-center gap-2.5">
            <RadioGroupItem value={o} id={`r-${i}`} />
            <Label htmlFor={`r-${i}`} className="cursor-pointer">{o}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  ),
};

export const NoSelection: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <p className="text-sm font-medium text-gray-900 mb-3">Pick an option</p>
      <RadioGroup className="space-y-2">
        {OPTIONS.map((o, i) => (
          <div key={o} className="flex items-center gap-2.5">
            <RadioGroupItem value={o} id={`rn-${i}`} />
            <Label htmlFor={`rn-${i}`} className="cursor-pointer">{o}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <p className="text-sm font-medium text-gray-900 mb-3">Disabled group</p>
      <RadioGroup defaultValue="Maybe" disabled className="space-y-2">
        {OPTIONS.map((o, i) => (
          <div key={o} className="flex items-center gap-2.5">
            <RadioGroupItem value={o} id={`rd-${i}`} />
            <Label htmlFor={`rd-${i}`}>{o}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
        <p className="text-sm font-medium text-gray-900 mb-3">How satisfied are you?</p>
        <RadioGroup value={value} onValueChange={setValue} className="space-y-2">
          {OPTIONS.map((o, i) => (
            <div key={o} className="flex items-center gap-2.5">
              <RadioGroupItem value={o} id={`ri-${i}`} />
              <Label htmlFor={`ri-${i}`} className="cursor-pointer">{o}</Label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-[#655d67] mt-3">Selected: {value || 'none'}</p>
      </div>
    );
  },
};
