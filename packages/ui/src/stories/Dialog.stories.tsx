import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../dialog';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { AlertTriangle, Trash2 } from 'lucide-react';

const meta: Meta = {
  title: 'Composed/Dialog',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit form title</DialogTitle>
          <DialogDescription>Make changes to your form. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="title" className="text-sm font-medium text-gray-900 mb-1.5 block">Form title</Label>
            <Input id="title" defaultValue="Customer Feedback" />
          </div>
          <div>
            <Label htmlFor="desc" className="text-sm font-medium text-gray-900 mb-1.5 block">Description</Label>
            <Input id="desc" placeholder="Optional description…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const DestructiveConfirm: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete form
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(206,93,85,0.08)' }}>
                  <AlertTriangle className="h-5 w-5" style={{ color: '#ce5d55' }} />
                </div>
                <DialogTitle>Delete "Customer Feedback"?</DialogTitle>
              </div>
              <DialogDescription>
                This action cannot be undone. All responses will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-[#ce5d55] hover:bg-[#b84e47] text-white" onClick={() => setOpen(false)}>
                Delete form
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

export const InfoDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View details</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscription details</DialogTitle>
          <DialogDescription>Your current plan and usage information.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {[
            ['Plan', 'Free'],
            ['Responses used', '7 / 10'],
            ['Next reset', 'June 1, 2026'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm py-2 border-b border-[rgba(81,76,84,0.08)]">
              <span style={{ color: '#655d67' }}>{label}</span>
              <span style={{ color: '#3c323e' }} className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button>Upgrade plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
