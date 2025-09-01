import React, { useState } from 'react';
import { FormLayout, ThemeType, SpacingType, LayoutCode, PageModeType } from '@dculus/types';
import { Button, RichTextEditor } from '@dculus/ui';
import { X, Volume2, VolumeX } from 'lucide-react';

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  layout: Partial<FormLayout>;
  thumbnail: string;
}

const NEW_LAYOUT_TEMPLATES: FormLayout[] = [
  {
    theme: ThemeType.LIGHT,
    textColor: '#1f2937',
    spacing: SpacingType.NORMAL,
    customBackGroundColor: '#ffffff',
    code: 'L1' as LayoutCode,
    content: 'Add your introduction and instructions here...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
  {
    theme: ThemeType.LIGHT,
    textColor: '#374151',
    spacing: SpacingType.SPACIOUS,
    customBackGroundColor: '#f9fafb',
    code: 'L2' as LayoutCode,
    content: 'Add helpful context and guidance here...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
  {
    theme: ThemeType.LIGHT,
    textColor: '#111827',
    spacing: SpacingType.COMPACT,
    customBackGroundColor: '#ffffff',
    code: 'L3' as LayoutCode,
    content: 'Brief description or welcome message...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
  {
    theme: ThemeType.LIGHT,
    textColor: '#1f2937',
    spacing: SpacingType.NORMAL,
    customBackGroundColor: '#ffffff',
    code: 'L4' as LayoutCode,
    content: 'Detailed documentation and help content...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
  {
    theme: ThemeType.LIGHT,
    textColor: '#1f2937',
    spacing: SpacingType.SPACIOUS,
    customBackGroundColor: '#ffffff',
    code: 'L5' as LayoutCode,
    content: 'Additional information and context...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
  {
    theme: ThemeType.LIGHT,
    textColor: '#1f2937',
    spacing: SpacingType.COMPACT,
    customBackGroundColor: '#ffffff',
    code: 'L6' as LayoutCode,
    content:
      'Welcome message...\n---\nContextual help for step 2...\n---\nFinal thoughts and next steps...',
    backgroundImageKey: '',
    pageMode: PageModeType.MULTIPAGE,
  },
];
const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'L1',
    name: 'Content First',
    description:
      'Rich text content displayed at top, form pages rendered below',
    useCase: 'Surveys with detailed instructions',
    thumbnail: 'M2 2h20v8H2z M6 12h12v2H6z M6 16h8v2H6z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#1f2937',
      spacing: SpacingType.NORMAL,
      customBackGroundColor: '#ffffff',
      code: 'L1' as LayoutCode,
      content: 'Add your introduction and instructions here...',
    },
  },
  {
    id: 'L2',
    name: 'Split Screen',
    description: 'Left panel: content (30-40%), Right panel: form (60-70%)',
    useCase: 'Forms with persistent context/help',
    thumbnail: 'M2 2h7v16H2z M11 2h11v16H11z M4 6h3v1H4z M13 6h6v1H13z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#374151',
      spacing: SpacingType.SPACIOUS,
      customBackGroundColor: '#f9fafb',
      code: 'L2' as LayoutCode,
      content: 'Add helpful context and guidance here...',
    },
  },
  {
    id: 'L3',
    name: 'Header Content',
    description:
      'Compact rich text header banner, form pages below in full width',
    useCase: 'Forms with brief descriptions',
    thumbnail: 'M2 2h20v4H2z M6 8h12v2H6z M6 12h8v2H6z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#111827',
      spacing: SpacingType.COMPACT,
      customBackGroundColor: '#ffffff',
      code: 'L3' as LayoutCode,
      content: 'Brief description or welcome message...',
    },
  },
  {
    id: 'L4',
    name: 'Tabbed Interface',
    description: 'Tab 1: Rich text content, Tab 2: Form pages',
    useCase: 'Complex forms with extensive documentation',
    thumbnail: 'M2 2h6v2H2z M10 2h6v2h-6z M2 6h20v12H2z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#1f2937',
      spacing: SpacingType.NORMAL,
      customBackGroundColor: '#ffffff',
      code: 'L4' as LayoutCode,
      content: 'Detailed documentation and help content...',
    },
  },
  {
    id: 'L5',
    name: 'Overlay Content',
    description:
      'Form pages as primary content, rich text content in expandable overlay',
    useCase: 'Quick forms with optional details',
    thumbnail: 'M2 2h20v16H2z M16 4h4v4h-4z M6 6h8v2H6z M6 10h6v2H6z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#1f2937',
      spacing: SpacingType.SPACIOUS,
      customBackGroundColor: '#ffffff',
      code: 'L5' as LayoutCode,
      content: 'Additional information and context...',
    },
  },
  {
    id: 'L6',
    name: 'Integrated Content',
    description: 'Rich text content integrated between form pages',
    useCase: 'Multi-step forms with contextual content',
    thumbnail: 'M6 2h12v2H6z M2 6h20v2H2z M6 10h12v2H6z M2 14h20v2H2z',
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#1f2937',
      spacing: SpacingType.COMPACT,
      customBackGroundColor: '#ffffff',
      code: 'L6' as LayoutCode,
      content:
        'Welcome message...\n---\nContextual help for step 2...\n---\nFinal thoughts and next steps...',
    },
  },
];

const BACKGROUND_IMAGES = [
  {
    id: 'bg1',
    src: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg2',
    src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg3',
    src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg4',
    src: 'https://images.unsplash.com/photo-1519452575417-564c1401ecc0?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg5',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg6',
    src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg7',
    src: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg8',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
    category: 'suggested',
  },
  {
    id: 'bg9',
    src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&h=200&fit=crop',
    category: 'customized',
  },
  {
    id: 'bg10',
    src: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=300&h=200&fit=crop',
    category: 'customized',
  },
  {
    id: 'bg11',
    src: 'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?w=300&h=200&fit=crop',
    category: 'customized',
  },
  {
    id: 'bg12',
    src: 'https://images.unsplash.com/photo-1536431311719-398b6704d4cc?w=300&h=200&fit=crop',
    category: 'customized',
  },
];

interface LayoutBuilderProps {
  currentLayout: FormLayout;
  onLayoutChange: (layout: Partial<FormLayout>) => void;
  onClose?: () => void;
}

export const LayoutBuilder: React.FC<LayoutBuilderProps> = ({
  currentLayout,
  onLayoutChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'suggested' | 'customized'>(
    'suggested'
  );
  const [backgroundMusic, setBackgroundMusic] = useState(false);

  const handleBackgroundSelect = (backgroundId: string) => {
    onLayoutChange({
      ...currentLayout,
      backgroundImageKey: backgroundId,
    });
  };

  const filteredBackgrounds = BACKGROUND_IMAGES.filter(
    (bg) => bg.category === activeTab
  );

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Layout & Content
        </h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* Layouts Section */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
            Layout Templates
          </div>
          <div className="grid grid-cols-2 gap-3">
            {NEW_LAYOUT_TEMPLATES.map((layout, index) => {
              const isSelected = currentLayout.code === layout.code;

              return (
                <button
                  key={index}
                  className={`relative p-3 rounded-lg border-2 transition-all hover:scale-[1.02] text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <p>{layout.code}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Editor Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
            Content Editor
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Current Layout:{' '}
              <span className="font-medium">
                {LAYOUT_TEMPLATES.find(
                  (t) => t.layout.code === currentLayout.code
                )?.name || 'Unknown'}
              </span>
            </div>
            <RichTextEditor
              value={currentLayout.content}
              onChange={(content: string) =>
                onLayoutChange({ ...currentLayout, content })
              }
              placeholder="Add your content here..."
              editable={true}
              className="max-h-40"
            />
          </div>
        </div>

        {/* Background Images Section */}
        <div className="p-4">
          {/* Category Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('suggested')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === 'suggested'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Suggested
            </button>
            <button
              onClick={() => setActiveTab('customized')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === 'customized'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Customized
            </button>
          </div>

          {/* Background Images Grid */}
          <div className="grid grid-cols-3 gap-2">
            {filteredBackgrounds.map((background) => {
              const isSelected =
                currentLayout.backgroundImageKey === background.id;

              return (
                <button
                  key={background.id}
                  onClick={() => handleBackgroundSelect(background.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    isSelected
                      ? 'border-blue-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <img
                    src={background.src}
                    alt={`Background ${background.id}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Background Music Toggle */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {backgroundMusic ? (
                <Volume2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Background music
              </span>
            </div>
            <button
              onClick={() => setBackgroundMusic(!backgroundMusic)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                backgroundMusic ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  backgroundMusic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
