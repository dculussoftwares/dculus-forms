import React from 'react';
import { FormLayout, ThemeType, SpacingType } from '@dculus/types';
import { Card } from '@dculus/ui';
import { Monitor } from 'lucide-react';

interface LayoutPreviewProps {
  layout: FormLayout;
  className?: string;
}

export const LayoutPreview: React.FC<LayoutPreviewProps> = ({ layout, className }) => {
  const getSpacingClass = () => {
    switch (layout.spacing) {
      case SpacingType.COMPACT:
        return 'space-y-2 p-3';
      case SpacingType.SPACIOUS:
        return 'space-y-6 p-6';
      default:
        return 'space-y-4 p-4';
    }
  };

  const getThemeClasses = () => {
    const isDark = layout.theme === ThemeType.DARK || 
                  (layout.theme === ThemeType.AUTO && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    return {
      container: isDark ? 'dark' : '',
      background: layout.customBackGroundColor,
      text: layout.textColor
    };
  };

  const themeClasses = getThemeClasses();
  
  return (
    <div className={`${className} ${themeClasses.container}`}>
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Monitor className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Layout Preview
            </span>
          </div>
        </div>
        
        <div 
          className={`min-h-48 ${getSpacingClass()}`}
          style={{ 
            backgroundColor: themeClasses.background,
            color: themeClasses.text
          }}
        >
          {/* Mock Form Elements */}
          <div className="space-y-3">
            <div>
              <div className="text-lg font-semibold mb-2">Sample Form</div>
              <div className="text-sm opacity-70">{layout.content}</div>
            </div>
            
            {/* Mock Input Fields */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Name</div>
                <div className="h-8 bg-white/10 border border-current/20 rounded px-3 flex items-center text-sm opacity-50">
                  Enter your name...
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-1">Email</div>
                <div className="h-8 bg-white/10 border border-current/20 rounded px-3 flex items-center text-sm opacity-50">
                  your@email.com
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-1">Message</div>
                <div className="h-16 bg-white/10 border border-current/20 rounded px-3 py-2 text-sm opacity-50">
                  Your message here...
                </div>
              </div>
            </div>
            
            {/* Mock Submit Button */}
            <div className="flex justify-end pt-2">
              <div 
                className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium"
                style={{ backgroundColor: layout.theme === ThemeType.DARK ? '#3b82f6' : '#2563eb' }}
              >
                {layout.customCTAButtonName || 'Submit'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};