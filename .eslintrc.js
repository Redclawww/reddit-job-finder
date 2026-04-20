module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-unused-vars': 'off',
    'no-console': 'warn',
    'no-undef': 'off', // TypeScript handles this
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
