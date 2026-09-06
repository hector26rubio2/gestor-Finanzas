const ts = require('@typescript-eslint/parser');
const plugin = require('@typescript-eslint/eslint-plugin');
module.exports = [{ ignores: ['dist/**'] }, {
  files: ['**/*.ts'], languageOptions: { parser: ts }, plugins: { '@typescript-eslint': plugin },
  rules: { ...plugin.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'off' }
}];
