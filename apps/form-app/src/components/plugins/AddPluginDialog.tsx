import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@dculus/ui';
import { Search } from 'lucide-react';
import { PluginGallery, AVAILABLE_PLUGIN_TYPES, PluginType } from './PluginGallery';

interface AddPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPluginSelected: (pluginType: PluginType) => void;
}

export const AddPluginDialog: React.FC<AddPluginDialogProps> = ({
  open,
  onOpenChange,
  onPluginSelected,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(AVAILABLE_PLUGIN_TYPES.map((p) => p.category)))];

  const filteredPlugins = AVAILABLE_PLUGIN_TYPES.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handlePluginSelect = (plugin: PluginType) => {
    onPluginSelected(plugin);
    // Don't close the dialog here - let parent handle it after configuration
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Add Integration</DialogTitle>
          <DialogDescription>
            Choose from our collection of integrations to enhance your forms
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList>
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Plugin Gallery - Scrollable */}
          <div className="flex-1 overflow-y-auto pr-2">
            {filteredPlugins.length > 0 ? (
              <PluginGallery
                onSelectPlugin={handlePluginSelect}
                selectedCategory={selectedCategory === 'all' ? undefined : selectedCategory}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No integrations found matching "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
