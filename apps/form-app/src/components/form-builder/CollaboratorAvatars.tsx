import React from 'react';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
import type { CollaboratorInfo } from '../../store/collaboration/CollaborationManager';

interface CollaboratorAvatarsProps {
  className?: string;
  maxVisible?: number;
}

/**
 * Display connected collaborators as colored avatars
 */
export const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  className = '',
  maxVisible = 5,
}) => {
  const { collaborators, isConnected } = useFormBuilderStore();

  if (!isConnected || !collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const remainingCount = collaborators.length - maxVisible;

  return (
    <div className={`flex items-center -space-x-2 ${className}`}>
      {visibleCollaborators.map((collaborator: CollaboratorInfo) => (
        <div key={collaborator.id} className="relative group">
          {/* Avatar circle */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium border-2 border-white dark:border-gray-800 shadow-sm cursor-pointer transition-transform hover:scale-110 hover:z-10"
            style={{ backgroundColor: collaborator.color }}
            title={collaborator.name}
          >
            {getInitials(collaborator.name)}
          </div>

          {/* Tooltip */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {collaborator.name}
            {collaborator.email && (
              <span className="block text-gray-400 text-xs">
                {collaborator.email}
              </span>
            )}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
          </div>
        </div>
      ))}

      {/* Overflow indicator */}
      {remainingCount > 0 && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-white dark:border-gray-800"
          title={`${remainingCount} more collaborator${remainingCount > 1 ? 's' : ''}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default CollaboratorAvatars;
