import React from 'react';
import { Sparkles } from 'lucide-react';

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
    <div className={`bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-${isSmall ? 'lg' : 'xl'} p-${isSmall ? '4' : '6'} border border-purple-200 dark:border-purple-800`}>
      <div className="text-center">
        <div className={`mx-auto w-${isSmall ? '8' : '12'} h-${isSmall ? '8' : '12'} bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mb-${isSmall ? '2' : '3'}`}>
          <Sparkles className={`w-${isSmall ? '4' : '6'} h-${isSmall ? '4' : '6'} text-purple-600 dark:text-purple-400`} />
        </div>
        
        <h4 className={`text-${isSmall ? 'sm' : 'lg'} font-semibold text-gray-900 dark:text-white mb-${isSmall ? '1' : '2'}`}>
          {title}
        </h4>
        
        <p className={`text-${isSmall ? 'xs' : 'sm'} text-gray-600 dark:text-gray-400 mb-${isSmall ? '3' : '4'}`}>
          {description}
        </p>

        <div className={`grid grid-cols-${isSmall ? '1' : '2 md:grid-cols-3'} gap-${isSmall ? '1' : '2'} text-xs`}>
          {Array.isArray(features) && features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-purple-400 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};