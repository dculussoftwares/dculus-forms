import React from 'react';

interface PageHeaderProps {
  title?: string;
  className?: string;
}

/**
 * Simple component for rendering page title
 * Extracted from SinglePageForm for better modularity
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  className = ''
}) => {
  if (!title) {
    return null;
  }

  return (
    <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${className}`}>
      {title}
    </h3>
  );
};