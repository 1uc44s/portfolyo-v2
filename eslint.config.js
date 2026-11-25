import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

const sharedRules = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'prefer-const': 'error',
  // raw SQL yalnızca tagged template ile
  'no-restricted-properties': [
    'error',
    {
      property: '$queryRawUnsafe',
      message: 'YASAK: $queryRaw tagged template kullan.',
    },
    {
      property: '$executeRawUnsafe',
      message: 'YASAK: $executeRaw tagged template kullan.',
    },
  ],
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/uploads/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'backend/src/generated/**',
    ],
  },
  js.configs.recommended,

  // Node tarafı: backend, shared, kök scriptler
  {
    files: [
      'backend/**/*.{js,mjs}',
      'packages/**/*.{js,mjs}',
      'scripts/**/*.mjs',
      '*.{js,mjs}',
      'e2e/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...sharedRules,
      // güvenlik/seçim mantığında Math.random yasak
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Math.random yerine node:crypto randomInt/randomBytes kullan.',
        },
      ],
    },
  },

  // Frontend (React)
  {
    files: ['frontend/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...sharedRules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      // istisnasız yasak
      'react/no-danger': 'error',
      'react/jsx-no-target-blank': 'error',
    },
  },
  {
    files: ['frontend/*.config.js', 'frontend/scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  prettier,
];
