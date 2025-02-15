function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    // Remove the following screen breakpoint or add other breakpoints
    // if one breakpoint is not enough for you
    screens: {
      sm: '640px',
    },

    extend: {
      textColor: {
        skin: {
          base: withOpacity('--color-text-base'),
          accent: withOpacity('--color-accent'),
          inverted: withOpacity('--color-fill'),
        },
      },
      backgroundColor: {
        skin: {
          fill: withOpacity('--color-fill'),
          accent: withOpacity('--color-accent'),
          inverted: withOpacity('--color-text-base'),
          card: withOpacity('--color-card'),
          'card-muted': withOpacity('--color-card-muted'),
        },
      },
      outlineColor: {
        skin: {
          fill: withOpacity('--color-accent'),
        },
      },
      borderColor: {
        skin: {
          line: withOpacity('--color-border'),
          fill: withOpacity('--color-text-base'),
          accent: withOpacity('--color-accent'),
        },
      },
      fill: {
        skin: {
          base: withOpacity('--color-text-base'),
          accent: withOpacity('--color-accent'),
        },
        transparent: 'transparent',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
      },

      typography: {
        DEFAULT: {
          css: {
            pre: {
              color: false,
            },
            code: {
              color: false,
            },
            // Override the default prose colors for math elements
            '.katex, .katex-display, .katex *': {
              color: 'rgb(var(--color-text-base))',
            },
            '.katex .katex-html .mord, .katex .katex-html .mop, .katex .katex-html .mbin, .katex .katex-html .mrel, .katex .katex-html .mopen, .katex .katex-html .mclose, .katex .katex-html .mpunct, .katex .katex-html .minner':
              {
                color: 'rgb(var(--color-text-base))',
              },
            // Handle fraction lines specifically
            '.katex .katex-html .frac-line': {
              borderColor: 'rgb(var(--color-text-base))',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
