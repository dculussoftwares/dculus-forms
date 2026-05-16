import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Switch } from '../switch';
import { Label } from '../label';

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <div className="flex items-center gap-3">
        <Switch id="s1" />
        <Label htmlFor="s1">Off (default)</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s2" defaultChecked />
        <Label htmlFor="s2">On</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s3" disabled />
        <Label htmlFor="s3" className="opacity-50">Disabled off</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s4" defaultChecked disabled />
        <Label htmlFor="s4" className="opacity-50">Disabled on</Label>
      </div>
    </div>
  ),
};

export const SettingsPanel: Story = {
  render: () => {
    const [states, setStates] = useState({ emails: true, analytics: false, notifications: true });
    return (
      <div className="max-w-xs p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
        <p className="text-sm font-semibold text-[#3c323e] mb-4">Preferences</p>
        <div className="space-y-4">
          {[
            { key: 'emails', label: 'Email notifications', hint: 'Get notified when a response is submitted' },
            { key: 'analytics', label: 'Analytics tracking', hint: 'Collect view and submission data' },
            { key: 'notifications', label: 'Push notifications', hint: 'Browser push alerts' },
          ].map(({ key, label, hint }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#3c323e]">{label}</p>
                <p className="text-xs text-[#655d67] mt-0.5">{hint}</p>
              </div>
              <Switch
                checked={states[key as keyof typeof states]}
                onCheckedChange={(v) => setStates((s) => ({ ...s, [key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
};
