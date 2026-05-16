import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';
import { BarChart3, FileText, Settings, TrendingUp } from 'lucide-react';

const meta: Meta = {
  title: 'Composed/Tabs',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="max-w-lg bg-white p-6 rounded-xl border border-[rgba(81,76,84,0.10)]">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <p className="text-sm text-[#655d67]">Overview tab content. Shows summary stats and charts.</p>
        </TabsContent>
        <TabsContent value="responses" className="mt-5">
          <p className="text-sm text-[#655d67]">Responses tab content. Shows the response table.</p>
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <p className="text-sm text-[#655d67]">Settings tab content. Form configuration options.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="max-w-lg bg-white p-6 rounded-xl border border-[rgba(81,76,84,0.10)]">
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="layout"><FileText className="h-3.5 w-3.5" />Layout</TabsTrigger>
          <TabsTrigger value="builder"><BarChart3 className="h-3.5 w-3.5" />Builder</TabsTrigger>
          <TabsTrigger value="preview"><TrendingUp className="h-3.5 w-3.5" />Preview</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="layout" className="mt-5">
          <p className="text-sm text-[#655d67]">Layout configuration</p>
        </TabsContent>
        <TabsContent value="builder" className="mt-5">
          <p className="text-sm text-[#655d67]">Form builder — drag and drop fields</p>
        </TabsContent>
        <TabsContent value="preview" className="mt-5">
          <p className="text-sm text-[#655d67]">Live preview of the form</p>
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <p className="text-sm text-[#655d67]">Form settings and configuration</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

export const DashboardTabs: Story = {
  render: () => (
    <div className="max-w-xl bg-[#f7f7f8] p-4 rounded-xl">
      <Tabs defaultValue="forms">
        <TabsList>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="forms" className="mt-4">
          <div className="p-4 bg-white rounded-lg border border-[rgba(81,76,84,0.10)] text-sm text-[#655d67]">
            Your forms list
          </div>
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <div className="p-4 bg-white rounded-lg border border-[rgba(81,76,84,0.10)] text-sm text-[#655d67]">
            Browse templates
          </div>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
