/**
 * Hello World External Plugin - Frontend Configuration UI
 *
 * This React component provides a user interface for configuring the plugin.
 * It will be dynamically loaded in the form builder when users configure the plugin.
 */

import React from 'react';

// Configuration interface (must match backend schema)
interface HelloWorldConfig {
  greeting?: string;
  showTimestamp?: boolean;
  showResponseData?: boolean;
  isEnabled?: boolean;
}

interface ConfigUIProps {
  config: HelloWorldConfig;
  onChange: (newConfig: HelloWorldConfig) => void;
}

/**
 * Configuration UI Component
 *
 * This component will be bundled as UMD and loaded dynamically
 * React is provided externally (not bundled)
 */
export default function HelloWorldConfigUI({ config, onChange }: ConfigUIProps) {
  const handleChange = (field: keyof HelloWorldConfig, value: any) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
        👋 Hello World Plugin Configuration
      </h3>

      {/* Greeting Input */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="greeting"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Greeting Message
        </label>
        <input
          id="greeting"
          type="text"
          value={config.greeting || 'Hello World'}
          onChange={(e) => handleChange('greeting', e.target.value)}
          placeholder="Enter your greeting message"
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
        <p
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          This message will be displayed in the console when a form is submitted
        </p>
      </div>

      {/* Show Timestamp Checkbox */}
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
            checked={config.showTimestamp ?? true}
            onChange={(e) => handleChange('showTimestamp', e.target.checked)}
            style={{
              marginRight: '8px',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#374151' }}>Show timestamp in logs</span>
        </label>
      </div>

      {/* Show Response Data Checkbox */}
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
            checked={config.showResponseData ?? true}
            onChange={(e) => handleChange('showResponseData', e.target.checked)}
            style={{
              marginRight: '8px',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#374151' }}>Show response data in logs</span>
        </label>
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
            ? '✅ Plugin is active and will trigger on form submissions'
            : '⚠️ Plugin is disabled and will not trigger'}
        </p>
      </div>

      {/* Preview */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#F9FAFB',
          borderRadius: '6px',
          border: '1px solid #E5E7EB',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 600,
            color: '#6B7280',
            marginBottom: '8px',
          }}
        >
          Preview:
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: '#111827',
            fontFamily: 'monospace',
          }}
        >
          👋 {(config.greeting || 'Hello World').toUpperCase()} - EXTERNAL PLUGIN!
        </p>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#EFF6FF',
          borderRadius: '6px',
          border: '1px solid #BFDBFE',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#1E40AF',
          }}
        >
          ℹ️ <strong>External Plugin:</strong> This plugin is loaded dynamically from an external
          source and demonstrates the bundle-based plugin architecture.
        </p>
      </div>
    </div>
  );
}
