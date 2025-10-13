/**
 * Webhook Notifier Plugin - Frontend Configuration UI
 *
 * Configuration form for webhook settings
 */

import React, { useState } from 'react';

// Configuration interface (must match backend schema)
interface WebhookConfig {
  webhookUrl?: string;
  method?: 'POST' | 'PUT';
  customHeaders?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  includeMetadata?: boolean;
  isEnabled?: boolean;
}

interface ConfigUIProps {
  config: WebhookConfig;
  onChange: (newConfig: WebhookConfig) => void;
}

export default function WebhookConfigUI({ config, onChange }: ConfigUIProps) {
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const handleChange = (field: keyof WebhookConfig, value: any) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const addHeader = () => {
    if (headerKey && headerValue) {
      onChange({
        ...config,
        customHeaders: {
          ...(config.customHeaders || {}),
          [headerKey]: headerValue,
        },
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...(config.customHeaders || {}) };
    delete newHeaders[key];
    onChange({
      ...config,
      customHeaders: newHeaders,
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
        🔔 Webhook Notifier Configuration
      </h3>

      {/* Webhook URL */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="webhookUrl"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Webhook URL *
        </label>
        <input
          id="webhookUrl"
          type="url"
          value={config.webhookUrl || ''}
          onChange={(e) => handleChange('webhookUrl', e.target.value)}
          placeholder="https://api.example.com/webhook"
          required
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
          The URL where form submission data will be sent
        </p>
      </div>

      {/* HTTP Method */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="method"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          HTTP Method
        </label>
        <select
          id="method"
          value={config.method || 'POST'}
          onChange={(e) => handleChange('method', e.target.value as 'POST' | 'PUT')}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
        >
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
        </select>
      </div>

      {/* Timeout */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="timeout"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Timeout (ms)
        </label>
        <input
          id="timeout"
          type="number"
          min="1000"
          max="30000"
          step="1000"
          value={config.timeout || 5000}
          onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
          Request timeout in milliseconds (1000-30000)
        </p>
      </div>

      {/* Retry Attempts */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="retryAttempts"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Retry Attempts
        </label>
        <input
          id="retryAttempts"
          type="number"
          min="0"
          max="5"
          value={config.retryAttempts ?? 3}
          onChange={(e) => handleChange('retryAttempts', parseInt(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
          Number of retry attempts on failure (0-5)
        </p>
      </div>

      {/* Custom Headers */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Custom Headers
        </label>

        {/* Existing Headers */}
        {config.customHeaders && Object.keys(config.customHeaders).length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            {Object.entries(config.customHeaders).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '4px',
                  marginBottom: '4px',
                }}
              >
                <code style={{ flex: 1, fontSize: '12px', color: '#1F2937' }}>
                  {key}: {value}
                </code>
                <button
                  onClick={() => removeHeader(key)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#DC2626',
                    backgroundColor: 'transparent',
                    border: '1px solid #FCA5A5',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Header */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Header name (e.g., Authorization)"
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Header value (e.g., Bearer token123)"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={addHeader}
            disabled={!headerKey || !headerValue}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              color: 'white',
              backgroundColor: headerKey && headerValue ? '#3B82F6' : '#9CA3AF',
              border: 'none',
              borderRadius: '6px',
              cursor: headerKey && headerValue ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            Add Header
          </button>
        </div>
      </div>

      {/* Include Metadata */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <input
            type="checkbox"
            checked={config.includeMetadata ?? true}
            onChange={(e) => handleChange('includeMetadata', e.target.checked)}
            style={{
              marginRight: '8px',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#374151' }}>Include form and organization metadata</span>
        </label>
        <p
          style={{
            marginTop: '4px',
            marginLeft: '24px',
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          Adds form title, organization name to the webhook payload
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <input
            type="checkbox"
            checked={config.isEnabled ?? true}
            onChange={(e) => handleChange('isEnabled', e.target.checked)}
            style={{
              marginRight: '8px',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#374151' }}>Enable plugin</span>
        </label>
        <p
          style={{
            marginTop: '4px',
            marginLeft: '24px',
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          {config.isEnabled ?? true
            ? '✅ Webhook will be sent on form submissions'
            : '⚠️ Plugin is disabled'}
        </p>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#DBEAFE',
          borderRadius: '6px',
          border: '1px solid #93C5FD',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#1E40AF',
          }}
        >
          ℹ️ <strong>How it works:</strong> When a form is submitted, this plugin will send a POST/PUT
          request to your webhook URL with the form submission data. Automatic retry with exponential
          backoff is included.
        </p>
      </div>
    </div>
  );
}
