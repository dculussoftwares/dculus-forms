import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, Eye, Save, MoreVertical } from 'lucide-react';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Input,
} from '@dculus/ui-v2';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';

interface FormBuilderHeaderProps {
  form: any; // TODO: Add proper Form type
}

/**
 * Header component for the collaborative form builder
 * Shows form title, connection status, permission badge, and action buttons
 */
export function FormBuilderHeader({ form }: FormBuilderHeaderProps) {
  const navigate = useNavigate();
  const { isConnected } = useFormBuilderStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(form.title || 'Untitled Form');

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    // TODO: Save title via GraphQL mutation
  };

  const handleSave = () => {
    // TODO: Implement save
    console.log('Save clicked');
  };

  const handleShare = () => {
    // TODO: Open share modal
    console.log('Share clicked');
  };

  const handlePreview = () => {
    // TODO: Open preview in new tab
    console.log('Preview clicked');
  };

  const connectionStatus = isConnected ? 'Live' : 'Offline';
  const connectionVariant = isConnected ? 'default' : 'secondary';

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/form/${form.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isEditingTitle ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
            className="h-8 w-64"
            autoFocus
          />
        ) : (
          <h1
            className="text-lg font-semibold cursor-pointer hover:text-muted-foreground"
            onClick={() => setIsEditingTitle(true)}
          >
            {title}
          </h1>
        )}

        <Badge variant={connectionVariant}>
          <span
            className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          {connectionStatus}
        </Badge>

        <Badge variant="outline">{form.userPermission || 'OWNER'}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>

        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>

        <Button variant="outline" size="sm" onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
