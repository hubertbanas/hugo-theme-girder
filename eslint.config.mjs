// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', '**/public/**', '**/resources/**', 'assets/vendor/**'],
  },
  eslint.configs.recommended,
  {
    // The pages' scripts (classic scripts, minified and fingerprinted by Hugo).
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      // The vendored libraries' globals: GLightbox (gallery) and Leaflet's L
      // (contact map).
      globals: { ...globals.browser, GLightbox: 'readonly', L: 'readonly' },
    },
  },
  {
    // The repo's checks, run by Node.
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  prettierConfig,
];
