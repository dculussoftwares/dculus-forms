import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card';
import { Button } from '../button';
import { Badge } from '../badge';
import { FileText, TrendingUp, Users } from 'lucide-react';

const meta: Meta = {
  title: 'Composed/Card',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A short description about this card's content or purpose.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[#655d67]">Card body content goes here. It can contain any kind of content.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Primary action</Button>
        <Button size="sm" variant="outline">Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

export const StatsCard: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 max-w-2xl">
      {[
        { title: 'Total Views', value: '1,284', icon: Users, iconBg: '#f4faf8', iconColor: '#177767' },
        { title: 'Submissions', value: '342', icon: FileText, iconBg: '#f8cdd8', iconColor: '#3c323e' },
        { title: 'Completion Rate', value: '26.6%', icon: TrendingUp, iconBg: '#ddd6fa', iconColor: '#5c2e6b' },
      ].map(({ title, value, icon: Icon, iconBg, iconColor }) => (
        <div key={title} className="rounded-xl bg-white p-5 transition-shadow hover:shadow-md"
          style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: '#655d67' }}>{title}</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
              <Icon className="h-4 w-4" style={{ color: iconColor }} />
            </div>
          </div>
          <p className="text-2xl font-light" style={{ color: '#262627' }}>{value}</p>
        </div>
      ))}
    </div>
  ),
};

export const FormCard: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-lg">
      {['Customer Feedback', 'Product Survey'].map((title) => (
        <div key={title}
          className="group relative rounded-xl bg-white overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(60,50,62,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(60,50,62,0.06)'; }}
        >
          <div className="h-28 flex items-center justify-center" style={{ backgroundColor: '#f7f7f8' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(81,76,84,0.08)' }}>
              <FileText className="w-5 h-5" style={{ color: '#655d67' }} />
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium" style={{ color: '#3c323e' }}>{title}</h3>
              <Badge variant="accent" style={{ backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }}>Published</Badge>
            </div>
            <p className="text-xs" style={{ color: '#655d67' }}>3 pages · 8 fields</p>
          </div>
        </div>
      ))}
    </div>
  ),
};
