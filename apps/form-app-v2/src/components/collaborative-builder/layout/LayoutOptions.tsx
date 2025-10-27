import React from 'react';
import type { FormLayout, LayoutCode } from '@dculus/types';

interface LayoutOptionsProps {
  layout: FormLayout;
  currentLayoutCode: LayoutCode;
}

/**
 * LayoutOptions component - Displays current layout configuration info
 */
export const LayoutOptions: React.FC<LayoutOptionsProps> = ({
  layout,
  currentLayoutCode
}) => {
  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-2">
        Layout Options
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Current:</span>
          <span className="text-foreground font-mono">
            {currentLayoutCode}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Theme:</span>
          <span className="text-foreground capitalize">
            {layout?.theme || 'light'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Spacing:</span>
          <span className="text-foreground capitalize">
            {layout?.spacing || 'normal'}
          </span>
        </div>
      </div>
    </div>
  );
};
