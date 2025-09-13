import React from 'react';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { Eye, Edit3, Crown, Ban } from 'lucide-react';

export const PermissionBadge: React.FC = () => {
  const { userPermission, getPermissionLabel, getPermissionColor } = useFormPermissions();

  const getIcon = () => {
    switch (userPermission) {
      case 'VIEWER':
        return <Eye className="w-3 h-3" />;
      case 'EDITOR':
        return <Edit3 className="w-3 h-3" />;
      case 'OWNER':
        return <Crown className="w-3 h-3" />;
      default:
        return <Ban className="w-3 h-3" />;
    }
  };

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border ${getPermissionColor()}`}>
      {getIcon()}
      <span>{getPermissionLabel()}</span>
    </div>
  );
};