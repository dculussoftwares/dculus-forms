import React from 'react';
import { Button, Input, Label, Textarea, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TypographyH2, TypographyP } from '@dculus/ui';

const DemoPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <TypographyH2 className="mb-4">Form Viewer Demo Page</TypographyH2>
        <TypographyP className="text-muted-foreground mb-6">
          This page showcases the shared UI components available in the form-viewer app.
        </TypographyP>
      </div>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Different button variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">🔍</Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
          <CardDescription>Input, Label, Textarea, and Select components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" placeholder="Enter your message" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
                <SelectItem value="ca">Canada</SelectItem>
                <SelectItem value="au">Australia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>Card component with header, content, and footer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card 1</CardTitle>
                <CardDescription>This is a description for card 1</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the content of card 1.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Card 2</CardTitle>
                <CardDescription>This is a description for card 2</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the content of card 2.</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card>
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
          <CardDescription>shadcn/ui color system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-12 bg-primary rounded-md"></div>
              <p className="text-sm font-medium">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 bg-secondary rounded-md"></div>
              <p className="text-sm font-medium">Secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 bg-muted rounded-md"></div>
              <p className="text-sm font-medium">Muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 bg-accent rounded-md"></div>
              <p className="text-sm font-medium">Accent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo</CardTitle>
          <CardDescription>Try out the form components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-name">Name</Label>
            <Input id="demo-name" placeholder="Enter your name" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="demo-feedback">Feedback</Label>
            <Textarea id="demo-feedback" placeholder="Share your feedback..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-category">Category</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button>Submit</Button>
            <Button variant="outline">Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoPage; 