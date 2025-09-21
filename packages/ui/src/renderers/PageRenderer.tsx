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

  // Multipage mode - show current page with navigation
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Page navigation header */}
      {showPageNavigation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">
                Page {currentPageIndex + 1} of {pages.length}:{' '}
                {pages[currentPageIndex]?.title}
              </h3>
              {/* Page validation indicator */}
              {enableStrictValidation && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  navigationState.currentPageValid 
                    ? 'bg-green-100 text-green-800' 
                    : navigationState.isFirstAttempt
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {navigationState.currentPageValid 
                    ? '✓ Valid' 
                    : navigationState.isFirstAttempt 
                      ? '◦ Ready'
                      : '⚠ Invalid'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                disabled={!navigationState.canGoPrevious}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:text-white/50 rounded-md transition-colors"
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
                Previous
              </button>
              <span className="text-white/80 text-sm px-2">
                {currentPageIndex + 1} / {pages.length}
              </span>
              {navigationState.isLastPage ? (
                <button
                  onClick={goToNextPage}
                  disabled={false}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                    navigationState.currentPageValid
                      ? 'bg-green-600 hover:bg-green-700'
                      : navigationState.isFirstAttempt
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-red-600 hover:bg-red-700'
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
                  onClick={goToNextPage}
                  disabled={false}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                    navigationState.currentPageValid
                      ? 'bg-green-600 hover:bg-green-700'
                      : navigationState.isFirstAttempt
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-red-600 hover:bg-red-700'
                  }`}
                  title={
                    navigationState.currentPageValid
                      ? 'Continue to next page'
                      : navigationState.isFirstAttempt 
                        ? 'Click to validate (will show validation errors if any)'
                        : 'Fix validation errors to continue'
                  }
                >
                  Next
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

          {/* Validation error summary */}
          {showValidationSummary && validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fix the following errors to continue:
                  </h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current page form */}
      {currentPage && (
        <div className="bg-white rounded-lg p-6 shadow-lg">
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
        </div>
      )}

      {/* Page dots indicator */}
      {showPageNavigation && pages.length > 1 && (
        <div className="flex justify-center space-x-2">
          {pages.map((page, index) => {
            const isCurrentPage = index === currentPageIndex;
            const isPageValid = pageValidationStates[page.id];
            
            return (
              <button
                key={index}
                onClick={() => goToPage(index)}
                className={`relative w-3 h-3 rounded-full transition-colors ${
                  isCurrentPage
                    ? 'bg-white'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to page ${index + 1}${isPageValid ? ' (completed)' : ''}`}
                title={`Page ${index + 1}${page.title ? `: ${page.title}` : ''}${isPageValid ? ' ✓' : ''}`}
              >
                {/* Validation indicator */}
                {enableStrictValidation && isPageValid && !isCurrentPage && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white"></span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};