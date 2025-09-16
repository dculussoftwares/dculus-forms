import React from 'react';
import {
  TypographyH1,
  TypographyP,
  TypographyMuted,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@dculus/ui';
import {
  Eye,
  BarChart3,
  EyeOff,
  Link,
  Trash2,
  MoreHorizontal,
  Share2,
} from 'lucide-react';

interface FormHeaderProps {
  form: {
    id: string;
    title: string;
    description?: string;
    isPublished: boolean;
    createdAt: string;
    shortUrl: string;
  };
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onCollectResponses: () => void;
  onPreview: () => void;
  onViewAnalytics: () => void;
  onShare?: () => void;
  updateLoading: boolean;
  deleteLoading: boolean;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  form,
  onPublish,
  onUnpublish,
  onDelete,
  onCollectResponses,
  onPreview,
  onViewAnalytics,
  onShare,
  updateLoading,
  deleteLoading,
}) => {
  return (
    <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <div>
        <TypographyH1 className="mb-2">{form.title}</TypographyH1>
        <TypographyP className="text-slate-600">
          {form.description || 'Monitor your form performance and responses'}
        </TypographyP>
        <div className="flex items-center space-x-4 mt-3">
          <div className="flex items-center space-x-1">
            <div
              className={`w-2 h-2 rounded-full ${
                form.isPublished ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <TypographyMuted>
              {form.isPublished ? 'Published' : 'Draft'}
            </TypographyMuted>
          </div>
          <TypographyMuted>•</TypographyMuted>
          <TypographyMuted>
            Created {new Date(form.createdAt).toLocaleDateString()}
          </TypographyMuted>
        </div>
      </div>
      <div className="flex space-x-3">
        {/* Primary Action - Publish/Unpublish */}
        {form.isPublished ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnpublish}
            disabled={updateLoading}
            className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-400"
          >
            <EyeOff className="mr-2 h-4 w-4" />
            {updateLoading ? 'Unpublishing...' : 'Unpublish'}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onPublish}
            disabled={updateLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Eye className="mr-2 h-4 w-4" />
            {updateLoading ? 'Publishing...' : 'Publish'}
          </Button>
        )}

        {/* Secondary Action - Collect Responses (only when published) */}
        {form.isPublished && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCollectResponses}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400"
          >
            <Link className="mr-2 h-4 w-4" />
            Collect Responses
          </Button>
        )}

        {/* Share Action (when share handler is provided) */}
        {onShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="text-purple-600 border-purple-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-400"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview Form
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewAnalytics}>
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={deleteLoading}
              className="text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete Form'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};