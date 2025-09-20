const common = require('./cucumber.js').default;

const coverageConfig = {
  ...common,
  format: [
    'progress-bar',
    'summary',
    '@cucumber/pretty-formatter'
  ],
  formatOptions: {
    ...common.formatOptions,
    snippetInterface: 'async-await'
  },
  // Increase timeout for coverage instrumentation overhead
  timeout: 120000, // 2 minutes per scenario
  retry: 0, // Don't retry with coverage to avoid double counting
  // Run sequentially to ensure proper coverage collection
  parallel: 1
};

module.exports = {
  default: coverageConfig
};