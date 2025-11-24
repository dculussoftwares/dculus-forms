module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'test/e2e/support/world.ts',
      'test/e2e/support/hooks.ts',
      'test/e2e/steps/**/*.ts',
    ],
    format: ['progress'],
    paths: ['test/e2e/features/**/*.feature'],
    publishQuiet: true,
  },
};
