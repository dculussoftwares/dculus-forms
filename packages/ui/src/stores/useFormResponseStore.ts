import React, { useMemo } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Type definitions for form response state
export interface FormResponseState {
  // Structure: pageId -> fieldId -> value
  responses: Record<string, Record<string, any>>;
  
  // Actions
  setFieldValue: (pageId: string, fieldId: string, value: any) => void;
  getFieldValue: (pageId: string, fieldId: string) => any;
  getPageResponses: (pageId: string) => Record<string, any>;
  getAllResponses: () => Record<string, Record<string, any>>;
  clearPageResponses: (pageId: string) => void;
  clearAllResponses: () => void;
  setPageResponses: (pageId: string, responses: Record<string, any>) => void;
  hasFieldValue: (pageId: string, fieldId: string) => boolean;
  getFieldValueCount: (pageId: string) => number;
}

// Create the Zustand store with DevTools support
export const useFormResponseStore = create<FormResponseState>()(
  devtools(
    (set, get) => ({
      responses: {},

      setFieldValue: (pageId: string, fieldId: string, value: any) => {
        set((state) => ({
          responses: {
            ...state.responses,
            [pageId]: {
              ...state.responses[pageId],
              [fieldId]: value,
            },
          },
        }), false, `setFieldValue: ${pageId}/${fieldId}`);
      },

      getFieldValue: (pageId: string, fieldId: string) => {
        const state = get();
        return state.responses[pageId]?.[fieldId];
      },

      getPageResponses: (pageId: string) => {
        const state = get();
        return state.responses[pageId] || {};
      },

      getAllResponses: () => {
        const state = get();
        return state.responses;
      },

      clearPageResponses: (pageId: string) => {
        set((state) => ({
          responses: {
            ...state.responses,
            [pageId]: {},
          },
        }), false, `clearPageResponses: ${pageId}`);
      },

      clearAllResponses: () => {
        set(
          { responses: {} },
          false,
          'clearAllResponses'
        );
      },

      setPageResponses: (pageId: string, responses: Record<string, any>) => {
        set((state) => ({
          responses: {
            ...state.responses,
            [pageId]: responses,
          },
        }), false, `setPageResponses: ${pageId}`);
      },

      hasFieldValue: (pageId: string, fieldId: string) => {
        const state = get();
        const value = state.responses[pageId]?.[fieldId];
        return value !== undefined && value !== null && value !== '';
      },

      getFieldValueCount: (pageId: string) => {
        const state = get();
        const pageResponses = state.responses[pageId] || {};
        return Object.keys(pageResponses).filter(fieldId => {
          const value = pageResponses[fieldId];
          return value !== undefined && value !== null && value !== '';
        }).length;
      },
    }),
    {
      name: 'form-response-store', // Name shown in DevTools
      serialize: {
        options: true,
      },
    }
  )
);

// Helper hook for easier access to form response utilities
export const useFormResponseUtils = () => {
  const store = useFormResponseStore();
  
  return useMemo(() => ({
    // Get all responses formatted for submission
    getFormattedResponses: () => {
      const allResponses = store.getAllResponses();
      const formatted: Record<string, any> = {};
      
      // Flatten the page/field structure for submission
      Object.entries(allResponses).forEach(([pageId, pageResponses]) => {
        Object.entries(pageResponses).forEach(([fieldId, value]) => {
          formatted[fieldId] = value;
        });
      });
      
      return formatted;
    },
    
    // Get completion status per page
    getPageCompletionStatus: (pageId: string, requiredFields: string[] = []) => {
      const pageResponses = store.getPageResponses(pageId);
      const completedFields = Object.keys(pageResponses).filter(fieldId => {
        const value = pageResponses[fieldId];
        return value !== undefined && value !== null && value !== '';
      });
      
      const requiredCompleted = requiredFields.filter(fieldId => 
        store.hasFieldValue(pageId, fieldId)
      );
      
      return {
        totalFields: Object.keys(pageResponses).length,
        completedFields: completedFields.length,
        requiredFields: requiredFields.length,
        requiredCompleted: requiredCompleted.length,
        isComplete: requiredFields.length === 0 || requiredCompleted.length === requiredFields.length,
      };
    },
    
    // Initialize responses from default values
    initializePageFromDefaults: (pageId: string, defaultValues: Record<string, any>) => {
      const currentResponses = store.getPageResponses(pageId);
      const mergedResponses = { ...defaultValues, ...currentResponses };
      store.setPageResponses(pageId, mergedResponses);
    },

  }), [store]);
};

// Development helper - expose store globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).formResponseStore = useFormResponseStore;
}