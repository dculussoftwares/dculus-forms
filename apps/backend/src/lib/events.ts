/**
 * Event Bus - Centralized event system for plugin architecture
 *
 * Uses EventEmitter3 for high-performance typed event handling.
 * Plugins subscribe to events like 'form.submitted' and execute custom logic.
 */

import { EventEmitter } from 'eventemitter3';

// Define all supported event types and their payloads
export interface FormSubmittedEvent {
  formId: string;
  responseId: string;
  organizationId: string;
  data: Record<string, any>;
  submittedAt: Date;
}

export interface FormCreatedEvent {
  formId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
}

export interface FormUpdatedEvent {
  formId: string;
  organizationId: string;
  updatedById: string;
  updatedAt: Date;
}

/**
 * Global event bus singleton
 * All plugins and services use this instance to emit/listen to events
 */
export const eventBus = new EventEmitter();

// Enable detailed logging in development
if (process.env.NODE_ENV === 'development') {
  eventBus.on('form.submitted', (event: FormSubmittedEvent) => {
    console.log('🔔 Event emitted: form.submitted', {
      formId: event.formId,
      responseId: event.responseId,
      timestamp: event.submittedAt,
    });
  });
}

// Log event listener counts for debugging
export function getEventStats() {
  return {
    'form.submitted': eventBus.listenerCount('form.submitted'),
    'form.created': eventBus.listenerCount('form.created'),
    'form.updated': eventBus.listenerCount('form.updated'),
  };
}
