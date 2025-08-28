const common = {
  requireModule: ['ts-node/register'],
  require: [
    'test/e2e/support/world.ts',
    'test/e2e/support/hooks.ts',
    'test/e2e/step-definitions/*.steps.ts'
  ],
  format: [
    'summary',
    'progress-bar',
    '@cucumber/pretty-formatter',
    'html:test/e2e/reports/cucumber-report.html',
    'json:test/e2e/reports/cucumber-report.json'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  publishQuiet: true,
  parallel: 1,
  retry: 1
};

module.exports = {
  default: common
};