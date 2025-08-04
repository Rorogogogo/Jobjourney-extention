import { withUI } from '@extension/ui';

export default withUI({
  content: ['index.html', 'src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        // JobJourney brand colors
        'jj-dark': '#1a1a1a',
        'jj-darker': '#000000',
      },
      gradients: {
        'jj-primary': 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      },
    },
  },
});
