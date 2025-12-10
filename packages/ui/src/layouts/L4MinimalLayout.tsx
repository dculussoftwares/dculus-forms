import React, { useState } from 'react';
import { FormPage, FormLayout } from '@dculus/types';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import { LayoutProps } from '../types';

export const L4MinimalLayout: React.FC<LayoutProps> = ({
  pages,
  layout,
  className = '',
  onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  // L4 Minimal layout styles
  const getLayoutStyles = () => ({
    field: {
      container: 'mb-8',
      label: 'block text-xs font-light text-gray-500 dark:text-gray-400 mt-2',
      input: 'w-full h-12 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
      textarea: 'w-full h-32 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 py-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
      select: 'w-full h-12 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
    },
    submitButton: 'w-full h-12 bg-slate-800 rounded-lg flex items-center justify-center'
  });
  const [showPages, setShowPages] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempContent, setTempContent] = useState(layout?.content || '<h1>Minimal Form</h1><p>Clean and spacious design for better focus.</p>');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);


  // Handle content changes in temporary state
  const handleContentChange = (content: string) => {
    setTempContent(content);
    setHasUnsavedChanges(content !== (layout?.content || '<h1>Minimal Form</h1><p>Clean and spacious design for better focus.</p>'));
  };

  // Save temporary content to layout
  const handleSave = () => {
    onLayoutChange?.({ content: tempContent });
    setHasUnsavedChanges(false);
    setIsEditMode(false); // Switch to view mode after saving
  };

  // Cancel changes and revert to original content
  const handleCancel = () => {
    const originalContent = layout?.content || '<h1>Minimal Form</h1><p>Clean and spacious design for better focus.</p>';
    setTempContent(originalContent);
    setHasUnsavedChanges(false);
    setEditorKey(prev => prev + 1); // Force editor remount
  };


  // Update temp content when layout content changes from outside
  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(layout?.content || '<h1>Minimal Form</h1><p>Clean and spacious design for better focus.</p>');
      setEditorKey(prev => prev + 1); // Force editor remount when content changes externally
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
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)',
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
            
            {/* Background image container with padding */}
            <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
              {/* Background image area with 2 chunks - clear background image in center */}
              <div className="w-full h-full relative rounded-lg overflow-hidden shadow-xl">
                {/* Default minimal gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100"></div>
                
                {/* Two chunks layout - 50/50 split */}
                <div className="relative z-10 h-full flex">
                  {/* First chunk - IMAGE CHUNK - Background image display area (50%) */}
                  <div className="flex-1 flex items-center justify-center relative">
                    {/* Background image showcase only in this chunk */}
                    {layout?.backgroundImageKey && cdnEndpoint ? (
                      <div 
                        className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                        style={{ backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})` }}
                      ></div>
                    ) : (
                      /* Default minimal gradient when no image */
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100"></div>
                    )}
                  </div>
                  
                  {/* Second chunk - WHITE PAPER CHUNK - Content area (50%) */}
                  <div className="flex-1 relative">
                    <div 
                      className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-8 overflow-y-auto shadow-inner inset-0" 
                    >
                        {/* Mode toggle and action buttons - only show in BUILDER mode */}
                        {mode === RendererMode.BUILDER && (
                          <div className="flex justify-between items-center mb-6">
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
                        
                        <div className="flex-1 flex items-start justify-center overflow-y-auto">
                          <div className="w-full max-w-sm my-auto">
                            <LexicalRichTextEditor
                              key={`editor-${editorKey}`}
                              value={tempContent}
                              onChange={handleContentChange}
                              placeholder="Enter your minimal content..."
                              className="border-none bg-transparent text-center"
                              editable={mode === RendererMode.BUILDER ? isEditMode : false}
                            />
                          </div>
                        </div>
                        
                        {/* Custom CTA Button at bottom of white paper */}
                        <div className="flex justify-center">
                          <button 
                            onClick={() => setShowPages(true)}
                            data-testid="viewer-cta-button"
                            className="bg-slate-800 hover:bg-slate-900 text-white font-light py-3 px-8 rounded-lg transition-colors shadow-sm max-w-xs w-full tracking-wide"
                          >
                            {layout?.customCTAButtonName || 'Continue'}
                          </button>
                        </div>

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
            
            {/* Pages content with white background container */}
            <div className="h-full relative z-10 p-8 overflow-y-auto">
              <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                {/* Back button */}
                <button
                  onClick={() => setShowPages(false)}
                  className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-light"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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