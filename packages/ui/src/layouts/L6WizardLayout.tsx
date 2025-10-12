import React, { useState } from 'react';
import { FormPage, FormLayout } from '@dculus/types';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import { LayoutProps } from '../types';

export const L6WizardLayout: React.FC<LayoutProps> = ({
  pages,
  layout,
  className = '',
  onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  // L6 Wizard layout styles
  const getLayoutStyles = () => ({
    field: {
      container: 'mb-6',
      label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
      input: 'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
      textarea: 'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100',
      select: 'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
    },
    submitButton: 'w-full h-12 bg-blue-600 rounded-lg flex items-center justify-center'
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempContent, setTempContent] = useState(layout?.content || '<h1>Wizard Layout</h1><p>Step-by-step form experience with guided navigation and progress tracking.</p>');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);


  // Handle content changes in temporary state
  const handleContentChange = (content: string) => {
    setTempContent(content);
    setHasUnsavedChanges(content !== (layout?.content || '<h1>Wizard Layout</h1><p>Step-by-step form experience with guided navigation and progress tracking.</p>'));
  };

  // Save temporary content to layout
  const handleSave = () => {
    onLayoutChange?.({ content: tempContent });
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  };

  // Cancel changes and revert to original content
  const handleCancel = () => {
    const originalContent = layout?.content || '<h1>Wizard Layout</h1><p>Step-by-step form experience with guided navigation and progress tracking.</p>';
    setTempContent(originalContent);
    setHasUnsavedChanges(false);
    setEditorKey(prev => prev + 1);
  };


  // Update temp content when layout content changes from outside
  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(layout?.content || '<h1>Wizard Layout</h1><p>Step-by-step form experience with guided navigation and progress tracking.</p>');
      setEditorKey(prev => prev + 1);
    }
  }, [layout?.content, hasUnsavedChanges]);

  // Create outer background - custom color when enabled, otherwise background image with minimal blur
  const outerBackgroundStyle = layout?.isCustomBackgroundColorEnabled && layout?.customBackGroundColor
    ? {
        backgroundColor: layout.customBackGroundColor,
        transition: 'background-color 0.5s ease-in-out'
      }
    : layout?.backgroundImageKey && cdnEndpoint
    ? {
        backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'all 0.5s ease-in-out'
      }
    : { 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
        transition: 'background 0.5s ease-in-out'
      };

  return (
    <div className={`w-full h-full bg-white dark:bg-gray-900 flex flex-col ${className}`}>
      <div className="flex-1 overflow-y-auto">
        <div 
          className="h-full relative"
          style={outerBackgroundStyle}
        >
          {/* Minimal backdrop blur overlay on top of background image in outer area - only when not using custom color */}
          {!layout?.isCustomBackgroundColorEnabled && layout?.backgroundImageKey && cdnEndpoint && (
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(50px)',
                WebkitBackdropFilter: 'blur(50px)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}
            ></div>
          )}
          
          {/* Central Content Area with vertical layout - scrollable */}
          <div className="h-full relative z-10 overflow-y-auto" style={{ padding: '5% 10%' }}>
            <div className="w-full max-w-4xl mx-auto flex flex-col space-y-6 min-h-full">
              
              {/* Background Image in 4:1 ratio */}
              <div className="w-full h-48 relative rounded-lg overflow-hidden shadow-lg">
                {layout?.backgroundImageKey && cdnEndpoint ? (
                  <div 
                    className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                    style={{ backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})` }}
                  ></div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100"></div>
                )}
              </div>

              {/* Rich Text Editor with Mode Toggle + Save/Cancel */}
              <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-6 shadow-lg">
                {/* Mode toggle and action buttons - only show in BUILDER mode */}
                {mode === RendererMode.BUILDER && (
                  <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    {isEditMode && hasUnsavedChanges && (
                      <>
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-light text-white bg-slate-700 hover:bg-slate-800 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-light text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-light text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                  >
                    {isEditMode ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </>
                    )}
                  </button>
                  </div>
                )}
                
                {/* Rich Text Editor */}
                <div className="min-h-32">
                  <LexicalRichTextEditor
                    key={`editor-${editorKey}`}
                    value={tempContent}
                    onChange={handleContentChange}
                    placeholder="Enter your wizard layout content..."
                    className="border-none bg-transparent"
                    editable={mode === RendererMode.BUILDER ? isEditMode : false}
                  />
                </div>
              </div>

              {/* Pages from schema displayed vertically */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-light text-gray-900 dark:text-white mb-6 tracking-wide">
                  Form Pages
                </h2>
                
                <PageRenderer
                  pages={pages}
                  layoutStyles={getLayoutStyles()}
                  className=""
                  showPageNavigation={true}
                  mode={mode}
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};