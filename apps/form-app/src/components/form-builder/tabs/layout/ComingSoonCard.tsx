import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@dculus/utils';

interface ComingSoonCardProps {
  title: string;
  description: string;
  features: string[];
  size?: 'small' | 'large';
}

export const ComingSoonCard: React.FC<ComingSoonCardProps> = ({
  title,
  description,
  features,
  size = 'large'
}) => {
  const isSmall = size === 'small';
  
  return (
    <div className={cn(
      'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800',
      isSmall ? 'rounded-lg p-4' : 'rounded-xl p-6',
    )}>
      <div className="text-center">
        <div className={cn(
          'mx-auto bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center',
          isSmall ? 'w-8 h-8 mb-2' : 'w-12 h-12 mb-3',
        )}>
          <Sparkles className={cn(isSmall ? 'w-4 h-4' : 'w-6 h-6', 'text-purple-600 dark:text-purple-400')} />
        </div>

        <h4 className={cn(
          'font-semibold text-primary dark:text-white',
          isSmall ? 'text-sm mb-1' : 'text-lg mb-2',
        )}>
          {title}
        </h4>

        <p className={cn(
          'text-foreground dark:text-gray-400',
          isSmall ? 'text-xs mb-3' : 'text-sm mb-4',
        )}>
          {description}
        </p>

        <div className={cn('text-xs', isSmall ? 'grid grid-cols-1 gap-1' : 'grid grid-cols-2 md:grid-cols-3 gap-2')}>
          {Array.isArray(features) && features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-purple-400 rounded-full" />
              <span className="text-foreground dark:text-gray-400">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};