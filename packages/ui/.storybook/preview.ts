import type { Preview, Decorator } from '@storybook/react';
import '../src/styles/globals.css';
import '../src/rich-text-editor/lexical-styles.css';

/* Apply / remove dark class on <html> when the theme toolbar changes */
const withDarkMode: Decorator = (Story, context) => {
  const isDark = context.globals.theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  return Story();
};

const preview: Preview = {
  decorators: [withDarkMode],
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app',   value: '#f7f7f8' },   // Typeform page bg
        { name: 'white', value: '#ffffff' },
        { name: 'dark',  value: '#1a141b' },
      ],
    },
    viewport: {
      viewports: {
        mobile:  { name: 'Mobile',         styles: { width: '375px',  height: '667px'  } },
        tablet:  { name: 'Tablet',         styles: { width: '768px',  height: '1024px' } },
        desktop: { name: 'Desktop',        styles: { width: '1024px', height: '768px'  } },
        large:   { name: 'Large Desktop',  styles: { width: '1440px', height: '900px'  } },
      },
      defaultViewport: 'large',
    },
  },
  globalTypes: {
    theme: {
      description: 'Light / Dark mode',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
