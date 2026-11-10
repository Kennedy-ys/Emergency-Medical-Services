import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'dev-dist', 'public/precache-map-tiles.js'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Screens written before the rebuild. They are replaced phase by phase
    // (docs/06-IMPLEMENTATION-PLAN.md), so their known problems are reported as
    // warnings instead of blocking CI. New code never goes in these folders.
    files: [
      'src/admin/**',
      'src/driver/**',
      'src/pages/**',
      'src/components/*.jsx',
      'src/utils/**',
      'src/hooks/useAdminStatus.js',
      'src/hooks/useDriverAuth.js',
    ],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
    },
  },
  {
    files: ['*.config.js', '*.cjs', 'supabase/tests/**'],
    languageOptions: { globals: globals.node },
  },
]
