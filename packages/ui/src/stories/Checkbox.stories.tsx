import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Checkbox } from '../checkbox';
import { Label } from '../label';

const meta: Meta = {
  title: 'Atoms/Checkbox',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div className="flex items-center gap-2.5">
        <Checkbox id="cb1" />
        <Label htmlFor="cb1">Unchecked</Label>
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="cb2" defaultChecked />
        <Label htmlFor="cb2">Checked</Label>
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="cb3" disabled />
        <Label htmlFor="cb3" className="opacity-50">Disabled unchecked</Label>
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="cb4" defaultChecked disabled />
        <Label htmlFor="cb4" className="opacity-50">Disabled checked</Label>
      </div>
    </div>
  ),
};

export const CheckboxGroup: Story = {
  render: () => {
    const OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D'];
    const [selected, setSelected] = useState<string[]>(['Option B']);
    const toggle = (o: string) =>
      setSelected((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]);

    return (
      <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
        <p className="text-sm font-medium text-gray-900 mb-3">Select your interests</p>
        <div className="space-y-2.5">
          {OPTIONS.map((o) => (
            <div key={o} className="flex items-center gap-2.5">
              <Checkbox
                id={`opt-${o}`}
                checked={selected.includes(o)}
                onCheckedChange={() => toggle(o)}
              />
              <Label htmlFor={`opt-${o}`} className="cursor-pointer">{o}</Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#655d67] mt-3">{selected.length} selected: {selected.join(', ') || 'none'}</p>
      </div>
    );
  },
};
