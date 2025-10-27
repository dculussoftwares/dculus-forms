/**
 * Collaborative Form Builder - Main Entry Point
 * 
 * This component orchestrates the collaborative form building experience
 * with real-time synchronization via YJS/Hocuspocus.
 * 
 * Features:
 * - Real-time multi-user collaboration
 * - Four main tabs: Layout, Page Builder, Preview, Settings
 * - Permission-based access control (VIEWER/EDITOR/OWNER)
 * - Drag-and-drop form building
 */


import React, { useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { FormPermissionProvider, type PermissionLevel } from '@/contexts/FormPermissionContext';
import { GET_FORM_BY_ID } from '@/graphql/formBuilder';
import { Card } from '@dculus/ui-v2';

type BuilderTab = 'layout' | 'page-builder' | 'preview' | 'settings';
const VALID_TABS: readonly BuilderTab[] = ['layout', 'page-builder', 'preview', 'settings'] as const;
const DEFAULT_TAB: BuilderTab = 'page-builder';

const CollaborativeFormBuilder: React.FC = () => {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();
  const navigate = useNavigate();

  // Fetch form metadata via GraphQL
  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
    errorPolicy: 'all',
  });

  // Connect to Zustand store with YJS collaboration
  const {
    isConnected,
    isLoading,
    pages,
    initializeCollaboration,
    disconnectCollaboration,
  } = useFormBuilderStore();

  // Validate and default tab
  const activeTab: BuilderTab = useMemo(() => {
    return tab && VALID_TABS.includes(tab as BuilderTab)
      ? (tab as BuilderTab)
      : DEFAULT_TAB;
  }, [tab]);

  // Redirect to default tab if none specified
  useEffect(() => {
    if (formId && !tab) {
      navigate(`/dashboard/form/${formId}/collaborate/${DEFAULT_TAB}`, { replace: true });
    }
  }, [formId, tab, navigate]);

  // Initialize YJS collaboration on mount
  useEffect(() => {
    if (!formId) return;

    initializeCollaboration(formId).catch((err) => {
      console.error('Failed to initialize collaboration:', err);
    });

    return () => {
      disconnectCollaboration();
    };
  }, [formId, initializeCollaboration, disconnectCollaboration]);

  // Setup drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Navigate to previous page
  const handleNavigateBack = useCallback(() => {
    navigate(`/dashboard/form/${formId}`);
  }, [formId, navigate]);

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">
              {isConnected ? 'Loading form data...' : 'Connecting to collaboration...'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md">
          <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Form</h2>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <button
            onClick={handleNavigateBack}
            className="mt-4 text-sm text-primary hover:underline"
          >
            ← Back to Dashboard
          </button>
        </Card>
      </div>
    );
  }

  // No form ID
  if (!formId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8">
          <h2 className="text-lg font-semibold mb-2">Form ID Required</h2>
          <p className="text-sm text-muted-foreground">Please provide a valid form ID to continue.</p>
        </Card>
      </div>
    );
  }

  const userPermission = (data?.form?.userPermission as PermissionLevel) || 'VIEWER';

  return (
    <FormPermissionProvider userPermission={userPermission}>
      <DndContext sensors={sensors}>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b bg-card">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleNavigateBack}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                  <h1 className="text-2xl font-bold">{data?.form?.title || 'Untitled Form'}</h1>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {pages.length} page{pages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Tab Content */}
          <main className="container mx-auto px-4 py-6">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-xl font-semibold">Active Tab: {activeTab}</h2>
                <p className="text-muted-foreground">
                  Form ID: {formId}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pages loaded: {pages.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Your permission: {userPermission}
                </p>
                <div className="mt-6">
                  <p className="text-sm text-muted-foreground">
                    Phase 1 Complete! 🎉
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Foundation is ready. Next: Implement tab components in Phase 2-6.
                  </p>
                </div>
              </div>
            </Card>
          </main>

          {/* Tab Navigation (Placeholder) */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Card className="px-6 py-3 shadow-lg">
              <div className="flex space-x-4">
                {VALID_TABS.map((tabId) => (
                  <button
                    key={tabId}
                    onClick={() => navigate(`/dashboard/form/${formId}/collaborate/${tabId}`)}
                    className={`px-4 py-2 text-sm rounded transition-colors ${
                      activeTab === tabId
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tabId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </DndContext>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
