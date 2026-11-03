const SCOPE = ':is(.dculus-form-renderer, [data-radix-popper-content-wrapper]:has(> [data-dculus-ui]))';

/**
 * Tailwind's base layer sets its --tw-* defaults on `*, ::before, ::after`
 * and `::backdrop` — i.e. on the whole host page. Rewrite those rules so they
 * only reach elements inside the renderer's scope.
 */
const scopeTailwindBase = () => ({
  postcssPlugin: 'dculus-scope-tailwind-base',
  Rule(rule) {
    const selector = rule.selector.replace(/\s+/g, ' ').trim();
    if (selector === '*, ::before, ::after' || selector === '*, :before, :after') {
      rule.selector = `${SCOPE}, ${SCOPE} *, ${SCOPE} ::before, ${SCOPE} ::after`;
    } else if (selector === '::backdrop') {
      rule.selector = `${SCOPE} ::backdrop`;
    }
  },
});
scopeTailwindBase.postcss = true;

module.exports = {
  plugins: [require('tailwindcss'), scopeTailwindBase, require('autoprefixer')],
};
