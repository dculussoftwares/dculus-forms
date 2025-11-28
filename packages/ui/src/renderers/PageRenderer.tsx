import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FormPage } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { SinglePageForm, LayoutStyles } from './SinglePageForm';
import { useFormResponseStore, useFormResponseUtils } from '../stores/useFormResponseStore';
import { FormValidationState, FormNavigationState } from '../types/validation';
import { useFormResponseContext } from './FormRenderer';

// Re-export LayoutStyles from SinglePageForm for backwards compatibility
export type { LayoutStyles } from './SinglePageForm';

interface PageRendererProps {
  pages: FormPage[];
  className?: string;
  showPageNavigation?: boolean;
  layoutStyles?: LayoutStyles;
  mode?: RendererMode;
  onPageSubmit?: (pageId: string, data: Record<string, any>) => void;
  onFormComplete?: (allData: Record<string, Record<string, any>>) => void;
  onValidationError?: (pageId: string, errors: string[]) => void;
  enableStrictValidation?: boolean;
  showValidationSummary?: boolean;
}

export const PageRenderer: React.FC<PageRendererProps> = ({
  pages,
  className = '',
  showPageNavigation = true,
  layoutStyles,
  mode = RendererMode.PREVIEW,
  onPageSubmit,
  onFormComplete,
  onValidationError,
  enableStrictValidation = true,
  showValidationSummary = true,
}) => {
  console.log('Rendering PageRenderer with mode:', mode);
  
  const store = useFormResponseStore();
  const { getFormattedResponses } = useFormResponseUtils();
  const { onFormSubmit, onResponseUpdate, formId, responseId, mode: contextMode } = useFormResponseContext();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageValidationStates, setPageValidationStates] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [pageAttemptCounts, setPageAttemptCounts] = useState<Record<string, number>>({});
  
  const currentPageFormRef = useRef<{ 
    submit: () => void;
    validate: () => Promise<boolean>;
    getValidationState: () => FormValidationState;
    showAllValidationErrors: () => Promise<void>;
  }>(null);


  // Get current page
  const currentPage = pages[currentPageIndex];

  // Navigation state calculation
  const navigationState: FormNavigationState = useMemo(() => {
    const isFirstPage = currentPageIndex === 0;
    const isLastPage = currentPageIndex >= pages.length - 1;
    const currentPageValid = pageValidationStates[currentPage?.id] ?? false;
    const currentPageAttempts = pageAttemptCounts[currentPage?.id] ?? 0;
    const isFirstAttempt = currentPageAttempts === 0;
    const showLenientValidation = isFirstAttempt && !currentPageValid;
    
    // Always allow button to be clickable for better UX
    // But navigation logic will handle blocking based on attempts and validation
    const canGoNext = true;
    
    return {
      canGoNext,
      canGoPrevious: !isFirstPage,
      isFirstPage,
      isLastPage,
      currentPageValid,
      isFirstAttempt,
      showLenientValidation,
    };
  }, [currentPageIndex, pages.length, pageValidationStates, currentPage?.id, enableStrictValidation, pageAttemptCounts]);

  // Handle page validation state change
  const handleValidationChange = useCallback((pageId: string, isValid: boolean) => {
    setPageValidationStates(prev => ({
      ...prev,
      [pageId]: isValid
    }));
  }, []);

  // Memoize validation change handler for current page to prevent infinite re-renders
  const currentPageValidationHandler = useCallback((isValid: boolean) => {
    if (currentPage) {
      handleValidationChange(currentPage.id, isValid);
    }
  }, [currentPage?.id, handleValidationChange]);


  // Handle page form submission
  const handlePageSubmit = useCallback((pageId: string, data: Record<string, any>) => {
    console.log('Page submitted:', pageId, data);
    
    // Call external callback if provided
    if (onPageSubmit) {
      onPageSubmit(pageId, data);
    }
  }, [onPageSubmit]);

  // Handle form completion (last page submitted)
  const handleFormComplete = () => {
    const allData = store.getAllResponses();
    const formattedData = getFormattedResponses();

    // Handle based on mode - EDIT mode uses onResponseUpdate, others use onFormSubmit
    if (contextMode === RendererMode.EDIT && onResponseUpdate && responseId) {
      onResponseUpdate(responseId, formattedData);
    } else if (onFormSubmit && formId) {
      onFormSubmit(formId, formattedData);
    } else if (onFormComplete) {
      onFormComplete(allData);
    }

    console.log('Form completed with all data:', allData);
  };

  // Navigation handlers with validation
  const goToNextPage = useCallback(async () => {
    if (!currentPage) return;
    
    try {
      setValidationErrors([]);
      
      const currentPageAttempts = pageAttemptCounts[currentPage.id] ?? 0;
      
      // Increment attempt count for this page
      setPageAttemptCounts(prev => ({
        ...prev,
        [currentPage.id]: currentPageAttempts + 1
      }));
      
      // Always validate the page
      if (currentPageFormRef.current) {
        const isValid = await currentPageFormRef.current.validate();
        
        // Show all validation errors and block navigation if invalid
        if (!isValid) {
          // Force show all validation errors on any invalid attempt
          if (currentPageFormRef.current.showAllValidationErrors) {
            await currentPageFormRef.current.showAllValidationErrors();
          }
          
          const validationState = currentPageFormRef.current.getValidationState();
          const errorMessages = Object.values(validationState.errors)
            .map(error => {
              if (error && typeof error === 'object' && 'message' in error) {
                return error.message as string;
              }
              return 'Unknown error';
            })
            .filter(Boolean);
          setValidationErrors(errorMessages);
          
          if (onValidationError) {
            onValidationError(currentPage.id, errorMessages);
          }
          
          // Block navigation on any invalid attempt (including first attempt)
          return;
        }
      }

      // Submit current page first using the ref
      if (currentPageFormRef.current) {
        currentPageFormRef.current.submit();
      }

      const newIndex = currentPageIndex + 1;
      if (newIndex < pages.length) {
        setCurrentPageIndex(newIndex);
      } else {
        // This was the last page
        handleFormComplete();
      }
    } catch (error) {
      console.error('Navigation error:', error);
      setValidationErrors(['An error occurred during validation']);
    }
  }, [currentPage, currentPageIndex, pages.length, enableStrictValidation, onValidationError, handleFormComplete, pageAttemptCounts]);

  const goToPrevPage = useCallback(async () => {
    if (!currentPage || currentPageIndex <= 0) return;

    // Submit current page first (to save progress) - no validation required for going back
    if (currentPageFormRef.current) {
      currentPageFormRef.current.submit();
    }

    setCurrentPageIndex(currentPageIndex - 1);
    setValidationErrors([]);
  }, [currentPage, currentPageIndex]);

  const goToPage = useCallback(async (pageIndex: number) => {
    if (!currentPage || pageIndex === currentPageIndex) return;
    if (pageIndex < 0 || pageIndex >= pages.length) return;

    // Only validate if moving forward
    if (pageIndex > currentPageIndex) {
      const currentPageAttempts = pageAttemptCounts[currentPage.id] ?? 0;
      
      // Increment attempt count for current page
      setPageAttemptCounts(prev => ({
        ...prev,
        [currentPage.id]: currentPageAttempts + 1
      }));
      
      try {
        if (currentPageFormRef.current) {
          const isValid = await currentPageFormRef.current.validate();
          
          // Show all validation errors and block navigation if invalid
          if (!isValid) {
            // Force show all validation errors on any invalid attempt
            if (currentPageFormRef.current.showAllValidationErrors) {
              await currentPageFormRef.current.showAllValidationErrors();
            }
            
            const validationState = currentPageFormRef.current.getValidationState();
            const errorMessages = Object.values(validationState.errors)
              .map(error => {
                if (error && typeof error === 'object' && 'message' in error) {
                  return error.message as string;
                }
                return 'Unknown error';
              })
              .filter(Boolean);
            setValidationErrors(errorMessages);
            
            if (onValidationError) {
              onValidationError(currentPage.id, errorMessages);
            }
            
            // Block navigation on any invalid attempt
            return;
          }
        }
      } catch (error) {
        console.error('Page navigation validation error:', error);
        return;
      }
    }

    // Submit current page first
    if (currentPageFormRef.current) {
      currentPageFormRef.current.submit();
    }

    setCurrentPageIndex(pageIndex);
    setValidationErrors([]);
  }, [currentPage, currentPageIndex, pages.length, enableStrictValidation, onValidationError, pageAttemptCounts]);

  if (pages.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          No pages created yet. Add pages and fields to see them here.
        </p>
      </div>
    );
  }

  // Multipage mode - show current page with navigation at bottom
  return (
    <div className={`flex flex-col min-h-full ${className}`} data-testid="viewer-page" data-page-index={currentPageIndex}>
      {/* Page title section - subtle and minimal */}
      {showPageNavigation && (
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white" data-testid="viewer-page-title">
            {pages[currentPageIndex]?.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1" data-testid="viewer-page-indicator">
            Page {currentPageIndex + 1} of {pages.length}
          </p>
        </div>
      )}

      {/* Validation error summary - shown at top for visibility */}
      {showPageNavigation && showValidationSummary && validationErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                Please fix the following errors to continue:
              </h3>
              <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Current page form - takes up remaining space */}
      <div className="flex-1">
        {currentPage && (
          <SinglePageForm
            page={currentPage}
            layoutStyles={layoutStyles}
            mode={mode}
            onSubmit={handlePageSubmit}
            showSubmitButton={false} // Navigation handles submission
            formRef={currentPageFormRef}
            onValidationChange={currentPageValidationHandler}
            enableRealtimeValidation={true}
          />
        )}
      </div>

      {/* Bottom sticky navigation footer */}
      {showPageNavigation && (
        <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg mt-8 z-10">
          <div className="max-w-4xl mx-auto p-4">
            {/* Mobile progress dots - shown on small screens */}
            {pages.length > 1 && (
              <div className="flex justify-center gap-2 mb-4 md:hidden">
                {pages.map((page, index) => {
                  const isCurrentPage = index === currentPageIndex;
                  const isPageValid = pageValidationStates[page.id];
                  
                  return (
                    <button
                      key={index}
                      onClick={() => goToPage(index)}
                      className={`relative h-2 rounded-full transition-all ${
                        isCurrentPage
                          ? 'bg-blue-600 dark:bg-blue-500 w-8'
                          : 'bg-gray-300 dark:bg-gray-600 w-2 hover:bg-gray-400 dark:hover:bg-gray-500'
                      }`}
                      aria-label={`Go to page ${index + 1}${isPageValid ? ' (completed)' : ''}`}
                      title={`Page ${index + 1}${page.title ? `: ${page.title}` : ''}${isPageValid ? ' ✓' : ''}`}
                    >
                      {/* Validation indicator */}
                      {enableStrictValidation && isPageValid && !isCurrentPage && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-green-500 rounded-full border border-white dark:border-gray-900"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Navigation controls */}
            <div className="flex items-center justify-between gap-4">
              {/* Page indicator - desktop only */}
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPageIndex + 1} of {pages.length}
                </span>
                {/* Validation status badge */}
                {enableStrictValidation && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    navigationState.currentPageValid 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                      : navigationState.isFirstAttempt
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                  }`}>
                    {navigationState.currentPageValid 
                      ? '✓ Valid' 
                      : navigationState.isFirstAttempt 
                        ? '◦ Ready'
                        : '⚠ Invalid'}
                  </span>
                )}
              </div>

              {/* Desktop progress dots */}
              {pages.length > 1 && (
                <div className="hidden md:flex justify-center gap-2">
                  {pages.map((page, index) => {
                    const isCurrentPage = index === currentPageIndex;
                    const isPageValid = pageValidationStates[page.id];
                    
                    return (
                      <button
                        key={index}
                        onClick={() => goToPage(index)}
                        className={`relative w-2.5 h-2.5 rounded-full transition-all ${
                          isCurrentPage
                            ? 'bg-blue-600 dark:bg-blue-500 scale-125'
                            : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                        }`}
                        aria-label={`Go to page ${index + 1}${isPageValid ? ' (completed)' : ''}`}
                        title={`Page ${index + 1}${page.title ? `: ${page.title}` : ''}${isPageValid ? ' ✓' : ''}`}
                      >
                        {/* Validation indicator */}
                        {enableStrictValidation && isPageValid && !isCurrentPage && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white dark:border-gray-900"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-3 flex-1 md:flex-initial">
                <button
                  data-testid="viewer-prev-button"
                  onClick={goToPrevPage}
                  disabled={!navigationState.canGoPrevious}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>
                
                {navigationState.isLastPage ? (
                  <button
                    data-testid="viewer-submit-button"
                    onClick={goToNextPage}
                    disabled={false}
                    className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors shadow-md ${
                      navigationState.currentPageValid
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                        : navigationState.isFirstAttempt
                          ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
                    }`}
                    title={
                      navigationState.currentPageValid
                        ? (contextMode === RendererMode.EDIT ? 'Update response and continue to next page' : 'Submit and continue to next page')
                        : navigationState.isFirstAttempt
                          ? 'Click to validate and submit (will show validation errors if any)'
                          : 'Fix validation errors to continue'
                    }
                  >
                    {contextMode === RendererMode.EDIT ? 'Update Response' : 'Submit'}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    data-testid="viewer-next-button"
                    onClick={goToNextPage}
                    disabled={false}
                    className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors shadow-md ${
                      navigationState.currentPageValid
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                        : navigationState.isFirstAttempt
                          ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
                    }`}
                    title={
                      navigationState.currentPageValid
                        ? 'Continue to next page'
                        : navigationState.isFirstAttempt 
                          ? 'Click to validate (will show validation errors if any)'
                          : 'Fix validation errors to continue'
                    }
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">Next</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};