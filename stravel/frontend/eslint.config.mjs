import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// @typescript-eslint flat/recommended merges eslint-recommended overrides + TS rules
const tsRecommendedRules = (() => {
  const cfg = tsPlugin.configs['flat/recommended'];
  const rules = {};
  if (Array.isArray(cfg)) {
    cfg.forEach((c) => Object.assign(rules, c.rules ?? {}));
  } else {
    Object.assign(rules, cfg.rules ?? {});
  }
  return rules;
})();

export default [
  // Base config: TypeScript + React parsing + TS recommended + hooks rules
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tsRecommendedRules,
      // React hooks — the two essential rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Ban raw fetch() — all API calls must go through apiClient.ts which centralises
  // response.ok checking and auth headers. Exemptions via eslint-disable-next-line.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/apiClient.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use api.*() from services/apiClient.ts instead of raw fetch(). Raw fetch() bypasses response.ok checking and auth headers.',
        },
      ],
    },
  },
  // Hex-color enforcement: scoped to B2C design-token components and styles only.
  {
    files: [
      'src/components/layout/**/*.{ts,tsx}',
      'src/components/shared/**/*.{ts,tsx}',
      'src/styles/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute > Literal[value=/^#[0-9A-Fa-f]{3,8}$/]',
          message:
            'Hardcoded hex colors in JSX attributes are forbidden. Use CSS token classes or CSS variables instead.',
        },
        {
          selector:
            'JSXAttribute[name.name="style"] JSXExpressionContainer ObjectExpression Property > Literal[value=/^#[0-9A-Fa-f]{3,8}$/]',
          message:
            'Hardcoded hex colors in style props are forbidden. Use CSS token classes or CSS variables instead.',
        },
      ],
    },
  },
];
