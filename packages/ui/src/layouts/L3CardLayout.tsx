import React, { useState } from 'react';
import { FormPage, FormLayout } from '@dculus/types';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import { LayoutProps } from '../types';

export const L3CardLayout: React.FC<LayoutProps> = ({
  pages,
  layout,
  className = '',
  onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  // L3 Card layout styles
  const getLayoutStyles = () => ({
    field: {
      container: 'mb-4',
      label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
      input: 'w-full h-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
      textarea: 'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100',
      select: 'w-full h-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
    },
    submitButton: 'w-full h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-md flex items-center justify-center'
  });
  const [showPages, setShowPages] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempContent, setTempContent] = useState(layout?.content || '<h1>Card Layout Survey</h1>');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);


  // Handle content changes in temporary state
  const handleContentChange = (content: string) => {
    setTempContent(content);
    setHasUnsavedChanges(content !== (layout?.content || '<h1>Card Layout Survey</h1>'));
  };

  // Save temporary content to layout
  const handleSave = () => {
    onLayoutChange?.({ content: tempContent });
    setHasUnsavedChanges(false);
    setIsEditMode(false); // Switch to view mode after saving
  };

  // Cancel changes and revert to original content
  const handleCancel = () => {
    const originalContent = layout?.content || '<h1>Card Layout Survey</h1>';
    setTempContent(originalContent);
    setHasUnsavedChanges(false);
    setEditorKey(prev => prev + 1); // Force editor remount
  };


  // Update temp content when layout content changes from outside
  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(layout?.content || '<h1>Card Layout Survey</h1>');
      setEditorKey(prev => prev + 1); // Force editor remount when content changes externally
    }
  }, [layout?.content, hasUnsavedChanges]);

  // Create outer background - custom color when enabled, otherwise background image with blur
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
        background: 'linear-gradient(135deg, #667eea 0%, #667eeacc 25%, #764ba2 50%, #764ba266 75%, #667eea33 100%)',
        transition: 'background 0.5s ease-in-out'
      };

  return (
    <div className={`w-full h-full bg-white dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!showPages ? (
          /* Intro Section - Full view with background image */
          <div 
            className="h-full relative"
            style={outerBackgroundStyle}
          >
            {/* Backdrop blur overlay on top of background image in outer area - only when not using custom color */}
            {!layout?.isCustomBackgroundColorEnabled && layout?.backgroundImageKey && cdnEndpoint && (
              <div 
                className="absolute inset-0"
                style={{
                  backdropFilter: 'blur(250px)',
                  WebkitBackdropFilter: 'blur(250px)',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)'
                }}
              ></div>
            )}
            
            {/* Background image container with padding */}
            <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
              {/* Background image area with white paper chunk centered */}
              <div className="w-full h-full relative rounded-sm overflow-hidden shadow-2xl">
                {/* Clear background image in center area */}
                {layout?.backgroundImageKey && cdnEndpoint ? (
                  <div 
                    className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                    style={{ backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})` }}
                  ></div>
                ) : (
                  /* Default gradient when no image */
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600"></div>
                )}
                
                {/* Centered white paper overlay with content */}
                <div className="relative z-10 h-full flex items-center justify-center">
                  <div 
                    className="bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto max-w-md w-full" 
                    style={{ maxHeight: '90%' }}
                  >
                      {/* Mode toggle and action buttons - only show in BUILDER mode */}
                      {mode === RendererMode.BUILDER && (
                        <div className="flex justify-between items-center mb-4">
                        <div className="flex gap-2">
                          {isEditMode && hasUnsavedChanges && (
                            <>
                              <button
                                onClick={handleSave}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save
                              </button>
                              <button
                                onClick={handleCancel}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                        
                        <button
                          onClick={() => setIsEditMode(!isEditMode)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          {isEditMode ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Mode
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Mode
                            </>
                          )}
                        </button>
                        </div>
                      )}
                      
                      <div className="flex-1 flex items-start justify-center overflow-y-auto">
                        <div className="w-full my-auto">
                          <LexicalRichTextEditor
                            key={`editor-${editorKey}`}
                            value={tempContent}
                            onChange={handleContentChange}
                            placeholder="Enter your content..."
                            className="border-none bg-transparent"
                            editable={mode === RendererMode.BUILDER ? isEditMode : false}
                          />
                        </div>
                      </div>
                      
                      {/* Custom CTA Button at bottom of white paper */}
                      <div className="flex justify-center">
                        <button 
                          onClick={() => setShowPages(true)}
                          data-testid="viewer-cta-button"
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md w-full"
                        >
                          {layout?.customCTAButtonName || 'Start Survey'}
                        </button>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Pages Section - Full height without center background */
          <div 
            className="h-full relative"
            style={outerBackgroundStyle}
          >
            {/* Backdrop blur overlay on top of background image in outer area - only when not using custom color */}
            {!layout?.isCustomBackgroundColorEnabled && layout?.backgroundImageKey && cdnEndpoint && (
              <div 
                className="absolute inset-0"
                style={{
                  backdropFilter: 'blur(250px)',
                  WebkitBackdropFilter: 'blur(250px)',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)'
                }}
              ></div>
            )}
            
            {/* Pages content with white background container */}
            <div className="h-full relative z-10 p-8 overflow-y-auto">
              <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                {/* Back button */}
                <button
                  onClick={() => setShowPages(false)}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Intro
                </button>
                
                <PageRenderer
                  pages={pages}
                  layoutStyles={getLayoutStyles()}
                  mode={mode}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};