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
  parallel: 4, // Run tests in parallel with 4 workers for production
  retry: 1, // Retry failed tests once
  timeout: 90000 // 90 second timeout per scenario (increased for remote backend)
};

module.exports = {
  default: common
};