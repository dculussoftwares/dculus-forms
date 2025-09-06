import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { FormRenderer } from '@dculus/ui';
import { deserializeFormSchema } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { GET_FORM_BY_SHORT_URL, SUBMIT_RESPONSE } from '../graphql/queries';
import ThankYouDisplay from '../components/ThankYouDisplay';

const FormViewer: React.FC = () => {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const cdnEndpoint = import.meta.env?.VITE_CDN_ENDPOINT as string | undefined;
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submissionMessage, setSubmissionMessage] = useState<string>('');
  const [thankYouData, setThankYouData] = useState<{message: string; isCustom: boolean} | null>(null);

  const { loading, error, data } = useQuery(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl: shortUrl || '' },
    skip: !shortUrl,
  });

  const [submitResponse] = useMutation(SUBMIT_RESPONSE);

  const handleFormSubmit = async (formId: string, responses: Record<string, unknown>) => {
    setSubmissionState('submitting');
    setSubmissionMessage('');
    
    try {
      const result = await submitResponse({
        variables: {
          input: {
            formId,
            data: responses,
          },
        },
      });
      
      const { thankYouMessage, showCustomThankYou } = result.data.submitResponse;
      
      setSubmissionState('success');
      setThankYouData({
        message: thankYouMessage,
        isCustom: showCustomThankYou
      });
    } catch (err: unknown) {
      console.error('Form submission error:', err);
      setSubmissionState('error');
      setSubmissionMessage(
        (err instanceof Error ? err.message : null) || 'An error occurred while submitting the form. Please try again.'
      );
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Form Not Found
          </h1>
          <p className="text-gray-600 mb-4">
            {error.message === 'Form is not published'
              ? 'This form is not yet published.'
              : "The form you're looking for doesn't exist or has been removed."}
          </p>
          <p className="text-sm text-gray-500">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  if (!data?.formByShortUrl) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Form Not Found
          </h1>
          <p className="text-gray-600">
            The form you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const form = data.formByShortUrl;

  // Check if form schema exists
  if (!form.formSchema) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Form Not Ready
          </h1>
          <p className="text-gray-600">
            This form is not yet configured. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  // Deserialize the form schema from the backend
  const formSchema = deserializeFormSchema(form.formSchema);

  if (!cdnEndpoint) {
    console.warn('No CDN endpoint found. Images may not load properly.');
  }

  // Show success message after submission
  if (submissionState === 'success' && thankYouData) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="w-full">
          <ThankYouDisplay 
            message={thankYouData.message}
            isCustom={thankYouData.isCustom}
          />
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setSubmissionState('idle');
                setThankYouData(null);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Submit Another Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render the form in fullscreen mode
  return (
    <div className="h-screen w-full">
      {/* Submission error message */}
      {submissionState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{submissionMessage}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setSubmissionState('idle')}
                className="text-red-800 hover:text-red-900"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <FormRenderer
        cdnEndpoint={cdnEndpoint}
        formSchema={formSchema}
        mode={RendererMode.SUBMISSION}
        className="h-full w-full"
        formId={form.id}
        onFormSubmit={handleFormSubmit}
      />
      
      {/* Loading overlay during submission */}
      {submissionState === 'submitting' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <p className="text-lg font-medium text-gray-900">Submitting...</p>
                <p className="text-sm text-gray-500">Please wait while we save your response.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormViewer;
