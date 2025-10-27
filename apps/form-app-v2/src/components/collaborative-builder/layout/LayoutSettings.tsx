import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Separator,
} from '@dculus/ui-v2';
import { ThemeType, SpacingType } from '@dculus/types';
import type { LayoutCode } from '@dculus/types';

/**
 * Layout Settings Panel - Configure form appearance
 * Right sidebar in Layout tab
 */
export function LayoutSettings() {
  const { layout, updateLayout } = useFormBuilderStore();

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select
          value={layout.theme || ThemeType.LIGHT}
          onValueChange={(value) => updateLayout({ theme: value as ThemeType })}
        >
          <SelectTrigger id="theme">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ThemeType.LIGHT}>Light</SelectItem>
            <SelectItem value={ThemeType.DARK}>Dark</SelectItem>
            <SelectItem value={ThemeType.AUTO}>Auto</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose the color scheme for your form
        </p>
      </div>

      <Separator />

      {/* Spacing */}
      <div className="space-y-2">
        <Label htmlFor="spacing">Spacing</Label>
        <Select
          value={layout.spacing || SpacingType.NORMAL}
          onValueChange={(value) => updateLayout({ spacing: value as SpacingType })}
        >
          <SelectTrigger id="spacing">
            <SelectValue placeholder="Select spacing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SpacingType.COMPACT}>Compact</SelectItem>
            <SelectItem value={SpacingType.NORMAL}>Normal</SelectItem>
            <SelectItem value={SpacingType.SPACIOUS}>Spacious</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Control the spacing between form elements
        </p>
      </div>

      <Separator />

      {/* Text Color */}
      <div className="space-y-2">
        <Label htmlFor="textColor">Text Color</Label>
        <div className="flex gap-2">
          <Input
            id="textColor"
            type="color"
            value={layout.textColor || '#000000'}
            onChange={(e) => updateLayout({ textColor: e.target.value })}
            className="w-16 h-10 cursor-pointer"
          />
          <Input
            type="text"
            value={layout.textColor || '#000000'}
            onChange={(e) => updateLayout({ textColor: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Primary text color for form labels and content
        </p>
      </div>

      <Separator />

      {/* Background Color */}
      <div className="space-y-2">
        <Label htmlFor="bgColor">Background Color</Label>
        <div className="flex gap-2">
          <Input
            id="bgColor"
            type="color"
            value={layout.customBackGroundColor || '#ffffff'}
            onChange={(e) => updateLayout({ customBackGroundColor: e.target.value })}
            className="w-16 h-10 cursor-pointer"
          />
          <Input
            type="text"
            value={layout.customBackGroundColor || '#ffffff'}
            onChange={(e) => updateLayout({ customBackGroundColor: e.target.value })}
            placeholder="#ffffff"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Form background color
        </p>
      </div>

      <Separator />

      {/* CTA Button Name */}
      <div className="space-y-2">
        <Label htmlFor="ctaButton">Submit Button Text</Label>
        <Input
          id="ctaButton"
          type="text"
          value={layout.customCTAButtonName || 'Submit'}
          onChange={(e) => updateLayout({ customCTAButtonName: e.target.value })}
          placeholder="Submit"
        />
        <p className="text-xs text-muted-foreground">
          Text displayed on the form submit button
        </p>
      </div>

      <Separator />

      {/* Layout Code (Advanced) */}
      <div className="space-y-2">
        <Label htmlFor="layoutCode">Layout Code</Label>
        <Select
          value={layout.code || 'L1'}
          onValueChange={(value) => updateLayout({ code: value as LayoutCode })}
        >
          <SelectTrigger id="layoutCode">
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L1">Layout 1 (Default)</SelectItem>
            <SelectItem value="L2">Layout 2 (Centered)</SelectItem>
            <SelectItem value="L3">Layout 3 (Sidebar)</SelectItem>
            <SelectItem value="L4">Layout 4 (Split)</SelectItem>
            <SelectItem value="L5">Layout 5 (Card)</SelectItem>
            <SelectItem value="L6">Layout 6 (Minimal)</SelectItem>
            <SelectItem value="L7">Layout 7 (Modern)</SelectItem>
            <SelectItem value="L8">Layout 8 (Classic)</SelectItem>
            <SelectItem value="L9">Layout 9 (Full Width)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose a layout template for your form
        </p>
      </div>
    </div>
  );
}
