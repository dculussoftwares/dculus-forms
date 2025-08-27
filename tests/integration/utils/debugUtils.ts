/**
 * Debugging utilities for integration tests
 */

export interface DebugConfig {
  logRequests: boolean;
  logResponses: boolean;
  logTokens: boolean;
  logGraphQL: boolean;
  verbose: boolean;
}

export class DebugUtils {
  private static config: DebugConfig = {
    logRequests: process.env.DEBUG_REQUESTS === 'true',
    logResponses: process.env.DEBUG_RESPONSES === 'true',
    logTokens: process.env.DEBUG_TOKENS === 'true',
    logGraphQL: process.env.DEBUG_GRAPHQL === 'true',
    verbose: process.env.DEBUG_VERBOSE === 'true'
  };

  /**
   * Configure debug settings
   */
  static configure(config: Partial<DebugConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log HTTP request details
   */
  static logRequest(method: string, url: string, data?: any, headers?: any) {
    if (!this.config.logRequests) return;

    console.log(`\n🌐 HTTP Request:`);
    console.log(`   Method: ${method}`);
    console.log(`   URL: ${url}`);
    
    if (headers && this.config.verbose) {
      console.log(`   Headers:`, this.sanitizeHeaders(headers));
    }
    
    if (data && this.config.verbose) {
      console.log(`   Data:`, this.sanitizeData(data));
    }
  }

  /**
   * Log HTTP response details
   */
  static logResponse(status: number, data?: any, headers?: any) {
    if (!this.config.logResponses) return;

    console.log(`\n📥 HTTP Response:`);
    console.log(`   Status: ${status}`);
    
    if (headers && this.config.verbose) {
      console.log(`   Headers:`, this.sanitizeHeaders(headers));
    }
    
    if (data) {
      if (this.config.verbose) {
        console.log(`   Body:`, this.sanitizeResponseData(data));
      } else {
        console.log(`   Body: [${this.getDataSummary(data)}]`);
      }
    }
  }

  /**
   * Log GraphQL query/mutation details
   */
  static logGraphQL(operation: string, query: string, variables?: any, response?: any) {
    if (!this.config.logGraphQL) return;

    console.log(`\n🔍 GraphQL ${operation}:`);
    console.log(`   Query:`, query.replace(/\s+/g, ' ').trim());
    
    if (variables && Object.keys(variables).length > 0) {
      console.log(`   Variables:`, variables);
    }
    
    if (response) {
      if (response.errors) {
        console.log(`   Errors:`, response.errors.map((e: any) => e.message));
      }
      if (response.data && this.config.verbose) {
        console.log(`   Data:`, this.formatGraphQLData(response.data));
      }
    }
  }

  /**
   * Log authentication token information
   */
  static logTokenInfo(token: string | null, action: 'generated' | 'stored' | 'cleared' | 'used') {
    if (!this.config.logTokens) return;

    console.log(`\n🔐 Auth Token ${action}:`);
    
    if (token) {
      // Only show first and last few characters for security
      const masked = this.maskToken(token);
      console.log(`   Token: ${masked}`);
      
      if (this.config.verbose) {
        try {
          const decoded = this.decodeJWTPayload(token);
          if (decoded) {
            console.log(`   Decoded:`, {
              userId: decoded.sub || decoded.userId,
              email: decoded.email,
              exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'unknown',
              iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'unknown'
            });
          }
        } catch (error) {
          console.log(`   Decode error:`, error.message);
        }
      }
    } else {
      console.log(`   Token: null`);
    }
  }

  /**
   * Log test scenario information
   */
  static logScenario(scenarioName: string, step: string, details?: any) {
    console.log(`\n🧪 [${scenarioName}] ${step}`);
    
    if (details && this.config.verbose) {
      console.log(`   Details:`, details);
    }
  }

  /**
   * Log error with context
   */
  static logError(error: Error, context?: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
    
    if (context && this.config.verbose) {
      console.error(`   Context:`, context);
    }
  }

  /**
   * Create a test summary
   */
  static createTestSummary(results: any) {
    console.log(`\n📊 Test Summary:`);
    console.log(`   Total scenarios: ${results.total || 0}`);
    console.log(`   Passed: ${results.passed || 0}`);
    console.log(`   Failed: ${results.failed || 0}`);
    console.log(`   Skipped: ${results.skipped || 0}`);
    
    if (results.duration) {
      console.log(`   Duration: ${results.duration}ms`);
    }
  }

  /**
   * Private helper methods
   */
  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return data.length > 200 ? data.substring(0, 200) + '...' : data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key'];
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    return data;
  }

  private static sanitizeResponseData(data: any): any {
    if (typeof data === 'object' && data !== null) {
      // For large responses, show structure rather than full content
      if (JSON.stringify(data).length > 1000 && !this.config.verbose) {
        return this.getObjectStructure(data);
      }
    }
    
    return this.sanitizeData(data);
  }

  private static formatGraphQLData(data: any): any {
    if (Array.isArray(data)) {
      return `[${data.length} items]`;
    }
    
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      if (keys.length > 5) {
        return `{${keys.slice(0, 5).join(', ')}, ...${keys.length - 5} more}`;
      }
      return `{${keys.join(', ')}}`;
    }
    
    return data;
  }

  private static getDataSummary(data: any): string {
    if (typeof data === 'string') {
      return `string(${data.length})`;
    }
    
    if (Array.isArray(data)) {
      return `array(${data.length})`;
    }
    
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      return `object(${keys.length} keys)`;
    }
    
    return typeof data;
  }

  private static getObjectStructure(obj: any, depth = 0): any {
    if (depth > 2) return '[...]';
    
    if (Array.isArray(obj)) {
      return obj.length > 0 ? [this.getObjectStructure(obj[0], depth + 1)] : [];
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const structure: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'object') {
          structure[key] = this.getObjectStructure(value, depth + 1);
        } else {
          structure[key] = typeof value;
        }
      });
      return structure;
    }
    
    return typeof obj;
  }

  private static maskToken(token: string): string {
    if (token.length < 20) return '[MASKED]';
    return `${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
  }

  private static decodeJWTPayload(token: string): any | null {
    try {
      // Simple JWT decode (not verifying signature)
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }
}

// Export convenience functions
export const logRequest = DebugUtils.logRequest.bind(DebugUtils);
export const logResponse = DebugUtils.logResponse.bind(DebugUtils);
export const logGraphQL = DebugUtils.logGraphQL.bind(DebugUtils);
export const logTokenInfo = DebugUtils.logTokenInfo.bind(DebugUtils);
export const logScenario = DebugUtils.logScenario.bind(DebugUtils);
export const logError = DebugUtils.logError.bind(DebugUtils);