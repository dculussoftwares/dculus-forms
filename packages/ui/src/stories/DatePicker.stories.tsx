import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { DatePicker } from '../date-picker';

const meta: Meta<typeof DatePicker> = {
  title: 'Composed/DatePicker',
  component: DatePicker,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj<typeof DatePicker>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Empty (no date selected)</p>
        <DatePicker placeholder="Pick a date" />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">With date selected</p>
        <DatePicker date={new Date(2026, 5, 15)} />
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Error state</p>
        <DatePicker placeholder="Select date" error />
        <p className="text-xs mt-1 text-[#ce5d55]">Date is required</p>
      </div>
      <div>
        <p className="text-xs text-[#655d67] mb-1.5">Disabled</p>
        <DatePicker date={new Date(2026, 0, 1)} disabled />
      </div>
    </div>
  ),
};

export const WithMinMax: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <p className="text-xs text-[#655d67] mb-1.5">With min/max constraints (this month only)</p>
      <DatePicker
        minDate={new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
        maxDate={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)}
        placeholder="Pick a date this month"
      />
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(undefined);
    return (
      <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1.5">
          Default value <span className="text-red-500 ml-1">*</span>
        </label>
        <DatePicker date={date} onDateChange={setDate} placeholder="Select default date" />
        {date && (
          <p className="text-xs mt-2" style={{ color: '#177767' }}>
            Selected: {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    );
  },
};
