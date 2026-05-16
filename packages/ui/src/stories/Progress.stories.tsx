import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { Progress } from '../progress';

const meta: Meta<typeof Progress> = {
  title: 'Atoms/Progress',
  component: Progress,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100, step: 1 } } },
};
export default meta;
type Story = StoryObj<typeof Progress>;

export const AllValues: Story = {
  render: () => (
    <div className="flex flex-col gap-5 max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      {[0, 25, 50, 75, 100].map((v) => (
        <div key={v}>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-[#655d67]">Progress</span>
            <span className="text-xs font-medium text-[#3c323e]">{v}%</span>
          </div>
          <Progress value={v} />
        </div>
      ))}
    </div>
  ),
};

export const UsageMeter: Story = {
  render: () => (
    <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-medium text-[#3c323e]">Responses collected</span>
        <span className="text-xs text-[#655d67]">7 / 10</span>
      </div>
      <Progress value={70} />
      <p className="text-xs text-[#655d67] mt-1.5">70% of your free plan used this month</p>
    </div>
  ),
};

export const AnimatedProgress: Story = {
  render: () => {
    const [value, setValue] = useState(10);
    useEffect(() => {
      const t = setInterval(() => setValue((v) => v >= 100 ? 10 : v + 5), 200);
      return () => clearInterval(t);
    }, []);
    return (
      <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-[#655d67]">Duplicating form…</span>
          <span className="text-xs font-medium text-[#3c323e]">{value}%</span>
        </div>
        <Progress value={value} className="transition-all duration-200" />
      </div>
    );
  },
};

export const Playground: Story = {
  args: { value: 60 },
};
