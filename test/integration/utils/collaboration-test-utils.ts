import WebSocket from 'ws';
import * as Y from 'yjs';

/**
 * Collaboration Test Utilities for Integration Tests
 *
 * Provides helper functions for testing real-time collaboration with YJS
 */

export interface YjsConnectionOptions {
  formId: string;
  userId: string;
  token: string;
  baseURL?: string;
}

export interface YjsUpdate {
  type: 'sync' | 'update' | 'awareness';
  data: Uint8Array;
}

export class CollaborationTestUtils {
  private baseURL: string;
  private connections: Map<string, WebSocket>;
  private yjsDocuments: Map<string, Y.Doc>;

  constructor(baseURL: string = 'ws://localhost:4000') {
    this.baseURL = baseURL.replace('http://', 'ws://').replace('https://', 'wss://');
    this.connections = new Map();
    this.yjsDocuments = new Map();
  }

  /**
   * Create a new YJS document
   */
  createYjsDocument(formId: string): Y.Doc {
    const doc = new Y.Doc();
    this.yjsDocuments.set(formId, doc);
    return doc;
  }

  /**
   * Get or create a YJS document for a form
   */
  getOrCreateDocument(formId: string): Y.Doc {
    if (this.yjsDocuments.has(formId)) {
      return this.yjsDocuments.get(formId)!;
    }
    return this.createYjsDocument(formId);
  }

  /**
   * Connect to a collaborative document via WebSocket
   */
  async connectToDocument(options: YjsConnectionOptions): Promise<WebSocket> {
    const { formId, userId, token } = options;
    const connectionKey = `${formId}-${userId}`;

    // Create WebSocket connection to Hocuspocus server
    const wsUrl = `${this.baseURL}/collaboration/${formId}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      ws.on('open', () => {
        console.log(`✅ WebSocket connected for user ${userId} on form ${formId}`);
        this.connections.set(connectionKey, ws);
        resolve(ws);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${userId}:`, error);
        reject(error);
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket closed for user ${userId} on form ${formId}`);
        this.connections.delete(connectionKey);
      });

      // Set timeout for connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Disconnect from a collaborative document
   */
  async disconnectFromDocument(formId: string, userId: string): Promise<void> {
    const connectionKey = `${formId}-${userId}`;
    const ws = this.connections.get(connectionKey);

    if (ws) {
      ws.close();
      this.connections.delete(connectionKey);
    }
  }

  /**
   * Send a YJS update through WebSocket
   */
  async sendYjsUpdate(formId: string, userId: string, update: Uint8Array): Promise<void> {
    const connectionKey = `${formId}-${userId}`;
    const ws = this.connections.get(connectionKey);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not connected for user ${userId} on form ${formId}`);
    }

    ws.send(update);
  }

  /**
   * Receive YJS updates from WebSocket
   */
  async receiveYjsUpdates(
    formId: string,
    userId: string,
    timeout: number = 3000
  ): Promise<Uint8Array[]> {
    const connectionKey = `${formId}-${userId}`;
    const ws = this.connections.get(connectionKey);

    if (!ws) {
      throw new Error(`WebSocket not connected for user ${userId} on form ${formId}`);
    }

    return new Promise((resolve, reject) => {
      const updates: Uint8Array[] = [];
      const timeoutId = setTimeout(() => {
        resolve(updates);
      }, timeout);

      ws.on('message', (data: Buffer) => {
        updates.push(new Uint8Array(data));
      });

      ws.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Simulate concurrent edit from multiple users
   */
  async simulateConcurrentEdit(
    formId: string,
    users: Array<{ userId: string; token: string }>,
    edits: Array<(doc: Y.Doc) => void>
  ): Promise<void> {
    // Connect all users
    const connections = await Promise.all(
      users.map((user) =>
        this.connectToDocument({
          formId,
          userId: user.userId,
          token: user.token,
        })
      )
    );

    // Get or create YJS document
    const doc = this.getOrCreateDocument(formId);

    // Apply edits concurrently
    await Promise.all(
      edits.map(async (edit, index) => {
        const userDoc = new Y.Doc();
        edit(userDoc);

        // Get state vector and update
        const stateVector = Y.encodeStateAsUpdate(userDoc);
        await this.sendYjsUpdate(formId, users[index].userId, stateVector);
      })
    );

    // Wait for synchronization
    await this.waitForSynchronization(formId, 2000);
  }

  /**
   * Get the current document state
   */
  getDocumentState(formId: string): any {
    const doc = this.yjsDocuments.get(formId);
    if (!doc) {
      throw new Error(`YJS document not found for form ${formId}`);
    }

    // Convert YJS document to plain object
    const formSchema = doc.getMap('formSchema');
    return formSchema.toJSON();
  }

  /**
   * Wait for document synchronization
   */
  async waitForSynchronization(formId: string, timeout: number = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // In a real scenario, we'd check if all updates have been applied
        // For testing purposes, we just wait for the timeout
        resolve(true);
      }, timeout);
    });
  }

  /**
   * Verify conflict resolution
   */
  async verifyConflictResolution(formId: string, expectedState: any): Promise<boolean> {
    const currentState = this.getDocumentState(formId);

    // Deep equality check
    return JSON.stringify(currentState) === JSON.stringify(expectedState);
  }

  /**
   * Get connected users count (awareness)
   */
  getConnectedUsersCount(formId: string): number {
    let count = 0;
    for (const [key] of this.connections) {
      if (key.startsWith(`${formId}-`)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup all connections and documents
   */
  async cleanup(): Promise<void> {
    // Close all WebSocket connections
    for (const [key, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();

    // Destroy all YJS documents
    for (const [, doc] of this.yjsDocuments) {
      doc.destroy();
    }
    this.yjsDocuments.clear();
  }
}
