const kthConfig = require('@kth/eslint-config-kth')

module.exports = [
  ...kthConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]
