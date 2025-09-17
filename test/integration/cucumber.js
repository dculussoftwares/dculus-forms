const common = {
  requireModule: ['ts-node/register'],
  require: [
    'test/integration/support/world.ts',
    'test/integration/support/hooks.ts',
    'test/integration/step-definitions/common.steps.ts',
    'test/integration/step-definitions/*.steps.ts'
  ],
  format: [
    'progress-bar',
    'summary'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  publishQuiet: true,
  parallel: 1, // Run tests sequentially to avoid port conflicts
  retry: 1, // Retry failed tests once
  timeout: 60000 // 60 second timeout per scenario
};

module.exports = {
  default: common
};