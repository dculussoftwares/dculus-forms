import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FormPage } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { SinglePageForm, LayoutStyles } from './SinglePageForm';
import { useFormResponseStore, useFormResponseUtils } from '../stores/useFormResponseStore';
import { FormValidationState, FormNavigationState } from '../types/validation';
import { useFormResponseContext } from './FormRenderer';
import { Checkbox } from '../checkbox';

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
  const store = useFormResponseStore();
  const { getFormattedResponses } = useFormResponseUtils();
  const {
    onFormSubmit,
    onResponseUpdate,
    formId,
    responseId,
    mode: contextMode,
    responseCopySettings,
    onResponseCopyConsentChange,
  } = useFormResponseContext();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageValidationStates, setPageValidationStates] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [pageAttemptCounts, setPageAttemptCounts] = useState<Record<string, number>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [sendResponseCopy, setSendResponseCopy] = useState(false);

  const handleResponseCopyConsentChange = useCallback((checked: boolean) => {
    setSendResponseCopy(checked);
    onResponseCopyConsentChange?.(checked);
  }, [onResponseCopyConsentChange]);

  const currentPageFormRef = useRef<{
    submit: () => void;
    validate: () => Promise<boolean>;
    getValidationState: () => FormValidationState;
    showAllValidationErrors: () => Promise<void>;
  }>(null);

  const currentPage = pages[currentPageIndex];

  const navigationState: FormNavigationState = useMemo(() => {
    const isFirstPage = currentPageIndex === 0;
    const isLastPage = currentPageIndex >= pages.length - 1;
    const currentPageValid = pageValidationStates[currentPage?.id] ?? false;
    const currentPageAttempts = pageAttemptCounts[currentPage?.id] ?? 0;
    const isFirstAttempt = currentPageAttempts === 0;
    const showLenientValidation = isFirstAttempt && !currentPageValid;

    return {
      canGoNext: true,
      canGoPrevious: !isFirstPage,
      isFirstPage,
      isLastPage,
      currentPageValid,
      isFirstAttempt,
      showLenientValidation,
    };
  }, [currentPageIndex, pages.length, pageValidationStates, currentPage?.id, enableStrictValidation, pageAttemptCounts]);

  const handleValidationChange = useCallback((pageId: string, isValid: boolean) => {
    setPageValidationStates(prev => ({ ...prev, [pageId]: isValid }));
  }, []);

  const currentPageValidationHandler = useCallback((isValid: boolean) => {
    if (currentPage) handleValidationChange(currentPage.id, isValid);
  }, [currentPage?.id, handleValidationChange]);

  const handlePageSubmit = useCallback((pageId: string, data: Record<string, any>) => {
    if (onPageSubmit) onPageSubmit(pageId, data);
  }, [onPageSubmit]);

  const handleFormComplete = () => {
    const allData = store.getAllResponses();
    const formattedData = getFormattedResponses();

    if (contextMode === RendererMode.EDIT && onResponseUpdate && responseId) {
      onResponseUpdate(responseId, formattedData);
    } else if (onFormSubmit && formId) {
      onFormSubmit(formId, formattedData);
    } else if (onFormComplete) {
      onFormComplete(allData);
    }
  };

  const goToNextPage = useCallback(async () => {
    if (!currentPage || isNavigating) return;

    setIsNavigating(true);
    try {
      setValidationErrors([]);

      const currentPageAttempts = pageAttemptCounts[currentPage.id] ?? 0;
      setPageAttemptCounts(prev => ({ ...prev, [currentPage.id]: currentPageAttempts + 1 }));

      if (currentPageFormRef.current) {
        const isValid = await currentPageFormRef.current.validate();

        if (!isValid) {
          if (currentPageFormRef.current.showAllValidationErrors) {
            await currentPageFormRef.current.showAllValidationErrors();
          }

          const validationState = currentPageFormRef.current.getValidationState();
          const errorMessages = Object.values(validationState.errors)
            .map(error => {
              if (error && typeof error === 'object' && 'message' in error) return error.message as string;
              return 'Unknown error';
            })
            .filter(Boolean);
          setValidationErrors(errorMessages);

          if (onValidationError) onValidationError(currentPage.id, errorMessages);
          return;
        }
      }

      if (currentPageFormRef.current) currentPageFormRef.current.submit();

      const newIndex = currentPageIndex + 1;
      if (newIndex < pages.length) {
        setCurrentPageIndex(newIndex);
      } else {
        handleFormComplete();
      }
    } catch (error) {
      console.error('Navigation error:', error);
      setValidationErrors(['An error occurred during validation']);
    } finally {
      setIsNavigating(false);
    }
  }, [currentPage, currentPageIndex, pages.length, isNavigating, enableStrictValidation, onValidationError, handleFormComplete, pageAttemptCounts]);

  const goToPrevPage = useCallback(async () => {
    if (!currentPage || currentPageIndex <= 0) return;
    if (currentPageFormRef.current) currentPageFormRef.current.submit();
    setCurrentPageIndex(currentPageIndex - 1);
    setValidationErrors([]);
  }, [currentPage, currentPageIndex]);

  if (pages.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          No pages created yet. Add pages and fields to see them here.
        </p>
      </div>
    );
  }

  const progressPercent = Math.round(((currentPageIndex + 1) / pages.length) * 100);

  return (
    <div
      className={`flex flex-col min-h-full ${className}`}
      data-testid="viewer-page"
      data-page-index={currentPageIndex}
    >
      {/* Progress bar + page counter */}
      {showPageNavigation && pages.length > 1 && (
        <div className="flex items-center gap-3 mb-4 sm:mb-8">
          <div className="flex-1 h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span
            className="text-xs text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0"
            data-testid="viewer-page-indicator"
          >
            Page {currentPageIndex + 1} of {pages.length}
          </span>
        </div>
      )}

      {/* Page title */}
      {showPageNavigation && pages[currentPageIndex]?.title && (
        <div className="mb-4 sm:mb-8">
          <h3
            className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight"
            data-testid="viewer-page-title"
          >
            {pages[currentPageIndex]?.title}
          </h3>
        </div>
      )}

      {/* Validation error summary */}
      {showPageNavigation && showValidationSummary && validationErrors.length > 0 && (
        <div
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-8"
          data-testid="validation-error-summary"
        >
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-400 dark:text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">
                Please fix the following errors to continue
              </h3>
              <ul className="mt-1.5 text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Current page form */}
      <div className="flex-1">
        {currentPage && (
          <SinglePageForm
            page={currentPage}
            layoutStyles={layoutStyles}
            mode={mode}
            onSubmit={handlePageSubmit}
            showSubmitButton={false}
            formRef={currentPageFormRef}
            onValidationChange={currentPageValidationHandler}
            enableRealtimeValidation={true}
          />
        )}
      </div>

      {/* "Send me a copy of my responses" — only on the last page, only when the
          form owner set responseCopy mode to respondentChoice. 'always' mode
          sends automatically with no UI, matching Google Forms' receipts behavior. */}
      {navigationState.isLastPage &&
        contextMode !== RendererMode.EDIT &&
        responseCopySettings?.enabled &&
        responseCopySettings.mode === 'respondentChoice' && (
          <div className="flex items-start space-x-2 mt-4 sm:mt-6">
            <Checkbox
              id="send-response-copy"
              data-testid="send-response-copy-checkbox"
              checked={sendResponseCopy}
              onCheckedChange={(checked) => handleResponseCopyConsentChange(Boolean(checked))}
            />
            <label
              htmlFor="send-response-copy"
              className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
            >
              Send me a copy of my responses
            </label>
          </div>
        )}

      {/* Typeform-style navigation footer */}
      {showPageNavigation && (
        <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 mt-4 sm:mt-10 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Ghost previous button */}
              <button
                data-testid="viewer-prev-button"
                onClick={goToPrevPage}
                disabled={!navigationState.canGoPrevious}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Prev
              </button>

              {/* Pill next / submit button + Enter hint */}
              <div className="flex flex-col items-end gap-1">
                {navigationState.isLastPage ? (
                  <button
                    data-testid="viewer-submit-button"
                    onClick={goToNextPage}
                    disabled={isNavigating}
                    className="flex items-center gap-2.5 px-8 py-3.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-full shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {contextMode === RendererMode.EDIT ? 'Update Response' : 'Submit'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    data-testid="viewer-next-button"
                    onClick={goToNextPage}
                    disabled={isNavigating}
                    className="flex items-center gap-2.5 px-8 py-3.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-full shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    OK
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <span className="hidden sm:inline text-xs text-gray-400 mr-1">press Enter ↵</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
